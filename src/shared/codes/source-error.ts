// 123 (FR-014, contracts/codes.md §1): nhãn lỗi nguồn lưu (cột source.error_label) và truyền qua IPC bằng MÃ;
// renderer dịch theo ngôn ngữ hiện tại (khoá sources.error.<code>). Thuần, dùng chung main + renderer.

export const SOURCE_ERROR_CODES = [
  "extract",
  "embed",
  "store",
  "generic",
  "fetch",
  "tooLarge",
  "interrupted",
  "reprocessFailed",
  "reprocessChanged",
  "reprocessVaultLocked",
  "unknown",
] as const;

export type SourceErrorCode = (typeof SOURCE_ERROR_CODES)[number];

/** Văn bản tiếng Việt do bản ≤ 0.2.9 lưu/gửi ⇒ mã. Dùng cho migration #10 và lớp phòng thủ khi đọc. */
export const LEGACY_SOURCE_ERROR_LABELS: Readonly<
  Record<string, SourceErrorCode>
> = {
  "Lỗi trích xuất": "extract",
  "Lỗi nhúng": "embed",
  "Lỗi lưu trữ": "store",
  Lỗi: "generic",
  "Lỗi tải trang": "fetch",
  "Tệp quá lớn": "tooLarge",
  "Gián đoạn khi nạp — thử lại": "interrupted",
  "Xử lý lại thất bại — vẫn dùng bản cũ.": "reprocessFailed",
  "Tệp gốc đã bị sửa so với lúc nạp — xử lý lại bị huỷ, vẫn dùng bản cũ.":
    "reprocessChanged",
  "Đang sao lưu/khôi phục — thử lại sau giây lát. Xử lý lại bị huỷ, vẫn dùng bản cũ.":
    "reprocessVaultLocked",
};

export function isSourceErrorCode(v: unknown): v is SourceErrorCode {
  return (
    typeof v === "string" &&
    (SOURCE_ERROR_CODES as readonly string[]).includes(v)
  );
}

/** Mã hợp lệ ⇒ giữ; văn bản cũ ⇒ mã; null/"" ⇒ null; khác ⇒ "unknown" (không hiện văn bản thô lạ ra UI). */
export function normalizeSourceErrorCode(
  raw: string | null | undefined,
): SourceErrorCode | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (isSourceErrorCode(raw)) return raw;
  return LEGACY_SOURCE_ERROR_LABELS[raw] ?? "unknown";
}
