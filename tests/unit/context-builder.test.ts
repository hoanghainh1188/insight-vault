import { describe, it, expect } from "vitest";
import { buildContext } from "../../src/main/services/rag/context-builder";
import { CONTEXT_CHAR_BUDGET } from "../../src/main/services/rag/constants";
import type { ScoredChunk } from "../../src/main/services/rag/rag-types";

function sc(
  id: string,
  text: string,
  page: number | null,
  score: number,
): ScoredChunk {
  return {
    sourceTitle: `Nguồn ${id}`,
    score,
    chunk: {
      id,
      sourceId: `s-${id}`,
      ordinal: 0,
      text,
      locator: { page, charStart: 0, charEnd: text.length },
    },
  };
}

describe("buildContext", () => {
  it("đánh số [1..k] theo thứ tự đầu vào; map n→chunk đúng", () => {
    const { contextText, map } = buildContext([
      sc("a", "alpha", 1, 0.1),
      sc("b", "beta", null, 0.2),
    ]);
    expect(contextText).toContain("[1] (Nguồn: Nguồn a, trang 1)");
    expect(contextText).toContain("[2] (Nguồn: Nguồn b, trang —)");
    expect(map.get(1)?.chunk.id).toBe("a");
    expect(map.get(2)?.chunk.id).toBe("b");
  });

  it("ngân sách: BỎ NGUYÊN chunk vượt ngưỡng (không cắt giữa)", () => {
    const big = "x".repeat(CONTEXT_CHAR_BUDGET); // 1 chunk gần đầy ngân sách
    const { contextText, map } = buildContext([
      sc("a", big, 1, 0.1),
      sc("b", "beta thêm", 2, 0.2),
    ]);
    expect(map.size).toBe(1); // chunk b bị bỏ nguyên
    expect(map.get(1)?.chunk.id).toBe("a");
    expect(contextText).toContain(big); // không cắt chunk a
    expect(contextText).not.toContain("beta thêm");
  });

  it("luôn giữ ít nhất 1 chunk dù chunk đầu vượt ngân sách", () => {
    const huge = "y".repeat(CONTEXT_CHAR_BUDGET * 2);
    const { map } = buildContext([sc("a", huge, 1, 0.1)]);
    expect(map.size).toBe(1);
  });

  it("rỗng → context rỗng", () => {
    const { contextText, map } = buildContext([]);
    expect(contextText).toBe("");
    expect(map.size).toBe(0);
  });
});
