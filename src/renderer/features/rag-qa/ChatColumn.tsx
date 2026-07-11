import { useState } from "react";
import { useChat } from "./useChat";
import { MessageBubble } from "./MessageBubble";
import { ModeToggle } from "./ModeToggle";

// Cột Chat của Workspace (prototype S2 cột giữa). Thay placeholder do 013-rag-qa.
export function ChatColumn({
  notebookId,
}: {
  notebookId: string;
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
  } = useChat(notebookId);
  const [draft, setDraft] = useState("");

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
      </header>

      <div className="chat-thread" data-testid="chat-thread">
        {messages.length === 0 && !loading && (
          <p className="chat-empty">
            Đặt câu hỏi về các nguồn trong notebook này.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {loading && (
          <div className="bubble ai" data-testid="chat-loading">
            <span className="typing">Đang trả lời…</span>
          </div>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="chat-composer">
        <ModeToggle mode={mode} onChange={setMode} disabled={loading} />
        {blockReason ? (
          <p className="chat-block" data-testid="chat-block">
            {blockReason}
          </p>
        ) : (
          <div className="composer-row">
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
            <button
              type="button"
              className="btn-primary"
              onClick={submit}
              disabled={!canSend || draft.trim() === ""}
              data-testid="chat-send"
            >
              Gửi
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
