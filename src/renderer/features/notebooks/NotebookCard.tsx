import type { Notebook } from "@shared/ipc/types";
import { formatRelativeTime } from "./relative-time";

// Thẻ notebook (prototype S1): stripe màu + tên + "N nguồn · Sửa <thời gian>" + nút sửa/xoá.
// Bấm thân thẻ → mở Workspace (FR-013).
export function NotebookCard({
  notebook,
  now,
  onOpen,
  onEdit,
  onDelete,
}: {
  notebook: Notebook;
  now: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <div className="nb-card" data-testid={`notebook-${notebook.id}`}>
      <button
        type="button"
        className="nb-card-open"
        onClick={onOpen}
        data-testid="notebook-open"
      >
        <div className="nb-stripe" style={{ background: notebook.color }} />
        <div className="nb-card-in">
          <h3 className="nb-card-name">{notebook.name}</h3>
          <div className="nb-card-meta">
            <span className="mono">{notebook.sourceCount} nguồn</span>
            <span>Sửa {formatRelativeTime(notebook.updatedAt, now)}</span>
          </div>
        </div>
      </button>
      <div className="nb-card-actions">
        <button
          type="button"
          className="nb-icon-btn"
          onClick={onEdit}
          data-testid="notebook-edit"
        >
          Sửa
        </button>
        <button
          type="button"
          className="nb-icon-btn danger"
          onClick={onDelete}
          data-testid="notebook-delete"
        >
          Xoá
        </button>
      </div>
    </div>
  );
}
