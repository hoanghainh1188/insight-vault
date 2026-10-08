import type { SourceRelinkResult } from "@shared/ipc/types";
import { createTranslator, type Translator } from "@shared/i18n";

const VI = createTranslator("vi");

// 101 — câu giải thích kết quả "chọn lại tệp gốc" (thuần). Huỷ ⇒ null (không báo gì).
// 123: dịch theo Translator truyền vào — gọi lúc render/announce với translator HIỆN TẠI.
export function relinkMessage(
  status: SourceRelinkResult["status"],
  tr: Translator = VI,
): string | null {
  switch (status) {
    case "ok":
    case "mismatch":
    case "wrongType":
    case "error":
    case "notApplicable":
    case "busy":
    case "locked":
      return tr.t(`sources.relink.${status}`);
    default:
      return null;
  }
}
