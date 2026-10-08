import { useEffect, useState } from "react";
import { PDF_EXTRACTION_VERSION, type Source } from "@shared/ipc/types";
import type { Translator } from "@shared/i18n";
import { statClass, statusLabel, stepLabel } from "./source-status";
import { progressValueText } from "../../shared/a11y/messages";
import { useT } from "../../shared/i18n/i18n-context";
import { useRelink } from "./useRelink";
import { useReprocess } from "./useReprocess";
import type { SourceProgress } from "./useSources";

const KIND_ICON: Record<Source["kind"], string> = {
  pdf: "PDF",
  docx: "DOC",
  txt: "TXT",
  md: "MD",
  url: "WEB",
  audio: "AUD",
  video: "VID",
  image: "IMG",
};

function subLabel(s: Source, tr: Translator): string {
  if (s.kind === "url") return tr.t("sources.kind.web");
  if (s.kind === "audio") return tr.t("sources.kind.audio");
  if (s.kind === "video") return tr.t("sources.kind.video");
  if (s.kind === "image") return tr.t("sources.kind.image");
  if (s.kind === "pdf" && s.pageCount)
    return tr.plural("sources.kind.pdfPages", s.pageCount);
  return KIND_ICON[s.kind];
}

// Một dòng nguồn ở cột Nguồn (prototype S2 .src): icon loại + tên + chấm trạng thái + hành động.
export function SourceItem({
  source,
  progress,
  onRetry,
  onDelete,
  onOpen,
}: {
  source: Source;
  progress?: SourceProgress; // 037: tiến độ realtime khi đang xử lý
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen?: (id: string) => void; // 019: mở trình xem nguồn từ cột Nguồn
}): JSX.Element {
  const t = useT();
  // Xem được khi nguồn đã có chunk (đã parse): ready hoặc chờ nhúng. (019)
  const openable =
    onOpen &&
    (source.status === "ready" || source.status === "awaiting_embedding");
  // Chỉ hiện thanh tiến độ khi đang xử lý (không phải trạng thái cuối).
  const showProgress =
    progress != null && source.status !== "ready" && source.status !== "error";
  const pct = showProgress ? Math.round((progress?.progress ?? 0) * 100) : 0;
  // 101: nguồn TỆP lỗi (thường do tệp gốc bị di chuyển) ⇒ chọn lại tệp rồi tự thử lại.
  const {
    relink,
    busy: relinking,
    message: relinkMsg,
    clear: clearRelinkMsg,
  } = useRelink();
  // Trạng thái nguồn đổi (thử lại/đang xử lý/sẵn sàng) ⇒ thông báo cũ không còn đúng.
  useEffect(() => clearRelinkMsg(), [source.status, clearRelinkMsg]);
  const canRelink = source.status === "error" && source.kind !== "url";
  const relinkThenRetry = async (): Promise<void> => {
    if ((await relink(source.id)) === "ok") onRetry(source.id);
  };
  // 112: PDF trích theo cách cũ ⇒ gợi ý thụ động; "Xử lý lại" (có xác nhận) cho PDF ready/error.
  const reproc = useReprocess(source.id, source.title);
  const [confirming, setConfirming] = useState(false);
  const isPdf = source.kind === "pdf";
  const showHint =
    isPdf &&
    source.status === "ready" &&
    source.extractionVersion < PDF_EXTRACTION_VERSION &&
    !reproc.running;
  const canReprocess =
    isPdf &&
    (source.status === "ready" || source.status === "error") &&
    !reproc.running;
  const confirmReprocess = (): void => {
    setConfirming(false);
    void reproc.start();
  };
  return (
    <li
      className={source.status === "error" ? "src src-error" : "src"}
      data-testid={`source-${source.id}`}
    >
      <span className={`src-icon kind-${source.kind}`}>
        {KIND_ICON[source.kind]}
      </span>
      <div className="src-main">
        {openable ? (
          <button
            type="button"
            className="src-title src-title-btn"
            onClick={() => onOpen(source.id)}
            data-testid="source-open"
          >
            {source.title}
          </button>
        ) : (
          <span className="src-title">{source.title}</span>
        )}
        {showProgress ? (
          <span className="src-sub" data-testid="source-progress">
            {/* 091: tra được bằng trình đọc màn hình (giá trị + bước); thông báo mốc nằm ở useSources. */}
            <span
              className="src-progress"
              role="progressbar"
              aria-label={t.t("sources.item.progressLabel", {
                title: source.title,
              })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={progressValueText(
                stepLabel(progress!.step, t),
                pct,
                t,
              )}
            >
              <span
                className="src-progress-fill"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span aria-hidden="true">
              {stepLabel(progress!.step, t)} · {pct}%
            </span>
          </span>
        ) : (
          <span className="src-sub">
            <span className={`stat ${statClass(source.status)}`} />
            {statusLabel(source, t)} · {subLabel(source, t)}
          </span>
        )}
        {relinkMsg && (
          <span className="src-relink-msg" data-testid="source-relink-msg">
            {relinkMsg}
          </span>
        )}
        {showHint && (
          <span className="src-hint" data-testid="source-reprocess-hint">
            {t.t("sources.item.reprocessHint")}
          </span>
        )}
        {reproc.running && (
          <span className="src-sub src-reprocess-run">
            <span
              className="src-progress"
              role="progressbar"
              aria-label={t.t("sources.item.reprocessProgressLabel", {
                title: source.title,
              })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={reproc.pct}
              data-testid="source-reprocess-progress"
            >
              <span
                className="src-progress-fill"
                style={{ width: `${reproc.pct}%` }}
              />
            </span>
            <span aria-hidden="true">
              {t.t("sources.item.reprocessRunning", { pct: reproc.pct })}
            </span>
            <button
              type="button"
              className="nb-icon-btn"
              onClick={() => void reproc.cancel()}
              data-testid="source-reprocess-cancel"
            >
              {t.t("common.cancel")}
            </button>
          </span>
        )}
        {reproc.message && (
          <span className="src-relink-msg" data-testid="source-reprocess-msg">
            {reproc.message}
          </span>
        )}
        {confirming && (
          <div
            className="src-confirm"
            role="alertdialog"
            aria-label={t.t("sources.item.reprocessConfirmLabel", {
              title: source.title,
            })}
            data-testid="source-reprocess-confirm"
          >
            <p>{t.t("sources.item.reprocessConfirmBody")}</p>
            <div className="src-confirm-actions">
              <button
                type="button"
                className="nb-icon-btn"
                onClick={() => setConfirming(false)}
                data-testid="source-reprocess-confirm-cancel"
              >
                {t.t("common.cancel")}
              </button>
              <button
                type="button"
                className="nb-icon-btn primary"
                onClick={confirmReprocess}
                data-testid="source-reprocess-confirm-ok"
              >
                {t.t("sources.item.reprocess")}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="src-actions">
        {source.status === "error" && (
          <button
            type="button"
            className="nb-icon-btn"
            onClick={() => onRetry(source.id)}
            data-testid="source-retry"
          >
            {t.t("common.retry")}
          </button>
        )}
        {canReprocess && !confirming && (
          <button
            type="button"
            className="nb-icon-btn"
            aria-label={t.t("sources.item.reprocessAria", {
              title: source.title,
            })}
            onClick={() => setConfirming(true)}
            data-testid="source-reprocess"
          >
            {t.t("sources.item.reprocess")}
          </button>
        )}
        {canRelink && (
          <button
            type="button"
            className="nb-icon-btn"
            disabled={relinking}
            aria-label={t.t("sources.item.relinkAria", {
              title: source.title,
            })}
            onClick={() => void relinkThenRetry()}
            data-testid="source-relink"
          >
            {t.t("sources.item.relink")}
          </button>
        )}
        <button
          type="button"
          className="nb-icon-btn danger"
          onClick={() => onDelete(source.id)}
          data-testid="source-delete"
        >
          {t.t("common.delete")}
        </button>
      </div>
    </li>
  );
}
