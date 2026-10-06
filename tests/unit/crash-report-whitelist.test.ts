import { describe, it, expect } from "vitest";
import { CHANNELS, isWhitelisted } from "../../src/shared/ipc/channels";

describe("crash-report (093) IPC whitelist", () => {
  it("4 kênh báo lỗi đều whitelisted", () => {
    expect(CHANNELS.crashGetReport).toBe("crash:getReport");
    expect(CHANNELS.crashOpenIssue).toBe("crash:openIssue");
    expect(CHANNELS.crashGetNotice).toBe("crash:getNotice");
    expect(CHANNELS.crashDismissNotice).toBe("crash:dismissNotice");
    for (const c of [
      "crash:getReport",
      "crash:openIssue",
      "crash:getNotice",
      "crash:dismissNotice",
    ])
      expect(isWhitelisted(c)).toBe(true);
  });

  it("không có kênh mở URL tuỳ ý hay đọc minidump", () => {
    expect(isWhitelisted("crash:openUrl")).toBe(false);
    expect(isWhitelisted("crash:readDump")).toBe(false);
    expect(isWhitelisted("app:openExternal")).toBe(false);
  });
});
