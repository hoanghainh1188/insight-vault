import { useEffect, useState, useCallback } from "react";
import type { Model, ModelSelection } from "@shared/ipc/types";
import { ModelSelect } from "./ModelSelect";
import { useRuntimeStatus } from "./useRuntimeStatus";
import { SettingsModelAdvice } from "./SettingsModelAdvice";

// Khu vực "AI cục bộ (Ollama)" trong Cài đặt (prototype S5). Trạng thái + kiểm tra kết nối +
// chọn chat/embedding model (lưu bền qua ai:setSelectedModels). Check-on-demand (A2).
export function SettingsAiSection(): JSX.Element {
  const { status, refresh } = useRuntimeStatus();
  const [models, setModels] = useState<Model[]>([]);
  const [selection, setSelection] = useState<ModelSelection>({
    chatModel: null,
    embeddingModel: null,
  });

  const loadModelsAndSelection = useCallback(() => {
    void window.api
      .aiListModels()
      .then(setModels)
      .catch(() => setModels([]));
    void window.api
      .aiGetSelectedModels()
      .then(setSelection)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadModelsAndSelection();
  }, [loadModelsAndSelection]);

  const chatModels = models.filter((m) => m.kind !== "embedding");

  const save = (next: ModelSelection): void => {
    setSelection(next);
    window.api
      .aiSetSelectedModels(next)
      .then((saved) => {
        // Đồng bộ với giá trị đã chuẩn hoá/validate ở main (tên model không hợp lệ → null).
        setSelection(saved);
        refresh();
      })
      .catch(() => {
        // IPC lỗi bất thường: giữ lựa chọn lạc quan, không unhandled rejection.
      });
  };

  const [adviceReload, setAdviceReload] = useState(0);
  const onTest = (): void => {
    refresh();
    loadModelsAndSelection();
    setAdviceReload((n) => n + 1); // 059: re-fetch gợi ý model + health Ollama
  };

  const connected = status?.reachable === true;

  return (
    <section className="settings-ai" data-testid="settings-ai">
      <div className="settings-ai-head">
        <h3>AI cục bộ (Ollama)</h3>
        <span
          className={`tag ${connected ? "ok" : "warn"}`}
          data-testid="ai-connection"
        >
          {connected ? "Đã kết nối" : "Chưa kết nối"}
        </span>
        <button
          type="button"
          className="btn-sm"
          onClick={onTest}
          data-testid="ai-test"
        >
          Kiểm tra kết nối
        </button>
      </div>

      {!connected && (
        <div className="ai-note" data-testid="ai-status-reason">
          {status?.reason ?? "Ollama chưa sẵn sàng."}
        </div>
      )}

      <ModelSelect
        label="Mô hình trả lời"
        models={chatModels}
        selected={selection.chatModel}
        onSelect={(name) => save({ ...selection, chatModel: name })}
        emptyHint="Chưa có mô hình trả lời. Cài bằng: ollama pull qwen2.5:7b"
      />

      {/* 059: gợi ý cỡ model chat theo RAM + trạng thái Ollama (chỉ gợi ý, không tự tải). */}
      <SettingsModelAdvice reloadKey={adviceReload} />

      {/* 059: embedding CHẠY IN-PROCESS (multilingual-e5-small) — không còn cần Ollama cho khâu nhúng. */}
      <p className="ai-embed-note" data-testid="ai-embed-inprocess">
        Embedding (lập chỉ mục &amp; tìm kiếm) chạy sẵn trong ứng dụng —{" "}
        <strong>không cần Ollama</strong>. Mô hình nhúng tải một lần khi dùng
        lần đầu rồi hoạt động ngoại tuyến.
      </p>

      {/* FR-011 / F2: link/hướng dẫn tĩnh — KHÔNG tự chạy ollama pull trong app v1. */}
      <p className="ai-more-models mono" data-testid="ai-more-models">
        Tải thêm mô hình: chạy <code>ollama pull &lt;tên-model&gt;</code> trong
        terminal, xem thư viện tại ollama.com/library
      </p>
    </section>
  );
}
