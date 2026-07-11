import type { NotebookColor } from "@shared/ipc/types";
import { isPaletteColor } from "./palette";

// Validate ở BOUNDARY (input renderer → main → SQLite). Sai → ném Error message thân thiện.

export const NAME_MAX_LEN = 100;

/** Trả tên đã trim nếu hợp lệ (1–NAME_MAX_LEN ký tự); ném nếu rỗng/quá dài. Cho unicode/emoji, cho trùng. */
export function validateName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0) {
    throw new Error("Tên notebook không được để trống.");
  }
  if (name.length > NAME_MAX_LEN) {
    throw new Error(`Tên notebook tối đa ${NAME_MAX_LEN} ký tự.`);
  }
  return name;
}

/** Trả màu nếu thuộc palette; ném nếu không. */
export function validateColor(raw: unknown): NotebookColor {
  if (!isPaletteColor(raw)) {
    throw new Error("Màu notebook không hợp lệ (phải chọn từ bảng màu).");
  }
  return raw;
}

/** Trả id nếu là chuỗi non-empty; ném lỗi nghiệp vụ rõ ràng (thay vì để node:sqlite ném TypeError). */
export function validateId(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Notebook id không hợp lệ.");
  }
  return raw;
}
