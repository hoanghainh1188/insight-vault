import { useEffect, type RefObject } from "react";

// Hook trợ năng cho modal (023-ui-polish, R5). THUẦN DOM — test được (jsdom).
// - Escape → onClose.
// - Khi mở: focus phần tử focusable đầu tiên trong container.
// - Focus trap: Tab/Shift+Tab vòng trong container (không rời modal).
// Markup tự đặt role="dialog" + aria-modal="true"; hook chỉ lo bàn phím/focus.

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalA11yOptions {
  active: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement>;
}

/**
 * Phần tử focusable trong container (selector đã loại disabled + tabindex=-1). Bỏ qua phần tử có
 * thuộc tính `hidden` (offsetParent không đáng tin ở môi trường không layout như jsdom).
 */
export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
  );
}

/**
 * Factory handler bàn phím cho modal — THUẦN (test được với jsdom, không cần React/testing-library).
 * Escape → onClose; Tab/Shift+Tab vòng focus trong container (trap).
 */
export function createModalKeydownHandler(
  container: HTMLElement,
  onClose: () => void,
): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusableIn(container);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const activeEl = document.activeElement as HTMLElement | null;
    if (e.shiftKey && activeEl === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first.focus();
    }
  };
}

export function useModalA11y({
  active,
  onClose,
  containerRef,
}: ModalA11yOptions): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Focus phần tử đầu khi mở.
    const initial = focusableIn(container);
    if (initial.length > 0) initial[0].focus();

    const onKeyDown = createModalKeydownHandler(container, onClose);
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [active, onClose, containerRef]);
}
