import { useT } from "../../shared/i18n/i18n-context";

// Dialog xác nhận xoá notebook (A3 — hard delete có xác nhận). `error` là câu đã dịch lúc render ở nơi gọi.
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
  const t = useT();
  return (
    <div
      className="nb-overlay"
      role="dialog"
      aria-modal="true"
      data-testid="delete-confirm"
    >
      <div className="nb-modal">
        <h3>{t.t("notebooks.delete.title")}</h3>
        <p>{t.t("notebooks.delete.body", { name })}</p>
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
            {t.t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-danger-sm"
            onClick={onConfirm}
            data-testid="delete-confirm-btn"
          >
            {t.t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
