import { useEffect, useState } from "react";
import type { ModelRecommendation, OllamaHealth } from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";

// 059: gợi ý cỡ model chat theo RAM máy + health-check Ollama (chỉ phục vụ chat — embedding đã in-process).
// CHỈ gợi ý/hướng dẫn, KHÔNG tự tải model. Hiển thị trong Cài đặt → AI.
export function SettingsModelAdvice({
  reloadKey = 0,
}: {
  /** Đổi giá trị (vd khi bấm "Kiểm tra kết nối") → re-fetch gợi ý + health Ollama. */
  reloadKey?: number;
}): JSX.Element {
  const t = useT();
  const [rec, setRec] = useState<ModelRecommendation | null>(null);
  const [health, setHealth] = useState<OllamaHealth | null>(null);

  useEffect(() => {
    void window.api
      .aiRecommendModel()
      .then(setRec)
      .catch(() => setRec(null));
    void window.api
      .aiOllamaHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [reloadKey]);

  return (
    <div className="model-advice" data-testid="model-advice">
      {rec && (
        <p className="advice-line" data-testid="ram-advice">
          {t.t("ai.advice.ramBefore")}{" "}
          <strong>{t.t("ai.advice.ramAmount", { gb: rec.totalMemGb })}</strong>{" "}
          {t.t("ai.advice.ramAfter", {
            label: t.t(`ai.advice.tier.${rec.tier}`),
          })}
          {rec.examples.length > 0 && (
            <>
              {" "}
              {t.t("ai.advice.suggestions")}{" "}
              {rec.examples.map((ex, i) => (
                <span key={ex}>
                  {i > 0 && ", "}
                  <code>{ex}</code>
                </span>
              ))}
              .
            </>
          )}
        </p>
      )}

      {health && (
        <p
          className={`advice-line ${health.running ? "ok" : "warn"}`}
          data-testid="ollama-health"
        >
          {!health.running
            ? t.t("ai.advice.ollamaNotRunning")
            : health.modelPulled
              ? t.t("ai.advice.ollamaReady")
              : t.t("ai.advice.ollamaModelMissing", {
                  command: `ollama pull <${t.t("ai.modelNameToken")}>`,
                })}
        </p>
      )}
    </div>
  );
}
