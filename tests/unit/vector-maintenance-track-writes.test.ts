import { describe, expect, it, vi } from "vitest";
import type { VectorStore } from "../../src/main/services/ingestion/vector-store";
import { trackVectorWrites } from "../../src/main/services/vector-maintenance/track-writes";

// 116 (contracts C2): decorator đếm thao tác ghi cho bộ lên lịch bảo trì.

function fakeStore(fail = false): VectorStore {
  const boom = async (): Promise<never> => {
    throw new Error("io");
  };
  const ok = async (): Promise<void> => undefined;
  return {
    add: fail ? boom : ok,
    deleteBySource: fail ? boom : ok,
    deleteByIds: fail ? boom : ok,
    deleteByNotebook: fail ? boom : ok,
    dropTable: fail ? boom : ok,
    countBySource: async () => 3,
    countByNotebook: async () => 4,
    search: async () => [{ id: "a", sourceId: "s", score: 0.1 }],
    getVectorsByIds: async () => new Map([["a", [1]]]),
    stats: async () => ({ fragmentCount: 2, rowCount: 5, prunableVersions: 1 }),
    optimize: async () => null,
    activeReads: () => 7,
    close: async () => undefined,
  };
}

const rec = {
  id: "a",
  notebookId: "nb",
  sourceId: "s",
  vector: [1],
  dim: 1,
};

describe("trackVectorWrites", () => {
  it("mỗi thao tác ghi thành công gọi onWrite đúng 1 lần", async () => {
    const onWrite = vi.fn();
    const vs = trackVectorWrites(fakeStore(), onWrite);
    await vs.add([rec]);
    await vs.deleteBySource("s");
    await vs.deleteByIds(["a"]);
    await vs.deleteByNotebook("nb");
    await vs.dropTable();
    expect(onWrite).toHaveBeenCalledTimes(5);
  });

  it("ghi rỗng ⇒ không tính", async () => {
    const onWrite = vi.fn();
    const vs = trackVectorWrites(fakeStore(), onWrite);
    await vs.add([]);
    await vs.deleteByIds([]);
    expect(onWrite).not.toHaveBeenCalled();
  });

  it("thao tác lỗi ⇒ ném lại nguyên lỗi, không gọi onWrite", async () => {
    const onWrite = vi.fn();
    const vs = trackVectorWrites(fakeStore(true), onWrite);
    await expect(vs.add([rec])).rejects.toThrow("io");
    await expect(vs.deleteBySource("s")).rejects.toThrow("io");
    await expect(vs.dropTable()).rejects.toThrow("io");
    expect(onWrite).not.toHaveBeenCalled();
  });

  it("onWrite ném ⇒ bị nuốt, thao tác vẫn thành công", async () => {
    const vs = trackVectorWrites(fakeStore(), () => {
      throw new Error("x");
    });
    await expect(vs.add([rec])).resolves.toBeUndefined();
  });

  it("thao tác đọc/bảo trì chuyển tiếp nguyên kết quả, không gọi onWrite; không sửa object gốc", async () => {
    const onWrite = vi.fn();
    const base = fakeStore();
    const add = base.add;
    const vs = trackVectorWrites(base, onWrite);
    expect(vs).not.toBe(base);
    expect(base.add).toBe(add);
    expect(await vs.countBySource("s")).toBe(3);
    expect(await vs.countByNotebook("nb")).toBe(4);
    expect(await vs.search([1], "nb", 6)).toEqual([
      { id: "a", sourceId: "s", score: 0.1 },
    ]);
    expect([...(await vs.getVectorsByIds(["a"])).keys()]).toEqual(["a"]);
    expect(await vs.stats(0)).toEqual({
      fragmentCount: 2,
      rowCount: 5,
      prunableVersions: 1,
    });
    expect(await vs.optimize(0)).toBeNull();
    expect(vs.activeReads()).toBe(7);
    await vs.close();
    expect(onWrite).not.toHaveBeenCalled();
  });
});
