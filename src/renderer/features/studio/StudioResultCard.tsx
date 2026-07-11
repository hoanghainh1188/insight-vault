import type { ReactNode } from "react";
import type { Citation, StudioResult } from "@shared/ipc/types";
import { formatCitationLabel } from "../rag-qa/citation-format";

// Card kết quả Studio. Render text + chip [n] AN TOÀN (React text node, KHÔNG innerHTML — Constitution III /
// FR-015), giống MessageBubble. Bấm chip → onCite (mở Source Viewer 019). Ghi chú khi truncated.

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
            data-testid={`studio-cite-${n}`}
          >
            {n}
          </button>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

const KIND_LABEL: Record<StudioResult["kind"], string> = {
  summary: "Tóm tắt tài liệu",
  keyPoints: "Ý chính",
  faq: "FAQ",
  outline: "Dàn ý",
};

interface StudioResultCardProps {
  result: StudioResult;
  regenerating: boolean;
  onRegenerate: () => void;
  onCite?: (c: Citation) => void;
}

export function StudioResultCard({
  result,
  regenerating,
  onRegenerate,
  onCite,
}: StudioResultCardProps): JSX.Element {
  const citeByN = new Map(result.citations.map((c) => [c.n, c]));

  return (
    <article className="studio-card" data-testid={`studio-card-${result.kind}`}>
      <header className="studio-card-head">
        <h3 className="studio-card-title">{KIND_LABEL[result.kind]}</h3>
        <button
          type="button"
          className="studio-regen"
          onClick={onRegenerate}
          disabled={regenerating}
          data-testid={`studio-regen-${result.kind}`}
        >
          {regenerating ? "Đang tạo…" : "Tạo lại"}
        </button>
      </header>
      <p className="studio-card-body">
        {renderWithChips(result.content, citeByN, onCite)}
      </p>
      {result.truncated && (
        <p className="studio-truncated" data-testid="studio-truncated">
          Dựa trên phần đầu tài liệu (nội dung dài đã được rút gọn theo giới
          hạn).
        </p>
      )}
      {result.citations.length > 0 && (
        <div
          className="studio-srcnote"
          data-testid={`studio-srcnote-${result.kind}`}
        >
          <span className="studio-srcnote-label">Nguồn:</span>
          {result.citations.map((c) => (
            <span key={c.n} className="studio-srcnote-item">
              {formatCitationLabel(c)}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
