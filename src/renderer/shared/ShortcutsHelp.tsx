import { useRef } from "react";
import { useModalA11y } from "./useModalA11y";
import { SHORTCUTS, isMacPlatform, keyLabel } from "./shortcuts";

// Bảng trợ giúp phím tắt (043) — mở bằng "?"; đóng bằng Esc/nút/nền. Tái dùng a11y modal (023).
export function ShortcutsHelp({
  onClose,
}: {
  onClose: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y({ active: true, onClose, containerRef: ref });
  const isMac = isMacPlatform();

  return (
    <div className="nb-overlay" onClick={onClose} data-testid="shortcuts-help">
      <div
        className="nb-modal shortcuts-modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Phím tắt"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-x"
          onClick={onClose}
          aria-label="Đóng"
          data-testid="shortcuts-close"
        >
          ✕
        </button>
        <h3>Phím tắt</h3>
        <ul className="shortcuts-list">
          {SHORTCUTS.map((s, i) => (
            <li key={i}>
              <span className="shortcut-keys">
                {s.keys.map((k, j) => (
                  <kbd key={j}>{keyLabel(k, isMac)}</kbd>
                ))}
              </span>
              <span className="shortcut-desc">{s.desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
