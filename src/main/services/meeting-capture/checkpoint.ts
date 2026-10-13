import type {
  MeetingMarker,
  MeetingMarkerKind,
  MeetingPhase,
  PauseGap,
  PauseGapReason,
} from "@shared/ipc/types";
import type { LanguageState } from "./language-policy";
import type { LanguageChange } from "./meeting-repo";
import { segmentFileName, type CaptureSegment } from "./segments";

// 186 PR C1 — checkpoint `session.json` (research R12). THUẦN. Ghi mỗi 30 s + khi đóng phân đoạn (tmp→rename ở session-store);
// DB vẫn là nguồn sự thật cho metadata đã đóng — checkpoint phủ phần của phân đoạn đang mở. Tệp trên đĩa là dữ liệu KHÔNG tin
// cậy: mọi trường được kiểm, sai ⇒ null (không ném). Tên tệp phân đoạn phải đúng `seg-NNNN.wav` của chỉ số (chặn path traversal).

export const CHECKPOINT_VERSION = 1;

export interface MeetingCheckpoint {
  version: typeof CHECKPOINT_VERSION;
  sessionId: string;
  sourceId: string;
  phase: MeetingPhase;
  endedByUser: boolean;
  segments: CaptureSegment[];
  pauseGaps: PauseGap[];
  language: LanguageState;
  markers: MeetingMarker[];
  /** Dự trữ cho định dạng (v1 luôn 0 — draft.jsonl tự kiểm từng dòng khi đọc, không cần cắt theo offset). */
  draftOffset: number;
  savedAt: number;
}

const PHASES: readonly MeetingPhase[] = [
  "recording",
  "paused",
  "stopping",
  "finalizing",
  "interrupted",
  "incomplete",
  "done",
];
const GAP_REASONS: readonly PauseGapReason[] = [
  "user",
  "deviceLost",
  "interrupted",
];
const MARKER_KINDS: readonly MeetingMarkerKind[] = [
  "decision",
  "actionItem",
  "question",
];
const MODES = ["auto", "vi", "en", "multi"] as const;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isNonNeg = (v: unknown): v is number => isNum(v) && v >= 0;
const isInt = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0;
const isLang = (v: unknown): v is "vi" | "en" => v === "vi" || v === "en";

/** Mọi phần tử hợp lệ ⇒ mảng đã kiểm; một phần tử sai ⇒ null (checkpoint hỏng thì bỏ cả, không đoán). */
function arrayOf<T>(v: unknown, item: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const x of v) {
    const r = item(x);
    if (r === null) return null;
    out.push(r);
  }
  return out;
}

const segment = (v: unknown): CaptureSegment | null =>
  isObj(v) &&
  isInt(v["index"]) &&
  v["file"] === segmentFileName(v["index"]) &&
  isInt(v["samples"]) &&
  typeof v["closed"] === "boolean"
    ? {
        index: v["index"],
        file: v["file"],
        samples: v["samples"],
        closed: v["closed"],
      }
    : null;

const gap = (v: unknown): PauseGap | null =>
  isObj(v) &&
  isNonNeg(v["atSec"]) &&
  isNonNeg(v["wallSeconds"]) &&
  GAP_REASONS.includes(v["reason"] as PauseGapReason)
    ? {
        atSec: v["atSec"],
        wallSeconds: v["wallSeconds"],
        reason: v["reason"] as PauseGapReason,
      }
    : null;

const marker = (v: unknown): MeetingMarker | null =>
  isObj(v) &&
  typeof v["id"] === "string" &&
  SAFE_ID.test(v["id"]) &&
  MARKER_KINDS.includes(v["kind"] as MeetingMarkerKind) &&
  isNonNeg(v["tStart"]) &&
  isNum(v["tEnd"]) &&
  v["tEnd"] >= v["tStart"]
    ? {
        id: v["id"],
        kind: v["kind"] as MeetingMarkerKind,
        tStart: v["tStart"],
        tEnd: v["tEnd"],
      }
    : null;

