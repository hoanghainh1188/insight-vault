import type { RagMode } from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";

// Segmented control 2 chế độ (023-ui-polish B). CHỈ render nút gạt (single-row) để canh thẳng hàng với
// model chip + nút gửi trong .cbar. Dòng gợi ý (hint) hiển thị riêng ở ChatColumn (chiều cao cố định →
// không nhảy layout khi đổi chế độ). 123: gợi ý là KHOÁ dịch, dịch lúc render.
export const MODE_HINTS = {
  grounded: "chat.mode.groundedHint",
  open: "chat.mode.openHint",
} as const satisfies Record<RagMode, string>;

export function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: RagMode;
  onChange: (m: RagMode) => void;
  disabled?: boolean;
}): JSX.Element {
  const t = useT();
  return (
    <div
      className="segmode"
      role="group"
      aria-label={t.t("chat.mode.groupLabel")}
      data-mode={mode}
    >
      <button
        type="button"
        className={mode === "grounded" ? "seg active" : "seg"}
        onClick={() => onChange("grounded")}
        disabled={disabled}
        aria-pressed={mode === "grounded"}
        data-testid="mode-grounded"
      >
        {t.t("chat.mode.grounded")}
      </button>
      <button
        type="button"
        className={mode === "open" ? "seg active" : "seg"}
        onClick={() => onChange("open")}
        disabled={disabled}
        aria-pressed={mode === "open"}
        data-testid="mode-open"
      >
        {t.t("chat.mode.open")}
      </button>
    </div>
  );
}
