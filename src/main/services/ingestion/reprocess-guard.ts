import type { Source } from "@shared/ipc/types";

// 112 (FR-012, FR-014; contracts/ipc-reprocess.md): điều kiện được "Xử lý lại" một nguồn. Hàm thuần — trả thông điệp
// lỗi (hiển thị cho người dùng, không chứa dữ liệu tài liệu) hoặc null nếu cho phép. Tệp gốc mất / bị sửa kiểm riêng ở
// handler IPC (cần I/O).

export const REPROCESS_ERRORS = {
  /** cùng nội dung VAULT_LOCKED_MESSAGE (085) — đang sao lưu/khôi phục ⇒ không ghi kho */
  vaultLocked: "Đang sao lưu/khôi phục — thử lại sau giây lát.",
  notFound: "Nguồn không tồn tại.",
  notPdf: "Chỉ xử lý lại nguồn PDF.",
  busy: "Nguồn đang được xử lý.",
  badStatus: "Chỉ xử lý lại nguồn sẵn sàng hoặc lỗi.",
} as const;

export function checkReprocessable(
  source: Source | null,
  state: { queued: boolean; vaultLocked: boolean },
): string | null {
  if (state.vaultLocked) return REPROCESS_ERRORS.vaultLocked;
  if (!source) return REPROCESS_ERRORS.notFound;
  if (source.kind !== "pdf") return REPROCESS_ERRORS.notPdf;
  if (state.queued) return REPROCESS_ERRORS.busy;
  if (source.status !== "ready" && source.status !== "error") {
    return REPROCESS_ERRORS.badStatus;
  }
  return null;
}
