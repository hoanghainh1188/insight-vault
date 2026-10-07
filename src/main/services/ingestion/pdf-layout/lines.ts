import {
  CELL_GAP_RATIO,
  LINE_OVERLAP_RATIO,
  WORD_GAP_RATIO,
  type LayoutItem,
  type Line,
  type Segment,
} from "./types";

// 112 (FR-001, research R2): gom item pdf.js thành dòng theo baseline, tách segment khi khe ngang lớn (ô bảng /
// cột). Hàm thuần — không đổi chữ, chỉ chèn dấu cách giữa item khi có khe.

/** chặn chia cho 0 khi item có chiều cao 0 (pdf.js đôi khi trả height = 0) */
const MIN_H = 1e-3;

export interface LinesResult {
  lines: Line[];
  /** item có chữ xoay — giữ thứ tự gốc, xử lý riêng (nối cuối trang) */
  rotated: LayoutItem[];
}

/** Chồng lấn dọc giữa phạm vi [y-h, y] của item và dòng, tính theo chiều cao nhỏ hơn. */
function overlapRatio(it: LayoutItem, line: { y: number; h: number }): number {
  const top = Math.max(it.y - it.h, line.y - line.h);
  const bottom = Math.min(it.y, line.y);
  return Math.max(0, bottom - top) / Math.max(Math.min(it.h, line.h), MIN_H);
}

function joinItems(a: string, b: string, gap: number, h: number): string {
  const needSpace =
    gap > WORD_GAP_RATIO * h && !/\s$/.test(a) && !/^\s/.test(b);
  return needSpace ? `${a} ${b}` : a + b;
}

function toSegments(items: LayoutItem[], h: number): Segment[] {
  const segs: Segment[] = [];
  for (const it of items) {
    const last = segs[segs.length - 1];
    const gap = last ? it.x - (last.x + last.w) : Infinity;
    if (last && gap <= CELL_GAP_RATIO * h) {
      last.text = joinItems(last.text, it.text, gap, h);
      last.w = Math.max(last.w, it.x + it.w - last.x);
      last.h = Math.max(last.h, it.h);
    } else {
      segs.push({ text: it.text, x: it.x, w: it.w, y: it.y, h: it.h });
    }
  }
  return segs.map((s) => ({ ...s, text: s.text.trim() }));
}

export function buildLines(items: readonly LayoutItem[]): LinesResult {
  const rotated = items.filter((i) => i.rotated && i.text.trim() !== "");
  const flat = items
    .filter((i) => !i.rotated && i.text.trim() !== "")
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const groups: { y: number; h: number; items: LayoutItem[] }[] = [];
  for (const it of flat) {
    const g = groups.find(
      (cand) => overlapRatio(it, cand) >= LINE_OVERLAP_RATIO,
    );
    if (g) {
      g.items.push(it);
      if (it.h > g.h) {
        g.h = it.h;
        g.y = it.y;
      }
    } else {
      groups.push({ y: it.y, h: it.h, items: [it] });
    }
  }

  const lines = groups
    .map((g) => ({
      y: g.y,
      h: g.h,
      segments: toSegments(
        g.items.slice().sort((a, b) => a.x - b.x),
        g.h,
      ),
    }))
    .sort((a, b) => a.y - b.y);
  return { lines, rotated };
}
