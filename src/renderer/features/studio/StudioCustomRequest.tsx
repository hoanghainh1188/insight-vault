import { useId, useState } from "react";
import {
  codePointLength,
  STUDIO_CUSTOM_PROMPT_MAX,
} from "@shared/studio-custom";
import { useT } from "../../shared/i18n/i18n-context";

// 178 (FR-020, ADR studio-enhance-2-clarify #3/#4): hàng "Yêu cầu tuỳ chỉnh" dưới lưới nút loại. Textarea có nhãn, đếm "n/500"
// theo code point (như main), vượt giới hạn ⇒ khoá nút + báo (KHÔNG cắt ngầm), Ctrl/Cmd+Enter gửi. Main vẫn kiểm lại (nguồn sự thật).

interface StudioCustomRequestProps {
  /** Lượt tuỳ chỉnh đang chạy. */
  loading: boolean;
  /** Chưa có nguồn sẵn sàng / mô hình chưa sẵn sàng. */
  disabled: boolean;
  onSubmit: (text: string) => void;
}

export function StudioCustomRequest({
  loading,
  disabled,
  onSubmit,
}: StudioCustomRequestProps): JSX.Element {
  const t = useT();
  const id = useId();
  const counterId = `${id}-count`;
  const errorId = `${id}-error`;
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const count = codePointLength(trimmed);
  const tooLong = count > STUDIO_CUSTOM_PROMPT_MAX;
  const canSubmit = !disabled && !loading && trimmed !== "" && !tooLong;

  const submit = (): void => {
    if (canSubmit) onSubmit(trimmed);
  };

  return (
    <div className="studio-custom" data-testid="studio-custom">
      <label className="studio-custom-label" htmlFor={id}>
        {t.t("studio.custom.label")}
      </label>
      <textarea
        id={id}
        className="studio-custom-input"
        rows={2}
        value={text}
        placeholder={t.t("studio.custom.placeholder")}
        disabled={disabled}
        aria-invalid={tooLong}
        aria-describedby={tooLong ? `${counterId} ${errorId}` : counterId}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
        data-testid="studio-custom-input"
      />
      <div className="studio-custom-foot">
        <span
          id={counterId}
          className={`studio-custom-counter${tooLong ? " over" : ""}`}
          data-testid="studio-custom-counter"
        >
          {t.t("studio.custom.counter", {
            n: count,
            max: STUDIO_CUSTOM_PROMPT_MAX,
          })}
        </span>
        <button
          type="button"
          className="btn-primary-sm studio-custom-submit"
          onClick={submit}
          disabled={!canSubmit}
          aria-label={loading ? undefined : t.t("studio.custom.submitAria")}
          data-testid="studio-custom-submit"
        >
          {loading ? t.t("studio.creating") : t.t("studio.custom.submit")}
        </button>
      </div>
      {tooLong && (
        <p
          id={errorId}
          className="studio-custom-error"
          data-testid="studio-custom-toolong"
        >
          {t.t("studio.custom.tooLong", { max: STUDIO_CUSTOM_PROMPT_MAX })}
        </p>
      )}
    </div>
  );
}
