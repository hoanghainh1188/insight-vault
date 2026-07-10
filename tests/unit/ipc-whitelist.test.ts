import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

describe("ipc whitelist", () => {
  it("đúng 5 kênh whitelisted", () => {
    expect(WHITELISTED_CHANNELS.size).toBe(5);
    expect(Object.values(CHANNELS)).toHaveLength(5);
  });

  it("cả 5 kênh app-shell đều whitelisted", () => {
    for (const ch of Object.values(CHANNELS)) {
      expect(isWhitelisted(ch)).toBe(true);
    }
  });

  it("kênh ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("app:readFile")).toBe(false);
    expect(isWhitelisted("fs:writeAnything")).toBe(false);
    expect(isWhitelisted("")).toBe(false);
  });
});
