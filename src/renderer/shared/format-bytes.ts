import {
  formatBytes as formatBytesShared,
  type LanguageCode,
} from "@shared/i18n";

// Định dạng số byte → chuỗi dễ đọc (037 — section Lưu trữ). 123: uỷ cho bản dùng chung theo ngôn ngữ
// (vi dùng dấu phẩy thập phân "1,5 KB"; en "1.5 KB").

/** VD 0 → "0 B"; 1536 → "1,5 KB" (vi) / "1.5 KB" (en); 1073741824 → "1 GB". Số âm/không hợp lệ → "0 B". */
export function formatBytes(bytes: number, lang: LanguageCode = "vi"): string {
  return formatBytesShared(bytes, lang);
}
