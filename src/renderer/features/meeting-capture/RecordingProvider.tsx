import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LanguageMode, MeetingState } from "@shared/ipc/types";
import { announce } from "../../shared/a11y/announcer";
import { useT } from "../../shared/i18n/i18n-context";
import {
  MicError,
  startMicCapture,
  type MicCapture,
} from "./capture/mic-capture";
import { publishLevel } from "./level-bus";
import { matchShortcut } from "./shortcuts";

// 186 — phiên ghi ở CẤP APP (đặt quanh RouterProvider — analyze P1): đổi notebook/route KHÔNG dừng micro. Giữ thu âm
// (mic-capture), số thứ tự lô, trạng thái đẩy từ main (meeting:state) và màn hoàn tất của phiên vừa kết thúc.
// Mọi quyết định (phiên hợp lệ, thời lượng, đĩa) ở main; renderer chỉ hiển thị + chuyển lô PCM.
// Review PR A: main tự kết thúc ⇒ tắt micro + màn hoàn tất có lý do (B1); Tiếp tục lỗi ⇒ quay về tạm dừng (B3); mất thiết
// bị ⇒ dừng hẳn capture (S2); lô chờ trước khi có phiên được xả theo nhịp ≤ 4 lô/giây, có trần (S7).

export interface StartRequest {
  notebookId: string;
  title: string;
  languageMode: LanguageMode;
  deviceId?: string;
}

export type EndReason = NonNullable<MeetingState["endReason"]>;

export interface FinalizingInfo {
  sourceId: string;
  notebookId: string;
  title: string;
  durationSec: number;
  openWhenDone: boolean;
  ready: boolean;
  endReason?: EndReason;
}

export type StartOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: "denied" | "notFound" | "failed" | "ipc";
      error?: unknown;
    };

interface RecordingContextValue {
  state: MeetingState | null;
  finalizing: FinalizingInfo | null;
  busy: boolean;
  start(req: StartRequest): Promise<StartOutcome>;
  pause(): Promise<void>;
  /** `deviceId` — sau khi mất thiết bị, tiếp tục cùng phiên với micro khác (T118). */
  resume(deviceId?: string): Promise<void>;
  /** Phím tắt Mod+Shift+M / Mod+Shift+E (T122): màn ghi lắng nghe bộ đếm này để mở menu đánh dấu / hộp kết thúc. */
  markRequest: number;
  endRequest: number;
  stop(): Promise<void>;
  rename(title: string): Promise<void>;
  setOpenWhenDone(v: boolean): void;
  dismissFinalizing(): void;
}

/** Lô chờ tối đa trước khi có sessionId (~8 s) và nhịp xả (khớp giới hạn 4 lô/giây ở main). */
export const PENDING_MAX = 8;
export const PENDING_FLUSH_MS = 260;

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function useRecording(): RecordingContextValue {
  const ctx = useContext(RecordingContext);
  if (!ctx)
    throw new Error("useRecording must be used inside RecordingProvider");
  return ctx;
}

interface Session {
  sessionId: string;
  deviceId?: string;
  fakeTone: boolean;
}

const isLive = (s: MeetingState | null): boolean =>
  s !== null && (s.phase === "recording" || s.phase === "paused");

