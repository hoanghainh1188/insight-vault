import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

describe("app:clipboardWrite whitelist (#67)", () => {
  it("kênh clipboardWrite tồn tại + whitelisted, tên không trùng", () => {
    expect(CHANNELS.clipboardWrite).toBe("app:clipboardWrite");
    expect(isWhitelisted("app:clipboardWrite")).toBe(true);
    expect(WHITELISTED_CHANNELS.has(CHANNELS.clipboardWrite)).toBe(true);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("kênh clipboard đọc KHÔNG được whitelist (chỉ ghi)", () => {
    expect(isWhitelisted("app:clipboardRead")).toBe(false);
    expect(isWhitelisted("clipboard:read")).toBe(false);
  });
});
