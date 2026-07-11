import { useState } from "react";
import { useRuntimeStatus } from "./useRuntimeStatus";

// Onboarding thật cho runtime AI (US3, A5): khi Ollama chưa sẵn sàng → banner thông báo + hướng dẫn +
// "cài sau" (bỏ qua → vào app trạng thái giới hạn). ollamaReady tách khỏi OnboardingState.completed (001).
export function RuntimeOnboarding(): JSX.Element | null {
  const { status, refresh } = useRuntimeStatus();
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
        <b>Runtime AI cục bộ chưa sẵn sàng.</b>{" "}
        <span data-testid="runtime-reason">{status.reason}</span> Cài Ollama tại{" "}
        <span className="mono">ollama.com</span>, chạy nó, rồi bấm "Kiểm tra
        lại".
      </div>
      <div className="runtime-banner-actions">
        <button
          type="button"
          className="btn-sm"
          onClick={refresh}
          data-testid="runtime-recheck"
        >
          Kiểm tra lại
        </button>
        <button
          type="button"
          className="btn-sm"
          onClick={() => setDismissed(true)}
          data-testid="runtime-skip"
        >
          Cài sau
        </button>
      </div>
    </div>
  );
}
