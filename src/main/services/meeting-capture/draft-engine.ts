import type { MeetingDraftLine } from "@shared/ipc/types";
import type { DraftTier, WindowLanguage } from "./asr-protocol";
import { planDraftQueue, type AsrJob } from "./draft-queue";
import {
  fallbackFailed,
  fallbackNowReady,
  initialDraftPerf,
  recordDraftRtf,
  type DraftPerf,
} from "./draft-model-policy";
import type { DetectedLanguage, DetectedLanguageCode } from "./language-detect";
import { AsrError } from "./meeting-io";
import { isSpeechWindow } from "./vad";

// 186 PR B — bộ máy NHÁP của một phiên đang ghi (research R6, R7; ADR meeting-asr-spike mục 4–5). Không I/O trực tiếp: ASR,
// đẩy dòng, ghi draft.jsonl đều tiêm vào ⇒ unit-test không cần worker. Cửa sổ 10 s nối liền trên trục thời gian AUDIO (khoảng
// tạm dừng không tính); VAD bỏ cửa sổ im lặng; lượt 5 s cho dòng "Đang nhận dạng"; hàng việc một lượt chạy một lúc, tồn đọng
// bỏ cửa sổ cũ (bản chốt phủ); đo RTF từng cửa sổ đủ ⇒ tự hạ cấp model. Không log nội dung.

export interface DraftResult {
  segments: { text: string; tStart: number; tEnd: number }[];
  language: DetectedLanguageCode | null;
  confidence?: number;
  elapsedMs: number;
}

export interface DraftAsrClient {
  draft(req: {
    pcm: ArrayBuffer;
    language: WindowLanguage;
    tier: DraftTier;
  }): Promise<DraftResult>;
  detectPcm(req: { pcm: ArrayBuffer }): Promise<DetectedLanguage>;
  /** Huỷ mọi việc nháp đang chờ/chạy (phiên bị xoá) — không chặn hàng việc của bản chốt (review S2). */
  cancelDrafts(): void;
}

/** Dòng nháp đã xong ghi vào draft.jsonl (dự phòng khi bản chốt lỗi — data-model §3). */
export interface PersistedDraftLine {
  id: string;
  tStart: number;
  tEnd: number;
  text: string;
  lang: DetectedLanguageCode | null;
}

export interface DraftEngineDeps {
  asr: DraftAsrClient;
  sampleRate: number;
  windowSec: number;
  partialSec: number;
  /** Bật lượt 5 s lúc đầu phiên (tự tắt theo RTF). */
  partialPass: boolean;
  windowLanguage(): WindowLanguage;
  /** Chính sách ngôn ngữ (service) quyết có phát hiện ở mốc này không. */
  shouldDetect(speechSec: number, audioSec: number): boolean;
  onLines(lines: MeetingDraftLine[]): void;
  onLagging(lagging: boolean): void;
  onDetected(
    lang: DetectedLanguageCode,
    confidence: number,
    atSec: number,
  ): void;
  onModelMissing(): void;
  /** Model dự phòng đã có trên máy (chỉ khi đó mới hạ cấp — không tự tải giữa cuộc họp). */
  fallbackReady(): boolean;
  persistLine(line: PersistedDraftLine): void;
  log(event: string, meta?: Record<string, string | number | boolean>): void;
}

export interface DraftEngine {
  /** PCM16 mới nhất của phiên (liền sau mẫu trước đó trên trục thời gian audio). */
  push(pcm: Int16Array): void;
  /** Tạm dừng / kết thúc: phần dở của cửa sổ hiện tại thành một cửa sổ ngắn. */
  flush(): void;
  /** Sau khi tải model xong: nháp chạy lại; model dự phòng vừa có ⇒ cho phép hạ cấp. */
  resumeModel(): void;
  /**
   * Kết thúc phiên (review S1): phần dở thành cửa sổ cuối, không nhận PCM mới, bỏ phát hiện ngôn ngữ; các cửa sổ còn lại vẫn
   * chạy để draft.jsonl đủ cho dự phòng. Resolve khi hàng việc rỗng.
   */
  finish(): Promise<void>;
  /** Huỷ ngay (nguồn bị xoá): bỏ hàng việc, huỷ việc đang chạy ở worker. */
  stop(): void;
  lines(): MeetingDraftLine[];
  perf(): DraftPerf;
  lagging(): boolean;
  /** Số cửa sổ nháp bị bỏ do tồn đọng (chẩn đoán). */
  dropped(): number;
}

