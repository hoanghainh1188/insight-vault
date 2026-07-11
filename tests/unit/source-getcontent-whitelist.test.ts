import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

describe("source:getContent whitelist", () => {
  it("có ≥ 23 kênh (22 cũ + getContent) và không trùng tên", () => {
    expect(WHITELISTED_CHANNELS.size).toBeGreaterThanOrEqual(23);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("source:getContent whitelisted", () => {
    expect(isWhitelisted("source:getContent")).toBe(true);
  });

  it("kênh đọc đĩa ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("source:rawFile")).toBe(false);
    expect(isWhitelisted("source:readDisk")).toBe(false);
  });
});
