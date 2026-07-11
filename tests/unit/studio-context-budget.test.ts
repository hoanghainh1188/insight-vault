import { describe, it, expect } from "vitest";
import type { ScoredChunk } from "../../src/main/services/rag/rag-types";
import { buildContext } from "../../src/main/services/rag/context-builder";

function chunk(id: string, len: number): ScoredChunk {
  return {
    chunk: {
      id,
      sourceId: "s1",
      ordinal: 0,
      text: "x".repeat(len),
      locator: { page: null, charStart: 0, charEnd: len },
    },
    sourceTitle: "Tài liệu",
    score: 0,
  };
}

describe("buildContext budget param (021-studio)", () => {
  // Mỗi chunk ~3500 ký tự: 1 chunk lọt cả hai; 2 chunk (~7000) vượt 6000 (rag) nhưng ≤ 8000 (studio).
  const scored = [chunk("c1", 3500), chunk("c2", 3500)];

  it("mặc định (6000, rag) — giữ hành vi cũ: bỏ nguyên chunk vượt ngân sách", () => {
    const { map } = buildContext(scored);
    expect(map.size).toBe(1); // chunk 2 vượt 6000 → bỏ
    expect(map.get(1)?.chunk.id).toBe("c1");
  });

  it("budget rộng hơn (8000, studio) — nhận thêm chunk", () => {
    const { map } = buildContext(scored, 8000);
    expect(map.size).toBe(2);
    expect(map.get(2)?.chunk.id).toBe("c2");
  });

  it("luôn giữ ít nhất 1 chunk dù chunk đầu vượt ngân sách", () => {
    const { map } = buildContext([chunk("big", 20000)], 8000);
    expect(map.size).toBe(1);
  });
});