export function RecordingProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const t = useT();
  const [state, setState] = useState<MeetingState | null>(null);
  const [finalizing, setFinalizing] = useState<FinalizingInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const capture = useRef<MicCapture | null>(null);
  const seq = useRef(0);
  const session = useRef<Session | null>(null);
  const stateRef = useRef<MeetingState | null>(null);
  stateRef.current = state;

  const stopCapture = useCallback(async (): Promise<void> => {
    const c = capture.current;
    capture.current = null;
    await c?.stop().catch(() => undefined);
  }, []);

  const send = (sessionId: string, pcm: ArrayBuffer): void =>
    window.api.meetingSendAudio({ sessionId, seq: seq.current++, pcm });

  /** Mất thiết bị/quyền (D10): dừng capture (xả lô lẻ) rồi tạm dừng phiên để giữ dữ liệu. */
  const onDeviceLost = useCallback(
    (sessionId: string) => {
      announce(t.t("meeting.a11y.deviceLost"), "assertive");
      void stopCapture().then(() =>
        window.api
          .meetingPause({ sessionId, reason: "deviceLost" })
          .then(setState, () => undefined),
      );
    },
    [stopCapture, t],
  );

  /** Mở micro cho phiên đã có sessionId. */
  const openCapture = useCallback(
    (s: Session): Promise<MicCapture> =>
      startMicCapture({
        ...(s.deviceId ? { deviceId: s.deviceId } : {}),
        fakeTone: s.fakeTone,
        onBatch: (pcm) => send(s.sessionId, pcm),
        onLevel: publishLevel,
        onEnded: () => onDeviceLost(s.sessionId),
      }),
    [onDeviceLost],
  );

  /**
   * Main tự kết thúc phiên ⇒ tắt micro. Đĩa đầy ⇒ màn hoàn tất có lý do; bị gián đoạn (renderer chết / mất audio / lỗi ghi —
   * PR C1) ⇒ KHÔNG hoàn tất: thẻ phục hồi ở cột Nguồn để người dùng chọn.
   */
  const onMainEnded = useCallback(
    (s: MeetingState) => {
      void stopCapture();
      session.current = null;
      setState(null);
      if (s.phase === "interrupted") {
        setFinalizing(null);
        if (s.endReason)
          announce(t.t(`meeting.ended.${s.endReason}`), "assertive");
        return;
      }
      setFinalizing({
        sourceId: s.sourceId,
        notebookId: s.notebookId,
        title: s.title,
        durationSec: s.durationSec,
        openWhenDone: false,
        ready: false,
        ...(s.endReason ? { endReason: s.endReason } : {}),
      });
      if (s.endReason)
        announce(t.t(`meeting.ended.${s.endReason}`), "assertive");
    },
    [stopCapture, t],
  );

  useEffect(() => {
    const off = window.api.onMeetingState((s) => {
      if (isLive(s)) setState(s);
      else if (s.endReason && stateRef.current?.sessionId === s.sessionId)
        onMainEnded(s);
    });
    void window.api.meetingStatus().then((s) => setState((cur) => cur ?? s));
    return off;
  }, [onMainEnded]);

  // Nguồn của màn hoàn tất chuyển ready ⇒ đánh dấu xong + thông báo (D15).
  useEffect(() => {
    if (!finalizing || finalizing.ready) return;
    return window.api.onSourceProgress((e) => {
      if (e.sourceId !== finalizing.sourceId || e.status !== "ready") return;
      setFinalizing((f) =>
        f && f.sourceId === e.sourceId ? { ...f, ready: true } : f,
      );
      announce(t.t("meeting.a11y.ready", { title: finalizing.title }));
    });
  }, [finalizing, t]);

  const start = useCallback(
    async (req: StartRequest): Promise<StartOutcome> => {
      setBusy(true);
      let mic: MicCapture | null = null;
      try {
        // Mở lại cổng quyền ngay trước getUserMedia (cổng ngắn, dùng một lần — review M1).
        const prep = await window.api.meetingPrepare({
          notebookId: req.notebookId,
        });
        const fakeTone = prep.testFakeMic === true;
        // Micro mở được TRƯỚC khi tạo nguồn (FR-005): lô đến trước khi có sessionId được giữ (có trần) rồi xả theo nhịp.
        const pending: ArrayBuffer[] = [];
        let sessionId: string | null = null;
        let endedEarly = false;
        seq.current = 0;
        mic = await startMicCapture({
          ...(req.deviceId ? { deviceId: req.deviceId } : {}),
          fakeTone,
          onBatch: (pcm) => {
            if (sessionId) send(sessionId, pcm);
            else if (pending.length < PENDING_MAX) pending.push(pcm);
          },
          onLevel: publishLevel,
          onEnded: () => {
            if (sessionId) onDeviceLost(sessionId);
            else endedEarly = true;
          },
        });
        const started = await window.api.meetingStart({
          notebookId: req.notebookId,
          title: req.title,
          languageMode: req.languageMode,
          ...(mic.deviceLabel ? { deviceLabel: mic.deviceLabel } : {}),
        });
        const sid = started.sessionId;
        session.current = {
          sessionId: sid,
          ...(req.deviceId ? { deviceId: req.deviceId } : {}),
          fakeTone,
        };
        capture.current = mic;
        // Xả lô chờ theo nhịp (không vượt giới hạn tần suất ở main), rồi chuyển sang gửi thẳng.
        const flush = (): void => {
          const pcm = pending.shift();
          if (pcm) {
            send(sid, pcm);
            setTimeout(flush, PENDING_FLUSH_MS);
          } else {
            sessionId = sid;
          }
        };
        flush();
        if (endedEarly) onDeviceLost(sid);
        setFinalizing(null);
        announce(t.t("meeting.a11y.started"));
        return { ok: true };
      } catch (e) {
        await mic?.stop().catch(() => undefined);
        if (e instanceof MicError) return { ok: false, reason: e.code };
        return { ok: false, reason: "ipc", error: e };
      } finally {
        setBusy(false);
      }
    },
    [onDeviceLost, t],
  );

  /** Phiên hiện hành — kể cả sau khi tải lại trang (session.current mất) dùng sessionId từ main (N2). */
  const currentSessionId = (): string | null =>
    session.current?.sessionId ?? stateRef.current?.sessionId ?? null;

  const pause = useCallback(async () => {
    const sid = currentSessionId();
    if (!sid) return;
    setBusy(true);
    try {
      await stopCapture(); // xả lô lẻ TRƯỚC khi main đóng phân đoạn
      setState(
        await window.api.meetingPause({ sessionId: sid, reason: "user" }),
      );
      announce(t.t("meeting.a11y.paused"));
    } finally {
      setBusy(false);
    }
  }, [stopCapture, t]);

  const resume = useCallback(
    async (deviceId?: string) => {
      const sid = currentSessionId();
      if (!sid) return;
      setBusy(true);
      try {
        // Main mở cổng quyền + phân đoạn mới trước, rồi mới mở lại micro (D11: tạm dừng tắt micro thật).
        setState(await window.api.meetingResume({ sessionId: sid }));
        const prev: Session = session.current ?? {
          sessionId: sid,
          fakeTone:
            (
              await window.api.meetingPrepare({
                notebookId: stateRef.current?.notebookId ?? "",
              })
            ).testFakeMic === true,
        };
        const s: Session = deviceId ? { ...prev, deviceId } : prev;
        session.current = s;
        try {
          capture.current = await openCapture(s);
          announce(t.t("meeting.a11y.resumed"));
        } catch {
          // B3: không mở được micro ⇒ quay về tạm dừng (giữ phiên) thay vì để main coi là mất audio.
          announce(t.t("meeting.a11y.deviceLost"), "assertive");
          setState(
            await window.api.meetingPause({
              sessionId: sid,
              reason: "deviceLost",
            }),
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [openCapture, t],
  );

  const stop = useCallback(async () => {
    const sid = currentSessionId();
    const cur = stateRef.current;
    if (!sid || !cur) return;
    setBusy(true);
    try {
      await stopCapture();
      const { sourceId } = await window.api.meetingStop({ sessionId: sid });
      session.current = null;
      setState(null);
      setFinalizing({
        sourceId,
        notebookId: cur.notebookId,
        title: cur.title,
        durationSec: cur.durationSec,
        openWhenDone: false,
        ready: false,
      });
      announce(t.t("meeting.a11y.ended"));
    } finally {
      setBusy(false);
    }
  }, [stopCapture, t]);

  const rename = useCallback(
    async (title: string) => {
      const sourceId = finalizing?.sourceId ?? state?.sourceId;
      if (!sourceId) return;
      await window.api.meetingRename({ sourceId, title });
      setFinalizing((f) =>
        f && f.sourceId === sourceId ? { ...f, title: title.trim() } : f,
      );
    },
    [finalizing, state],
  );

  // T122: phím tắt khi app focus (Mod+Shift+P/M/E) — có phiên mới nghe.
  const [markRequest, setMarkRequest] = useState(0);
  const [endRequest, setEndRequest] = useState(0);
  const live = isLive(state);
  useEffect(() => {
    if (!live) return;
    const platform = window.api.platform;
    const onKey = (e: KeyboardEvent): void => {
      const action = matchShortcut(e, platform);
      if (!action) return;
      e.preventDefault();
      if (action === "togglePause") {
        if (stateRef.current?.phase === "paused") void resume();
        else void pause();
      } else if (action === "mark") setMarkRequest((n) => n + 1);
      else setEndRequest((n) => n + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, pause, resume]);

  const value = useMemo<RecordingContextValue>(
    () => ({
      state,
      finalizing,
      busy,
      start,
      pause,
      resume,
      markRequest,
      endRequest,
      stop,
      rename,
      setOpenWhenDone: (v) =>
        setFinalizing((f) => (f ? { ...f, openWhenDone: v } : f)),
      dismissFinalizing: () => setFinalizing(null),
    }),
    [
      state,
      finalizing,
      busy,
      start,
      pause,
      resume,
      markRequest,
      endRequest,
      stop,
      rename,
    ],
  );

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
}
