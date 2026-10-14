import type { MeetingPhase } from "@shared/ipc/types";

// 186 PR C1 — xử lý phiên dang dở lúc khởi động (research R12, data-model §5). THUẦN.
// - Người dùng đã kết thúc (kể cả thoát app có xác nhận) hoặc đang ở bước hoàn tất ⇒ tự hoàn tất tiếp.
// - Ghi bị gián đoạn ngoài ý muốn (sập, mất điện, renderer chết) ⇒ thẻ phục hồi: Hoàn tất / Giữ chưa hoàn thiện / Xoá.
// - Đã xong (done/incomplete) ⇒ không làm gì.

export type StartupAction = "autoFinalize" | "recoveryCard" | "none";

export function classifyOnStartup(
  phase: MeetingPhase,
  endedByUser: boolean,
): StartupAction {
  switch (phase) {
    case "stopping":
    case "finalizing":
      return "autoFinalize";
    case "recording":
    case "paused":
    case "interrupted":
      return endedByUser ? "autoFinalize" : "recoveryCard";
    case "done":
    case "incomplete":
      return "none";
  }
}
