import type { RagMode } from "@shared/ipc/types";

// Segmented control 2 chế độ (023-ui-polish B). CHỈ render nút gạt (single-row) để canh thẳng hàng với
// model chip + nút gửi trong .cbar. Dòng gợi ý (hint) hiển thị riêng ở ChatColumn (chiều cao cố định →
// không nhảy layout khi đổi chế độ).
export const MODE_HINTS: Record<RagMode, string> = {
  grounded: "Theo nguồn: chỉ trả lời từ tài liệu đã nạp, không bịa.",
  open: "Mở rộng: dùng thêm kiến thức chung, phần ngoài nguồn được gắn nhãn.",
};

export function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: RagMode;
  onChange: (m: RagMode) => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <div
      className="segmode"
      role="group"
      aria-label="Chế độ trả lời"
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
        Theo nguồn
      </button>
      <button
        type="button"
        className={mode === "open" ? "seg active" : "seg"}
        onClick={() => onChange("open")}
        disabled={disabled}
        aria-pressed={mode === "open"}
        data-testid="mode-open"
      >
        Mở rộng
      </button>
    </div>
  );
}
