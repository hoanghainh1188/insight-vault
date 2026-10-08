import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createTranslator,
  type LanguageCode,
  type UiLanguagePreference,
} from "@shared/i18n";
import type { UiLanguageState } from "@shared/ipc/types";
import { UiLanguageContext, type UiLanguageContextValue } from "./i18n-context";

// 123 (FR-004, FR-006): đọc ngôn ngữ hiệu lực từ main, cập nhật theo sự kiện app:uiLanguageChanged (không reload),
// đồng bộ <html lang>. Bọc NGOÀI RouterProvider (errorElement của router nằm ngoài <App/>).

interface UiLanguageApi {
  getUiLanguage?: () => Promise<UiLanguageState>;
  setUiLanguage?: (p: UiLanguagePreference) => Promise<UiLanguageState>;
  onUiLanguageChanged?: (cb: (s: UiLanguageState) => void) => () => void;
}

function api(): UiLanguageApi {
  return ((window as unknown as { api?: UiLanguageApi }).api ??
    {}) as UiLanguageApi;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UiLanguageState | null>(null);

  useEffect(() => {
    let alive = true;
    const a = api();
    const off = a.onUiLanguageChanged?.((s) => {
      if (alive) setState(s);
    });
    if (a.getUiLanguage) {
      a.getUiLanguage().then(
        (s) => alive && setState((prev) => prev ?? s),
        () =>
          alive &&
          setState((prev) => prev ?? { preference: "auto", effective: "vi" }),
      );
    } else {
      setState({ preference: "auto", effective: "vi" });
    }
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  const effective: LanguageCode = state?.effective ?? "vi";

  useEffect(() => {
    if (state) document.documentElement.lang = effective;
  }, [state, effective]);

  const setPreference = useCallback(async (pref: UiLanguagePreference) => {
    const set = api().setUiLanguage;
    if (!set) return;
    setState(await set(pref));
  }, []);

  const value = useMemo<UiLanguageContextValue>(
    () => ({
      preference: state?.preference ?? "auto",
      effective,
      translator: createTranslator(effective),
      setPreference,
    }),
    [state?.preference, effective, setPreference],
  );

  // Chờ ngôn ngữ hiệu lực (IPC vài ms) để không nháy tiếng Việt trên máy English.
  if (!state) return null;
  return (
    <UiLanguageContext.Provider value={value}>
      {children}
    </UiLanguageContext.Provider>
  );
}
