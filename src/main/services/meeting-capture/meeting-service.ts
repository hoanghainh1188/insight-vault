import type {
  LanguageMode,
  MeetingPrepareResult,
  MeetingStartInput,
  MeetingStartResult,
  MeetingState,
  MicStatus,
  PauseGap,
  Source,
} from "@shared/ipc/types";
import { UserFacingError } from "@shared/codes/user-error";
import type { MicGate } from "../app-shell/permissions";
import type { IngestionPipeline } from "../ingestion/pipeline";
import type { Segment } from "../ingestion/audio/audio-transcript";
import type { AsrErrorCode, AsrLanguage } from "./asr-protocol";
import { validateAudioBatch, type IngressState } from "./audio-ingress";
import { canStart, diskLevel, minutesRemaining } from "./disk-guard";
import {
  BYTES_PER_MIN,
  CHECKPOINT_SEC,
  FINAL_MODEL_SIZE_MB,
  FINAL_OVERLAP_SEC,
  NO_AUDIO_TIMEOUT_MS,
} from "./meeting-constants";
import type { MeetingRepo, MeetingSession } from "./meeting-repo";
import { buildMeetingTranscript } from "./meeting-transcript";
import {
  segmentFileName,
  segmentOffsets,
  segmentShouldRotate,
  toSegmentInfo,
  totalDurationSec,
  type SegmentRecord,
} from "./segments";
import {
  sessionTransition,
  type SessionEvent,
  type SessionSnapshot,
} from "./session-state";
import { shiftSegments, stitchSegments, type SegmentResult } from "./stitch";

// 186 — điều phối phiên ghi (research R4, R8, R12; data-model §5). Mọi I/O tiêm vào ⇒ unit-test không cần Electron/đĩa.
// Việc GHI tệp (writer) không phụ thuộc ASR (A3): ASR chốt chạy ở asr-worker sau khi kết thúc, tuần tự từng phiên.
// KHÔNG log nội dung (audio, transcript, tiêu đề) — Constitution III.

export class AsrError extends Error {
  constructor(readonly code: AsrErrorCode) {
    super(code);
    this.name = "AsrError";
  }
}

/** Ghi một phân đoạn WAV tăng dần (I/O ở capture-writer.ts). */
export interface SegmentWriter {
  /** Đưa PCM vào hàng ghi (không chờ đĩa). */
  append(bytes: Uint8Array): void;
  samples(): number;
  /** Ghi nốt + header đúng + fsync. Trả số mẫu. */
  close(): Promise<number>;
}

