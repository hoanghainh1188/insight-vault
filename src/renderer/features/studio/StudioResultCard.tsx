import { useState, type ReactNode } from "react";
import type { Citation, StudioResult } from "@shared/ipc/types";
import { isoDate } from "@shared/i18n";
import { formatCitationLabel } from "../rag-qa/citation-format";
import { MarkdownContent } from "../../shared/markdown/MarkdownContent";
import { useT } from "../../shared/i18n/i18n-context";

// Card kết quả Studio. Render MARKDOWN an toàn + chip [n] (029, React node — KHÔNG innerHTML). Bấm chip →
// onCite (mở Source Viewer 019). Ghi chú khi truncated. 123: nhãn loại = khoá `studio.kind.<kind>`.
// 178: `result` là PHIÊN BẢN đang xem — Copy / Export / chip / ghi chú / nhãn AI cục bộ đều theo phiên bản này.

// 123: thông báo chớp lưu KHOÁ (không lưu chuỗi đã dịch).
type NoticeKey = "copyFailed" | "exported" | "exportFailed";

interface StudioResultCardProps {
  result: StudioResult;
  regenerating: boolean;
  onRegenerate: () => void;
  onCite?: (c: Citation) => void;
  /** 178: bộ chọn / xoá phiên bản (đặt dưới tiêu đề thẻ). */
  versionPicker?: ReactNode;
}

export function StudioResultCard({
  result,
  regenerating,
  onRegenerate,
  onCite,
  versionPicker,
}: StudioResultCardProps): JSX.Element {
  // 098 + 178: nhãn AI cục bộ lưu cùng phiên bản (main ghi khi target local).
  const local = result.local === true;
  const t = useT();
  const kindLabel = t.t(`studio.kind.${result.kind}`);
  const citeByN = new Map(result.citations.map((c) => [c.n, c]));
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<NoticeKey | null>(null);

  const flash = (key: NoticeKey): void => {
    setNotice(key);
    setTimeout(() => setNotice(null), 2000);
  };

  const onCopy = async (): Promise<void> => {
    try {
      // Ghi clipboard qua main (#67): navigator.clipboard bị chặn ở renderer sandbox (permission +
      // file:// không phải secure context ở bản đóng gói).
      await window.api.clipboardWrite(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      flash("copyFailed");
    }
  };

  const onExport = async (): Promise<void> => {
    try {
      const res = await window.api.studioExport({
        content: result.content,
        suggestedName: t.t("studio.exportName", {
          kind: kindLabel,
          date: isoDate(result.createdAt),
        }),
      });
      if (res.saved) flash("exported");
    } catch {
      flash("exportFailed");
    }
  };

  return (
    <article className="studio-card" data-testid={`studio-card-${result.kind}`}>
      <header className="studio-card-head">
        <h3 className="studio-card-title">
          {kindLabel}
          {local && (
            <span
              className="local-answer"
              data-testid={`studio-local-${result.kind}`}
              title={t.t("studio.localBadgeTitle")}
            >
              {t.t("studio.localBadge")}
            </span>
          )}
        </h3>
        <div className="studio-card-actions">
          <button
            type="button"
            className="studio-cardbtn"
            onClick={() => void onCopy()}
            data-testid={`studio-copy-${result.kind}`}
          >
            {copied ? t.t("common.copied") : t.t("common.copy")}
          </button>
          <button
            type="button"
            className="studio-cardbtn"
            onClick={() => void onExport()}
            data-testid={`studio-export-${result.kind}`}
          >
            {t.t("chat.actions.export")}
          </button>
          <button
            type="button"
            className="studio-regen"
            onClick={onRegenerate}
            disabled={regenerating}
            data-testid={`studio-regen-${result.kind}`}
          >
            {regenerating ? t.t("studio.creating") : t.t("studio.regenerate")}
          </button>
        </div>
      </header>
      {versionPicker}
      {/* 178 (FR-024): yêu cầu tuỳ chỉnh của phiên bản — text node (React tự thoát), KHÔNG markdown / HTML. */}
      {result.customPrompt && (
        <p
          className="studio-request"
          data-testid={`studio-request-${result.kind}`}
        >
          <span className="studio-request-label">
            {t.t("studio.custom.requestHeading")}:
          </span>{" "}
          {result.customPrompt}
        </p>
      )}
      {notice && (
        <p
          className="studio-notice"
          data-testid={`studio-notice-${result.kind}`}
        >
          {t.t(`chat.actions.${notice}`)}
        </p>
      )}
      <div className="studio-card-body">
        <MarkdownContent
          content={result.content}
          citeByN={citeByN}
          onCite={onCite}
        />
      </div>
      {/* 105: tổng hợp nhiều phần (map-reduce) — chip [n] vẫn trỏ đúng đoạn nguồn (ADR studio-large-clarify). */}
      {(result.parts ?? 1) > 1 && (
        <p className="studio-truncated" data-testid="studio-parts">
          {t.plural("studio.parts", result.parts ?? 1)}
        </p>
      )}
      {result.truncated && (
        <p className="studio-truncated" data-testid="studio-truncated">
          {t.t("studio.truncated")}
        </p>
      )}
      {result.citations.length > 0 && (
        <div
          className="studio-srcnote"
          data-testid={`studio-srcnote-${result.kind}`}
        >
          <span className="studio-srcnote-label">
            {t.t("chat.sourcesLabel")}
          </span>
          {result.citations.map((c) => (
            <span key={c.n} className="studio-srcnote-item">
              {formatCitationLabel(c, t)}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
