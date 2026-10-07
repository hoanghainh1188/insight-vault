import type { LayoutItem } from "../../../src/main/services/ingestion/pdf-layout/types";

// 112: builder LayoutItem tổng hợp cho test pdf-layout (chữ 0,5 em/ký tự như fixture PDF).

export const CW = 0.5;

export function item(
  text: string,
  x: number,
  y: number,
  h = 10,
  rotated = false,
): LayoutItem {
  return { text, x, y, w: text.length * h * CW, h, rotated };
}

/** Các dòng của một đoạn tại (x, y) với bước dòng `step`. */
export function lines(
  x: number,
  y: number,
  texts: string[],
  step = 12,
  h = 10,
): LayoutItem[] {
  return texts.map((t, i) => item(t, x, y + i * step, h));
}

/** Lưới bảng: hàng cách nhau `step`, cột tại `xs`; ô "" bị bỏ (ô rỗng). */
export function grid(
  rows: string[][],
  xs: number[],
  y0: number,
  step = 14,
  h = 10,
): LayoutItem[] {
  return rows.flatMap((r, i) =>
    r.flatMap((c, j) => (c === "" ? [] : [item(c, xs[j], y0 + i * step, h)])),
  );
}
