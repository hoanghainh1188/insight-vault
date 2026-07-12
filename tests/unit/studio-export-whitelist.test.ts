import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

describe("studio:export whitelist (025)", () => {
  it("có ≥ 26 kênh (25 cũ + studio:export), không trùng tên", () => {
    expect(WHITELISTED_CHANNELS.size).toBeGreaterThanOrEqual(26);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("studio:export whitelisted", () => {
    expect(isWhitelisted("studio:export")).toBe(true);
  });

  it("kênh ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("studio:writeFile")).toBe(false);
    expect(isWhitelisted("fs:write")).toBe(false);
  });
});