/** Thao tác tệp của phiên (I/O ở meeting-files.ts). Đường dẫn luôn nằm trong `meetingsRoot`. */
export interface MeetingFiles {
  meetingsRoot: string;
  segmentPath(sessionId: string, index: number): string;
  ensureSessionDir(sessionId: string): Promise<void>;
  openWriter(
    sessionId: string,
    index: number,
    onError: (e: unknown) => void,
  ): SegmentWriter;
  /** Sửa header phân đoạn ghi dở sau sự cố; trả danh sách với `samples` thật, mọi phân đoạn `closed`. */
  repairSegments(
    sessionId: string,
    segments: readonly SegmentRecord[],
  ): Promise<SegmentRecord[]>;
  readFinal(sessionId: string, index: number): Promise<Segment[] | null>;
  writeFinal(
    sessionId: string,
    index: number,
    segments: readonly Segment[],
  ): Promise<void>;
  mergeSegments(
    sessionId: string,
    segments: readonly SegmentRecord[],
  ): Promise<void>;
  deleteSegments(
    sessionId: string,
    segments: readonly SegmentRecord[],
  ): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export interface AsrFinalClient {
  /** Segment trả về có thời gian TƯƠNG ĐỐI đầu phân đoạn hiện tại (vùng ngữ cảnh của phân đoạn trước có giá trị âm). */
  final(req: {
    segmentPath: string;
    prevSegmentPath?: string;
    overlapSec: number;
    language: AsrLanguage;
  }): Promise<Segment[]>;
}

export interface MeetingServiceDeps {
  repo: MeetingRepo;
  pipeline: Pick<IngestionPipeline, "createMeetingSource" | "ingestParsed">;
  sources: {
    getById(id: string): Source | null;
    setTitle(id: string, title: string): void;
  };
  notebookExists(id: string): boolean;
  files: MeetingFiles;
  asr: AsrFinalClient;
  freeBytes(): Promise<number>;
  micGate: MicGate;
  mediaAccess: { status(): MicStatus; ask(): Promise<boolean> };
  isOnlineActive(): boolean;
  isModelReady(): Promise<boolean>;
  prefs: { get(key: string): unknown; set(key: string, value: unknown): void };
  push(webContentsId: number, state: MeetingState): void;
  emitProgress(sourceId: string, notebookId: string, frac: number): void;
  notifyReady(sourceId: string, notebookId: string, title: string): void;
  logEvent?(
    event: string,
    meta?: Record<string, string | number | boolean>,
  ): void;
  now(): number;
  uuid(): string;
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval>;
  clearInterval(handle: ReturnType<typeof setInterval>): void;
  segmentSeconds: number;
  sampleRate: number;
}

export interface MeetingService {
  prepare(senderId: number, input: unknown): Promise<MeetingPrepareResult>;
  start(senderId: number, input: unknown): Promise<MeetingStartResult>;
  acceptAudio(
    senderId: number,
    msg: { sessionId: unknown; seq: unknown; pcm: unknown },
  ): void;
  pause(senderId: number, input: unknown): Promise<MeetingState>;
  resume(senderId: number, input: unknown): Promise<MeetingState>;
  stop(senderId: number, input: unknown): Promise<{ sourceId: string }>;
  status(): MeetingState | null;
  rename(input: unknown): Promise<{ ok: true }>;
  onRendererGone(webContentsId: number): void;
  onSourceRemoved(sourceId: string): Promise<void>;
  isRecordingNotebook(notebookId: string): boolean;
  isActive(): boolean;
  recoverOnStartup(): Promise<void>;
  /** Chờ mọi việc I/O + hoàn tất đang xếp hàng (test, thoát app). */
  whenIdle(): Promise<void>;
  dispose(): void;
}

const LANGUAGE_MODES: readonly LanguageMode[] = ["auto", "vi", "en", "multi"];
const TITLE_MAX = 200;
const PREF_DEVICE = "meeting.lastDeviceLabel";
const PREF_LANGUAGE = "meeting.lastLanguageMode";
const UNFINISHED: MeetingSession["phase"][] = [
  "recording",
  "paused",
  "stopping",
  "finalizing",
  "interrupted",
];

interface Active {
  sessionId: string;
  sourceId: string;
  notebookId: string;
  title: string;
  ownerId: number;
  languageMode: LanguageMode;
  snap: SessionSnapshot;
  ingress: IngressState;
  writer: SegmentWriter | null;
  segments: SegmentRecord[];
  pauseGaps: PauseGap[];
  pausedAtWall: number | null;
  pauseReason: "user" | "deviceLost" | undefined;
  lastBatchAt: number;
  minutesRemaining: number;
  lastDiskCheck: number;
  lastPersist: number;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function cleanTitle(v: unknown): string {
  const t = typeof v === "string" ? v.trim() : "";
  if (t === "" || t.length > TITLE_MAX)
    throw new UserFacingError("meetingInvalidInput");
  return t;
}

function finalLanguage(mode: LanguageMode): AsrLanguage {
  return mode === "vi" || mode === "en" ? mode : null;
}

export function createMeetingService(deps: MeetingServiceDeps): MeetingService {
  const { repo, files, sampleRate } = deps;
  const segmentSamples = deps.segmentSeconds * sampleRate;
  let active: Active | null = null;
  let watchdog: ReturnType<typeof setInterval> | null = null;
  let ioChain: Promise<void> = Promise.resolve();
  let finalizeChain: Promise<void> = Promise.resolve();
  const removed = new Set<string>();

  const log = (
    event: string,
    meta?: Record<string, string | number | boolean>,
  ): void => deps.logEvent?.(event, meta);

  /** Việc I/O tuần tự; lỗi được ghi log (không nội dung) và không làm hỏng chuỗi. */
  const enqueueIo = (fn: () => Promise<void>): Promise<void> => {
    const run = ioChain.then(fn);
    ioChain = run.catch((e: unknown) =>
      log("meeting.ioError", { name: e instanceof Error ? e.name : "unknown" }),
    );
    return run;
  };

  const durationSec = (a: Active): number =>
    totalDurationSec(a.segments, sampleRate);

  const state = (a: Active): MeetingState => {
    const level = diskLevel(a.minutesRemaining);
    return {
      sessionId: a.sessionId,
      sourceId: a.sourceId,
      notebookId: a.notebookId,
      title: a.title,
      phase: a.snap.phase as MeetingState["phase"],
      durationSec: durationSec(a),
      segments: toSegmentInfo(a.segments, sampleRate),
      ...(a.snap.phase === "paused" && a.pauseReason
        ? { pauseReason: a.pauseReason }
        : {}),
      diskLevel: level === "stop" ? "urgent" : level,
      minutesRemaining: a.minutesRemaining,
      transcriptLagging: false,
      modelReady: true,
    };
  };

  const pushState = (a: Active): void => deps.push(a.ownerId, state(a));

  const persist = (a: Active): void => {
    a.lastPersist = deps.now();
    repo.update(a.sourceId, {
      phase: a.snap.phase,
      endedByUser: a.snap.endedByUser,
      segments: a.segments,
      pauseGaps: a.pauseGaps,
      durationMs: Math.round(durationSec(a) * 1000),
    });
  };

  const transition = (a: Active, event: SessionEvent): void => {
    const r = sessionTransition(a.snap, event);
    if (!r.ok) throw new UserFacingError("meetingInvalidInput");
    a.snap = r.state;
    a.ingress = { ...a.ingress, phase: r.state.phase };
  };

  const requireOwned = (senderId: number, input: unknown): Active => {
    const sid = isObj(input) ? str(input["sessionId"]) : null;
    if (!active || sid !== active.sessionId || senderId !== active.ownerId) {
      throw new UserFacingError("meetingNotFound");
    }
    return active;
  };

  const openSegment = (a: Active): void => {
    const index =
      a.segments.length === 0
        ? 0
        : (a.segments[a.segments.length - 1]?.index ?? -1) + 1;
    a.writer = files.openWriter(a.sessionId, index, (e) => onWriterError(a, e));
    a.segments = [
      ...a.segments,
      { index, file: segmentFileName(index), samples: 0, closed: false },
    ];
  };

  /** Đóng phân đoạn đang mở (chờ đĩa). */
  const closeSegment = async (a: Active): Promise<void> => {
    const w = a.writer;
    if (!w) return;
    a.writer = null;
    a.segments = a.segments.map((s, i) =>
      i === a.segments.length - 1 ? { ...s, closed: true } : s,
    );
    await enqueueIo(async () => {
      await w.close();
    });
  };

  const stopWatchdog = (): void => {
    if (watchdog !== null) deps.clearInterval(watchdog);
    watchdog = null;
  };

  const deactivate = (): void => {
    stopWatchdog();
    active = null;
    deps.micGate.disarm();
  };

  const queueFinalize = (sourceId: string): void => {
    finalizeChain = finalizeChain.then(() =>
      runFinalize(sourceId).catch((e: unknown) =>
        log("meeting.finalizeError", {
          name: e instanceof Error ? e.name : "unknown",
        }),
      ),
    );
  };

  /** Phiên bị cắt ngang (renderer chết / mất audio / lỗi ghi). PR A: tự kết thúc và hoàn tất (endedByUser=false). */
  const interruptAndFinalize = async (
    a: Active,
    cause: "rendererGone" | "noAudio" | "crash",
  ): Promise<void> => {
    if (active !== a) return;
    transition(a, { type: "interrupt", cause });
    deactivate();
    await closeSegment(a);
    transition(a, { type: "recover", action: "finalize" });
    persist(a);
    log("meeting.interrupted", { cause });
    queueFinalize(a.sourceId);
  };

  function onWriterError(a: Active, _e: unknown): void {
    void interruptAndFinalize(a, "crash");
  }

  const checkDisk = async (a: Active): Promise<void> => {
    const recordedBytes = durationSec(a) * sampleRate * 2;
    a.minutesRemaining = minutesRemaining({
      freeBytes: await deps.freeBytes(),
      recordedBytes,
      bytesPerMin: BYTES_PER_MIN,
    });
    if (
      active === a &&
      a.snap.phase === "recording" &&
      diskLevel(a.minutesRemaining) === "stop"
    ) {
      await stopActive(a, "diskFull");
    }
  };

  const stopActive = async (
    a: Active,
    cause: "user" | "diskFull" | "quitConfirmed",
  ): Promise<void> => {
    transition(a, { type: "stop", cause });
    deactivate();
    await closeSegment(a);
    transition(a, { type: "segmentsClosed" });
    persist(a);
    repo.update(a.sourceId, { endedAt: deps.now() });
    queueFinalize(a.sourceId);
  };

  async function runFinalize(sourceId: string): Promise<void> {
    const s = repo.get(sourceId);
    const src = deps.sources.getById(sourceId);
    if (!s || !src || removed.has(sourceId) || s.phase !== "finalizing") return;
    const offsets = segmentOffsets(s.segments, sampleRate);
    const offsetOf = new Map(
      s.segments.map((seg, i) => [seg.index, offsets[i] ?? 0]),
    );
    const withAudio = s.segments.filter((seg) => seg.samples > 0);
    const language = finalLanguage(s.languageMode);
    const results: SegmentResult[] = [];
    let failed = false;

    for (let k = 0; k < withAudio.length; k++) {
      if (removed.has(sourceId)) return;
      const seg = withAudio[k] as SegmentRecord;
      const startSec = offsetOf.get(seg.index) ?? 0;
      let abs = await files.readFinal(s.sessionId, seg.index);
      if (!abs) {
        const prev = k > 0 ? withAudio[k - 1] : undefined;
        try {
          const rel = await deps.asr.final({
            segmentPath: files.segmentPath(s.sessionId, seg.index),
            ...(prev
              ? { prevSegmentPath: files.segmentPath(s.sessionId, prev.index) }
              : {}),
            overlapSec: prev ? FINAL_OVERLAP_SEC : 0,
            language,
          });
          if (removed.has(sourceId)) return;
          abs = shiftSegments(rel, startSec);
          await files.writeFinal(s.sessionId, seg.index, abs);
        } catch (e) {
          log("meeting.asrFailed", {
            code: e instanceof AsrError ? e.code : "asrFailed",
          });
          failed = true;
          break;
        }
      }
      results.push({ startSec, segments: abs });
      repo.update(sourceId, { finalProgress: k + 1 });
      deps.emitProgress(
        sourceId,
        src.notebookId,
        (0.8 * (k + 1)) / withAudio.length,
      );
    }
    if (removed.has(sourceId)) return;

    await files.mergeSegments(s.sessionId, s.segments);
    const transcript = failed
      ? { text: "", spans: [], timeMap: [] }
      : buildMeetingTranscript(stitchSegments(results, FINAL_OVERLAP_SEC));
    repo.replaceSpans(sourceId, transcript.spans);
    const next = sessionTransition(
      { phase: s.phase, endedByUser: s.endedByUser },
      failed
        ? { type: "finalizeFailed" }
        : { type: "finalized", quality: "final" },
    );
    if (next.ok) {
      repo.update(sourceId, {
        phase: next.state.phase,
        transcriptQuality: failed ? null : "final",
      });
    }
    const ok = await deps.pipeline.ingestParsed(sourceId, {
      pages: [{ page: null, text: transcript.text }],
      pageCount: null,
      timeMap: transcript.timeMap,
    });
    if (!ok || removed.has(sourceId)) return;
    // Bản chốt đủ ⇒ phân đoạn không còn cần (meeting.wav là bản phát lại). Chưa hoàn thiện ⇒ giữ để "Hoàn tất transcript".
    if (!failed) await files.deleteSegments(s.sessionId, s.segments);
    deps.notifyReady(sourceId, src.notebookId, src.title);
  }

  const startWatchdog = (): void => {
    stopWatchdog();
    watchdog = deps.setInterval(() => {
      const a = active;
      if (!a || a.snap.phase !== "recording") return;
      if (deps.now() - a.lastBatchAt > NO_AUDIO_TIMEOUT_MS)
        void interruptAndFinalize(a, "noAudio");
    }, 1000);
  };

  return {
    async prepare(_senderId, input) {
      if (!isObj(input) || !str(input["notebookId"]))
        throw new UserFacingError("meetingInvalidInput");
      let micStatus = deps.mediaAccess.status();
      if (micStatus === "notDetermined")
        micStatus = (await deps.mediaAccess.ask()) ? "granted" : "denied";
      deps.micGate.arm();
      const minutes = minutesRemaining({
        freeBytes: await deps.freeBytes(),
        recordedBytes: 0,
        bytesPerMin: BYTES_PER_MIN,
      });
      const lastDevice = deps.prefs.get(PREF_DEVICE);
      const lastLanguage = deps.prefs.get(PREF_LANGUAGE);
      return {
        micStatus,
        modelReady: await deps.isModelReady(),
        modelSizeMb: FINAL_MODEL_SIZE_MB,
        minutesRemaining: minutes,
        canStart:
          micStatus !== "denied" &&
          micStatus !== "restricted" &&
          canStart(minutes) &&
          active === null,
        onlineActive: deps.isOnlineActive(),
        recordingActive: active !== null,
        ...(typeof lastDevice === "string"
          ? { lastDeviceLabel: lastDevice }
          : {}),
        ...(LANGUAGE_MODES.includes(lastLanguage as LanguageMode)
          ? { lastLanguageMode: lastLanguage as LanguageMode }
          : {}),
      };
    },

    async start(senderId, input) {
      if (!isObj(input)) throw new UserFacingError("meetingInvalidInput");
      const notebookId = str(input["notebookId"]);
      const languageMode = input[
        "languageMode"
      ] as MeetingStartInput["languageMode"];
      const deviceLabel = input["deviceLabel"];
      const title = cleanTitle(input["title"]);
      if (
        !notebookId ||
        !LANGUAGE_MODES.includes(languageMode) ||
        (deviceLabel !== undefined &&
          (typeof deviceLabel !== "string" || deviceLabel.length > TITLE_MAX))
      ) {
        throw new UserFacingError("meetingInvalidInput");
      }
      if (active) throw new UserFacingError("meetingAlreadyRecording");
      if (!deps.notebookExists(notebookId))
        throw new UserFacingError("notebookNotFound");
      const minutes = minutesRemaining({
        freeBytes: await deps.freeBytes(),
        recordedBytes: 0,
        bytesPerMin: BYTES_PER_MIN,
      });
      if (!canStart(minutes)) throw new UserFacingError("meetingDiskLow");

      const sessionId = deps.uuid();
      await files.ensureSessionDir(sessionId);
      const source = deps.pipeline.createMeetingSource({
        notebookId,
        title,
        sessionId,
      });
      const now = deps.now();
      repo.create({
        sourceId: source.id,
        sessionId,
        languageMode,
        ...(typeof deviceLabel === "string" ? { deviceLabel } : {}),
        startedAt: now,
      });
      const a: Active = {
        sessionId,
        sourceId: source.id,
        notebookId,
        title,
        ownerId: senderId,
        languageMode,
        snap: { phase: "recording", endedByUser: false },
        ingress: {
          sessionId,
          ownerId: senderId,
          phase: "recording",
          expectedSeq: 0,
          windowStartMs: 0,
          batchesInWindow: 0,
        },
        writer: null,
        segments: [],
        pauseGaps: [],
        pausedAtWall: null,
        pauseReason: undefined,
        lastBatchAt: now,
        minutesRemaining: minutes,
        lastDiskCheck: now,
        lastPersist: now,
      };
      openSegment(a);
      persist(a);
      active = a;
      if (typeof deviceLabel === "string")
        deps.prefs.set(PREF_DEVICE, deviceLabel);
      deps.prefs.set(PREF_LANGUAGE, languageMode);
      deps.micGate.disarm();
      startWatchdog();
      pushState(a);
      log("meeting.started", { languageMode });
      return { sessionId, sourceId: source.id };
    },

    acceptAudio(senderId, msg) {
      const a = active;
      const now = deps.now();
      const v = validateAudioBatch(
        a?.ingress ?? null,
        { senderId, ...msg },
        now,
      );
      if (!a) return;
      if (v.verdict === "rateLimited") {
        a.ingress = v.next;
        return;
      }
      if (v.verdict !== "accept" || !a.writer) return;
      a.ingress = v.next;
      a.lastBatchAt = now;
      if (v.gapBatches > 0) {
        a.pauseGaps = [
          ...a.pauseGaps,
          {
            atSec: durationSec(a),
            wallSeconds: v.gapBatches,
            reason: "interrupted",
          },
        ];
        persist(a);
      }
      a.writer.append(v.bytes);
      const last = a.segments.length - 1;
      const samples = (a.segments[last]?.samples ?? 0) + v.bytes.byteLength / 2;
      a.segments = a.segments.map((s, i) =>
        i === last ? { ...s, samples } : s,
      );
      if (segmentShouldRotate(samples, segmentSamples)) {
        void closeSegment(a);
        openSegment(a);
        persist(a);
      } else if (now - a.lastPersist >= CHECKPOINT_SEC * 1000) {
        persist(a);
      }
      if (now - a.lastDiskCheck >= CHECKPOINT_SEC * 1000) {
        a.lastDiskCheck = now;
        void checkDisk(a);
      }
      pushState(a);
    },

    async pause(senderId, input) {
      const a = requireOwned(senderId, input);
      const reason =
        isObj(input) && input["reason"] === "deviceLost"
          ? "deviceLost"
          : "user";
      transition(a, { type: "pause", reason });
      await closeSegment(a);
      a.pausedAtWall = deps.now();
      a.pauseReason = reason;
      persist(a);
      pushState(a);
      return state(a);
    },

    async resume(senderId, input) {
      const a = requireOwned(senderId, input);
      transition(a, { type: "resume" });
      deps.micGate.arm();
      const now = deps.now();
      const wallSeconds =
        a.pausedAtWall === null ? 0 : (now - a.pausedAtWall) / 1000;
      a.pauseGaps = [
        ...a.pauseGaps,
        {
          atSec: durationSec(a),
          wallSeconds,
          reason: a.pauseReason === "deviceLost" ? "deviceLost" : "user",
        },
      ];
      a.pausedAtWall = null;
      a.pauseReason = undefined;
      a.lastBatchAt = now;
      openSegment(a);
      persist(a);
      pushState(a);
      return state(a);
    },

    async stop(senderId, input) {
      const a = requireOwned(senderId, input);
      await stopActive(a, "user");
      return { sourceId: a.sourceId };
    },

    status: () => (active ? state(active) : null),

    async rename(input) {
      if (!isObj(input)) throw new UserFacingError("meetingInvalidInput");
      const sourceId = str(input["sourceId"]);
      const src = sourceId ? deps.sources.getById(sourceId) : null;
      if (!src || src.kind !== "meeting")
        throw new UserFacingError("meetingNotFound");
      const title = cleanTitle(input["title"]);
      deps.sources.setTitle(src.id, title);
      if (active?.sourceId === src.id) {
        active.title = title;
        pushState(active);
      }
      return { ok: true as const };
    },

    onRendererGone(webContentsId) {
      if (active && active.ownerId === webContentsId)
        void interruptAndFinalize(active, "rendererGone");
    },

    async onSourceRemoved(sourceId) {
      removed.add(sourceId);
      const s = repo.get(sourceId);
      if (active?.sourceId === sourceId) {
        const a = active;
        deactivate();
        await closeSegment(a);
      }
      if (s) await enqueueIo(() => files.deleteSession(s.sessionId));
    },

    isRecordingNotebook: (notebookId) => active?.notebookId === notebookId,
    isActive: () => active !== null,

    async recoverOnStartup() {
      for (const s of repo.listByPhase(UNFINISHED)) {
        const segments = await files.repairSegments(s.sessionId, s.segments);
        let snap: SessionSnapshot = {
          phase: s.phase,
          endedByUser: s.endedByUser,
        };
        const steps: SessionEvent[] =
          s.phase === "recording" || s.phase === "paused"
            ? [
                { type: "interrupt", cause: "crash" },
                { type: "recover", action: "finalize" },
              ]
            : s.phase === "stopping"
              ? [{ type: "segmentsClosed" }]
              : s.phase === "interrupted"
                ? [{ type: "recover", action: "finalize" }]
                : [];
        for (const e of steps) {
          const r = sessionTransition(snap, e);
          if (r.ok) snap = r.state;
        }
        repo.update(s.sourceId, {
          phase: snap.phase,
          endedByUser: snap.endedByUser,
          segments,
          durationMs: Math.round(totalDurationSec(segments, sampleRate) * 1000),
        });
        log("meeting.recovered", { from: s.phase });
        queueFinalize(s.sourceId);
      }
    },

    async whenIdle() {
      // Hoàn tất có thể sinh thêm I/O và ngược lại ⇒ chờ tới khi cả hai chuỗi ổn định.
      for (;;) {
        const io = ioChain;
        const fin = finalizeChain;
        await io;
        await fin;
        if (io === ioChain && fin === finalizeChain) return;
      }
    },

    dispose() {
      stopWatchdog();
    },
  };
}
