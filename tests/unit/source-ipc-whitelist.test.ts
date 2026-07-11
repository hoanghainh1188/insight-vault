import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

const SOURCE_CHANNELS = [
  "source:add",
  "source:listByNotebook",
  "source:get",
  "source:delete",
  "source:retry",
  "source:progress",
];

describe("source IPC whitelist", () => {
  it("có ≥ 21 kênh (15 cũ + 6 source) và không trùng tên", () => {
    expect(WHITELISTED_CHANNELS.size).toBeGreaterThanOrEqual(21);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("6 kênh source:* (5 invoke + progress) đều whitelisted", () => {
    for (const ch of SOURCE_CHANNELS) expect(isWhitelisted(ch)).toBe(true);
  });

  it("kênh source:* ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("source:rawQuery")).toBe(false);
    expect(isWhitelisted("source:dropTable")).toBe(false);
    expect(isWhitelisted("source:readFile")).toBe(false);
  });
});
