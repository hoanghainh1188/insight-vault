import { describe, it, expect } from "vitest";
import { CHANNELS, isWhitelisted } from "../../src/shared/ipc/channels";

describe("app-log (088) IPC whitelist", () => {
  it("2 kênh nhật ký đều whitelisted", () => {
    expect(CHANNELS.reportRendererError).toBe("app:reportRendererError");
    expect(CHANNELS.openLogsFolder).toBe("app:openLogsFolder");
    expect(isWhitelisted("app:reportRendererError")).toBe(true);
    expect(isWhitelisted("app:openLogsFolder")).toBe(true);
  });

  it("không có kênh đọc/ghi file log tuỳ ý", () => {
    expect(isWhitelisted("app:readLog")).toBe(false);
    expect(isWhitelisted("app:writeLog")).toBe(false);
  });
});
