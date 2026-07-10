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

/** Trạng thái riêng tư hiện tại. v1 cố định 'local' (FR-002, SC-002). */
export function getPrivacyState(): PrivacyState {
  const mode: PrivacyState["mode"] = "local";
  return { mode, label: labelForMode(mode) };
}
