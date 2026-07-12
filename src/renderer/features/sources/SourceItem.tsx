import type { Source } from "@shared/ipc/types";
import { statClass, statusLabel, stepLabel } from "./source-status";
import type { SourceProgress } from "./useSources";

const KIND_ICON: Record<Source["kind"], string> = {
  pdf: "PDF",
  docx: "DOC",
  txt: "TXT",
  md: "MD",
  url: "WEB",
};

function subLabel(s: Source): string {
  if (s.kind === "url") return "Web";
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
            <span className="src-progress" aria-hidden="true">
              <span
                className="src-progress-fill"
                style={{ width: `${pct}%` }}
              />
            </span>
            {stepLabel(progress!.step)} · {pct}%
          </span>
        ) : (
          <span className="src-sub">
            <span className={`stat ${statClass(source.status)}`} />
            {statusLabel(source)} · {subLabel(source)}
          </span>
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
