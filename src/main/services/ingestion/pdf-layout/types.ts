// 112: kiểu + ngưỡng cho dựng bố cục trang PDF (hàm thuần, research R1–R8, contracts/pdf-layout.md).
// Toạ độ theo điểm PDF, gốc TRÊN-TRÁI trang; `y` là baseline của chữ; `h` = cỡ chữ hiệu dụng.

export interface LayoutItem {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface PageGeometry {
  width: number;
  height: number;
}

/** Một cụm chữ liền nhau trên cùng dòng (khe ngang ≤ CELL_GAP_RATIO × h). */
export interface Segment {
  text: string;
  x: number;
  w: number;
  y: number;
  h: number;
}

/** Một dòng = các segment cùng baseline, sắp theo x. */
export interface Line {
  y: number;
  h: number;
  segments: Segment[];
}

export interface TextBlock {
  start: number;
  end: number;
}

export interface LayoutResult {
  text: string;
  blocks: TextBlock[];
  fallback: boolean;
}

export const MAX_LAYOUT_ITEMS_PER_PAGE = 5000;
/** khoảng cách baseline > tỉ lệ × h ⇒ đoạn mới */
export const PARAGRAPH_GAP_RATIO = 1.5;
/** chồng lấn dọc tối thiểu (theo chiều cao nhỏ hơn) để cùng dòng */
export const LINE_OVERLAP_RATIO = 0.5;
/** khe ngang > tỉ lệ × h ⇒ chèn dấu cách giữa hai item */
export const WORD_GAP_RATIO = 0.15;
/** khe ngang > tỉ lệ × h ⇒ tách segment (ô/cột) */
export const CELL_GAP_RATIO = 1;
/** sai lệch mép trái ô cho phép (× h) */
export const CELL_ALIGN_RATIO = 0.5;
export const TABLE_MIN_ROWS = 3;
export const TABLE_MIN_COLS = 2;
/** tỉ lệ hàng phải đủ số cột */
export const TABLE_FULL_ROW_RATIO = 0.8;
/** khe cột tối thiểu (× bề rộng trang) */
export const COLUMN_GUTTER_MIN = 0.02;
/** tỉ lệ segment tối đa được phép cắt ngang khe cột */
export const COLUMN_CROSS_MAX = 0.1;
/** cột chữ "dày": trung vị bề rộng segment ≥ tỉ lệ × bề rộng trang (phân biệt cột văn bản với cột bảng) */
export const DENSE_COLUMN_RATIO = 0.25;
