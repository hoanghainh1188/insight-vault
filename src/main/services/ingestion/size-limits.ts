import type { SourceKind } from "@shared/ipc/types";

// Giới hạn kích thước nguồn (FR-020, A7). Hàm thuần — unit-test được.

const MB = 1024 * 1024;

/** Giới hạn dung lượng (byte) theo loại nguồn. */
export const SIZE_LIMITS: Record<SourceKind, number> = {
  pdf: 50 * MB,
  docx: 50 * MB,
  txt: 25 * MB,
  md: 25 * MB,
  url: 10 * MB, // body tải về
  audio: 200 * MB, // 045 — file audio lớn (bóc băng cục bộ)
};

/** Lỗi vượt giới hạn — nhãn thân thiện dùng cho error_label của nguồn. */
export class SizeLimitError extends Error {
  readonly label = "Tệp quá lớn";
  constructor() {
    super("Nguồn vượt giới hạn kích thước cho phép.");
    this.name = "SizeLimitError";
  }
}

/** Ném SizeLimitError nếu `bytes` vượt giới hạn của `kind`. */
export function assertWithinLimit(kind: SourceKind, bytes: number): void {
  if (bytes > SIZE_LIMITS[kind]) throw new SizeLimitError();
}

/** Kiểm không ném — trả true nếu hợp lệ. */
export function isWithinLimit(kind: SourceKind, bytes: number): boolean {
  return bytes <= SIZE_LIMITS[kind];
}
