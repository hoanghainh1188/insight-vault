import { useState } from "react";
import type { Citation } from "@shared/ipc/types";
import { formatCitationLabel, formatAnswerMarkdown } from "./citation-format";
import { MarkdownContent } from "../../shared/markdown/MarkdownContent";
import type { ChatMessage } from "./useChat";

// Bong bóng hội thoại (prototype S2). Trả lời AI: render MARKDOWN an toàn + chip [n] (029). Tin người dùng
// giữ text thuần. Bấm chip → mở Source Viewer (019). onCite optional. 072: Copy/Export câu trả lời kèm nguồn.

export function MessageBubble({
  message,
  onCite,
}: {
  message: ChatMessage;
  onCite?: (c: Citation) => void;
}): JSX.Element {
  const isUser = message.role === "user";
  const citeByN = new Map((message.citations ?? []).map((c) => [c.n, c]));
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string): void => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2000);
  };

  // 072: copy/export câu trả lời + danh sách nguồn (markdown). Copy qua clipboard main (#67); export .md
  // qua hộp thoại lưu (tái dùng studioExport — ghi markdown generic ở main). KHÔNG log nội dung.
  const exportMd = (): string =>
    formatAnswerMarkdown(message.content, message.citations ?? []);

  const onCopy = async (): Promise<void> => {
    try {
      await window.api.clipboardWrite(exportMd());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      flash("Không sao chép được.");
    }
  };

  const onExport = async (): Promise<void> => {
    try {
      const res = await window.api.studioExport({
        content: exportMd(),
        suggestedName: `Câu trả lời — ${new Date().toISOString().slice(0, 10)}`,
      });
      if (res.saved) flash("Đã xuất tệp.");
    } catch {
      flash("Không xuất được tệp.");
    }
  };

  // Chỉ hiện hành động cho câu trả lời AI đã hoàn tất, có nội dung.
  const showActions =
    !isUser && !message.streaming && message.content.trim() !== "";

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
      {showActions && (
        <div className="bubble-actions" data-testid="bubble-actions">
          <button
            type="button"
            className="bubblebtn"
            onClick={() => void onCopy()}
            data-testid="bubble-copy"
          >
            {copied ? "Đã sao chép" : "Sao chép"}
          </button>
          <button
            type="button"
            className="bubblebtn"
            onClick={() => void onExport()}
            data-testid="bubble-export"
          >
            Xuất
          </button>
          {notice && (
            <span className="bubble-notice" data-testid="bubble-notice">
              {notice}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
