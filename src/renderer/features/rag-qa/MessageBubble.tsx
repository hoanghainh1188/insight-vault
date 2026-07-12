import type { Citation } from "@shared/ipc/types";
import { formatCitationLabel } from "./citation-format";
import { MarkdownContent } from "../../shared/markdown/MarkdownContent";
import type { ChatMessage } from "./useChat";

// Bong bóng hội thoại (prototype S2). Trả lời AI: render MARKDOWN an toàn + chip [n] (029). Tin người dùng
// giữ text thuần. Bấm chip → mở Source Viewer (019). onCite optional.

export function MessageBubble({
  message,
  onCite,
}: {
  message: ChatMessage;
  onCite?: (c: Citation) => void;
}): JSX.Element {
  const isUser = message.role === "user";
  const citeByN = new Map((message.citations ?? []).map((c) => [c.n, c]));

  return (
    <div
      className={isUser ? "bubble user" : "bubble ai"}
      data-testid={`bubble-${message.role}`}
    >
      <span className="who" data-testid="bubble-who">
        {isUser ? "Bạn" : "InsightVault"}
      </span>
      {isUser ? (
        <p className="bubble-text">{message.content}</p>
      ) : message.streaming ? (
        // 039: đang stream → text thô + con trỏ (chip [n] chỉ xuất hiện sau khi hậu kiểm toàn văn).
        <p
          className="bubble-text bubble-streaming"
          data-testid="bubble-streaming"
        >
          {message.content}
          <span className="stream-caret" aria-hidden="true" />
        </p>
      ) : (
        <div className="bubble-text">
          <MarkdownContent
            content={message.content}
            citeByN={citeByN}
            onCite={onCite}
          />
        </div>
      )}
      {!isUser && message.citations && message.citations.length > 0 && (
        <div className="srcnote" data-testid="srcnote">
          <span className="srcnote-label">Nguồn:</span>
          {message.citations.map((c) => (
            <span key={c.n} className="srcnote-item">
              {formatCitationLabel(c)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
