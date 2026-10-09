import type { PageBreak } from "./ipc/types";

// 147 (e, research R1): đọc lại bảng Markdown mà trích xuất PDF (112, `renderTable`) đã ghi vào văn bản nguồn — để Trình xem nguồn
// vẽ lưới mà KHÔNG cần lưu thêm cấu trúc (có ngay với PDF đã nạp). Ô mang vị trí ký tự trong văn bản GỐC ⇒ tô sáng trích dẫn theo ký tự.
// Hàm thuần, không ném (lỗi ⇒ []). Cổng chặt: tiêu đề + hàng phân cách + ≥ 1 hàng, số ô bằng nhau, không vắt mốc trang.

/** Một ô: `[start, end)` trong văn bản gốc (không gồm "|" và khoảng đệm); `text` đã bỏ thoát `\|`. */
export interface TableCell {
  start: number;
  end: number;
  text: string;
}

export interface PdfTable {
  /** Vị trí ký tự đầu / sau cuối của khối bảng trong văn bản gốc. */
  start: number;
  end: number;
  header: TableCell[];
  rows: TableCell[][];
  /** Cột "trông như số" (≥ 80% ô có chữ là số) — để căn phải khi hiển thị. */
  numericColumns: boolean[];
}

const SEPARATOR = /^\|(?:\s*-{3,}\s*\|)+$/;
const NUMERIC =
  /^[(−\-+]?\s?[$€£¥₫]?\s?\d[\d.,\s]*%?\)?(?:\s?(?:\u0111|₫|VND|USD|%))?$/u;
const NUMERIC_RATIO = 0.8;

/** Ô có chữ trông như số (dùng để căn phải khi hiển thị — không đổi văn bản). */
export function looksNumericCell(text: string): boolean {
  return NUMERIC.test(text.trim());
}

interface Line {
  start: number;
  text: string;
}

function splitLines(text: string): Line[] {
  const out: Line[] = [];
  let start = 0;
  for (;;) {
    const nl = text.indexOf("\n", start);
    const end = nl === -1 ? text.length : nl;
    out.push({ start, text: text.slice(start, end) });
    if (nl === -1) return out;
    start = nl + 1;
  }
}

const isRowLine = (s: string): boolean =>
  s.length >= 3 && s.startsWith("|") && s.endsWith("|") && !s.endsWith("\\|");

/** Tách ô của một dòng `| a | b |` theo "|" KHÔNG thoát; null nếu không đúng dạng. */
function cellsOf(line: Line): TableCell[] | null {
  const s = line.text;
  if (!isRowLine(s)) return null;
  const cells: TableCell[] = [];
  let from = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] !== "|" || s[i - 1] === "\\") continue;
    let a = from;
    let b = i;
    while (a < b && s[a] === " ") a++;
    while (b > a && s[b - 1] === " ") b--;
    cells.push({
      start: line.start + a,
      end: line.start + b,
      text: s.slice(a, b).replace(/\\\|/g, "|"),
    });
    from = i + 1;
  }
  return cells.length > 0 ? cells : null;
}

function numericColumnsOf(rows: TableCell[][], cols: number): boolean[] {
  return Array.from({ length: cols }, (_, c) => {
    const filled = rows.map((r) => r[c].text).filter((t) => t !== "");
    if (filled.length === 0) return false;
    const n = filled.filter(looksNumericCell).length;
    return n / filled.length >= NUMERIC_RATIO;
  });
}

export function parsePdfTables(
  text: string,
  pageBreaks: readonly PageBreak[],
): PdfTable[] {
  try {
    const lines = splitLines(text);
    const breaks = pageBreaks.map((p) => p.offset);
    const tables: PdfTable[] = [];
    let i = 0;
    while (i < lines.length) {
      const header = cellsOf(lines[i]);
      const sep = lines[i + 1];
      if (!header || !sep || !SEPARATOR.test(sep.text)) {
        i++;
        continue;
      }
      const cols = sep.text.split("|").length - 2;
      if (header.length !== cols) {
        i++;
        continue;
      }
      const rows: TableCell[][] = [];
      let j = i + 2;
      for (; j < lines.length; j++) {
        const cells = cellsOf(lines[j]);
        if (!cells) break;
        if (cells.length !== cols) {
          rows.length = 0; // số ô lệch ⇒ không phải bảng theo quy ước 112
          break;
        }
        rows.push(cells);
      }
      const last = lines[i + 1 + rows.length];
      const start = lines[i].start;
      const end = last.start + last.text.length;
      const crossesPage = breaks.some((b) => b > start && b <= end);
      if (rows.length > 0 && !crossesPage) {
        tables.push({
          start,
          end,
          header,
          rows,
          numericColumns: numericColumnsOf(rows, cols),
        });
        i = i + 2 + rows.length;
      } else {
        i++;
      }
    }
    return tables;
  } catch {
    return [];
  }
}
