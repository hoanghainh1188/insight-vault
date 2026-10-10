// 178 (FR-021, research R5): kiểm yêu cầu tuỳ chỉnh của Studio ở MAIN — văn bản renderer gửi là KHÔNG tin cậy.
// Hàm THUẦN: kiểu chuỗi → CR/CRLF thành LF → gỡ ký tự điều khiển (giữ \n, \t) → vô hiệu thẻ <request> (không thoát được
// khối trong prompt) → trim → 1..500 code point. Kết quả chỉ được đặt trong tin nhắn user (khối <request>), không vào system.

import {
  codePointLength,
  STUDIO_CUSTOM_PROMPT_MAX,
} from "@shared/studio-custom";

export { STUDIO_CUSTOM_PROMPT_MAX };

export type CustomPromptErrorCode =
  | "studioCustomPromptInvalid"
  | "studioCustomPromptEmpty"
  | "studioCustomPromptTooLong";

export type CustomPromptResult =
  | { ok: true; text: string }
  | {
      ok: false;
      code: CustomPromptErrorCode;
      params?: { max: number };
    };

// C0 trừ \t (09) và \n (0A); DEL; C1; ký tự định hướng hai chiều (đảo chiều hiển thị) + zero-width / BOM.
// (\r đã được đổi thành \n trước bước này.)
const CONTROL_CHARS =
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
// Chặn chuỗi thô quá lớn TRƯỚC regex (renderer bị chiếm quyền) — trần rộng hơn mọi chuỗi hợp lệ có thể có.
const RAW_MAX = STUDIO_CUSTOM_PROMPT_MAX * 8 + 256;

/**
 * Thẻ <request> / </request> / <request foo="…"> / <request/> (hoa thường, khoảng trắng) ⇒ `[request]` / `[/request]` — văn
 * bản (người dùng hoặc đoạn nguồn) không đóng / mở được khối giả trong tin nhắn user.
 */
export function neutralizeRequestTags(text: string): string {
  return text.replace(
    /<\s*(\/?)\s*request\b[^>]*>/gi,
    (_m, slash: string) => `[${slash}request]`,
  );
}

export function parseCustomPrompt(raw: unknown): CustomPromptResult {
  if (typeof raw !== "string") {
    return { ok: false, code: "studioCustomPromptInvalid" };
  }
  if (raw.length > RAW_MAX) {
    return {
      ok: false,
      code: "studioCustomPromptTooLong",
      params: { max: STUDIO_CUSTOM_PROMPT_MAX },
    };
  }
  const text = neutralizeRequestTags(
    raw.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, ""),
  ).trim();
  if (text === "") return { ok: false, code: "studioCustomPromptEmpty" };
  if (codePointLength(text) > STUDIO_CUSTOM_PROMPT_MAX) {
    return {
      ok: false,
      code: "studioCustomPromptTooLong",
      params: { max: STUDIO_CUSTOM_PROMPT_MAX },
    };
  }
  return { ok: true, text };
}
