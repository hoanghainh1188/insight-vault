import type {
  CaptureSegmentInfo,
  MeetingDraftEvent,
  MeetingDraftLine,
} from "@shared/ipc/types";
import { mergeDraft } from "./draft-merge";

// 186 PR B — quy tắc THUẦN của màn transcript nháp (FR-020..FR-023). Không React, không I/O.

/** Áp một push meeting:draft: `full` thay toàn bộ (gắn lại sau reload); còn lại gộp theo id. Dòng rỗng = main thu hồi. */
export function applyDraftEvent(
  prev: readonly MeetingDraftLine[],
  ev: MeetingDraftEvent,
): readonly MeetingDraftLine[] {
  const merged = ev.full
    ? [...ev.windows].sort((a, b) => a.tStart - b.tStart)
    : mergeDraft(prev, ev.windows);
  return merged.some((l) => l.text === "")
    ? merged.filter((l) => l.text !== "")
    : merged;
}

/** Thời gian audio ⇒ phân đoạn để phát (`iv-media://…?seg=n`) + offset trong phân đoạn. */
export function playbackAt(
  segments: readonly CaptureSegmentInfo[],
  tSec: number,
): { seg: number; offsetSec: number } | null {
  if (!Number.isFinite(tSec) || tSec < 0) return null;
  let start = 0;
  for (const s of segments) {
    const end = start + s.durationSec;
    if (tSec <= end) return { seg: s.index, offsetSec: tSec - start };
    start = end;
  }
  return null;
}

/** Dòng nháp được bôi chọn ⇒ khoảng thời gian gắn đánh dấu (FR-027). */
export function selectionRange(
  lines: readonly MeetingDraftLine[],
  ids: readonly string[],
): { tStart: number; tEnd: number } | null {
  const picked = lines.filter((l) => ids.includes(l.id));
  if (picked.length === 0) return null;
  return {
    tStart: Math.min(...picked.map((l) => l.tStart)),
    tEnd: Math.max(...picked.map((l) => l.tEnd)),
  };
}
