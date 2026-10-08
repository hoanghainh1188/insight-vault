import {
  createTranslator,
  parseUiLanguage,
  resolveLanguage,
  type LanguageCode,
  type Translator,
  type UiLanguagePreference,
} from "@shared/i18n";
import type { UiLanguageState } from "@shared/ipc/types";

// 123 (FR-002, FR-004, FR-005, FR-007; contracts/ipc-ui-language.md): lựa chọn ngôn ngữ giao diện lưu ở
// electron-store (khoá uiLanguage, mặc định auto — tính lại mỗi lần mở), ngôn ngữ hiệu lực, phát sự kiện đổi.
// Nhận StoreLike + locale OS tiêm vào ⇒ unit test không cần Electron.

export const UI_LANGUAGE_KEY = "uiLanguage";

export interface StoreLike {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

export interface UiLanguageDeps {
  store: StoreLike;
  /** Locale OS ưu tiên đầu tiên (app.getPreferredSystemLanguages()[0] ?? app.getLocale()). */
  osLocale: () => string | undefined;
  /** IV_UI_LANG — chỉ có hiệu lực khi app chưa đóng gói (e2e/dev), thay locale OS. */
  envOverride: string | undefined;
  isPackaged: boolean;
}

export interface UiLanguageService {
  get(): UiLanguageState;
  /** Ném nếu không thuộc {auto, vi, en}; hợp lệ ⇒ lưu (lỗi ghi không ném) + phát nếu đổi. */
  set(pref: unknown): UiLanguageState;
  onChange(cb: (s: UiLanguageState) => void): () => void;
  translator(): Translator;
}

const VALID: readonly string[] = ["auto", "vi", "en"];

export function createUiLanguageService(
  deps: UiLanguageDeps,
): UiLanguageService {
  const osLocale = (): string | undefined =>
    !deps.isPackaged && deps.envOverride ? deps.envOverride : deps.osLocale();

  let preference: UiLanguagePreference = readStored(deps.store);
  const listeners = new Set<(s: UiLanguageState) => void>();
  const current = (): UiLanguageState => ({
    preference,
    effective: resolveLanguage(preference, osLocale()),
  });

  return {
    get: current,
    set(pref) {
      if (typeof pref !== "string" || !VALID.includes(pref)) {
        throw new Error("Invalid uiLanguage.");
      }
      const before = current();
      preference = pref as UiLanguagePreference;
      try {
        deps.store.set(UI_LANGUAGE_KEY, preference);
      } catch {
        // Ghi lỗi (đĩa đầy/quyền) không ném qua IPC: vẫn áp dụng trong phiên.
      }
      const after = current();
      if (
        after.preference !== before.preference ||
        after.effective !== before.effective
      ) {
        for (const cb of listeners) cb(after);
      }
      return after;
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    translator: () => createTranslator(current().effective),
  };
}

function readStored(store: StoreLike): UiLanguagePreference {
  try {
    return parseUiLanguage(store.get(UI_LANGUAGE_KEY));
  } catch {
    return "auto";
  }
}

/** Ngôn ngữ cho hộp thoại lỗi khởi động — trước khi store sẵn sàng: theo locale OS. */
export function startupLanguage(osLocale: string | undefined): LanguageCode {
  return resolveLanguage("auto", osLocale);
}
