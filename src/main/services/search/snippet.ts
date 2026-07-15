// Đoạn trích (snippet) cho kết quả tìm toàn văn (073). Hàm THUẦN — gọn khoảng trắng + cắt độ dài.
// KHÔNG log nội dung (Constitution III). Cắt theo ranh giới ký tự (không cắt giữa cặp surrogate hiếm khi
// cần cho tiếng Việt) — đủ cho hiển thị preview.

export const SNIPPET_MAX_LEN = 160;

/** Rút gọn text thành 1 dòng preview: gộp mọi khoảng trắng thành 1, cắt tối đa `maxLen`, thêm "…" nếu cắt. */
export function makeSnippet(
  text: string,
  maxLen: number = SNIPPET_MAX_LEN,
): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen).trimEnd()}…`;
}
