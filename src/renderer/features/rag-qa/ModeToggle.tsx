import type { RagMode } from "@shared/ipc/types";

// Công tắc 2 chế độ + dòng gợi ý (prototype "modehint").
const HINTS: Record<RagMode, string> = {
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
    <div className="mode-toggle">
      <div className="mode-buttons" role="tablist">
        <button
          type="button"
          className={mode === "grounded" ? "mode active" : "mode"}
          onClick={() => onChange("grounded")}
          disabled={disabled}
          data-testid="mode-grounded"
        >
          Theo nguồn
        </button>
        <button
          type="button"
          className={mode === "open" ? "mode active" : "mode"}
          onClick={() => onChange("open")}
          disabled={disabled}
          data-testid="mode-open"
        >
          Mở rộng
        </button>
      </div>
      <span className="modehint">{HINTS[mode]}</span>
    </div>
  );
}
