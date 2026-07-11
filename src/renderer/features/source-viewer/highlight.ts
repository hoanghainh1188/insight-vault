import type { PageBreak } from "@shared/ipc/types";

// Chia toàn văn thành các đoạn để render: đoạn thường / đoạn highlight, kèm mốc trang. Hàm THUẦN.
// Render bằng React text node (không innerHTML) — chống XSS từ nội dung nguồn không tin cậy.

export interface Segment {
  text: string;
  kind: "plain" | "highlight";
  /** Nếu đoạn này bắt đầu một trang mới → số trang (chèn mốc "Trang N"). */
  pageMark?: number;
}

/**
 * Cắt `text` tại các mốc: `[charStart, charEnd)` (nếu có highlight hợp lệ) + offset các `pageBreaks`.
 * Highlight ngoài phạm vi / null (mở nguồn trực tiếp) → không có đoạn 'highlight' (phòng thủ, không crash).
 */
export function buildSegments(
  text: string,
  highlight: { charStart: number; charEnd: number } | null,
  pageBreaks: PageBreak[] = [],
): Segment[] {
  const len = text.length;
  const hl =
    highlight &&
    highlight.charStart >= 0 &&
    highlight.charEnd <= len &&
    highlight.charStart < highlight.charEnd
      ? highlight
      : null;

  const bounds = new Set<number>([0, len]);
  if (hl) {
    bounds.add(hl.charStart);
    bounds.add(hl.charEnd);
  }
  const pageAt = new Map<number, number>();
  for (const pb of pageBreaks) {
    if (pb.offset >= 0 && pb.offset <= len) {
      bounds.add(pb.offset);
      pageAt.set(pb.offset, pb.page);
    }
  }

  const sorted = [...bounds].sort((a, b) => a - b);
  const segs: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const inHl = hl != null && start >= hl.charStart && end <= hl.charEnd;
    const seg: Segment = {
      text: text.slice(start, end),
      kind: inHl ? "highlight" : "plain",
    };
    const mark = pageAt.get(start);
    if (mark !== undefined) seg.pageMark = mark;
    segs.push(seg);
  }
  return segs;
}
