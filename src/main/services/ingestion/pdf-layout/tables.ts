import {
  CELL_ALIGN_RATIO,
  DENSE_COLUMN_RATIO,
  TABLE_FULL_ROW_RATIO,
  TABLE_MIN_COLS,
  TABLE_MIN_ROWS,
  type Line,
  type PageGeometry,
  type Segment,
} from "./types";
import { logEvent } from "../../../logging";
import { joinAcrossLines, type Lexicon } from "./hyphen";
import { decimalAnchor, looksNumeric } from "./numeric";

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

/** Phần tiếp của ô (dòng sau): gạch nối cuối dòng theo 147 (a), còn lại dấu cách. */
function continueCell(c: string, t: string, lexicon?: Lexicon): string {
  if (t === "") return c;
  if (c === "") return t;
  return joinAcrossLines(c, t, lexicon)?.text ?? `${c} ${t}`;
}

/** Thêm dòng vào bảng đang dựng; false nếu dòng không thuộc bảng. */
function extendRun(run: Run, line: Line, lexicon?: Lexicon): boolean {
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
      continueCell(c, cells[i] ?? "", lexicon),
    );
  } else {
    if (filled < TABLE_MIN_COLS) return false;
    run.rows.push(cells.map((c) => c ?? ""));
  }
  run.lines.push(line);
  run.widths.push(...line.segments.map((s) => s.w));
  return true;
}

/** 147 (b): mục lục không chấm dẫn — 2 cột, cột cuối toàn số nguyên trơn tăng dần (số trang). */
function looksLikeToc(rows: readonly string[][]): boolean {
  if (rows.length < TABLE_MIN_ROWS || rows.some((r) => r.length !== 2))
    return false;
  const pages = rows.map((r) => r[1].trim());
  if (!pages.every((p) => PLAIN_INTEGER.test(p))) return false;
  return pages.every((p, i) => i === 0 || Number(p) >= Number(pages[i - 1]));
}

/** Loại trừ chung của hai đường nhận diện: chấm dẫn, đầu dòng, ô dài như đoạn văn. */
function excluded(
  rows: readonly string[][],
  widths: readonly number[],
  page: PageGeometry,
): boolean {
  if (rows.some((r) => r.some((c) => LEADER_DOTS.test(c)))) return true;
  if (rows.every((r) => BULLET.test(r[0]))) return true;
  // Ô dài như đoạn văn ⇒ cột văn bản, không phải bảng.
  return median([...widths]) >= DENSE_COLUMN_RATIO * page.width;
}

const spread = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);

/** Cột cuối của bảng căn trái thật ra căn PHẢI (mép phải thẳng hơn mép trái) — dấu hiệu số trang mục lục lọt dung sai mép trái. */
function lastColumnRightAligned(run: Run): boolean {
  const anchor = run.anchors[run.anchors.length - 1];
  const segs = run.lines.flatMap((l) =>
    l.segments.filter((s) => Math.abs(s.x - anchor) <= CELL_ALIGN_RATIO * l.h),
  );
  if (segs.length < 2) return false;
  return spread(segs.map((s) => s.x + s.w)) < spread(segs.map((s) => s.x));
}

function isTable(run: Run, page: PageGeometry): boolean {
  if (run.rows.length < TABLE_MIN_ROWS || run.anchors.length < TABLE_MIN_COLS)
    return false;
  const full = run.rows.filter(
    (r) => r.filter((c) => c !== "").length >= TABLE_MIN_COLS,
  ).length;
  if (full < TABLE_FULL_ROW_RATIO * run.rows.length) return false;
  if (excluded(run.rows, run.widths, page)) return false;
  // 147 (b): số trang mục lục căn phải 1–2 chữ số lọt dung sai mép trái ⇒ không phải bảng; cột số nguyên căn trái giữ như 112.
  return !(looksLikeToc(run.rows) && lastColumnRightAligned(run));
}

// ---------------------------------------------------------------------------------------------------------------------
// 147 (b, research R5, clarify #1–#5): đường phụ cho bảng có cột số căn PHẢI hoặc căn DẤU THẬP PHÂN (mép trái các ô số lệch nhau
// nên đường căn trái ở trên không nhận). Cột số = cụm mép phải (hoặc neo thập phân) của các ô "trông như số"; ô chữ (tiêu đề,
// nhãn) gán theo chồng lấn khoảng x với cột số, hoặc vào cột nhãn nếu nằm hẳn bên trái. Không đủ chắc ⇒ null.

