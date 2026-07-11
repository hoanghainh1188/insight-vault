import type { PrivacyState } from "@shared/ipc/types";

// Nguồn sự thật trạng thái riêng tư (Constitution I). v1: chưa có mã gọi mạng ⇒ luôn 'local'.
// Feature online-provider (008) sẽ cập nhật mode khi có egress thật; badge đọc TỪ ĐÂY, không hard-code.

const LABELS: Record<PrivacyState["mode"], string> = {
  local: "Chạy cục bộ · dữ liệu không rời máy",
  online: "AI online đang bật · một số dữ liệu sẽ gửi ra ngoài",
};

/** Suy ra văn bản badge từ mode (không để renderer tự ghép chuỗi rời rạc). */
export function labelForMode(mode: PrivacyState["mode"]): string {
  return LABELS[mode];
}

// Đếm số hoạt động egress đang diễn ra (vd fetch URL — 011-ingestion, FR-019). >0 → 'online'.
// Local-first: mặc định 0 ⇒ 'local'. Chỉ bật khi có dữ liệu THẬT rời máy do người dùng chủ động.
let egressDepth = 0;

/** Bật/tắt chỉ báo online khi có egress (fetch URL). Dùng refcount để chồng nhiều hoạt động an toàn. */
export function setEgressActive(active: boolean): void {
  egressDepth = active ? egressDepth + 1 : Math.max(0, egressDepth - 1);
}

/** Trạng thái riêng tư hiện tại (FR-019): 'online' khi đang có egress, ngược lại 'local'. */
export function getPrivacyState(): PrivacyState {
  const mode: PrivacyState["mode"] = egressDepth > 0 ? "online" : "local";
  return { mode, label: labelForMode(mode) };
}
