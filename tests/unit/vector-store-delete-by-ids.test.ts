import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLanceVectorStore } from "../../src/main/services/ingestion/vector-store";

// 112 (research R10): deleteByIds xoá đúng vector theo chunk id (LanceDB thật trên thư mục tạm), không đụng id khác.

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("LanceVectorStore.deleteByIds", () => {
  it("xoá đúng id, giữ id khác; danh sách rỗng ⇒ no-op; id có dấu nháy an toàn", async () => {
    dir = mkdtempSync(join(tmpdir(), "iv-vs-"));
    const vs = await createLanceVectorStore(dir);
    const rec = (id: string) => ({
      id,
      notebookId: "nb1",
      sourceId: "s1",
      vector: [1, 0, 0],
      dim: 3,
    });
    await vs.add([rec("a"), rec("b"), rec("c'd"), rec("e")]);
    await vs.deleteByIds([]);
    expect(await vs.countBySource("s1")).toBe(4);
    await vs.deleteByIds(["a", "c'd"]);
    expect(await vs.countBySource("s1")).toBe(2);
    const left = await vs.getVectorsByIds(["a", "b", "c'd", "e"]);
    expect([...left.keys()].sort()).toEqual(["b", "e"]);
    await vs.close();
  });
});
