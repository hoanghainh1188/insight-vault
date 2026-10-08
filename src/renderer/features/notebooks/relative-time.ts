import {
  createTranslator,
  formatRelativeTime as formatRelativeTimeShared,
  type Translator,
} from "@shared/i18n";

// "Sửa <thời gian>" (A9). Thuần + nhận `now` tiêm vào → test tất định. 123: uỷ cho bản dùng chung theo ngôn ngữ;
// mặc định tiếng Việt (giữ hành vi cũ). Thời điểm tương lai (diff âm) → "vừa xong".
export function formatRelativeTime(
  thenMs: number,
  nowMs: number,
  tr: Translator = createTranslator("vi"),
): string {
  return formatRelativeTimeShared(thenMs, nowMs, tr);
}
