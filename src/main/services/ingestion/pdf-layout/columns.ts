import {
  COLUMN_CROSS_MAX,
  COLUMN_GUTTER_MIN,
  DENSE_COLUMN_RATIO,
  type Line,
  type PageGeometry,
  type Segment,
} from "./types";

// 112 (FR-003, research R3): thứ tự đọc cho trang nhiều cột — XY-cut đơn giản theo khe dọc giữa các segment.
// Không tìm được khe tin cậy ⇒ một vùng, đọc trên→xuống. Hàm thuần.

const MAX_DEPTH = 2; // tối đa 2 lần tách ⇒ ≤ 4 cột
const NARROW_RATIO = 0.5; // segment rộng ≥ 50% vùng (tiêu đề/đoạn trải trang) không dùng để tìm khe
const CENTER_MARGIN = 0.15; // khe phải nằm trong khoảng giữa của vùng

interface Gap {
  start: number;
  end: number;
}

const right = (s: Segment): number => s.x + s.w;
const byY = (a: Line, b: Line): number => a.y - b.y;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Khe dọc rộng nhất giữa các segment hẹp, nằm ở vùng giữa. */
function findGutter(segs: Segment[], page: PageGeometry): Gap | null {
  if (segs.length === 0) return null;
  const x0 = Math.min(...segs.map((s) => s.x));
  const x1 = Math.max(...segs.map(right));
  const width = x1 - x0;
  const narrow = segs
    .filter((s) => s.w < NARROW_RATIO * width)
    .sort((a, b) => a.x - b.x);
  let best: Gap | null = null;
  let reach = -Infinity;
  for (const s of narrow) {
    if (reach > -Infinity && s.x > reach) {
      const gap = { start: reach, end: s.x };
      const center = (gap.start + gap.end) / 2;
      const inMiddle =
        center >= x0 + CENTER_MARGIN * width &&
        center <= x1 - CENTER_MARGIN * width;
      const wide = gap.end - gap.start >= COLUMN_GUTTER_MIN * page.width;
      if (
        inMiddle &&
        wide &&
        (!best || gap.end - gap.start > best.end - best.start)
      ) {
        best = gap;
      }
    }
    reach = Math.max(reach, right(s));
  }
  return best;
}

const crosses = (s: Segment, g: Gap): boolean =>
  s.x < g.end && right(s) > g.start;

function lineWith(l: Line, segments: Segment[]): Line {
  return { y: l.y, h: l.h, segments };
}

/** Thử tách các dòng tại một khe; null nếu không đủ tin cậy là cột văn bản. */
function splitAt(
  lines: Line[],
  gap: Gap,
  page: PageGeometry,
): { left: Line[]; right: Line[]; crossing: Line[] } | null {
  const left: Line[] = [];
  const rightLines: Line[] = [];
  const crossing: Line[] = [];
  for (const l of lines) {
    if (l.segments.some((s) => crosses(s, gap))) {
      crossing.push(l);
      continue;
    }
    const ls = l.segments.filter((s) => right(s) <= gap.start);
    const rs = l.segments.filter((s) => s.x >= gap.end);
    if (ls.length > 0) left.push(lineWith(l, ls));
    if (rs.length > 0) rightLines.push(lineWith(l, rs));
  }
  if (left.length < 2 || rightLines.length < 2) return null;
  // Cột văn bản "dày" (đoạn chữ dài) — phân biệt với cột bảng (ô ngắn) để không xé bảng.
  const dense = (ls: Line[]) =>
    median(ls.flatMap((l) => l.segments.map((s) => s.w))) >=
    DENSE_COLUMN_RATIO * page.width;
  if (!dense(left) || !dense(rightLines)) return null;
  // Dòng cắt ngang khe nằm TRONG thân hai cột (không tính tiêu đề trên / chân trang dưới).
  const inner = [...left, ...rightLines];
  const top = Math.min(...inner.map((l) => l.y));
  const bottom = Math.max(...inner.map((l) => l.y));
  const innerCross = crossing.filter((l) => l.y > top && l.y < bottom).length;
  if (innerCross > COLUMN_CROSS_MAX * inner.length) return null;
  return { left, right: rightLines, crossing };
}

function regionsOf(lines: Line[], page: PageGeometry, depth: number): Line[][] {
  if (lines.length === 0) return [];
  const sorted = [...lines].sort(byY);
  if (depth >= MAX_DEPTH) return [sorted];
  const gap = findGutter(
    sorted.flatMap((l) => l.segments),
    page,
  );
  const split = gap ? splitAt(sorted, gap, page) : null;
  if (!split) return [sorted];

  const out: Line[][] = [];
  const cols = [...split.left, ...split.right];
  const top = Math.min(...cols.map((l) => l.y));
  const bottom = Math.max(...cols.map((l) => l.y));
  const above = split.crossing.filter((l) => l.y < top).sort(byY);
  const below = split.crossing.filter((l) => l.y > bottom).sort(byY);
  const inside = split.crossing
    .filter((l) => l.y >= top && l.y <= bottom)
    .sort(byY);
  if (above.length > 0) out.push(above);
  // Dòng cắt ngang bên trong chia thân trang thành các dải; mỗi dải đọc cột trái rồi cột phải.
  const cuts = [...inside.map((l) => l.y), Infinity];
  let from = -Infinity;
  for (let i = 0; i < cuts.length; i++) {
    const inBand = (l: Line) => l.y > from && l.y < cuts[i];
    out.push(...regionsOf(split.left.filter(inBand), page, depth + 1));
    out.push(...regionsOf(split.right.filter(inBand), page, depth + 1));
    if (i < inside.length) out.push([inside[i]]);
    from = cuts[i];
  }
  if (below.length > 0) out.push(below);
  return out.filter((r) => r.length > 0);
}

/** Chia các dòng của trang thành vùng theo thứ tự đọc. */
export function orderRegions(
  lines: readonly Line[],
  page: PageGeometry,
): Line[][] {
  return regionsOf([...lines], page, 0);
}
