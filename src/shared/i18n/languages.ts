// 123 — bảng ngôn ngữ giao diện (contracts/i18n-core.md). Thêm ngôn ngữ = thêm 1 mục ở đây + 1 tệp dịch.

export type LanguageCode = "vi" | "en";
export type UiLanguagePreference = "auto" | LanguageCode;

export interface LanguageInfo {
  readonly code: LanguageCode;
  /** Tên tự xưng — hiển thị trong Cài đặt bằng chính ngôn ngữ đó. */
  readonly nativeName: string;
  /** Locale cho Intl (ngày giờ, số, plural). */
  readonly intlLocale: string;
}

export const LANGUAGES: readonly LanguageInfo[] = [
  { code: "vi", nativeName: "Tiếng Việt", intlLocale: "vi-VN" },
  { code: "en", nativeName: "English", intlLocale: "en-US" },
];

/** Ngôn ngữ nguồn của tệp dịch (giao diện gốc theo prototype). */
export const SOURCE_LANGUAGE: LanguageCode = "vi";

export function intlLocaleOf(lang: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === lang)?.intlLocale ?? "vi-VN";
}
