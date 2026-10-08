import type { Source } from "@shared/ipc/types";
import type { UserErrorCode } from "@shared/codes/user-error";

// 112 (FR-012, FR-014; contracts/ipc-reprocess.md): điều kiện được "Xử lý lại" một nguồn. Hàm thuần — trả MÃ lỗi
// người-dùng-thấy (123: giao diện dịch) hoặc null nếu cho phép. Tệp gốc mất / bị sửa kiểm riêng ở handler IPC (cần I/O).

export const REPROCESS_ERRORS = {
  /** cùng mã khoá vault (085) — đang sao lưu/khôi phục ⇒ không ghi kho */
  vaultLocked: "vaultLocked",
  notFound: "sourceNotFound",
  notPdf: "reprocessNotPdf",
  busy: "reprocessBusy",
  badStatus: "reprocessBadStatus",
} as const satisfies Record<string, UserErrorCode>;

export function checkReprocessable(
  source: Source | null,
  state: { queued: boolean; vaultLocked: boolean },
): UserErrorCode | null {
  if (state.vaultLocked) return REPROCESS_ERRORS.vaultLocked;
  if (!source) return REPROCESS_ERRORS.notFound;
  if (source.kind !== "pdf") return REPROCESS_ERRORS.notPdf;
  if (state.queued) return REPROCESS_ERRORS.busy;
  if (source.status !== "ready" && source.status !== "error") {
    return REPROCESS_ERRORS.badStatus;
  }
  return null;
}
