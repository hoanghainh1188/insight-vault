import type { StudioKind } from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";

// 149 (clarify #6): nút Huỷ của một loại đang tạo — nhãn ngắn "Huỷ", tên đọc có tên loại; sau khi bấm "Đang huỷ…" + disabled
// tới khi lượt kết thúc. Không hỏi xác nhận (huỷ không mất dữ liệu đã lưu).

interface StudioCancelProps {
  kind: StudioKind;
  cancelling: boolean;
  onCancel: () => void;
}

export function StudioCancel({
  kind,
  cancelling,
  onCancel,
}: StudioCancelProps): JSX.Element {
  const t = useT();
  return (
    <button
      type="button"
      className="btn-outline-sm studio-cancel"
      onClick={onCancel}
      disabled={cancelling}
      aria-label={
        cancelling
          ? undefined
          : t.t("studio.cancelAria", { kind: t.t(`studio.kind.${kind}`) })
      }
      data-testid={`studio-cancel-${kind}`}
    >
      {cancelling ? t.t("studio.cancelling") : t.t("common.cancel")}
    </button>
  );
}
