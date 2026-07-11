import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

describe("studio IPC whitelist", () => {
  it("có ≥ 25 kênh (23 cũ + studio:generate + studio:list) và không trùng tên", () => {
    expect(WHITELISTED_CHANNELS.size).toBeGreaterThanOrEqual(25);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("studio:generate + studio:list whitelisted", () => {
    expect(isWhitelisted("studio:generate")).toBe(true);
    expect(isWhitelisted("studio:list")).toBe(true);
  });

  it("kênh studio:* ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("studio:rawChunks")).toBe(false);
    expect(isWhitelisted("studio:delete")).toBe(false);
  });
});
