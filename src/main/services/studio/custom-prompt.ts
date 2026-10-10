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

// C0 trừ \t (09) và \n (0A); DEL. (\r đã được đổi thành \n trước bước này.)
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
// <request>, </request>, < REQUEST >… — đổi ngoặc nhọn để không đóng / mở khối giả trong tin nhắn user.
const REQUEST_TAG = /<\s*(\/?)\s*request\s*>/gi;

export function parseCustomPrompt(raw: unknown): CustomPromptResult {
  if (typeof raw !== "string") {
    return { ok: false, code: "studioCustomPromptInvalid" };
  }
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(REQUEST_TAG, (_m, slash: string) => `[${slash}request]`)
    .trim();
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
