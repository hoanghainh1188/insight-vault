import { useState } from "react";
import type { Citation, StudioResult } from "@shared/ipc/types";
import { formatCitationLabel } from "../rag-qa/citation-format";
import { MarkdownContent } from "../../shared/markdown/MarkdownContent";

// Card kết quả Studio. Render MARKDOWN an toàn + chip [n] (029, React node — KHÔNG innerHTML). Bấm chip →
// onCite (mở Source Viewer 019). Ghi chú khi truncated.

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
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string): void => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2000);
  };

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      flash("Không sao chép được.");
    }
  };

  const onExport = async (): Promise<void> => {
    try {
      const res = await window.api.studioExport({
        content: result.content,
        suggestedName: `${KIND_LABEL[result.kind]} — ${new Date(result.createdAt).toISOString().slice(0, 10)}`,
      });
      if (res.saved) flash("Đã xuất tệp.");
    } catch {
      flash("Không xuất được tệp.");
    }
  };

  return (
    <article className="studio-card" data-testid={`studio-card-${result.kind}`}>
      <header className="studio-card-head">
        <h3 className="studio-card-title">{KIND_LABEL[result.kind]}</h3>
        <div className="studio-card-actions">
          <button
            type="button"
            className="studio-cardbtn"
            onClick={() => void onCopy()}
            data-testid={`studio-copy-${result.kind}`}
          >
            {copied ? "Đã sao chép" : "Sao chép"}
          </button>
          <button
            type="button"
            className="studio-cardbtn"
            onClick={() => void onExport()}
            data-testid={`studio-export-${result.kind}`}
          >
            Xuất
          </button>
          <button
            type="button"
            className="studio-regen"
            onClick={onRegenerate}
            disabled={regenerating}
            data-testid={`studio-regen-${result.kind}`}
          >
            {regenerating ? "Đang tạo…" : "Tạo lại"}
          </button>
        </div>
      </header>
      {notice && (
        <p
          className="studio-notice"
          data-testid={`studio-notice-${result.kind}`}
        >
          {notice}
        </p>
      )}
      <div className="studio-card-body">
        <MarkdownContent
          content={result.content}
          citeByN={citeByN}
          onCite={onCite}
        />
      </div>
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
