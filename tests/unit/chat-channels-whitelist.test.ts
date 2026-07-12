import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

describe("chat-history whitelist (027)", () => {
  it("có ≥ 28 kênh (26 cũ + chat:history + chat:clear), không trùng tên", () => {
    expect(WHITELISTED_CHANNELS.size).toBeGreaterThanOrEqual(28);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("chat:history + chat:clear whitelisted", () => {
    expect(isWhitelisted("chat:history")).toBe(true);
    expect(isWhitelisted("chat:clear")).toBe(true);
  });

  it("kênh ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("chat:deleteMessage")).toBe(false);
    expect(isWhitelisted("chat:rawQuery")).toBe(false);
  });
});
