import { useState } from "react";
import type { NotebookColor } from "@shared/ipc/types";
import { PALETTE, DEFAULT_COLOR } from "@shared/notebook-palette";

// Modal tạo/sửa notebook (A8): nhập tên + chọn màu từ palette. onSubmit ném lỗi → hiện message.
export interface NotebookModalProps {
  mode: "create" | "edit";
  initialName?: string;
  initialColor?: NotebookColor;
  onSubmit: (name: string, color: NotebookColor) => Promise<void>;
  onClose: () => void;
}

export function NotebookModal({
  mode,
  initialName = "",
  initialColor = DEFAULT_COLOR,
  onSubmit,
  onClose,
}: NotebookModalProps): JSX.Element {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<NotebookColor>(initialColor);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name, color);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="nb-overlay"
      role="dialog"
      aria-modal="true"
      data-testid="notebook-modal"
    >
      <div className="nb-modal">
        <h3>{mode === "create" ? "Notebook mới" : "Sửa notebook"}</h3>
        <label className="nb-field-label" htmlFor="nb-name">
          Tên
        </label>
        <input
          id="nb-name"
          className="nb-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên notebook…"
          data-testid="notebook-name-input"
          autoFocus
        />
        <div className="nb-field-label">Màu</div>
        <div className="nb-palette" data-testid="notebook-palette">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`nb-swatch${color === c ? " sel" : ""}`}
              style={{ background: c }}
              aria-label={`Màu ${c}`}
              onClick={() => setColor(c)}
              data-testid={`swatch-${c}`}
            />
          ))}
        </div>
        {error && (
          <div className="nb-error" data-testid="notebook-error">
            {error}
          </div>
        )}
        <div className="nb-modal-actions">
          <button type="button" className="btn-sm" onClick={onClose}>
            Huỷ
          </button>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={submit}
            disabled={busy}
            data-testid="notebook-submit"
          >
            {mode === "create" ? "Tạo" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
