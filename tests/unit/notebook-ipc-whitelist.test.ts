import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

const NOTEBOOK_CHANNELS = [
  "notebook:list",
  "notebook:create",
  "notebook:rename",
  "notebook:setColor",
  "notebook:delete",
];

describe("notebook IPC whitelist", () => {
  it("có ≥ 15 kênh (thêm 5 notebook) và không trùng tên", () => {
    expect(WHITELISTED_CHANNELS.size).toBeGreaterThanOrEqual(15);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("5 kênh notebook:* đều whitelisted", () => {
    for (const ch of NOTEBOOK_CHANNELS) expect(isWhitelisted(ch)).toBe(true);
  });

  it("kênh notebook:* ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("notebook:dropTable")).toBe(false);
    expect(isWhitelisted("notebook:rawQuery")).toBe(false);
    expect(isWhitelisted("notebook:exportAll")).toBe(false);
  });
});
