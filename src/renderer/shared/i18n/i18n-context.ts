import { createContext, useContext } from "react";
import {
  createTranslator,
  type LanguageCode,
  type Translator,
  type UiLanguagePreference,
} from "@shared/i18n";

// 123 (research R6): ngữ cảnh ngôn ngữ giao diện cho renderer. KHÔNG có provider (test component cũ) ⇒ tiếng Việt.

export interface UiLanguageContextValue {
  preference: UiLanguagePreference;
  effective: LanguageCode;
  translator: Translator;
  setPreference: (pref: UiLanguagePreference) => Promise<void>;
}

const FALLBACK: UiLanguageContextValue = {
  preference: "auto",
  effective: "vi",
  translator: createTranslator("vi"),
  setPreference: async () => undefined,
};

export const UiLanguageContext =
  createContext<UiLanguageContextValue>(FALLBACK);

/** Translator theo ngôn ngữ hiện tại — gọi `t.t(key, params)` / `t.plural(key, n)` lúc render. */
export function useT(): Translator {
  return useContext(UiLanguageContext).translator;
}

export function useLang(): LanguageCode {
  return useContext(UiLanguageContext).effective;
}

export function useUiLanguage(): UiLanguageContextValue {
  return useContext(UiLanguageContext);
}