const change = (v: unknown): LanguageChange | null =>
  isObj(v) &&
  isNonNeg(v["atSec"]) &&
  isLang(v["lang"]) &&
  (v["source"] === "auto" || v["source"] === "user")
    ? { atSec: v["atSec"], lang: v["lang"], source: v["source"] }
    : null;

const nullableLang = (v: unknown): "vi" | "en" | null | undefined =>
  v === null ? null : isLang(v) ? v : undefined;

function language(v: unknown): LanguageState | null {
  if (!isObj(v) || !MODES.includes(v["mode"] as (typeof MODES)[number]))
    return null;
  const locked = v["locked"];
  const lockedOk =
    locked === null ||
    (isObj(locked) &&
      isLang(locked["lang"]) &&
      (locked["source"] === "auto" || locked["source"] === "user"));
  const cand = v["candidate"];
  const candOk =
    cand === null ||
    (isObj(cand) &&
      isLang(cand["lang"]) &&
      Number.isInteger(cand["streak"]) &&
      (cand["streak"] as number) >= 1);
  const suggestion = nullableLang(v["suggestion"]);
  const dismissed = nullableLang(v["dismissed"]);
  const changes = arrayOf(v["changes"], change);
  if (
    !lockedOk ||
    !candOk ||
    suggestion === undefined ||
    dismissed === undefined ||
    !changes ||
    !isNonNeg(v["nextCheckSec"])
  )
    return null;
  return {
    mode: v["mode"] as LanguageState["mode"],
    locked: locked as LanguageState["locked"],
    candidate: cand as LanguageState["candidate"],
    suggestion,
    dismissed,
    changes,
    nextCheckSec: v["nextCheckSec"],
  };
}

export function serializeCheckpoint(c: MeetingCheckpoint): string {
  return JSON.stringify(c);
}

export function parseCheckpoint(raw: string): MeetingCheckpoint | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || v["version"] !== CHECKPOINT_VERSION) return null;
  const { sessionId, sourceId, phase, endedByUser } = v;
  const segments = arrayOf(v["segments"], segment);
  const pauseGaps = arrayOf(v["pauseGaps"], gap);
  const markers = arrayOf(v["markers"], marker);
  const lang = language(v["language"]);
  if (
    typeof sessionId !== "string" ||
    !SAFE_ID.test(sessionId) ||
    typeof sourceId !== "string" ||
    !SAFE_ID.test(sourceId) ||
    !PHASES.includes(phase as MeetingPhase) ||
    typeof endedByUser !== "boolean" ||
    !segments ||
    !pauseGaps ||
    !markers ||
    !lang ||
    !isInt(v["draftOffset"]) ||
    !isNonNeg(v["savedAt"])
  )
    return null;
  return {
    version: CHECKPOINT_VERSION,
    sessionId,
    sourceId,
    phase: phase as MeetingPhase,
    endedByUser,
    segments,
    pauseGaps,
    language: lang,
    markers,
    draftOffset: v["draftOffset"],
    savedAt: v["savedAt"],
  };
}

/**
 * Dựng checkpoint từ trạng thái phiên đang ghi. `markers` để trống: đánh dấu ghi thẳng DB ngay khi tạo (bền sẵn) — trường giữ
 * cho định dạng v1.
 */
export function checkpointOf(
  a: Pick<
    MeetingCheckpoint,
    "sessionId" | "sourceId" | "segments" | "pauseGaps"
  > & { lang: LanguageState },
  snap: Pick<MeetingCheckpoint, "phase" | "endedByUser">,
  savedAt: number,
): MeetingCheckpoint {
  return {
    version: CHECKPOINT_VERSION,
    sessionId: a.sessionId,
    sourceId: a.sourceId,
    phase: snap.phase,
    endedByUser: snap.endedByUser,
    segments: a.segments,
    pauseGaps: a.pauseGaps,
    language: a.lang,
    markers: [],
    draftOffset: 0,
    savedAt,
  };
}
