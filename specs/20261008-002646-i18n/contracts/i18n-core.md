# Contract — khung dịch dùng chung (`src/shared/i18n/`)

Module thuần TS (không Node/DOM API ngoài `Intl`), import được từ main, preload-free renderer và test.

```ts
export type LanguageCode = "vi" | "en";
export type UiLanguagePreference = "auto" | LanguageCode;

export interface LanguageInfo {
  code: LanguageCode;
  nativeName: string; // "Tiếng Việt" | "English" — hiển thị trong Cài đặt bằng chính ngôn ngữ đó
  intlLocale: string; // "vi-VN" | "en-US"
}
export const LANGUAGES: readonly LanguageInfo[];
export const SOURCE_LANGUAGE: LanguageCode; // "vi"

/** Giá trị đã lưu bất kỳ ⇒ preference hợp lệ; ngoài {auto,vi,en} ⇒ "auto". */
export function parseUiLanguage(raw: unknown): UiLanguagePreference;

/** pref vi|en ⇒ pref; auto ⇒ locale bắt đầu "vi" (vi, vi-VN, vi_VN, không phân biệt hoa thường) ⇒ "vi"; còn lại ⇒ "en". */
export function resolveLanguage(pref: UiLanguagePreference, osLocale: string | undefined): LanguageCode;

/** Kiểu khoá + tham số suy từ vi.ts. */
export type MessageKey; // hợp các đường dẫn lá dạng "a.b.c"
export type PluralKey; // khoá có lá { one, other }
export type ParamsOf<K extends MessageKey>; // {} hoặc { [placeholder]: string | number }

export interface Translator {
  lang: LanguageCode;
  t<K extends MessageKey>(key: K, ...params: ParamsOf<K> extends Record<string, never> ? [] : [ParamsOf<K>]): string;
  plural<K extends PluralKey>(key: K, count: number, params?: ParamsOf<K>): string; // {count} luôn có sẵn
}
export function createTranslator(lang: LanguageCode): Translator;
```

**Hành vi `t`:**

- Tra khoá ở `lang`; thiếu (chỉ có thể nếu dữ liệu lỗi) ⇒ `vi` ⇒ trả chính khoá.
- Nội suy: thay mỗi `{name}` bằng `String(params[name])`; placeholder không có tham số giữ nguyên `{name}`; không diễn giải
  HTML/markdown (nơi hiển thị dùng text node React).
- `plural` chọn `one`/`other` bằng `new Intl.PluralRules(intlLocale).select(count)`.

**Định dạng (`format.ts`):**

```ts
export function formatDateTime(ms: number, lang: LanguageCode): string; // dateStyle medium + timeStyle short
export function formatNumber(
  n: number,
  lang: LanguageCode,
  maxFractionDigits?: number,
): string;
export function formatBytes(bytes: number, lang: LanguageCode): string; // "1,5 MB" (vi) / "1.5 MB" (en); đơn vị B/KB/MB/GB
export function formatRelativeTime(
  thenMs: number,
  nowMs: number,
  t: Translator,
): string; // bucket như relative-time.ts hiện có
export function isoDate(ms: number): string; // "yyyy-mm-dd" cho tên tệp xuất — không theo ngôn ngữ
```

**Nhận diện ngôn ngữ (`detect-language.ts`):**

```ts
export function detectQuestionLanguage(text: string): LanguageCode | undefined;
```

- Bỏ `[n]`, URL, chữ số. Có ký tự riêng tiếng Việt với mật độ ≥ 1/30 chữ cái ⇒ `vi`.
- ≥ 3 từ Latin, có từ chức năng English phổ biến và không có dấu Việt ⇒ `en`.
- Còn lại ⇒ `undefined` (câu quá ngắn, chỉ tên riêng/số, Việt không dấu, ngôn ngữ khác).

**Bất biến kiểm thử:**

- Tập khoá lá `vi` = `en`; tập placeholder mỗi khoá giống nhau; lá plural có cả `one` và `other`; không chuỗi rỗng; không ký
  tự `<`.
- `resolveLanguage("auto", x)` = `vi` với `vi`, `vi-VN`, `VI_vn`; = `en` với `en-US`, `de-DE`, `""`, `undefined`.
