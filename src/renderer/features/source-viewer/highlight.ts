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
  const valid =
    highlight &&
    highlight.charStart >= 0 &&
    highlight.charEnd <= len &&
    highlight.charStart < highlight.charEnd
      ? highlight
      : null;
  const hl = valid ? alignStart(text, trimRange(text, valid)) : null;

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

/**
 * 157: bỏ khoảng trắng/xuống dòng ở hai đầu vùng tô sáng — chunk thường mở đầu bằng "\n\n" sau câu trước, khiến nhãn [n]
 * neo vào mảnh inline rỗng ở cuối dòng trước (dựng dọc, đè chữ). Vùng toàn khoảng trắng ⇒ giữ nguyên.
 */
function trimRange(
  text: string,
  r: { charStart: number; charEnd: number },
): { charStart: number; charEnd: number } {
  let start = r.charStart;
  let end = r.charEnd;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return start < end ? { charStart: start, charEnd: end } : r;
}

/** Ký tự thuộc một chữ (chữ cái mọi ngôn ngữ, dấu kết hợp, chữ số). */
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;

/** Đuôi đoạn trước dài tối đa bao nhiêu ký tự thì được bỏ qua (vd "e." của "sauce."). */
const TAIL_MAX = 40;

/**
 * 159 (phần hiển thị): chunk chồng lấn có thể bắt đầu GIỮA CHỮ (chunker lùi overlap theo ký tự thô). Không tô một mảnh chữ:
 * - mảnh là đuôi ngắn của đoạn trước (gặp xuống dòng trong TAIL_MAX ký tự) ⇒ bắt đầu ở ký tự thật đầu tiên sau xuống dòng;
 * - còn lại ⇒ nới về đầu chữ.
 * Chỉ đổi hiển thị; vùng sau khi chỉnh rỗng ⇒ giữ nguyên.
 */
function alignStart(
  text: string,
  r: { charStart: number; charEnd: number },
): { charStart: number; charEnd: number } {
  const { charStart: start, charEnd: end } = r;
  if (
    start === 0 ||
    !WORD_CHAR.test(text[start - 1]) ||
    !WORD_CHAR.test(text[start])
  ) {
    return r;
  }
  const nl = text.indexOf("\n", start);
  if (nl !== -1 && nl - start <= TAIL_MAX && nl < end) {
    let next = nl;
    while (next < end && /\s/.test(text[next])) next++;
    if (next < end) return { charStart: next, charEnd: end };
    return r;
  }
  let ws = start;
  while (ws > 0 && WORD_CHAR.test(text[ws - 1])) ws--;
  return { charStart: ws, charEnd: end };
}
