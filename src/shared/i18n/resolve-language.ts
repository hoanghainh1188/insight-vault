import type { LanguageCode, UiLanguagePreference } from "./languages";

// 123 (FR-002, FR-005): lựa chọn đã lưu ⇒ preference hợp lệ; "auto" ⇒ theo locale OS ưu tiên đầu tiên.

const PREFERENCES: readonly UiLanguagePreference[] = ["auto", "vi", "en"];

/** Giá trị lưu bất kỳ ⇒ preference hợp lệ; ngoài {auto, vi, en} ⇒ "auto". */
export function parseUiLanguage(raw: unknown): UiLanguagePreference {
  return typeof raw === "string" &&
    (PREFERENCES as readonly string[]).includes(raw)
    ? (raw as UiLanguagePreference)
    : "auto";
}

/** vi|en giữ nguyên; auto ⇒ locale bắt đầu "vi" (vi, vi-VN, vi_VN…) ⇒ vi, còn lại (kể cả rỗng) ⇒ en. */
export function resolveLanguage(
  pref: UiLanguagePreference,
  osLocale: string | undefined,
): LanguageCode {
  if (pref !== "auto") return pref;
  return /^vi(?:[-_]|$)/i.test(osLocale ?? "") ? "vi" : "en";
}
