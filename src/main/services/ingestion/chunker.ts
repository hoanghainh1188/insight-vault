import type { Locator } from "@shared/ipc/types";

// Chia đoạn (chunking) + gắn locator NGAY lúc tạo (Constitution II, ADR chunking-strategy).
// Hàm thuần — unit-test tất định, không cần model/Electron.

export const CHUNK_SIZE = 1000; // ký tự mục tiêu/chunk
export const CHUNK_OVERLAP = 150; // ký tự chồng lấn giữa 2 chunk liền kề

/** Một "trang" văn bản đã làm sạch. PDF → nhiều trang (page 1-based); loại khác → 1 trang (page=null). */
export interface PageText {
  page: number | null;
  text: string;
}

/** Chunk nháp (chưa có id) — locator trỏ vào TOÀN văn bản (các trang nối bằng "\n\n"). */
export interface ChunkDraft {
  ordinal: number;
  text: string;
  locator: Locator;
}

const PAGE_SEP = "\n\n";

interface Range {
  start: number;
  end: number;
}

/** Tìm điểm cắt "đẹp" trong [from, to): ưu tiên \n\n > \n > kết câu > khoảng trắng; không có → to. */
function findBreak(text: string, from: number, to: number): number {
  const win = text.slice(from, to);
  const rel = (idx: number, len: number): number => from + idx + len;
  let i = win.lastIndexOf("\n\n");
  if (i >= 0) return rel(i, 2);
  i = win.lastIndexOf("\n");
  if (i >= 0) return rel(i, 1);
  for (const sep of [". ", "! ", "? "]) {
    const j = win.lastIndexOf(sep);
    if (j >= 0) return rel(j, sep.length);
  }
  i = win.lastIndexOf(" ");
  if (i >= 0) return rel(i, 1);
  return to;
}

/** Chia một chuỗi thành các range [start,end) ~size ký tự, overlap, cắt theo ranh giới. */
function splitRanges(text: string, size: number, overlap: number): Range[] {
  const len = text.length;
  if (len === 0) return [];
  if (len <= size) return [{ start: 0, end: len }];

  const ranges: Range[] = [];
  let pos = 0;
  while (pos < len) {
    const hardEnd = Math.min(pos + size, len);
    let end: number;
    if (hardEnd >= len) {
      end = len;
    } else {
      // Chỉ nhận điểm cắt nằm nửa sau cửa sổ để tránh chunk quá ngắn.
      const minBreak = pos + Math.floor(size / 2);
      end = findBreak(text, minBreak, hardEnd);
      if (end <= pos) end = hardEnd; // an toàn: luôn tiến
    }
    ranges.push({ start: pos, end });
    if (end >= len) break;
    // Lùi lại overlap ký tự cho chunk kế; đảm bảo luôn tiến ít nhất 1.
    pos = Math.max(end - overlap, pos + 1);
  }
  return ranges;
}

/**
 * Chunk toàn tài liệu theo trang — CHUNK KHÔNG VẮT QUA RANH GIỚI TRANG (locator.page đơn trị).
 * Offset char tính vào toàn văn bản = các trang nối bằng "\n\n".
 */
export function chunkPages(
  pages: PageText[],
  opts: { size?: number; overlap?: number } = {},
): ChunkDraft[] {
  const size = opts.size ?? CHUNK_SIZE;
  const overlap = opts.overlap ?? CHUNK_OVERLAP;
  const drafts: ChunkDraft[] = [];
  let base = 0; // offset đầu trang hiện tại trong toàn văn bản
  let ordinal = 0;

  pages.forEach((pg, idx) => {
    for (const r of splitRanges(pg.text, size, overlap)) {
      drafts.push({
        ordinal: ordinal++,
        text: pg.text.slice(r.start, r.end),
        locator: {
          page: pg.page,
          charStart: base + r.start,
          charEnd: base + r.end,
        },
      });
    }
    base += pg.text.length;
    if (idx < pages.length - 1) base += PAGE_SEP.length;
  });

  return drafts;
}

/** Ghép toàn văn bản đúng cách offset của chunkPages tham chiếu (dùng cho kiểm thử/lưu trữ). */
export function joinPages(pages: PageText[]): string {
  return pages.map((p) => p.text).join(PAGE_SEP);
}
