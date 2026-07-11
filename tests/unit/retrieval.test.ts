import { describe, it, expect } from "vitest";
import {
  retrieve,
  type RetrievalDeps,
} from "../../src/main/services/rag/retrieval";
import type { Chunk } from "@shared/ipc/types";
import type { VectorSearchHit } from "../../src/main/services/ingestion/vector-store";

function chunk(id: string): Chunk {
  return {
    id,
    sourceId: `s-${id}`,
    ordinal: 0,
    text: `text ${id}`,
    locator: { page: 1, charStart: 0, charEnd: 4 },
  };
}

function deps(hits: VectorSearchHit[], chunks: Chunk[]): RetrievalDeps {
  return {
    embed: async () => [0.1, 0.2, 0.3],
    search: async () => hits,
    getChunksByIds: (ids) => {
      const m = new Map(chunks.map((c) => [c.id, c]));
      return ids.map((i) => m.get(i)).filter((c): c is Chunk => c != null);
    },
    sourceTitle: (sid) => `Nguồn ${sid}`,
  };
}

describe("retrieve", () => {
  it("lọc theo ngưỡng liên quan; giữ thứ tự score tăng dần", async () => {
    const hits: VectorSearchHit[] = [
      { id: "a", sourceId: "s-a", score: 0.2 },
      { id: "b", sourceId: "s-b", score: 0.9 },
      { id: "c", sourceId: "s-c", score: 5.0 }, // vượt ngưỡng (>1.0) → loại
    ];
    const res = await retrieve(
      "hỏi",
      "nb1",
      deps(hits, [chunk("a"), chunk("b"), chunk("c")]),
    );
    expect(res.map((r) => r.chunk.id)).toEqual(["a", "b"]);
    expect(res[0].sourceTitle).toBe("Nguồn s-a");
    expect(res[0].score).toBe(0.2);
  });

  it("0 hit → []", async () => {
    expect(await retrieve("x", "nb1", deps([], []))).toEqual([]);
  });

  it("mọi hit vượt ngưỡng → []", async () => {
    const hits: VectorSearchHit[] = [{ id: "a", sourceId: "s-a", score: 9 }];
    expect(await retrieve("x", "nb1", deps(hits, [chunk("a")]))).toEqual([]);
  });

  it("chunk đã xoá (search có nhưng getChunksByIds không trả) → bỏ", async () => {
    const hits: VectorSearchHit[] = [
      { id: "gone", sourceId: "s-gone", score: 0.1 },
    ];
    expect(await retrieve("x", "nb1", deps(hits, []))).toEqual([]);
  });
});
