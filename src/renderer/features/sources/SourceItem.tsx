import type { Source } from "@shared/ipc/types";
import { statClass, statusLabel } from "./source-status";

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
  onRetry,
  onDelete,
}: {
  source: Source;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}): JSX.Element {
  return (
    <li className="src" data-testid={`source-${source.id}`}>
      <span className="src-icon">{KIND_ICON[source.kind]}</span>
      <div className="src-main">
        <span className="src-title">{source.title}</span>
        <span className="src-sub">
          <span className={`stat ${statClass(source.status)}`} />
          {statusLabel(source)} · {subLabel(source)}
        </span>
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
