import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHANNELS, isWhitelisted } from "../../src/shared/ipc/channels";

// 112 (FR-021, contracts/ipc-reprocess.md): 2 kênh mới whitelisted; renderer chỉ gửi sourceId (không đường dẫn).

describe("source:reprocess / source:reprocessCancel whitelist (112)", () => {
  it("kênh có trong CHANNELS và whitelisted; kênh nhận đường dẫn không tồn tại", () => {
    expect(CHANNELS.sourceReprocess).toBe("source:reprocess");
    expect(CHANNELS.sourceReprocessCancel).toBe("source:reprocessCancel");
    expect(isWhitelisted("source:reprocess")).toBe(true);
    expect(isWhitelisted("source:reprocessCancel")).toBe(true);
    expect(isWhitelisted("source:reprocessPath")).toBe(false);
    expect(isWhitelisted("source:reprocessAll")).toBe(false);
  });

  it("preload chỉ chuyển tiếp sourceId: string", () => {
    const src = readFileSync("src/preload/index.ts", "utf8");
    expect(src).toMatch(/sourceReprocess:\s*\(\s*id:\s*string,?\s*\)/);
    expect(src).toMatch(/sourceReprocessCancel:\s*\(\s*id:\s*string,?\s*\)/);
  });
});
