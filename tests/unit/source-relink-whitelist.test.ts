import { describe, it, expect } from "vitest";
import { CHANNELS, isWhitelisted } from "../../src/shared/ipc/channels";

describe("source:relink (101) IPC whitelist", () => {
  it("kênh liên kết lại whitelisted, KHÔNG nhận đường dẫn từ renderer", () => {
    expect(CHANNELS.sourceRelink).toBe("source:relink");
    expect(isWhitelisted("source:relink")).toBe(true);
    expect(isWhitelisted("source:setOrigin")).toBe(false);
    expect(isWhitelisted("source:relinkPath")).toBe(false);
  });
});
