import { runtimeReasonText } from "./runtime-reason";
import { useEffect, useState, useCallback } from "react";
import type { Model, ModelSelection } from "@shared/ipc/types";
import { ModelSelect } from "./ModelSelect";
import { useRuntimeStatus } from "./useRuntimeStatus";
import { SettingsModelAdvice } from "./SettingsModelAdvice";
import { useT } from "../../shared/i18n/i18n-context";

// Khu vực "AI cục bộ (Ollama)" trong Cài đặt (prototype S5). Trạng thái + kiểm tra kết nối +
// chọn chat/embedding model (lưu bền qua ai:setSelectedModels). Check-on-demand (A2).
export function SettingsAiSection(): JSX.Element {
  const t = useT();
  const { status, readFailed, refresh } = useRuntimeStatus();
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
        <h3>{t.t("ai.local.title")}</h3>
        <span
          className={`tag ${connected ? "ok" : "warn"}`}
          data-testid="ai-connection"
        >
          {connected ? t.t("ai.local.connected") : t.t("ai.local.notConnected")}
        </span>
        <button
          type="button"
          className="btn-sm"
          onClick={onTest}
          data-testid="ai-test"
        >
          {t.t("ai.testConnection")}
        </button>
      </div>

      {!connected && (
        <div className="ai-note" data-testid="ai-status-reason">
          {readFailed
            ? t.t("ai.runtime.statusUnreadable")
            : ((status && runtimeReasonText(status, t)) ??
              t.t("ai.local.notReady"))}
        </div>
      )}

      <ModelSelect
        kind="chat"
        label={t.t("ai.local.chatModel")}
        models={chatModels}
        selected={selection.chatModel}
        onSelect={(name) => save({ ...selection, chatModel: name })}
        emptyHint={t.t("ai.local.chatModelEmpty")}
      />

      {/* 059: gợi ý cỡ model chat theo RAM + trạng thái Ollama (chỉ gợi ý, không tự tải). */}
      <SettingsModelAdvice reloadKey={adviceReload} />

      {/* 059: embedding CHẠY IN-PROCESS (multilingual-e5-small) — không còn cần Ollama cho khâu nhúng. */}
      <p className="ai-embed-note" data-testid="ai-embed-inprocess">
        {t.t("ai.local.embedNoteBefore")}{" "}
        <strong>{t.t("ai.local.embedNoteStrong")}</strong>
        {t.t("ai.local.embedNoteAfter")}
      </p>

      {/* FR-011 / F2: link/hướng dẫn tĩnh — KHÔNG tự chạy ollama pull trong app v1. */}
      <p className="ai-more-models mono" data-testid="ai-more-models">
        {t.t("ai.local.moreModelsBefore")}{" "}
        <code>{`ollama pull <${t.t("ai.modelNameToken")}>`}</code>{" "}
        {t.t("ai.local.moreModelsAfter")}
      </p>
    </section>
  );
}
