import { runtimeReasonText } from "./runtime-reason";
import { useState } from "react";
import { useRuntimeStatus } from "./useRuntimeStatus";
import { useT } from "../../shared/i18n/i18n-context";

// Onboarding thật cho runtime AI (US3, A5): khi Ollama chưa sẵn sàng → banner thông báo + hướng dẫn +
// "cài sau" (bỏ qua → vào app trạng thái giới hạn). ollamaReady tách khỏi OnboardingState.completed (001).
export function RuntimeOnboarding(): JSX.Element | null {
  const t = useT();
  const { status, readFailed, refresh } = useRuntimeStatus();
  const [dismissed, setDismissed] = useState(false);

  // Chỉ hiện khi đã biết trạng thái và CHƯA sẵn sàng, chưa bỏ qua trong phiên.
  if (dismissed || !status || status.ollamaReady) return null;

  return (
    <div
      className="runtime-banner"
      role="status"
      data-testid="runtime-onboarding"
    >
      <div className="runtime-banner-body">
        <b>{t.t("ai.onboarding.title")}</b>{" "}
        <span data-testid="runtime-reason">
          {readFailed
            ? t.t("ai.runtime.statusUnreadable")
            : (runtimeReasonText(status, t) ?? t.t("ai.local.notReady"))}
        </span>{" "}
        {t.t("ai.onboarding.hintBefore")}{" "}
        <span className="mono">ollama.com</span>
        {t.t("ai.onboarding.hintAfter")}
      </div>
      <div className="runtime-banner-actions">
        <button
          type="button"
          className="btn-sm"
          onClick={refresh}
          data-testid="runtime-recheck"
        >
          {t.t("ai.onboarding.recheck")}
        </button>
        <button
          type="button"
          className="btn-sm"
          onClick={() => setDismissed(true)}
          data-testid="runtime-skip"
        >
          {t.t("ai.onboarding.skip")}
        </button>
      </div>
    </div>
  );
}
