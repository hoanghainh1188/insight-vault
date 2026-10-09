import type { PageBreak } from "@shared/ipc/types";
import type { PdfTable } from "@shared/pdf-tables";

// Chia toàn văn thành các đoạn để render: đoạn thường / đoạn highlight, kèm mốc trang. Hàm THUẦN.
// Render bằng React text node (không innerHTML) — chống XSS từ nội dung nguồn không tin cậy.

export interface Segment {
  text: string;
  kind: "plain" | "highlight";
  /** Nếu đoạn này bắt đầu một trang mới → số trang (chèn mốc "Trang N"). */
  pageMark?: number;
  /** 147: đoạn tô sáng ĐẦU TIÊN (nhãn [n] + cuộn tới) — chỉ đặt bởi buildViewerBlocks. */
  first?: boolean;
}

/** 147 (e): khối hiển thị — văn bản thường hoặc bảng (ô = các đoạn plain / highlight theo ký tự). */
export type ViewerBlock =
  | { kind: "text"; segments: Segment[] }
  | {
      kind: "table";
      table: PdfTable;
      /** cells[hàng][cột] — hàng 0 = tiêu đề. */
      cells: Segment[][][];
      /** Bảng bắt đầu một trang mới. */
      pageMark?: number;
    };

type Range = { charStart: number; charEnd: number };

/** Vùng tô hợp lệ sau chỉnh 157/159, hoặc null. */
function adjustHighlight(text: string, highlight: Range | null): Range | null {
  const len = text.length;
  const valid =
    highlight &&
    highlight.charStart >= 0 &&
    highlight.charEnd <= len &&
    highlight.charStart < highlight.charEnd
      ? highlight
      : null;
  return valid ? alignStart(text, trimRange(text, valid)) : null;
}

/** Cắt `[from, to)` theo vùng tô + mốc trang (mốc ngoài khoảng bị bỏ qua). */
function segmentRange(
  text: string,
  from: number,
  to: number,
  hl: Range | null,
  pageAt: ReadonlyMap<number, number>,
): Segment[] {
  const bounds = new Set<number>([from, to]);
  if (hl) {
    if (hl.charStart > from && hl.charStart < to) bounds.add(hl.charStart);
    if (hl.charEnd > from && hl.charEnd < to) bounds.add(hl.charEnd);
  }
  for (const off of pageAt.keys()) if (off > from && off < to) bounds.add(off);
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

function pageMap(
  len: number,
  pageBreaks: readonly PageBreak[],
): Map<number, number> {
  const pageAt = new Map<number, number>();
  for (const pb of pageBreaks) {
    if (pb.offset >= 0 && pb.offset <= len) pageAt.set(pb.offset, pb.page);
  }
  return pageAt;
}

/**
 * 147 (e, research R2): như buildSegments nhưng tách các BẢNG (từ parsePdfTables) thành khối riêng; mỗi ô cắt theo vùng tô ⇒ tô
 * sáng chính xác theo ký tự trong ô. Ký tự khung ("|", hàng phân cách, đệm) không hiển thị. Đánh dấu `first` cho đoạn tô đầu tiên.
 */
export function buildViewerBlocks(
  text: string,
  highlight: Range | null,
  pageBreaks: readonly PageBreak[],
  tables: readonly PdfTable[],
): ViewerBlock[] {
  const hl = adjustHighlight(text, highlight);
  const pageAt = pageMap(text.length, pageBreaks);
  const blocks: ViewerBlock[] = [];
  const pushText = (
    from: number,
    to: number,
    edges: { beforeTable: boolean; afterTable: boolean },
  ): void => {
    if (to <= from) return;
    // mốc trang đúng tại `from` vẫn phải hiện ⇒ segmentRange lấy mốc ở chính `from`
    const raw = segmentRange(text, from, to, hl, pageAt);
    const lead = edges.afterTable ? untintLeadingSpace(raw) : raw;
    blocks.push({
      kind: "text",
      segments: edges.beforeTable ? untintTrailingSpace(lead) : lead,
    });
  };
  let cursor = 0;
  for (const t of [...tables].sort((a, b) => a.start - b.start)) {
    if (t.start < cursor || t.end > text.length) continue;
    pushText(cursor, t.start, { beforeTable: true, afterTable: cursor > 0 });
    const rows = [t.header, ...t.rows];
    const block: ViewerBlock = {
      kind: "table",
      table: t,
      cells: rows.map((r) =>
        r.map((c) =>
          c.end > c.start
            ? segmentRange(text, c.start, c.end, hl, new Map())
            : [],
        ),
      ),
    };
    const mark = pageAt.get(t.start);
    if (mark !== undefined) block.pageMark = mark;
    blocks.push(block);
    cursor = t.end;
  }
  pushText(cursor, text.length, { beforeTable: false, afterTable: cursor > 0 });
  return markFirst(blocks);
}

/**
 * Khoảng trắng cuối khối văn bản ngay trước bảng (dòng trống ngăn cách) KHÔNG tô — tránh vạch tô sáng lẻ trên dòng trống. Không mutate.
 */
function untintTrailingSpace(segs: Segment[]): Segment[] {
  const last = segs[segs.length - 1];
  if (!last || last.kind !== "highlight") return segs;
  const body = last.text.replace(/\s+$/u, "");
  if (body === last.text) return segs;
  const tail: Segment = { text: last.text.slice(body.length), kind: "plain" };
  if (body === "") {
    if (last.pageMark !== undefined) tail.pageMark = last.pageMark;
    return [...segs.slice(0, -1), tail];
  }
  return [...segs.slice(0, -1), { ...last, text: body }, tail];
}

/**
 * #171: khoảng trắng đầu khối văn bản ngay SAU bảng (dòng trống ngăn cách) KHÔNG tô — đối xứng với untintTrailingSpace. Không mutate.
 */
function untintLeadingSpace(segs: Segment[]): Segment[] {
  const first = segs[0];
  if (!first || first.kind !== "highlight") return segs;
  const body = first.text.replace(/^\s+/u, "");
  if (body === first.text) return segs;
  const head: Segment = {
    text: first.text.slice(0, first.text.length - body.length),
    kind: "plain",
  };
  if (first.pageMark !== undefined) head.pageMark = first.pageMark;
  if (body === "") return [head, ...segs.slice(1)];
  const rest: Segment = { ...first, text: body };
  delete rest.pageMark;
  return [head, rest, ...segs.slice(1)];
}

/** Đặt `first` cho đoạn tô sáng đầu tiên theo thứ tự hiển thị (bản sao — không mutate). */
function markFirst(blocks: ViewerBlock[]): ViewerBlock[] {
  let done = false;
  const mark = (segs: Segment[]): Segment[] =>
    segs.map((s) => {
      if (done || s.kind !== "highlight") return s;
      done = true;
      return { ...s, first: true };
    });
  return blocks.map((b) =>
    b.kind === "text"
      ? { ...b, segments: mark(b.segments) }
      : { ...b, cells: b.cells.map((r) => r.map((c) => mark(c))) },
  );
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
  return segmentRange(
    text,
    0,
    text.length,
    adjustHighlight(text, highlight),
    pageMap(text.length, pageBreaks),
  );
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
