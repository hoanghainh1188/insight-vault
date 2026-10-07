import { describe, it, expect, vi } from "vitest";
import {
  retrieve,
  type RetrievalDeps,
} from "../../src/main/services/rag/retrieval";
import type { Chunk } from "@shared/ipc/types";
import type { VectorSearchHit } from "../../src/main/services/ingestion/vector-store";
import type { RelevanceConfig } from "../../src/main/services/rag/relevance-filter";
import { RELEVANCE_CALIBRATION } from "../../src/main/services/rag/relevance-calibration";

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

  const hist = [{ role: "user" as const, content: "về hợp đồng X" }];

  it("rewrite ném (có history) → dùng câu gốc (embed nhận câu gốc)", async () => {
    const embed = vi.fn(async () => [1, 0]);
    const deps = baseDeps({
      embed,
      rewrite: async () => {
        throw new Error("rewrite lỗi");
      },
    });
    await retrieve("câu gốc", "nb1", deps, hist);
    expect(embed).toHaveBeenCalledWith("câu gốc");
  });

  it("rewrite thành công (CÓ history) → embed nhận câu viết lại", async () => {
    const embed = vi.fn(async () => [1, 0]);
    const deps = baseDeps({ embed, rewrite: async () => "câu viết lại" });
    await retrieve("nó là gì", "nb1", deps, hist);
    expect(embed).toHaveBeenCalledWith("câu viết lại");
  });

  it("câu đầu (history RỖNG) → KHÔNG rewrite, embed nhận câu gốc", async () => {
    const embed = vi.fn(async () => [1, 0]);
    const rewrite = vi.fn(async () => "không nên gọi");
    const deps = baseDeps({ embed, rewrite });
    await retrieve("câu hỏi rõ ràng", "nb1", deps, []);
    expect(rewrite).not.toHaveBeenCalled();
    expect(embed).toHaveBeenCalledWith("câu hỏi rõ ràng");
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
    expect(await retrieve("q", "nb1", deps)).toEqual([]); // 1.5 > ngưỡng → loại
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

// 108: retrieve() nhận cấu hình bộ lọc (selectRelevant) — mặc định RELEVANCE_CALIBRATION.config.
describe("retrieve — cấu hình bộ lọc độ liên quan (108)", () => {
  const hist = [{ role: "user" as const, content: "về hợp đồng X" }];
  const cfg = (over: Partial<RelevanceConfig> = {}): RelevanceConfig => ({
    maxDistance: 0.5,
    relativeDelta: null,
    bm25Gate: "none",
    bm25VectorMaxDistance: null,
    bm25MaxScore: null,
    ...over,
  });
  // câu hỏi [1,0]; a trùng hướng (d=0), k1 gần (d≈0.006), k2 trực giao (d=1)
  const vecs: Record<string, number[]> = {
    a: [1, 0],
    b: [1, 0],
    k1: [0.9, 0.1],
    k2: [0, 1],
  };
  const getVectorsByIds = vi.fn(
    async (ids: string[]) =>
      new Map(ids.filter((id) => vecs[id]).map((id) => [id, vecs[id]])),
  );
  const bm25 = () => [
    { id: "a", score: -5 },
    { id: "k1", score: -3 },
    { id: "k2", score: -2 },
  ];

  it("không truyền cfg ⇒ dùng RELEVANCE_CALIBRATION.config (baseline giữ hit chỉ-BM25)", async () => {
    const deps = baseDeps({ searchBm25: bm25, getVectorsByIds });
    const ids = (await retrieve("q", "nb1", deps)).map((s) => s.chunk.id);
    expect(RELEVANCE_CALIBRATION.config.bm25Gate).toBe("none");
    expect(ids).toEqual(expect.arrayContaining(["a", "b", "k1", "k2"]));
  });

  it("requireVector ⇒ hit chỉ-BM25 bị loại", async () => {
    const deps = baseDeps({ searchBm25: bm25, getVectorsByIds });
    const out = await retrieve(
      "q",
      "nb1",
      deps,
      [],
      cfg({ bm25Gate: "requireVector" }),
    );
    expect(out.map((s) => s.chunk.id).sort()).toEqual(["a", "b"]);
  });

  it("vectorWithin dùng distance từ getVectorsByIds + vector câu hỏi; gọi getVectorsByIds MỘT lần", async () => {
    getVectorsByIds.mockClear();
    const deps = baseDeps({ searchBm25: bm25, getVectorsByIds });
    const out = await retrieve(
      "q",
      "nb1",
      deps,
      [],
      cfg({ bm25Gate: "vectorWithin", bm25VectorMaxDistance: 0.2 }),
    );
    const ids = out.map((s) => s.chunk.id);
    expect(ids).toContain("k1");
    expect(ids).not.toContain("k2");
    expect(getVectorsByIds).toHaveBeenCalledTimes(1);
  });

  it("vectorWithin mà không có getVectorsByIds ⇒ không có distance ⇒ hit chỉ-BM25 bị loại", async () => {
    const deps = baseDeps({ searchBm25: bm25, getVectorsByIds: undefined });
    const out = await retrieve(
      "q",
      "nb1",
      deps,
      [],
      cfg({ bm25Gate: "vectorWithin", bm25VectorMaxDistance: 0.2 }),
    );
    expect(out.map((s) => s.chunk.id).sort()).toEqual(["a", "b"]);
  });

  it("(C1) hit chỉ-BM25 mang cosine distance thật; thiếu vector ⇒ cfg.maxDistance", async () => {
    const deps = baseDeps({
      searchBm25: () => [
        { id: "k2", score: -2 },
        { id: "novec", score: -1 },
      ],
      getVectorsByIds,
    });
    const out = await retrieve("q", "nb1", deps, [], cfg({ maxDistance: 0.4 }));
    const score = new Map(out.map((s) => [s.chunk.id, s.score]));
    expect(score.get("k2")).toBeCloseTo(1, 6);
    expect(score.get("novec")).toBe(0.4);
    expect(score.get("a")).toBe(0.1); // hit vector giữ distance từ search
  });

  it("minScore ⇒ chỉ giữ hit BM25 có bm25 ≤ ngưỡng", async () => {
    const deps = baseDeps({ searchBm25: bm25, getVectorsByIds });
    const out = await retrieve(
      "q",
      "nb1",
      deps,
      [],
      cfg({ bm25Gate: "minScore", bm25MaxScore: -2.5 }),
    );
    const ids = out.map((s) => s.chunk.id);
    expect(ids).toContain("k1");
    expect(ids).not.toContain("k2");
  });

  it.each(["requireVector", "vectorWithin"] as const)(
    "(E2/FR-018) searchBm25 ném với gate %s ⇒ vẫn trả kết quả vector",
    async (gate) => {
      const deps = baseDeps({
        searchBm25: () => {
          throw new Error("FTS lỗi");
        },
        getVectorsByIds,
      });
      const out = await retrieve(
        "q",
        "nb1",
        deps,
        [],
        cfg({ bm25Gate: gate, bm25VectorMaxDistance: 0.2 }),
      );
      expect(out.map((s) => s.chunk.id).sort()).toEqual(["a", "b"]);
    },
  );

  it("(E2) có history ⇒ cfg áp lên kết quả của câu đã viết lại", async () => {
    const embed = vi.fn(async () => [1, 0]);
    const deps = baseDeps({ embed, rewrite: async () => "câu viết lại" });
    const out = await retrieve(
      "nó?",
      "nb1",
      deps,
      hist,
      cfg({ maxDistance: 0.15 }),
    );
    expect(embed).toHaveBeenCalledWith("câu viết lại");
    expect(out.map((s) => s.chunk.id)).toEqual(["a"]);
  });

  it("(E2) rewrite lỗi ⇒ dùng câu gốc và VẪN áp cfg", async () => {
    const embed = vi.fn(async () => [1, 0]);
    const deps = baseDeps({
      embed,
      rewrite: async () => {
        throw new Error("x");
      },
    });
    const out = await retrieve(
      "gốc",
      "nb1",
      deps,
      hist,
      cfg({ maxDistance: 0.15 }),
    );
    expect(embed).toHaveBeenCalledWith("gốc");
    expect(out.map((s) => s.chunk.id)).toEqual(["a"]);
  });

  it("câu chỉ trùng từ thông dụng (không hỗ trợ ngữ nghĩa) + requireVector ⇒ []", async () => {
    const deps = baseDeps({
      search: async () => [{ id: "far", sourceId: "s1", score: 0.3 }],
      searchBm25: () => [{ id: "k2", score: -1 }],
      getVectorsByIds,
    });
    const out = await retrieve(
      "của là và",
      "nb1",
      deps,
      [],
      cfg({ maxDistance: 0.2, bm25Gate: "requireVector" }),
    );
    expect(out).toEqual([]);
  });
});
