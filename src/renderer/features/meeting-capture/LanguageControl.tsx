import { useEffect, useRef } from "react";
import type { MeetingState } from "@shared/ipc/types";
import { announce } from "../../shared/a11y/announcer";
import { useT } from "../../shared/i18n/i18n-context";
import { PopoverMenu } from "./PopoverMenu";

// 186 PR B (US4, R7) — ngôn ngữ nhận dạng ở thanh dưới màn ghi: "Đang nhận dạng ngôn ngữ…" ⇒ "<Ngôn ngữ> · Tự động"; chọn
// khoá tay; gợi ý đổi ngôn ngữ (Đồng ý / Không). Mọi quyết định ở main (languagePolicy); renderer chỉ gửi hành động.

export function LanguageControl({
  state,
}: {
  state: MeetingState;
}): JSX.Element {
  const t = useT();
  const lang = state.language;
  const name = (code: "vi" | "en"): string => t.t(`meeting.language.${code}`);
  const lastAnnounced = useRef<string | null>(null);

  useEffect(() => {
    const key =
      lang.suggestion !== undefined
        ? `s:${lang.suggestion}`
        : lang.current
          ? `c:${lang.current}`
          : null;
    if (!key || key === lastAnnounced.current) return;
    const first = lastAnnounced.current === null && lang.status === "manual";
    lastAnnounced.current = key;
    if (first) return; // ngôn ngữ người dùng chọn lúc bắt đầu — không đọc lại
    if (lang.suggestion)
      announce(
        t.t("meeting.a11y.languageSuggest", {
          language: name(lang.suggestion),
        }),
      );
    else if (lang.current)
      announce(
        t.t("meeting.a11y.languageDetected", { language: name(lang.current) }),
      );
  }, [lang.current, lang.suggestion, lang.status]);

  const act = (
    input:
      | { action: "lock"; lang: "vi" | "en" }
      | { action: "acceptSuggestion" }
      | { action: "dismissSuggestion" },
  ): void => {
    void window.api
      .meetingSetLanguage({ sessionId: state.sessionId, ...input })
      .catch(() => undefined);
  };

  const status =
    lang.status === "multi"
      ? t.t("meeting.languageCtl.multi")
      : lang.status === "detecting" || !lang.current
        ? t.t("meeting.languageCtl.detecting")
        : lang.status === "locked"
          ? t.t("meeting.languageCtl.auto", { language: name(lang.current) })
          : name(lang.current);

  return (
    <div className="rec-lang" data-testid="recording-language">
      <span className="rec-lang-status" data-testid="recording-language-status">
        {status}
      </span>
      <PopoverMenu
        label={t.t("meeting.languageCtl.change")}
        menuLabel={t.t("meeting.languageCtl.label")}
        testId="recording-language-change"
        items={(["vi", "en"] as const)
          .filter((c) => !(lang.status === "manual" && lang.current === c))
          .map((c) => ({
            key: c,
            label: t.t("meeting.languageCtl.lockTo", { language: name(c) }),
            testId: `recording-language-lock-${c}`,
            onSelect: () => act({ action: "lock", lang: c }),
          }))}
      />
      {lang.suggestion && (
        <div
          className="rec-lang-suggest"
          role="group"
          aria-label={t.t("meeting.languageCtl.label")}
          data-testid="recording-language-suggest"
        >
          <span>
            {t.t("meeting.languageCtl.suggest", {
              language: name(lang.suggestion),
            })}
          </span>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() => act({ action: "acceptSuggestion" })}
          >
            {t.t("meeting.languageCtl.accept")}
          </button>
          <button
            type="button"
            className="btn-sm"
            onClick={() => act({ action: "dismissSuggestion" })}
          >
            {t.t("meeting.languageCtl.dismiss")}
          </button>
        </div>
      )}
    </div>
  );
}
