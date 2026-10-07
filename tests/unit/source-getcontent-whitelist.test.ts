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

// 112 (contracts/ipc-reprocess.md): kiểm tra trích dẫn cũ dùng LẠI kênh source:getContent (nhận thêm chunkId) —
// không mở kênh mới; preload chỉ chuyển tiếp id/{sourceId, chunkId} (không đường dẫn tệp).
describe("source:getContent nhận chunkId (112)", () => {
  it("không có kênh riêng cho trích dẫn", () => {
    expect(isWhitelisted("source:getContentWithCitation")).toBe(false);
    expect(isWhitelisted("source:citationValid")).toBe(false);
  });

  it("preload sourceGetContent chấp nhận {sourceId, chunkId}", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/preload/index.ts", "utf8");
    expect(src).toMatch(
      /sourceGetContent:\s*\(\s*request:\s*string\s*\|\s*\{\s*sourceId:\s*string;\s*chunkId\?:\s*string\s*\}/,
    );
  });
});
