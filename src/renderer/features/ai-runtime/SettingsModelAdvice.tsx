import { useEffect, useState } from "react";
import type { ModelRecommendation, OllamaHealth } from "@shared/ipc/types";

// 059: gợi ý cỡ model chat theo RAM máy + health-check Ollama (chỉ phục vụ chat — embedding đã in-process).
// CHỈ gợi ý/hướng dẫn, KHÔNG tự tải model. Hiển thị trong Cài đặt → AI.
export function SettingsModelAdvice({
  reloadKey = 0,
}: {
  /** Đổi giá trị (vd khi bấm "Kiểm tra kết nối") → re-fetch gợi ý + health Ollama. */
  reloadKey?: number;
}): JSX.Element {
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
          Máy bạn có <strong>{rec.totalMemGb} GB</strong> RAM — {rec.label}.
          {rec.examples.length > 0 && (
            <>
              {" "}
              Gợi ý:{" "}
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
            ? "Ollama chưa chạy — cài/mở Ollama (ollama.com) rồi thử lại để dùng chat cục bộ."
            : health.modelPulled
              ? "Ollama đang chạy và mô hình chat đã sẵn sàng."
              : "Ollama đang chạy nhưng mô hình chat đang chọn chưa được tải — chạy ollama pull <tên-model>."}
        </p>
      )}
    </div>
  );
}
