import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

describe("rag IPC whitelist", () => {
  it("có ≥ 22 kênh (21 cũ + rag:ask) và không trùng tên", () => {
    expect(WHITELISTED_CHANNELS.size).toBeGreaterThanOrEqual(22);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("rag:ask whitelisted", () => {
    expect(isWhitelisted("rag:ask")).toBe(true);
  });

  it("streaming (039): rag:askStream, rag:streamToken, rag:stop whitelisted", () => {
    expect(isWhitelisted("rag:askStream")).toBe(true);
    expect(isWhitelisted("rag:streamToken")).toBe(true);
    expect(isWhitelisted("rag:stop")).toBe(true);
  });

  it("kênh rag:* ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("rag:eval")).toBe(false);
    expect(isWhitelisted("rag:rawQuery")).toBe(false);
  });
});
