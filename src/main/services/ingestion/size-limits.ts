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
  audio: 200 * MB, // 045 — file audio lớn (bóc băng cục bộ); 051 thêm m4a/aac cùng giới hạn
  video: 1024 * MB, // 051 — video lớn (tách audio + phát file gốc)
  image: 50 * MB, // 053 — ảnh OCR (tesseract.js)
};

/** Lỗi vượt giới hạn — mã lỗi nguồn "tooLarge" (123: lưu mã, giao diện dịch). */
export class SizeLimitError extends Error {
  readonly code = "tooLarge" as const;
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
