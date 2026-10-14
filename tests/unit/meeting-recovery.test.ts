import { describe, it, expect } from "vitest";
import type { MeetingPhase } from "@shared/ipc/types";
import { classifyOnStartup } from "../../src/main/services/meeting-capture/recovery";

// 186 PR C1 (R12, data-model §5) — xử lý phiên dang dở lúc khởi động. THUẦN.
// Người dùng đã kết thúc (kể cả thoát có xác nhận) ⇒ tự hoàn tất; gián đoạn ngoài ý muốn ⇒ thẻ phục hồi; đã xong ⇒ không làm gì.

describe("classifyOnStartup", () => {
  it.each<[MeetingPhase, boolean, ReturnType<typeof classifyOnStartup>]>([
    ["stopping", true, "autoFinalize"],
    ["stopping", false, "autoFinalize"],
    ["finalizing", true, "autoFinalize"],
    ["finalizing", false, "autoFinalize"],
    ["recording", true, "autoFinalize"],
    ["paused", true, "autoFinalize"],
    ["interrupted", true, "autoFinalize"],
    ["recording", false, "recoveryCard"],
    ["paused", false, "recoveryCard"],
    ["interrupted", false, "recoveryCard"],
    ["done", false, "none"],
    ["done", true, "none"],
    ["incomplete", false, "none"],
    ["incomplete", true, "none"],
  ])("%s, endedByUser=%s ⇒ %s", (phase, endedByUser, expected) => {
    expect(classifyOnStartup(phase, endedByUser)).toBe(expected);
  });
});