/** tỉ lệ ô số tối thiểu phải khớp một cột (mép phải / neo thập phân) */
const NUMERIC_ALIGN_MIN = 0.9;
/** số ô số tối thiểu để một cụm là cột số */
const NUMERIC_COLUMN_MIN_CELLS = 3;
/** chỉ có 1 cột số ⇒ cần ít nhất ngần này hàng có số */
const SINGLE_NUMERIC_COLUMN_MIN_ROWS = 4;
/** chặn số dòng xét mỗi lần thử (trang dày đặc) */
const RIGHT_ALIGNED_MAX_LINES = 200;
const PLAIN_INTEGER = /^\d+$/;

type AlignKey = (s: Segment) => number;
const rightEdge: AlignKey = (s) => s.x + s.w;
const ALIGN_KEYS: readonly AlignKey[] = [rightEdge, decimalAnchor];

interface NumericColumn {
  key: number;
  start: number;
  end: number;
}

interface SideRow {
  cells: string[];
  /** số ô số khớp cột theo từng cột số */
  hits: number[];
  /** số dòng đã dùng tính đến hết hàng này */
  lineCount: number;
}

export interface RightAlignedTable {
  rows: string[][];
  lineCount: number;
}

/** Các dòng liên tiếp từ `start` không bị ngắt bởi khoảng dọc lớn. */
function candidateLines(region: readonly Line[], start: number): Line[] {
  const out = [region[start]];
  for (
    let k = start + 1;
    k < region.length && out.length < RIGHT_ALIGNED_MAX_LINES;
    k++
  ) {
    const prev = out[out.length - 1];
    if (region[k].y - prev.y > ROW_BREAK_RATIO * prev.h) break;
    out.push(region[k]);
  }
  return out;
}

/** Cụm giá trị trong dung sai (tính từ phần tử đầu cụm); chỉ giữ cụm đủ đông. */
function clusterCenters(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const centers: number[] = [];
  let group: number[] = [];
  const flush = () => {
    if (group.length >= NUMERIC_COLUMN_MIN_CELLS)
      centers.push(group.reduce((a, b) => a + b, 0) / group.length);
  };
  for (const v of sorted) {
    if (group.length > 0 && v - group[0] > tol) {
      flush();
      group = [];
    }
    group.push(v);
  }
  flush();
  return centers;
}

function numericColumns(
  lines: readonly Line[],
  key: AlignKey,
  tol: number,
): NumericColumn[] | null {
  const nums = lines.flatMap((l) =>
    l.segments.filter((s) => looksNumeric(s.text)),
  );
  const cols = clusterCenters(nums.map(key), tol).map((c) => {
    const members = nums.filter((s) => Math.abs(key(s) - c) <= tol);
    return {
      key: c,
      start: Math.min(...members.map((s) => s.x)),
      end: Math.max(...members.map((s) => s.x + s.w)),
    };
  });
  if (cols.length === 0) return null;
  const matched = nums.filter((s) =>
    cols.some((c) => Math.abs(key(s) - c.key) <= tol),
  ).length;
  if (matched < NUMERIC_ALIGN_MIN * nums.length) return null;
  return cols.sort((a, b) => a.start - b.start);
}

/** Cột của một segment: 0 = cột nhãn (bên trái mọi cột số), 1..n = cột số; -1 nếu không gán được. */
function columnOf(
  s: Segment,
  cols: readonly NumericColumn[],
  key: AlignKey,
  tol: number,
): { col: number; hit: boolean } {
  if (looksNumeric(s.text)) {
    const j = cols.findIndex((c) => Math.abs(key(s) - c.key) <= tol);
    if (j >= 0) return { col: j + 1, hit: true };
  }
  let best = -1;
  let bestOverlap = 0;
  cols.forEach((c, j) => {
    const overlap = Math.min(c.end, s.x + s.w) - Math.max(c.start, s.x);
    if (overlap > bestOverlap) {
      best = j;
      bestOverlap = overlap;
    }
  });
  if (best >= 0) return { col: best + 1, hit: false };
  return { col: s.x + s.w <= cols[0].start ? 0 : -1, hit: false };
}

const appendCell = (c: string, t: string): string =>
  t === "" ? c : c === "" ? t : `${c} ${t}`;

