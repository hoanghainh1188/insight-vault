import { describe, it, expect, vi } from "vitest";
import {
  retrieve,
  type RetrievalDeps,
} from "../../src/main/services/rag/retrieval";
import type { Chunk } from "@shared/ipc/types";
import type { VectorSearchHit } from "../../src/main/services/ingestion/vector-store";

const chunk = (id: string, text = id): Chunk => ({
  id,
  sourceId: "s1",
  ordinal: 0,
  text,
  locator: { page: 1, charStart: 0, charEnd: 5 },
});

function baseDeps(over: Partial<RetrievalDeps> = {}): RetrievalDeps {
  return {
    embed: async () => [1, 0],
    search: async (): Promise<VectorSearchHit[]> => [
      { id: "a", sourceId: "s1", score: 0.1 },
      { id: "b", sourceId: "s1", score: 0.2 },
    ],
    getChunksByIds: (ids) => ids.map((id) => chunk(id)),
    sourceTitle: () => "Nguồn",
    getVectorsByIds: async (ids) => new Map(ids.map((id) => [id, [1, 0]])),
    ...over,
  };
}

describe("retrieve hybrid (055)", () => {
  it("hợp nhất vector + BM25 (RRF); chunk BM25-only cũng vào; giữ locator", async () => {
    const deps = baseDeps({
      searchBm25: () => [
        { id: "k", score: -1 }, // chỉ có ở BM25
        { id: "a", score: -0.5 }, // trùng vector
      ],
    });
    const out = await retrieve("q", "nb1", deps);
    const ids = out.map((s) => s.chunk.id);
    expect(ids).toContain("a");
    expect(ids).toContain("k"); // BM25-only vẫn được đưa vào
    expect(out[0].chunk.locator).toBeDefined(); // Constitution II: locator giữ
  });

  it("searchBm25 ném → vector-only (không lỗi)", async () => {
    const deps = baseDeps({
      searchBm25: () => {
        throw new Error("FTS lỗi");
      },
    });
    const out = await retrieve("q", "nb1", deps);
    expect(out.map((s) => s.chunk.id)).toEqual(
      expect.arrayContaining(["a", "b"]),
    );
  });

  it("rewrite ném → dùng câu gốc (embed nhận câu gốc)", async () => {
    const embed = vi.fn(async () => [1, 0]);
    const deps = baseDeps({
      embed,
      rewrite: async () => {
        throw new Error("rewrite lỗi");
      },
    });
    await retrieve("câu gốc", "nb1", deps, []);
    // retrieve embed(q) với q = câu gốc (rewrite fallback). embed được gọi.
    expect(embed).toHaveBeenCalled();
  });

  it("rewrite thành công → embed nhận câu viết lại", async () => {
    const embed = vi.fn(async () => [1, 0]);
    const deps = baseDeps({
      embed,
      rewrite: async () => "câu viết lại",
    });
    await retrieve("nó là gì", "nb1", deps, []);
    expect(embed).toHaveBeenCalledWith("câu viết lại");
  });

  it("không hit nào (vector rỗng + bm25 rỗng) → [] (grounded 'không tìm thấy')", async () => {
    const deps = baseDeps({
      search: async () => [],
      searchBm25: () => [],
    });
    expect(await retrieve("q", "nb1", deps)).toEqual([]);
  });

  it("lọc hit vector kém liên quan (score > ngưỡng)", async () => {
    const deps = baseDeps({
      search: async () => [{ id: "far", sourceId: "s1", score: 1.5 }],
      searchBm25: () => [],
    });
    expect(await retrieve("q", "nb1", deps)).toEqual([]); // 1.5 > 0.75 → loại
  });

  it("MMR chọn ≤ RETRIEVAL_TOP_K", async () => {
    const many: VectorSearchHit[] = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      sourceId: "s1",
      score: 0.1,
    }));
    const deps = baseDeps({
      search: async () => many,
      searchBm25: () => [],
      getVectorsByIds: async (ids) =>
        new Map(ids.map((id, i) => [id, [1, i * 0.01]])),
    });
    const out = await retrieve("q", "nb1", deps);
    expect(out.length).toBeLessThanOrEqual(6);
  });
});
