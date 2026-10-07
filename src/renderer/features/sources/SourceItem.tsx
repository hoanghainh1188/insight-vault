import { useEffect, useState } from "react";
import { PDF_EXTRACTION_VERSION, type Source } from "@shared/ipc/types";
import { statClass, statusLabel, stepLabel } from "./source-status";
import { progressValueText } from "../../shared/a11y/messages";
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

function subLabel(s: Source): string {
  if (s.kind === "url") return "Web";
  if (s.kind === "audio") return "Âm thanh";
  if (s.kind === "video") return "Video";
  if (s.kind === "image") return "Hình ảnh";
  if (s.kind === "pdf" && s.pageCount) return `PDF · ${s.pageCount} trang`;
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
    <li className="src" data-testid={`source-${source.id}`}>
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
              aria-label={`Tiến độ xử lý ${source.title}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={progressValueText(stepLabel(progress!.step), pct)}
            >
              <span
                className="src-progress-fill"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span aria-hidden="true">
              {stepLabel(progress!.step)} · {pct}%
            </span>
          </span>
        ) : (
          <span className="src-sub">
            <span className={`stat ${statClass(source.status)}`} />
            {statusLabel(source)} · {subLabel(source)}
          </span>
        )}
        {relinkMsg && (
          <span className="src-relink-msg" data-testid="source-relink-msg">
            {relinkMsg}
          </span>
        )}
        {showHint && (
          <span className="src-hint" data-testid="source-reprocess-hint">
            Xử lý lại để giữ bố cục
          </span>
        )}
        {reproc.running && (
          <span className="src-sub src-reprocess-run">
            <span
              className="src-progress"
              role="progressbar"
              aria-label={`Tiến độ xử lý lại ${source.title}`}
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
            <span aria-hidden="true">Đang xử lý lại · {reproc.pct}%</span>
            <button
              type="button"
              className="nb-icon-btn"
              onClick={() => void reproc.cancel()}
              data-testid="source-reprocess-cancel"
            >
              Huỷ
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
            aria-label={`Xử lý lại ${source.title}`}
            data-testid="source-reprocess-confirm"
          >
            <p>
              Trích xuất lại PDF để giữ dòng, cột và bảng. Các trích dẫn [n] cũ
              tới nguồn này vẫn mở được nhưng sẽ không còn tô sáng đúng vị trí.
            </p>
            <div className="src-confirm-actions">
              <button
                type="button"
                className="nb-icon-btn"
                onClick={() => setConfirming(false)}
                data-testid="source-reprocess-confirm-cancel"
              >
                Huỷ
              </button>
              <button
                type="button"
                className="nb-icon-btn primary"
                onClick={confirmReprocess}
                data-testid="source-reprocess-confirm-ok"
              >
                Xử lý lại
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
            Thử lại
          </button>
        )}
        {canReprocess && !confirming && (
          <button
            type="button"
            className="nb-icon-btn"
            aria-label={`Xử lý lại ${source.title} để giữ bố cục`}
            onClick={() => setConfirming(true)}
            data-testid="source-reprocess"
          >
            Xử lý lại
          </button>
        )}
        {canRelink && (
          <button
            type="button"
            className="nb-icon-btn"
            disabled={relinking}
            aria-label={`Chọn lại tệp gốc cho ${source.title}`}
            onClick={() => void relinkThenRetry()}
            data-testid="source-relink"
          >
            Chọn lại tệp gốc…
          </button>
        )}
        <button
          type="button"
          className="nb-icon-btn danger"
          onClick={() => onDelete(source.id)}
          data-testid="source-delete"
        >
          Xoá
        </button>
      </div>
    </li>
  );
}