/** Dựng hàng từ đầu `lines`; dừng ở dòng đầu tiên không gán được cột. */
function sideRows(
  lines: readonly Line[],
  cols: readonly NumericColumn[],
  key: AlignKey,
  tol: number,
  lexicon?: Lexicon,
): SideRow[] {
  const rows: SideRow[] = [];
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    const cells = Array.from({ length: cols.length + 1 }, () => "");
    const hits = cols.map(() => 0);
    for (const s of line.segments) {
      const { col, hit } = columnOf(s, cols, key, tol);
      if (col < 0) return rows;
      cells[col] = appendCell(cells[col], s.text);
      if (hit) hits[col - 1]++;
    }
    const filled = cells.filter((c) => c !== "").length;
    const prev = lines[k - 1];
    const continuation =
      rows.length > 0 &&
      line.y - prev.y <= CONTINUATION_GAP_RATIO * prev.h &&
      filled < cells.length;
    if (continuation) {
      const last = rows[rows.length - 1];
      rows[rows.length - 1] = {
        cells: last.cells.map((c, i) => continueCell(c, cells[i], lexicon)),
        hits: last.hits.map((h, i) => h + hits[i]),
        lineCount: k + 1,
      };
    } else {
      rows.push({ cells, hits, lineCount: k + 1 });
    }
  }
  return rows;
}

function acceptSide(
  rows: readonly SideRow[],
  lines: readonly Line[],
  page: PageGeometry,
): string[][] | null {
  const hasNumber = (r: SideRow) => r.hits.some((h) => h > 0);
  if (rows.filter(hasNumber).length < TABLE_MIN_ROWS) return null;
  const hasLabel = rows.some((r) => r.cells[0] !== "");
  const out = rows.map((r) => (hasLabel ? r.cells : r.cells.slice(1)));
  if (out[0].length < TABLE_MIN_COLS) return null;
  const perCol = rows[0].hits.map((_, j) =>
    rows.reduce((n, r) => n + r.hits[j], 0),
  );
  const numericCols = perCol.filter((n) => n >= NUMERIC_COLUMN_MIN_CELLS);
  const enough =
    numericCols.length >= 2 ||
    (numericCols.length === 1 &&
      numericCols[0] >= SINGLE_NUMERIC_COLUMN_MIN_ROWS);
  if (!enough) return null;
  const widths = lines.flatMap((l) => l.segments.map((s) => s.w));
  return excluded(out, widths, page) || looksLikeToc(out) ? null : out;
}

/** Thử nhận bảng số căn phải / căn thập phân bắt đầu tại dòng `start` của vùng. Hàm thuần. */
export function detectRightAlignedTable(
  region: readonly Line[],
  page: PageGeometry,
  start = 0,
  lexicon?: Lexicon,
): RightAlignedTable | null {
  if (start >= region.length) return null;
  const cand = candidateLines(region, start);
  if (cand.length < TABLE_MIN_ROWS) return null;
  const tol = CELL_ALIGN_RATIO * median(cand.map((l) => l.h));
  for (const key of ALIGN_KEYS) {
    const cols = numericColumns(cand, key, tol);
    if (!cols) continue;
    const rows = sideRows(cand, cols, key, tol, lexicon);
    // Hàng cuối không có số (chú thích, ghi chú dưới bảng) ⇒ văn bản.
    while (rows.length > 0 && rows[rows.length - 1].hits.every((h) => h === 0))
      rows.pop();
    if (rows.length === 0) continue;
    const lineCount = rows[rows.length - 1].lineCount;
    const accepted = acceptSide(rows, cand.slice(0, lineCount), page);
    if (accepted) return { rows: accepted, lineCount };
  }
  return null;
}

/** Đường phụ không bao giờ làm hỏng kết quả của đường chính: lỗi bất kỳ ⇒ coi như không nhận. */
function trySide(
  region: readonly Line[],
  page: PageGeometry,
  start: number,
  lexicon?: Lexicon,
): RightAlignedTable | null {
  try {
    return detectRightAlignedTable(region, page, start, lexicon);
  } catch (e) {
    // Chỉ mã lỗi, không nội dung tài liệu (constitution III).
    logEvent("pdf.layout.fallback", {
      feature: "numericTable",
      errorType: e instanceof Error ? e.constructor.name : typeof e,
    });
    return null;
  }
}

/** Chia các dòng (đã theo thứ tự đọc) của một vùng thành phần văn bản / bảng, giữ thứ tự. */
export function detectTables(
  region: readonly Line[],
  page: PageGeometry,
  lexicon?: Lexicon,
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
    while (j < region.length && extendRun(run, region[j], lexicon)) j++;
    const left = isTable(run, page);
    // 147 (b): đường phụ chỉ thắng khi đường căn trái không nhận, hoặc nhận ít dòng hơn (vài hàng đầu tình cờ thẳng mép trái).
    const side = trySide(region, page, i, lexicon);
    if (side && (!left || side.lineCount > j - i)) {
      parts.push({ kind: "table", rows: side.rows });
      i += side.lineCount;
    } else if (left) {
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
