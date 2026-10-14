import { useEffect, useRef, useState } from "react";

// 186 PR B — nút mở menu nhỏ ở thanh công cụ màn ghi (Đánh dấu, đổi ngôn ngữ). Hành động chỉ xảy ra khi người dùng CHỌN một
// mục (không như <select>: phím mũi tên trên Windows đổi giá trị ngay ⇒ lỡ khoá ngôn ngữ khi chỉ Tab qua). Esc đóng và trả
// focus về nút.

export interface PopoverMenuItem {
  key: string;
  label: string;
  className?: string;
  testId?: string;
  onSelect(): void;
}

export interface PopoverMenuProps {
  label: string;
  menuLabel: string;
  items: readonly PopoverMenuItem[];
  testId?: string;
  /** Tăng giá trị ⇒ mở menu (phím tắt Mod+Shift+M). */
  openRequest?: number;
  /** aria-keyshortcuts + tooltip của nút. */
  keyshortcuts?: { aria: string; title: string };
}

export function PopoverMenu({
  label,
  menuLabel,
  items,
  testId,
  openRequest,
  keyshortcuts,
}: PopoverMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openRequest) setOpen(true);
  }, [openRequest]);
  const first = useRef<HTMLButtonElement | null>(null);
  const toggle = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);

  const close = (): void => {
    setOpen(false);
    toggle.current?.focus();
  };

  return (
    <span className="rec-popover">
      <button
        ref={toggle}
        type="button"
        className="btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        {...(keyshortcuts
          ? {
              "aria-keyshortcuts": keyshortcuts.aria,
              title: keyshortcuts.title,
            }
          : {})}
        onClick={() => setOpen((v) => !v)}
        data-testid={testId}
      >
        {label}
      </button>
      {open && (
        <ul
          className="rec-popover-menu"
          role="menu"
          aria-label={menuLabel}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          {items.map((it, i) => (
            <li key={it.key} role="none">
              <button
                ref={i === 0 ? first : undefined}
                type="button"
                role="menuitem"
                className={`rec-popover-item ${it.className ?? ""}`}
                onClick={() => {
                  close();
                  it.onSelect();
                }}
                data-testid={it.testId}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
