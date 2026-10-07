import {
  CELL_ALIGN_RATIO,
  DENSE_COLUMN_RATIO,
  TABLE_FULL_ROW_RATIO,
  TABLE_MIN_COLS,
  TABLE_MIN_ROWS,
  type Line,
  type PageGeometry,
} from "./types";

// 112 (FR-004, FR-005, research R5–R6): nhận diện bảng theo CĂN CỘT của các segment trong một vùng và xuất bảng
// Markdown. Nguyên tắc "thà bỏ sót còn hơn nhận nhầm": không đủ chắc ⇒ giữ văn bản dòng thường. Hàm thuần.

export type RegionPart =
  { kind: "text"; lines: Line[] } | { kind: "table"; rows: string[][] };

/** dòng kế tiếp cách dòng trên ≤ tỉ lệ × h và có ít ô hơn ⇒ phần tiếp của ô nhiều dòng */
const CONTINUATION_GAP_RATIO = 1.25;
/** khoảng cách giữa hai hàng > tỉ lệ × h ⇒ kết thúc bảng */
const ROW_BREAK_RATIO = 2.5;
const LEADER_DOTS = /\.{4,}/;
const BULLET = /^[•◦▪▫‣∙·\-–—*]$/;

interface Run {
  anchors: number[];
  rows: string[][];
  lines: Line[];
  widths: number[];
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)];
}

/** Gán mỗi segment của dòng vào cột (anchor) gần nhất; null nếu có segment không thẳng hàng cột nào. */
function alignCells(line: Line, anchors: number[]): (string | null)[] | null {
  const cells: (string | null)[] = anchors.map(() => null);
  const tol = CELL_ALIGN_RATIO * line.h;
  for (const s of line.segments) {
    const idx = anchors.findIndex((a) => Math.abs(a - s.x) <= tol);
    if (idx < 0) return null;
    cells[idx] = cells[idx] === null ? s.text : `${cells[idx]} ${s.text}`;
  }
  return cells;
}

function startRun(line: Line): Run {
  return {
    anchors: line.segments.map((s) => s.x),
    rows: [line.segments.map((s) => s.text)],
    lines: [line],
    widths: line.segments.map((s) => s.w),
  };
}

/** Thêm dòng vào bảng đang dựng; false nếu dòng không thuộc bảng. */
function extendRun(run: Run, line: Line): boolean {
  const prev = run.lines[run.lines.length - 1];
  const gap = line.y - prev.y;
  if (gap > ROW_BREAK_RATIO * prev.h) return false;
  const cells = alignCells(line, run.anchors);
  if (!cells) return false;
  const filled = cells.filter((c) => c !== null).length;
  const continuation =
    gap <= CONTINUATION_GAP_RATIO * prev.h && filled < run.anchors.length;
  if (continuation) {
    const last = run.rows[run.rows.length - 1];
    run.rows[run.rows.length - 1] = last.map((c, i) =>
      cells[i] === null
        ? c
        : c === ""
          ? (cells[i] as string)
          : `${c} ${cells[i]}`,
    );
  } else {
    if (filled < TABLE_MIN_COLS) return false;
    run.rows.push(cells.map((c) => c ?? ""));
  }
  run.lines.push(line);
  run.widths.push(...line.segments.map((s) => s.w));
  return true;
}

function isTable(run: Run, page: PageGeometry): boolean {
  if (run.rows.length < TABLE_MIN_ROWS || run.anchors.length < TABLE_MIN_COLS)
    return false;
  const full = run.rows.filter(
    (r) => r.filter((c) => c !== "").length >= TABLE_MIN_COLS,
  ).length;
  if (full < TABLE_FULL_ROW_RATIO * run.rows.length) return false;
  if (run.rows.some((r) => r.some((c) => LEADER_DOTS.test(c)))) return false;
  if (run.rows.every((r) => BULLET.test(r[0]))) return false;
  // Ô dài như đoạn văn ⇒ cột văn bản, không phải bảng.
  if (median(run.widths) >= DENSE_COLUMN_RATIO * page.width) return false;
  return true;
}

/** Chia các dòng (đã theo thứ tự đọc) của một vùng thành phần văn bản / bảng, giữ thứ tự. */
export function detectTables(
  region: readonly Line[],
  page: PageGeometry,
): RegionPart[] {
  const parts: RegionPart[] = [];
  const pushText = (ls: Line[]) => {
    if (ls.length === 0) return;
    const last = parts[parts.length - 1];
    if (last?.kind === "text") last.lines.push(...ls);
    else parts.push({ kind: "text", lines: [...ls] });
  };
  let i = 0;
  while (i < region.length) {
    const line = region[i];
    if (line.segments.length < TABLE_MIN_COLS) {
      pushText([line]);
      i++;
      continue;
    }
    const run = startRun(line);
    let j = i + 1;
    while (j < region.length && extendRun(run, region[j])) j++;
    if (isTable(run, page)) {
      parts.push({ kind: "table", rows: run.rows });
      i = j;
    } else {
      // Cụm không thành bảng ⇒ giữ cả cụm là văn bản và đi tiếp sau cụm (tránh dò lại O(n²) — hardening).
      pushText(region.slice(i, Math.max(j, i + 1)));
      i = Math.max(j, i + 1);
    }
  }
  return parts;
}

const cell = (c: string): string =>
  c.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");

/** Bảng Markdown ở dạng cố định của cleanText: ô `| a |`, ô rỗng `| |`, hàng phân cách sau hàng đầu. */
export function renderTable(rows: readonly string[][]): string {
  const row = (r: readonly string[]) =>
    `|${r.map((c) => (cell(c) === "" ? " " : ` ${cell(c)} `)).join("|")}|`;
  const cols = Math.max(...rows.map((r) => r.length));
  const sep = `|${Array.from({ length: cols }, () => "---").join("|")}|`;
  return [row(rows[0]), sep, ...rows.slice(1).map(row)].join("\n");
}
