import type { ReactNode } from "react";
import type { Citation } from "@shared/ipc/types";
import { formatCitationLabel } from "./citation-format";
import type { ChatMessage } from "./useChat";

// Bong bóng hội thoại (prototype S2). Trả lời AI: render chip [n] (nút .cite) tại chỗ + dòng "Nguồn:".
// Bấm chip → 006-source-viewer sẽ mở nguồn; feature này chỉ cung cấp mapping (onCite optional).

const CHIP_RE = /(\[\d+\])/g;

function renderWithChips(
  text: string,
  citeByN: Map<number, Citation>,
  onCite?: (c: Citation) => void,
): ReactNode[] {
  return text.split(CHIP_RE).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m) {
      const n = Number(m[1]);
      const c = citeByN.get(n);
      if (c) {
        return (
          <button
            key={i}
            type="button"
            className="cite"
            title={formatCitationLabel(c)}
            onClick={() => onCite?.(c)}
            data-testid={`cite-${n}`}
          >
            {n}
          </button>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

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
      <p className="bubble-text">
        {isUser
          ? message.content
          : renderWithChips(message.content, citeByN, onCite)}
      </p>
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
