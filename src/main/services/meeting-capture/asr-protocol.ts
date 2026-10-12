import { isAbsolute, relative, resolve } from "node:path";
import type { Segment } from "../ingestion/audio/audio-transcript";

// 186 — giao thức main ↔ asr-worker (utilityProcess, R5). THUẦN: mọi tin từ phía bên kia là dữ liệu không tin cậy.
// Worker CHỈ nhận đường dẫn nằm trong <userData>/meetings/ (kiểm cả hai phía).

export type AsrLanguage = "vi" | "en" | null;
export type AsrErrorCode = "asrFailed" | "modelMissing" | "cancelled";

export type MainToWorker =
  | { type: "init"; cacheDir: string; finalModel: string; fake: boolean }
  | {
      type: "final";
      reqId: string;
      segmentPath: string;
      prevSegmentPath?: string;
      overlapSec: number;
      language: AsrLanguage;
    }
  /** Phát hiện ngôn ngữ trên ≤ 30 s đầu của phân đoạn (ADR spike S2). */
  | { type: "detect"; reqId: string; segmentPath: string }
  | { type: "cancel"; reqId: string };

export type WorkerToMain =
  | { type: "ready" }
  | { type: "result"; reqId: string; segments: Segment[] }
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

function parseLanguage(v: unknown): AsrLanguage | undefined {
  return v === null || v === "vi" || v === "en" ? v : undefined;
}

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
        typeof raw["fake"] !== "boolean"
      )
        return null;
      return {
        type: "init",
        cacheDir: raw["cacheDir"],
        finalModel: raw["finalModel"],
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
