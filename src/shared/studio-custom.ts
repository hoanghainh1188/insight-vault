// 178 (ADR studio-enhance-2-clarify #3): độ dài tối đa của yêu cầu tuỳ chỉnh Studio, đếm theo CODE POINT sau khi trim — MỘT
// nguồn cho main (kiểm — nguồn sự thật) và renderer (đếm "n/500", khoá nút sớm cho UX).
export const STUDIO_CUSTOM_PROMPT_MAX = 500;

/** Số code point (emoji / ký tự ngoài BMP = 1) — cùng cách main đếm. */
export function codePointLength(s: string): number {
  return [...s].length;
}
