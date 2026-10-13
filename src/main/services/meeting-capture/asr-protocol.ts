import { isAbsolute, relative, resolve } from "node:path";
import type { Segment } from "../ingestion/audio/audio-transcript";

// 186 — giao thức main ↔ asr-worker (utilityProcess, R5). THUẦN: mọi tin từ phía bên kia là dữ liệu không tin cậy.
// Worker CHỈ nhận đường dẫn nằm trong <userData>/meetings/ (kiểm cả hai phía).

export type AsrLanguage = "vi" | "en" | null;
/** "perWindow" = worker phát hiện ngôn ngữ trên từng cửa sổ ≤ 30 s rồi truyền tường minh (chế độ Đa ngôn ngữ / chưa khoá). */
export type WindowLanguage = "vi" | "en" | "perWindow";
export type AsrErrorCode = "asrFailed" | "modelMissing" | "cancelled";
/** primary = model chốt (nháp dùng chung, nạp một lần); fallback = model nhỏ khi máy chậm (ADR spike mục 4). */
export type DraftTier = "primary" | "fallback";

/** PCM gửi kèm tin tối đa 30 s PCM16 16 kHz mono (một lượt encoder Whisper). */
export const MAX_PCM_BYTES = 30 * 16_000 * 2;

export type MainToWorker =
  | {
      type: "init";
      cacheDir: string;
      finalModel: string;
      fallbackModel: string;
      fake: boolean;
    }
  | {
      type: "final";
      reqId: string;
      segmentPath: string;
      prevSegmentPath?: string;
      overlapSec: number;
      language: AsrLanguage | "perWindow";
    }
  /** Phát hiện ngôn ngữ trên ≤ 30 s đầu của phân đoạn (ADR spike S2). */
  | { type: "detect"; reqId: string; segmentPath: string }
  /** Phát hiện ngôn ngữ trên PCM gần đây khi đang ghi (R7: 30 s lời nói, đánh giá lại mỗi 120 s). */
  | { type: "detectPcm"; reqId: string; pcm: ArrayBuffer }
  /** Nháp một cửa sổ (PR B, R6). PCM do main gửi — không đọc tệp đang ghi. */
  | {
      type: "draft";
      reqId: string;
      pcm: ArrayBuffer;
      language: WindowLanguage;
      tier: DraftTier;
    }
  /** Nạp (tải lần đầu) model của tier — chỉ khi người dùng bấm "Tải model" (ADR meeting-asr-spike, quyết định 2026-10-13). */
  | { type: "load"; reqId: string; tier: DraftTier }
  | { type: "cancel"; reqId: string };

export type WorkerToMain =
  | { type: "ready" }
  | { type: "result"; reqId: string; segments: Segment[] }
  | { type: "loaded"; reqId: string }
  | {
      type: "draftResult";
      reqId: string;
      segments: Segment[];
      /** Ngôn ngữ đã dùng; null khi cửa sổ không có lời (VAD/khử ảo giác bỏ hết). */
      language: "vi" | "en" | null;
      /** Chỉ có khi worker tự phát hiện (perWindow). */
      confidence?: number;
      /** Thời gian xử lý (ms) — main tính RTF cho tự hạ cấp + chẩn đoán. */
      elapsedMs: number;
    }
  | {
      type: "language";
      reqId: string;
      language: "vi" | "en";
      confidence: number;
    }
  | { type: "progress"; reqId: string; frac: number }
  | { type: "modelDownload"; active: boolean }
  | { type: "error"; reqId: string; code: AsrErrorCode };

