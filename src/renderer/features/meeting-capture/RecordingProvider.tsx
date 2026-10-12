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

// 186 — phiên ghi ở CẤP APP (đặt quanh RouterProvider — analyze P1): đổi notebook/route KHÔNG dừng micro. Giữ thu âm
// (mic-capture), số thứ tự lô, trạng thái đẩy từ main (meeting:state) và màn hoàn tất của phiên vừa kết thúc.
// Mọi quyết định (phiên hợp lệ, thời lượng, đĩa) ở main; renderer chỉ hiển thị + chuyển lô PCM.

export interface StartRequest {
  notebookId: string;
  title: string;
  languageMode: LanguageMode;
  deviceId?: string;
}

export interface FinalizingInfo {
  sourceId: string;
  notebookId: string;
  title: string;
  durationSec: number;
  openWhenDone: boolean;
  ready: boolean;
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
  resume(): Promise<void>;
  stop(): Promise<void>;
  rename(title: string): Promise<void>;
  setOpenWhenDone(v: boolean): void;
  dismissFinalizing(): void;
}

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function useRecording(): RecordingContextValue {
  const ctx = useContext(RecordingContext);
  if (!ctx)
    throw new Error("useRecording must be used inside RecordingProvider");
  return ctx;
}

/** Cho component tuỳ chọn (vd. test) — không ném khi thiếu provider. */
export function useRecordingOptional(): RecordingContextValue | null {
  return useContext(RecordingContext);
}

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
  const session = useRef<{
    sessionId: string;
    deviceId?: string;
    fakeTone: boolean;
  } | null>(null);

  // Trạng thái từ main + gắn lại sau reload (meeting:status).
  useEffect(() => {
    const off = window.api.onMeetingState((s) => setState(s));
    void window.api.meetingStatus().then((s) => setState((cur) => cur ?? s));
    return off;
  }, []);

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

  const openCapture = useCallback(
    async (
      sessionId: string,
      deviceId: string | undefined,
      fakeTone: boolean,
    ): Promise<MicCapture> =>
      startMicCapture({
        ...(deviceId ? { deviceId } : {}),
        fakeTone,
        onBatch: (pcm) =>
          window.api.meetingSendAudio({ sessionId, seq: seq.current++, pcm }),
        onEnded: () => {
          // D10 (rút thiết bị / mất quyền): tạm dừng để giữ dữ liệu; người dùng tiếp tục khi có micro.
          announce(t.t("meeting.a11y.deviceLost"), "assertive");
          capture.current = null;
          void window.api
            .meetingPause({ sessionId, reason: "deviceLost" })
            .then(setState, () => undefined);
        },
      }),
    [t],
  );

  const start = useCallback(
    async (req: StartRequest): Promise<StartOutcome> => {
      setBusy(true);
      let mic: MicCapture | null = null;
      try {
        // Mở lại cổng quyền ngay trước getUserMedia (cổng 15 s — người dùng có thể đã mở hộp lâu).
        const prep = await window.api.meetingPrepare({
          notebookId: req.notebookId,
        });
        const fakeTone = prep.testFakeMic === true;
        // Micro mở được TRƯỚC khi tạo nguồn (FR-005): lô đầu chỉ gửi sau khi có sessionId.
        const pending: ArrayBuffer[] = [];
        let sessionId: string | null = null;
        seq.current = 0;
        mic = await startMicCapture({
          ...(req.deviceId ? { deviceId: req.deviceId } : {}),
          fakeTone,
          onBatch: (pcm) => {
            if (sessionId)
              window.api.meetingSendAudio({
                sessionId,
                seq: seq.current++,
                pcm,
              });
            else pending.push(pcm);
          },
          onEnded: () => {
            announce(t.t("meeting.a11y.deviceLost"), "assertive");
            capture.current = null;
            if (sessionId) {
              void window.api
                .meetingPause({ sessionId, reason: "deviceLost" })
                .then(setState, () => undefined);
            }
          },
        });
        const started = await window.api.meetingStart({
          notebookId: req.notebookId,
          title: req.title,
          languageMode: req.languageMode,
          ...(mic.deviceLabel ? { deviceLabel: mic.deviceLabel } : {}),
        });
        sessionId = started.sessionId;
        for (const pcm of pending.splice(0)) {
          window.api.meetingSendAudio({ sessionId, seq: seq.current++, pcm });
        }
        capture.current = mic;
        session.current = {
          sessionId,
          ...(req.deviceId ? { deviceId: req.deviceId } : {}),
          fakeTone,
        };
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
    [t],
  );

  const pause = useCallback(async () => {
    const s = session.current;
    if (!s) return;
    setBusy(true);
    try {
      await capture.current?.stop(); // xả lô lẻ TRƯỚC khi main đóng phân đoạn
      capture.current = null;
      setState(
        await window.api.meetingPause({
          sessionId: s.sessionId,
          reason: "user",
        }),
      );
      announce(t.t("meeting.a11y.paused"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const resume = useCallback(async () => {
    const s = session.current;
    if (!s) return;
    setBusy(true);
    try {
      // Main mở cổng quyền + phân đoạn mới trước, rồi mới mở lại micro (D11: tạm dừng tắt micro thật).
      setState(await window.api.meetingResume({ sessionId: s.sessionId }));
      capture.current = await openCapture(s.sessionId, s.deviceId, s.fakeTone);
      announce(t.t("meeting.a11y.resumed"));
    } finally {
      setBusy(false);
    }
  }, [openCapture, t]);

  const stop = useCallback(async () => {
    const s = session.current;
    const cur = state;
    if (!s || !cur) return;
    setBusy(true);
    try {
      await capture.current?.stop();
      capture.current = null;
      const { sourceId } = await window.api.meetingStop({
        sessionId: s.sessionId,
      });
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
  }, [state, t]);

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

  const value = useMemo<RecordingContextValue>(
    () => ({
      state,
      finalizing,
      busy,
      start,
      pause,
      resume,
      stop,
      rename,
      setOpenWhenDone: (v) =>
        setFinalizing((f) => (f ? { ...f, openWhenDone: v } : f)),
      dismissFinalizing: () => setFinalizing(null),
    }),
    [state, finalizing, busy, start, pause, resume, stop, rename],
  );

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
}
