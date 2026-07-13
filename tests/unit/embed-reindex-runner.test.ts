import { describe, it, expect, vi } from "vitest";
import {
  runReindex,
  needsReindex,
  type ReindexDeps,
  type ChunkRef,
} from "../../src/main/services/embedding/reindex-runner";
import {
  EMBEDDING_MODEL_VERSION,
  EMBEDDING_VERSION_REINDEXING,
  EMBEDDING_DIM,
} from "../../src/main/services/embedding/model-version";

/** VectorStore giả trong bộ nhớ (chỉ phần reindex cần). */
function fakeStore(seed: Record<string, number[]> = {}) {
  const rows = new Map<string, number[]>(Object.entries(seed));
  return {
    rows,
    dropCount: 0,
    async add(records: { id: string; vector: number[] }[]) {
      for (const r of records) rows.set(r.id, r.vector);
    },
    async getVectorsByIds(ids: string[]) {
      const m = new Map<string, number[]>();
      for (const id of ids) if (rows.has(id)) m.set(id, rows.get(id)!);
      return m;
    },
    async dropTable() {
      this.dropCount++;
      rows.clear();
    },
  };
}

function makeDeps(
  refs: ChunkRef[],
  store: ReturnType<typeof fakeStore>,
  versionBox: { v: string | undefined },
  batchSize = 2,
): ReindexDeps {
  return {
    listAllChunkRefs: () => refs,
    getChunkTexts: (ids) => new Map(ids.map((id) => [id, `text-${id}`])),
    embedPassage: vi.fn(async (texts: string[]) =>
      texts.map((_, i) => [i, i, i]),
    ),
    vectorStore: store,
    readVersion: () => versionBox.v,
    writeVersion: (v) => {
      versionBox.v = v;
    },
    batchSize,
  };
}

const refs: ChunkRef[] = [
  { id: "c1", notebookId: "n1", sourceId: "s1" },
  { id: "c2", notebookId: "n1", sourceId: "s1" },
  { id: "c3", notebookId: "n2", sourceId: "s2" },
];

describe("needsReindex", () => {
  it("version hiện tại → false", () => {
    expect(needsReindex(EMBEDDING_MODEL_VERSION)).toBe(false);
  });
  it("version cũ/thiếu → true", () => {
    expect(needsReindex("nomic-embed-768")).toBe(true);
    expect(needsReindex(undefined)).toBe(true);
  });
});

describe("runReindex — fresh", () => {
  it("drop bảng cũ, nhúng lại toàn bộ, bump version khi xong", async () => {
    const store = fakeStore();
    const box = { v: "nomic-embed-768" as string | undefined };
    const deps = makeDeps(refs, store, box);
    const progress: number[][] = [];
    await runReindex({ ...deps, onProgress: (d, t) => progress.push([d, t]) });

    expect(store.dropCount).toBe(1); // drop bảng 768d đúng 1 lần
    expect(store.rows.size).toBe(3); // đã nhúng lại cả 3
    expect(box.v).toBe(EMBEDDING_MODEL_VERSION); // bump khi xong
    expect(progress.at(-1)).toEqual([3, 3]); // tiến độ chạm total
    const rec = store.rows.get("c1")!;
    expect(rec.length).toBe(3); // vector từ embedPassage giả
    expect(EMBEDDING_DIM).toBe(384); // dim mới
  });
});

describe("runReindex — resume", () => {
  it("KHÔNG drop; bỏ qua chunk đã có vector; nhúng phần còn lại", async () => {
    // c1 đã nhúng ở phiên trước (marker reindexing).
    const store = fakeStore({ c1: [9, 9, 9] });
    const box = { v: EMBEDDING_VERSION_REINDEXING as string | undefined };
    const deps = makeDeps(refs, store, box);
    const embedSpy = deps.embedPassage as ReturnType<typeof vi.fn>;
    await runReindex(deps);

    expect(store.dropCount).toBe(0); // resume KHÔNG drop
    expect(store.rows.get("c1")).toEqual([9, 9, 9]); // giữ vector cũ (không nhúng lại)
    expect(store.rows.size).toBe(3); // c2,c3 được thêm
    expect(box.v).toBe(EMBEDDING_MODEL_VERSION);
    // Chỉ nhúng c2,c3 (không nhúng c1) → tổng text nhúng = 2.
    const embedded = embedSpy.mock.calls.flatMap((c) => c[0] as string[]);
    expect(embedded).not.toContain("text-c1");
    expect(embedded.sort()).toEqual(["text-c2", "text-c3"]);
  });
});

describe("runReindex — idempotent", () => {
  it("version đã done → no-op (không drop, không nhúng)", async () => {
    const store = fakeStore({ c1: [1], c2: [1], c3: [1] });
    const box = { v: EMBEDDING_MODEL_VERSION as string | undefined };
    const deps = makeDeps(refs, store, box);
    await runReindex(deps);
    expect(store.dropCount).toBe(0);
    expect(deps.embedPassage).not.toHaveBeenCalled();
  });

  it("chạy 2 lần liên tiếp → không nhân bản", async () => {
    const store = fakeStore();
    const box = { v: "old" as string | undefined };
    await runReindex(makeDeps(refs, store, box));
    const sizeAfter1 = store.rows.size;
    await runReindex(makeDeps(refs, store, box)); // giờ version=done → no-op
    expect(store.rows.size).toBe(sizeAfter1);
    expect(store.rows.size).toBe(3);
  });
});
