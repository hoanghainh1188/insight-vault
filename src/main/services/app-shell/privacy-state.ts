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

// Có provider AI online đang active không (031). true → badge 'online' kể cả khi không có egress tức thời
// (Constitution I: chỉ báo phải phản ánh đúng việc dữ liệu SẼ gửi ra ngoài khi hỏi/tổng hợp).
let onlineProviderActive = false;

/** Bật/tắt chỉ báo online khi có egress (fetch URL). Dùng refcount để chồng nhiều hoạt động an toàn. */
export function setEgressActive(active: boolean): void {
  egressDepth = active ? egressDepth + 1 : Math.max(0, egressDepth - 1);
}

/** Đặt cờ có provider AI online đang active (031) — nguồn cho badge 'online'. */
export function setOnlineProviderActive(active: boolean): void {
  onlineProviderActive = active;
}

/** Trạng thái riêng tư hiện tại (FR-019 + 031): 'online' khi có egress HOẶC provider online active. */
export function getPrivacyState(): PrivacyState {
  const mode: PrivacyState["mode"] =
    egressDepth > 0 || onlineProviderActive ? "online" : "local";
  return { mode, label: labelForMode(mode) };
}