const ERROR_CODES: readonly AsrErrorCode[] = [
  "asrFailed",
  "modelMissing",
  "cancelled",
];
const MAX_OVERLAP_SEC = 30;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const isStr = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** `p` nằm TRONG `root` (không phải chính root, không thoát ra bằng ..), cả hai tuyệt đối. */
export function isInsideDir(root: string, p: string): boolean {
  if (!isAbsolute(root) || !isAbsolute(p)) return false;
  const rel = relative(resolve(root), resolve(p));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function parseLanguage(v: unknown): AsrLanguage | "perWindow" | undefined {
  return v === null || v === "vi" || v === "en" || v === "perWindow"
    ? v
    : undefined;
}

/** PCM16 hợp lệ: ArrayBuffer (structured clone), số byte chẵn, 0 < n ≤ MAX_PCM_BYTES. */
const isPcm = (v: unknown): v is ArrayBuffer =>
  v instanceof ArrayBuffer &&
  v.byteLength > 0 &&
  v.byteLength % 2 === 0 &&
  v.byteLength <= MAX_PCM_BYTES;

export function parseMainMessage(
  raw: unknown,
  meetingsRoot: string,
): MainToWorker | null {
  if (!isObj(raw)) return null;
  switch (raw["type"]) {
    case "init":
      if (
        !isStr(raw["cacheDir"]) ||
        !isStr(raw["finalModel"]) ||
        !isStr(raw["fallbackModel"]) ||
        typeof raw["fake"] !== "boolean"
      )
        return null;
      return {
        type: "init",
        cacheDir: raw["cacheDir"],
        finalModel: raw["finalModel"],
        fallbackModel: raw["fallbackModel"],
        fake: raw["fake"],
      };
    case "final": {
      const { reqId, segmentPath, prevSegmentPath, overlapSec } = raw;
      const language = parseLanguage(raw["language"]);
      if (
        !isStr(reqId) ||
        !isStr(segmentPath) ||
        !isInsideDir(meetingsRoot, segmentPath)
      )
        return null;
      if (
        prevSegmentPath !== undefined &&
        (!isStr(prevSegmentPath) || !isInsideDir(meetingsRoot, prevSegmentPath))
      ) {
        return null;
      }
      if (
        !isNum(overlapSec) ||
        overlapSec < 0 ||
        overlapSec > MAX_OVERLAP_SEC ||
        language === undefined
      )
        return null;
      return {
        type: "final",
        reqId,
        segmentPath,
        ...(prevSegmentPath !== undefined ? { prevSegmentPath } : {}),
        overlapSec,
        language,
      };
    }
    case "detect": {
      const { reqId, segmentPath } = raw;
      return isStr(reqId) &&
        isStr(segmentPath) &&
        isInsideDir(meetingsRoot, segmentPath)
        ? { type: "detect", reqId, segmentPath }
        : null;
    }
    case "detectPcm":
      return isStr(raw["reqId"]) && isPcm(raw["pcm"])
        ? { type: "detectPcm", reqId: raw["reqId"], pcm: raw["pcm"] }
        : null;
    case "draft": {
      const { reqId, pcm, language, tier } = raw;
      return isStr(reqId) &&
        isPcm(pcm) &&
        (language === "vi" || language === "en" || language === "perWindow") &&
        (tier === "primary" || tier === "fallback")
        ? { type: "draft", reqId, pcm, language, tier }
        : null;
    }
    case "load": {
      const { reqId, tier } = raw;
      return isStr(reqId) && (tier === "primary" || tier === "fallback")
        ? { type: "load", reqId, tier }
        : null;
    }
    case "cancel":
      return isStr(raw["reqId"])
        ? { type: "cancel", reqId: raw["reqId"] }
        : null;
    default:
      return null;
  }
}

function parseSegments(v: unknown): Segment[] | null {
  if (!Array.isArray(v)) return null;
  const out: Segment[] = [];
  for (const s of v) {
    if (
      !isObj(s) ||
      typeof s["text"] !== "string" ||
      !isNum(s["tStart"]) ||
      !isNum(s["tEnd"])
    )
      return null;
    if (s["tEnd"] < s["tStart"]) return null;
    out.push({ text: s["text"], tStart: s["tStart"], tEnd: s["tEnd"] });
  }
  return out;
}

export function parseWorkerMessage(raw: unknown): WorkerToMain | null {
  if (!isObj(raw)) return null;
  switch (raw["type"]) {
    case "ready":
      return { type: "ready" };
    case "result": {
      const segments = parseSegments(raw["segments"]);
      return isStr(raw["reqId"]) && segments
        ? { type: "result", reqId: raw["reqId"], segments }
        : null;
    }
    case "loaded":
      return isStr(raw["reqId"])
        ? { type: "loaded", reqId: raw["reqId"] }
        : null;
    case "draftResult": {
      const segments = parseSegments(raw["segments"]);
      const { reqId, language, confidence, elapsedMs } = raw;
      const confOk =
        confidence === undefined ||
        (isNum(confidence) && confidence >= 0 && confidence <= 1);
      return isStr(reqId) &&
        segments &&
        (language === null || language === "vi" || language === "en") &&
        confOk &&
        isNum(elapsedMs) &&
        elapsedMs >= 0
        ? {
            type: "draftResult",
            reqId,
            segments,
            language,
            ...(confidence !== undefined ? { confidence } : {}),
            elapsedMs,
          }
        : null;
    }
    case "language": {
      const { reqId, language, confidence } = raw;
      return isStr(reqId) &&
        (language === "vi" || language === "en") &&
        isNum(confidence) &&
        confidence >= 0 &&
        confidence <= 1
        ? { type: "language", reqId, language, confidence }
        : null;
    }
    case "progress": {
      const frac = raw["frac"];
      return isStr(raw["reqId"]) && isNum(frac) && frac >= 0 && frac <= 1
        ? { type: "progress", reqId: raw["reqId"], frac }
        : null;
    }
    case "modelDownload":
      return typeof raw["active"] === "boolean"
        ? { type: "modelDownload", active: raw["active"] }
        : null;
    case "error": {
      const code = raw["code"];
      return isStr(raw["reqId"]) && ERROR_CODES.includes(code as AsrErrorCode)
        ? { type: "error", reqId: raw["reqId"], code: code as AsrErrorCode }
        : null;
    }
    default:
      return null;
  }
}
