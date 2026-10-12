import { randomUUID } from "node:crypto";
import type { Segment } from "../ingestion/audio/audio-transcript";
import { parseWorkerMessage, type MainToWorker } from "./asr-protocol";
import type { DetectedLanguage } from "./language-detect";
import { AsrError, type AsrFinalClient } from "./meeting-service";

// 186 — phía main của asr-worker (utilityProcess, research R5). Fork LƯỜI ở yêu cầu đầu; khớp phản hồi theo reqId; mọi
// tin từ worker qua parseWorkerMessage. Worker chết ⇒ từ chối mọi yêu cầu đang chờ (asrFailed), fork lại ≤ 3 lần / 5 phút
// (sau đó từ chối ngay để không vòng lặp sập). Việc GHI audio không phụ thuộc client này (A3).

export interface UtilityProcessLike {
  postMessage(message: unknown): void;
  on(event: "message", cb: (message: unknown) => void): this;
  on(event: "exit", cb: (code: number) => void): this;
  kill(): boolean;
}

export interface AsrClientOptions {
  workerPath: string;
  meetingsRoot: string;
  cacheDir: string;
  finalModel: string;
  fake: boolean;
  fork(workerPath: string, args: string[]): UtilityProcessLike;
  onModelDownload(active: boolean): void;
  now?: () => number;
  /** Trần chờ một phân đoạn (mặc định 30 phút) — tránh treo vô hạn. */
  requestTimeoutMs?: number;
}

const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 5 * 60_000;

export function createAsrClient(
  opts: AsrClientOptions,
): AsrFinalClient & { dispose(): void } {
  const now = opts.now ?? Date.now;
  const timeoutMs = opts.requestTimeoutMs ?? 30 * 60_000;
  let child: UtilityProcessLike | null = null;
  let downloading = false;
  const forkTimes: number[] = [];
  // Mỗi yêu cầu chờ đúng MỘT loại trả lời (final ⇒ result, detect ⇒ language); loại khác cho cùng reqId bị bỏ qua.
  type Kind = "final" | "detect";
  interface Pending {
    kind: Kind;
    resolve: (v: unknown) => void;
    reject: (e: AsrError) => void;
    timer: ReturnType<typeof setTimeout>;
  }
  const pending = new Map<string, Pending>();

  const settle = (reqId: string, kind?: Kind): Pending | null => {
    const p = pending.get(reqId);
    if (!p || (kind && p.kind !== kind)) return null;
    clearTimeout(p.timer);
    pending.delete(reqId);
    return p;
  };

  const failAll = (code: "asrFailed" | "cancelled"): void => {
    for (const id of [...pending.keys()])
      settle(id)?.reject(new AsrError(code));
  };

  const setDownloading = (active: boolean): void => {
    if (downloading === active) return;
    downloading = active;
    opts.onModelDownload(active);
  };

  const ensureChild = (): UtilityProcessLike | null => {
    if (child) return child;
    const t = now();
    while (forkTimes.length > 0 && t - (forkTimes[0] ?? 0) >= RESTART_WINDOW_MS)
      forkTimes.shift();
    if (forkTimes.length > MAX_RESTARTS) return null;
    forkTimes.push(t);
    const c = opts.fork(opts.workerPath, [opts.meetingsRoot]);
    c.on("message", (raw) => {
      const m = parseWorkerMessage(raw);
      if (!m) return;
      if (m.type === "modelDownload") setDownloading(m.active);
      else if (m.type === "result")
        settle(m.reqId, "final")?.resolve(m.segments);
      else if (m.type === "language")
        settle(m.reqId, "detect")?.resolve({
          language: m.language,
          confidence: m.confidence,
        });
      else if (m.type === "error")
        settle(m.reqId)?.reject(new AsrError(m.code));
    });
    c.on("exit", () => {
      if (child === c) child = null;
      setDownloading(false);
      failAll("asrFailed");
    });
    const init: MainToWorker = {
      type: "init",
      cacheDir: opts.cacheDir,
      finalModel: opts.finalModel,
      fake: opts.fake,
    };
    c.postMessage(init);
    child = c;
    return c;
  };

  const request = <T>(
    kind: Kind,
    build: (reqId: string) => MainToWorker,
  ): Promise<T> => {
    const c = ensureChild();
    if (!c) return Promise.reject(new AsrError("asrFailed"));
    const reqId = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        settle(reqId)?.reject(new AsrError("asrFailed"));
        c.postMessage({ type: "cancel", reqId } satisfies MainToWorker);
      }, timeoutMs);
      pending.set(reqId, {
        kind,
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });
      c.postMessage(build(reqId));
    });
  };

  return {
    final(req) {
      return request<Segment[]>("final", (reqId) => ({
        type: "final",
        reqId,
        ...req,
      }));
    },
    detectLanguage(req) {
      return request<DetectedLanguage>("detect", (reqId) => ({
        type: "detect",
        reqId,
        segmentPath: req.segmentPath,
      }));
    },
    dispose() {
      failAll("cancelled");
      const c = child;
      child = null;
      c?.kill();
      setDownloading(false);
    },
  };
}
