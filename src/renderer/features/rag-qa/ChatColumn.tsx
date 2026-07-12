import { useEffect, useState } from "react";
import type { Citation } from "@shared/ipc/types";
import { useChat } from "./useChat";
import { MessageBubble } from "./MessageBubble";
import { ModeToggle, MODE_HINTS } from "./ModeToggle";
import { IconSend } from "../../shared/icons";

// Cột Chat của Workspace (prototype S2 cột giữa). 013-rag-qa + đánh bóng 023-ui-polish (composer .cbox +
// model chip + nút gửi icon + skeleton). `onCite` (019): bấm chip [n] → mở trình xem nguồn.
// Model chip CHỈ hiển thị (đọc aiGetSelectedModels) — KHÔNG đổi logic gửi (useChat/send giữ nguyên).
export function ChatColumn({
  notebookId,
  onCite,
}: {
  notebookId: string;
  onCite?: (c: Citation) => void;
}): JSX.Element {
  const {
    messages,
    mode,
    setMode,
    loading,
    error,
    runtimeReady,
    hasReadySources,
    canSend,
    send,
    clearHistory,
  } = useChat(notebookId);
  const [draft, setDraft] = useState("");
  const [chatModel, setChatModel] = useState<string | null>(null);

  useEffect(() => {
    window.api
      .aiGetSelectedModels()
      .then((s) => setChatModel(s.chatModel))
      .catch(() => setChatModel(null));
  }, [runtimeReady]);

  const submit = (): void => {
    if (!canSend || draft.trim() === "") return;
    void send(draft);
    setDraft("");
  };

  const blockReason =
    runtimeReady === false
      ? "AI cục bộ (Ollama) chưa sẵn sàng. Mở Cài đặt để bật/chọn mô hình."
      : !hasReadySources
        ? "Nạp nguồn để bắt đầu hỏi đáp."
        : null;

  return (
    <section
      className="chat-col"
      aria-label="Hỏi đáp"
      data-testid="chat-column"
    >
      <header className="chat-head">
        <h2>Hỏi đáp</h2>
        {messages.length > 0 && (
          <button
            type="button"
            className="chat-clear"
            onClick={clearHistory}
            data-testid="chat-clear"
          >
            Xoá hội thoại
          </button>
        )}
      </header>

      <div className="chat-thread" data-testid="chat-thread">
        {messages.length === 0 && !loading && (
          <p className="chat-empty">
            Đặt câu hỏi về các nguồn trong notebook này.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} onCite={onCite} />
        ))}
        {loading && (
          <div
            className="bubble-skeleton"
            data-testid="chat-skeleton"
            aria-hidden="true"
          >
            <span className="sk-line" />
            <span className="sk-line short" />
          </div>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="chat-composer">
        {blockReason ? (
          <p className="chat-block" data-testid="chat-block">
            {blockReason}
          </p>
        ) : (
          <>
            <div className="cbox">
              <textarea
                className="composer-input"
                placeholder="Nhập câu hỏi…"
                value={draft}
                maxLength={2000}
                rows={2}
                disabled={!canSend}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                data-testid="chat-input"
              />
              <div className="cbar">
                <ModeToggle mode={mode} onChange={setMode} disabled={loading} />
                <span
                  className="model-chip"
                  title="Mô hình đang dùng — đổi ở mục Cài đặt"
                  data-testid="composer-model"
                >
                  Local · {chatModel ?? "chưa chọn"}
                </span>
                <button
                  type="button"
                  className="send-btn"
                  onClick={submit}
                  disabled={!canSend || draft.trim() === ""}
                  aria-label="Gửi"
                  data-testid="chat-send"
                >
                  <IconSend size={16} />
                </button>
              </div>
            </div>
            <p className="modehint" data-testid="mode-hint">
              {MODE_HINTS[mode]}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
