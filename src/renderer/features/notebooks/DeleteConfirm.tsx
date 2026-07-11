// Dialog xác nhận xoá notebook (A3 — hard delete có xác nhận).
export function DeleteConfirm({
  name,
  error,
  onConfirm,
  onCancel,
}: {
  name: string;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div
      className="nb-overlay"
      role="dialog"
      aria-modal="true"
      data-testid="delete-confirm"
    >
      <div className="nb-modal">
        <h3>Xoá notebook?</h3>
        <p>
          Notebook “{name}” sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn
          tác.
        </p>
        {error && (
          <div className="nb-error" data-testid="delete-error">
            {error}
          </div>
        )}
        <div className="nb-modal-actions">
          <button
            type="button"
            className="btn-sm"
            onClick={onCancel}
            data-testid="delete-cancel"
          >
            Huỷ
          </button>
          <button
            type="button"
            className="btn-danger-sm"
            onClick={onConfirm}
            data-testid="delete-confirm-btn"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
}
