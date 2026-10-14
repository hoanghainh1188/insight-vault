import type { PauseGap } from "@shared/ipc/types";
import { formatDuration } from "@shared/meeting/format-duration";
import type { TextMatch } from "./transcript-search";

// 186 PR C2 (T140–T143) — quy tắc THUẦN của trình xem cuộc họp: cắt chữ một câu theo kết quả tìm (để tô), dựng văn bản sao chép
// có timestamp. Không React, không I/O.

export interface Span {
  charStart: number;
  charEnd: number;
  tStart: number;
  tEnd: number;
}

export interface Piece {
  text: string;
  /** Chỉ số kết quả tìm (để biết kết quả hiện tại); null = chữ thường. */
  match: number | null;
}

/** Chữ của câu `span` chia thành đoạn thường / đoạn trùng kết quả tìm (kết quả cắt theo ranh giới câu). */
export function splitSpan(
  text: string,
  span: Span,
  matches: readonly TextMatch[],
): Piece[] {
  const out: Piece[] = [];
  let at = span.charStart;
  matches.forEach((m, i) => {
    const from = Math.max(m.start, span.charStart);
    const to = Math.min(m.end, span.charEnd);
    if (to <= from) return;
    if (from > at) out.push({ text: text.slice(at, from), match: null });
    out.push({ text: text.slice(from, to), match: i });
    at = to;
  });
  if (at < span.charEnd)
    out.push({ text: text.slice(at, span.charEnd), match: null });
  return out;
}

/** Chỉ số câu chứa kết quả tìm thứ `i` (để cuộn tới). */
export function spanOfMatch(
  spans: readonly Span[],
  m: TextMatch | undefined,
): number {
  if (!m) return -1;
  return spans.findIndex((s) => m.start < s.charEnd && m.end > s.charStart);
}

/** Khoảng ngừng chèn TRƯỚC câu `i` (atSec nằm giữa đầu câu trước và đầu câu này). */
export function gapsBefore(
  spans: readonly Span[],
  gaps: readonly PauseGap[],
  i: number,
): PauseGap[] {
  const t = spans[i]?.tStart ?? Infinity;
  const prev = i === 0 ? -Infinity : (spans[i - 1]?.tStart ?? -Infinity);
  return gaps.filter((g) => g.atSec <= t && g.atSec > prev);
}

/** "[hh:mm:ss] câu" mỗi dòng, dòng tạm dừng chèn đúng chỗ — để sao chép transcript. */
export function plainTranscript(
  text: string,
  spans: readonly Span[],
  gaps: readonly PauseGap[],
  gapLabel: (g: PauseGap) => string,
): string {
  const lines: string[] = [];
  spans.forEach((s, i) => {
    for (const g of gapsBefore(spans, gaps, i)) lines.push(gapLabel(g));
    const line = text.slice(s.charStart, s.charEnd).replace(/\s+/g, " ").trim();
    if (line !== "") lines.push(`[${formatDuration(s.tStart)}] ${line}`);
  });
  const last = spans.at(-1)?.tStart ?? -Infinity;
  for (const g of gaps) if (g.atSec > last) lines.push(gapLabel(g));
  return lines.join("\n");
}
