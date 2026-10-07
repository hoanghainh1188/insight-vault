import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLanceVectorStore,
  type VectorRecord,
  type VectorStore,
} from "../../src/main/services/ingestion/vector-store";
import { RETENTION_MS } from "../../src/main/services/vector-maintenance/constants";

// 116 (research R2/R5): bảo trì trên LanceDB THẬT ở thư mục tạm — gộp fragment, dọn phiên bản, kết quả truy vấn
// không đổi, ghi đồng thời an toàn.

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = "";
});

function dirSize(d: string): number {
  return readdirSync(d, { withFileTypes: true }).reduce(
    (s, e) =>
      s +
      (e.isDirectory()
        ? dirSize(join(d, e.name))
        : statSync(join(d, e.name)).size),
    0,
  );
}

const DIM = 16;
let seed = 11;
function rnd(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647 - 0.5;
}
function rec(i: number): VectorRecord {
  return {
    id: `c${i}`,
    notebookId: `nb${i % 2}`,
    sourceId: `s${i % 10}`,
    vector: Array.from({ length: DIM }, rnd),
    dim: DIM,
  };
}

/** 80 lô nhỏ (như embedAndStore lô 32) ⇒ ≥ 80 fragment; xoá 5/10 nguồn ⇒ nửa số hàng thành rác. */
async function fragmentedStore(): Promise<VectorStore> {
  dir = mkdtempSync(join(tmpdir(), "iv-vopt-"));
  const vs = await createLanceVectorStore(dir);
  for (let b = 0; b < 80; b++) {
    await vs.add(Array.from({ length: 20 }, (_, k) => rec(b * 20 + k)));
  }
  for (let s = 0; s < 10; s += 2) await vs.deleteBySource(`s${s}`);
  return vs;
}

async function snapshot(vs: VectorStore, queries: number[][]) {
  const searches = [];
  for (const q of queries) {
    for (const nb of ["nb0", "nb1"]) searches.push(await vs.search(q, nb, 6));
  }
  const counts = [];
  for (let s = 0; s < 10; s++) counts.push(await vs.countBySource(`s${s}`));
  const vectors = await vs.getVectorsByIds(["c1", "c3", "c5", "c7", "c999"]);
  return {
    searches,
    counts,
    nb: [await vs.countByNotebook("nb0"), await vs.countByNotebook("nb1")],
    vectors: [...vectors.entries()].sort(),
  };
}

describe("LanceVectorStore stats/optimize (116)", () => {
  it("bảng chưa tồn tại ⇒ stats/optimize trả null, activeReads = 0", async () => {
    dir = mkdtempSync(join(tmpdir(), "iv-vopt-"));
    const vs = await createLanceVectorStore(dir);
    expect(await vs.stats(0)).toBeNull();
    expect(await vs.optimize(0)).toBeNull();
    expect(vs.activeReads()).toBe(0);
    await vs.close();
  });

  it("gộp fragment + dọn phiên bản: dung lượng ≤ 50%, kết quả truy vấn giống hệt", async () => {
    const vs = await fragmentedStore();
    const queries = Array.from({ length: 5 }, () =>
      Array.from({ length: DIM }, rnd),
    );
    const before = await snapshot(vs, queries);
    const s0 = await vs.stats(0);
    expect(s0).not.toBeNull();
    expect(s0!.fragmentCount).toBeGreaterThanOrEqual(64);
    expect(s0!.prunableVersions).toBeGreaterThanOrEqual(20);
    expect(s0!.rowCount).toBe(800);
    const bytesBefore = dirSize(dir);

    const r = await vs.optimize(0);
    expect(r).not.toBeNull();
    expect(r!.fragmentsRemoved).toBeGreaterThan(0);
    expect(r!.versionsRemoved).toBeGreaterThan(0);
    expect(r!.bytesFreed).toBeGreaterThan(0);

    const s1 = await vs.stats(0);
    expect(s1!.fragmentCount).toBe(1);
    expect(s1!.fragmentCount).toBeLessThan(s0!.fragmentCount);
    expect(s1!.rowCount).toBe(800);
    expect(dirSize(dir)).toBeLessThanOrEqual(bytesBefore * 0.5);
    expect(await snapshot(vs, queries)).toEqual(before);
    await vs.close();
  });

  it("biên giữ lại 10 phút ngay sau ghi ⇒ chỉ gộp, chưa dọn phiên bản nào", async () => {
    const vs = await fragmentedStore();
    expect((await vs.stats(RETENTION_MS))!.prunableVersions).toBe(0);
    const r = await vs.optimize(RETENTION_MS);
    expect(r!.fragmentsRemoved).toBeGreaterThan(0);
    expect(r!.versionsRemoved).toBe(0);
    expect((await vs.stats(RETENTION_MS))!.fragmentCount).toBe(1);
    await vs.close();
  });

  it("ghi đồng thời trong lúc optimize vẫn đúng", async () => {
    const vs = await fragmentedStore();
    const opt = vs.optimize(0);
    const writes = (async () => {
      for (let k = 0; k < 5; k++) await vs.add([rec(10_000 + k)]);
      await vs.deleteBySource("s1");
    })();
    await Promise.all([opt, writes]);
    // 1600 − 800 (đã xoá s0,s2,s4,s6,s8) = 800 hàng; − 160 của s1 + 4 mới (10001 thuộc s1 nên bị xoá theo).
    expect(await vs.countBySource("s1")).toBe(0);
    expect((await vs.stats(0))!.rowCount).toBe(800 - 160 + 4);
    await vs.close();
  });

  it("activeReads > 0 trong lúc một truy vấn đang chạy", async () => {
    const vs = await fragmentedStore();
    const p = vs.search(Array.from({ length: DIM }, rnd), "nb0", 6);
    expect(vs.activeReads()).toBe(1);
    await p;
    expect(vs.activeReads()).toBe(0);
    await vs.close();
  });
});
