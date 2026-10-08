import { useState } from "react";
import { LANGUAGES, type UiLanguagePreference } from "@shared/i18n";
import { useT, useUiLanguage } from "../../shared/i18n/i18n-context";

// 123 (FR-003, FR-004): Cài đặt › Ngôn ngữ — Tự động / Tiếng Việt / English; tên ngôn ngữ hiển thị bằng chính ngôn
// ngữ đó (người không đọc được ngôn ngữ hiện tại vẫn tìm ra). Chọn ⇒ áp dụng ngay (main phát sự kiện, không reload).

export function SettingsLanguageSection() {
  const t = useT();
  const ui = useUiLanguage();
  const [failed, setFailed] = useState(false);
  // Lựa chọn đang lưu: radio phản hồi ngay khi bấm (IPC chậm lúc máy bận ⇒ trước đây trông như bấm không ăn).
  const [pending, setPending] = useState<UiLanguagePreference | null>(null);

  const choose = async (pref: UiLanguagePreference) => {
    setFailed(false);
    setPending(pref);
    try {
      await ui.setPreference(pref);
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  };
  const selected = pending ?? ui.preference;

  const options: { value: UiLanguagePreference; label: string }[] = [
    { value: "auto", label: t.t("settings.language.auto") },
    ...LANGUAGES.map((l) => ({ value: l.code, label: l.nativeName })),
  ];

  return (
    <section
      className="settings-ai settings-language"
      data-testid="settings-language"
    >
      <fieldset className="language-options">
        <legend className="settings-ai-head">
          <h3>{t.t("settings.language.title")}</h3>
        </legend>
        <p className="ai-note">{t.t("settings.language.description")}</p>
        {options.map((o) => (
          <label key={o.value} className="language-option">
            <input
              type="radio"
              name="ui-language"
              value={o.value}
              checked={selected === o.value}
              onChange={() => void choose(o.value)}
            />
            <span lang={o.value === "auto" ? undefined : o.value}>
              {o.label}
            </span>
          </label>
        ))}
      </fieldset>
      {failed && (
        <div className="ai-note" role="alert" data-testid="language-error">
          {t.t("settings.language.saveFailed")}
        </div>
      )}
    </section>
  );
}