interface Job extends AsrJob {
  pcm: Int16Array;
  tStart: number;
  tEnd: number;
}

/** Ghép các lô thành một Int16Array liền (copy — lô gốc có thể bị tái dùng). */
function concat(chunks: readonly Int16Array[], total: number): Int16Array {
  const out = new Int16Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

const toBuffer = (pcm: Int16Array): ArrayBuffer =>
  pcm.buffer.slice(
    pcm.byteOffset,
    pcm.byteOffset + pcm.byteLength,
  ) as ArrayBuffer;

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

export function createDraftEngine(deps: DraftEngineDeps): DraftEngine {
  const sr = deps.sampleRate;
  const windowSamples = deps.windowSec * sr;
  const partialSamples = deps.partialSec * sr;
  const detectSamples = 30 * sr;

  let chunks: Int16Array[] = [];
  let buffered = 0;
  let windowIndex = 0;
  let windowStartSample = 0;
  let partialSent = false;

  let pending: Job[] = [];
  let running = false;
  let laggingFlag = false;
  let droppedCount = 0;
  let stopped = false;
  let modelMissing = false;
  let detectQueued = false;
  let ending = false;
  let onIdle: (() => void) | null = null;
  let perf = initialDraftPerf(deps.partialPass);
  let lineMap = new Map<string, MeetingDraftLine>();

  let speech: Int16Array[] = [];
  let speechSamples = 0;
  let speechSecTotal = 0;

  const emit = (line: MeetingDraftLine): void => {
    const next = new Map(lineMap);
    if (line.text === "") next.delete(line.id);
    else next.set(line.id, line);
    lineMap = next;
    deps.onLines([line]);
  };

  /** Giữ ≤ 30 s lời nói gần nhất cho phát hiện ngôn ngữ. */
  const rememberSpeech = (pcm: Int16Array): void => {
    speech = [...speech, pcm];
    speechSamples += pcm.length;
    while (
      speech.length > 1 &&
      speechSamples - (speech[0]?.length ?? 0) >= detectSamples
    ) {
      speechSamples -= speech[0]?.length ?? 0;
      speech = speech.slice(1);
    }
  };

  const recentSpeech = (): Int16Array => {
    const all = concat(speech, speechSamples);
    return all.length > detectSamples
      ? all.subarray(all.length - detectSamples)
      : all;
  };

  const runJob = async (job: Job): Promise<void> => {
    if (job.kind === "detect") {
      const r = await deps.asr.detectPcm({ pcm: toBuffer(job.pcm) });
      if (!stopped) deps.onDetected(r.language, r.confidence, job.tEnd);
      return;
    }
    const tier = perf.tier;
    const r = await deps.asr.draft({
      pcm: toBuffer(job.pcm),
      language: deps.windowLanguage(),
      tier,
    });
    if (stopped) return;
    const text = r.segments
      .map((s) => s.text.trim())
      .filter((t) => t !== "")
      .join(" ");
    // Review B2: chỉ cửa sổ ĐỦ độ dài mới là mẫu RTF (cửa sổ ngắn do tạm dừng có chi phí cố định cao ⇒ hạ cấp oan).
    if (!job.partial && job.tEnd - job.tStart >= deps.windowSec - 0.01) {
      const rtf = r.elapsedMs / 1000 / (job.tEnd - job.tStart);
      const window = [...perf.recent, rtf];
      const wasDowngraded = perf.downgraded;
      perf = recordDraftRtf(perf, rtf, deps.fallbackReady());
      if (perf.downgraded && !wasDowngraded) {
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        deps.log("meeting.draftDowngraded", { rtf: round3(avg) });
      }
    }
    const id = `w${job.window}`;
    const had = lineMap.has(id);
    if (text === "" && !had) return;
    // Lượt 5 s về sau lượt đủ (hiếm) ⇒ bỏ, không ghi đè dòng đã chốt nháp.
    if (job.partial && lineMap.get(id)?.pending === false) return;
    emit({
      id,
      tStart: job.tStart,
      tEnd: job.tEnd,
      text,
      pending: job.partial,
    });
    if (!job.partial && text !== "") {
      deps.persistLine({
        id,
        tStart: job.tStart,
        tEnd: job.tEnd,
        text,
        lang: r.language,
      });
    }
  };

  const onJobError = (job: Job, e: unknown): void => {
    const code = e instanceof AsrError ? e.code : "asrFailed";
    if (job.kind === "detect") {
      deps.log("meeting.languageDetectFailed", { code });
      return;
    }
    if (code === "modelMissing") {
      if (perf.tier === "fallback") {
        perf = fallbackFailed(perf);
        deps.log("meeting.draftFallbackUnavailable");
      } else if (!modelMissing) {
        modelMissing = true;
        pending = pending.filter((j) => j.kind !== "draft");
        deps.onModelMissing();
      }
    } else if (code !== "cancelled") {
      deps.log("meeting.draftFailed", { code });
    }
    // Dòng "Đang nhận dạng" của cửa sổ lỗi không được treo mãi.
    const id = `w${job.window}`;
    if (lineMap.get(id)?.pending)
      emit({ ...(lineMap.get(id) as MeetingDraftLine), text: "" });
  };

  const setLagging = (v: boolean): void => {
    if (v === laggingFlag) return;
    laggingFlag = v;
    deps.onLagging(v);
  };

  const pump = (): void => {
    if (running || stopped) return;
    const plan = planDraftQueue(pending, laggingFlag);
    droppedCount += plan.dropped.length;
    for (const w of plan.dropped) {
      const line = lineMap.get(`w${w}`);
      if (line?.pending) emit({ ...line, text: "" });
    }
    setLagging(plan.lagging);
    const [next, ...rest] = plan.ordered as Job[];
    pending = rest;
    if (!next) {
      onIdle?.();
      return;
    }
    if (next.kind === "detect") detectQueued = false;
    running = true;
    void runJob(next)
      .catch((e: unknown) => {
        if (!stopped) onJobError(next, e);
      })
      .finally(() => {
        running = false;
        if (next.kind === "detect") detectQueued = false;
        pump();
      });
  };

  const enqueue = (job: Job): void => {
    pending = [...pending, job];
    pump();
  };

  const canDraft = (): boolean => !stopped && !modelMissing;

  const closeWindow = (): void => {
    if (buffered === 0) return;
    const pcm = concat(chunks, buffered);
    const tStart = windowStartSample / sr;
    const tEnd = (windowStartSample + buffered) / sr;
    const index = windowIndex;
    windowIndex += 1;
    windowStartSample += buffered;
    chunks = [];
    buffered = 0;
    partialSent = false;
    if (!isSpeechWindow(pcm)) return;
    rememberSpeech(pcm);
    speechSecTotal += tEnd - tStart;
    if (canDraft())
      enqueue({
        kind: "draft",
        window: index,
        partial: false,
        pcm,
        tStart,
        tEnd,
      });
    if (
      !stopped &&
      !ending &&
      !detectQueued &&
      deps.shouldDetect(speechSecTotal, tEnd)
    ) {
      detectQueued = true;
      enqueue({
        kind: "detect",
        window: index,
        partial: false,
        pcm: recentSpeech(),
        tStart,
        tEnd,
      });
    }
  };

  const maybePartial = (): void => {
    if (
      partialSent ||
      !perf.partialPass ||
      !canDraft() ||
      buffered < partialSamples
    )
      return;
    partialSent = true;
    const pcm = concat(chunks, buffered).subarray(0, partialSamples);
    if (!isSpeechWindow(pcm)) return;
    const tStart = windowStartSample / sr;
    enqueue({
      kind: "draft",
      window: windowIndex,
      partial: true,
      pcm,
      tStart,
      tEnd: tStart + deps.partialSec,
    });
  };

  return {
    push(pcm) {
      if (stopped || ending) return;
      let off = 0;
      while (off < pcm.length) {
        const take = Math.min(pcm.length - off, windowSamples - buffered);
        chunks = [...chunks, pcm.slice(off, off + take)];
        buffered += take;
        off += take;
        maybePartial();
        if (buffered >= windowSamples) closeWindow();
      }
    },
    flush: () => closeWindow(),
    resumeModel() {
      modelMissing = false;
      if (deps.fallbackReady()) perf = fallbackNowReady(perf);
    },
    finish() {
      if (stopped) return Promise.resolve();
      closeWindow();
      ending = true;
      pending = pending.filter((j) => j.kind !== "detect");
      if (!running && pending.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        onIdle = resolve;
      });
    },
    stop() {
      stopped = true;
      pending = [];
      chunks = [];
      buffered = 0;
      deps.asr.cancelDrafts();
      onIdle?.();
    },
    lines: () => [...lineMap.values()],
    perf: () => perf,
    lagging: () => laggingFlag,
    dropped: () => droppedCount,
  };
}
