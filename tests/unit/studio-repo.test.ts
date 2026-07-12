import { describe, it, expect } from "vitest";
import type { Citation } from "../../src/shared/ipc/types";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createStudioRepo } from "../../src/main/services/studio/studio-repo";

function setup() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N1", "#4F46E5", 1, 1);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb2", "N2", "#4F46E5", 1, 1);
  let t = 1000;
  let n = 0;
  const repo = createStudioRepo(db, {
    now: () => ++t,
    uuid: () => `id-${++n}`,
  });
  return { db, repo };
}

const cites: Citation[] = [
  {
    n: 1,
    chunkId: "c1",
    sourceId: "s1",
    sourceTitle: "Tài liệu",
    locator: { page: 2, charStart: 10, charEnd: 40 },
  },
];

describe("studio-repo", () => {
  it("migration #3 đã áp (bảng studio_result tồn tại; user_version ≥ 3)", () => {
    const { db } = setup();
    const row = db.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(row.user_version).toBeGreaterThanOrEqual(3);
    const tbl = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='studio_result'",
      )
      .get();
    expect(tbl).toBeTruthy();
  });

  it("upsert tạo mới rồi ghi đè cùng (notebook,kind) — chỉ 1 hàng", () => {
    const { db, repo } = setup();
    const a = repo.upsert("nb1", "summary", "bản 1 [1]", cites);
    expect(a.content).toBe("bản 1 [1]");
    expect(a.citations).toHaveLength(1);

    const b = repo.upsert("nb1", "summary", "bản 2 mới", []);
    expect(b.content).toBe("bản 2 mới");
    expect(b.citations).toHaveLength(0);

    const count = db
      .prepare(
        "SELECT COUNT(*) AS c FROM studio_result WHERE notebook_id='nb1' AND kind='summary'",
      )
      .get() as { c: number };
    expect(count.c).toBe(1);
  });

  it("listByNotebook trả các loại đã lưu; getByNotebookKind đúng loại", () => {
    const { repo } = setup();
    repo.upsert("nb1", "summary", "s", cites);
    repo.upsert("nb1", "faq", "f", []);
    repo.upsert("nb2", "outline", "o", []);

    const list1 = repo.listByNotebook("nb1");
    expect(list1.map((r) => r.kind).sort()).toEqual(["faq", "summary"]);
    expect(repo.getByNotebookKind("nb1", "faq")?.content).toBe("f");
    expect(repo.getByNotebookKind("nb1", "keyPoints")).toBeNull();
    expect(repo.listByNotebook("nb2")).toHaveLength(1);
  });

  it("citations_json khứ hồi giữ nguyên Citation[] (kèm locator)", () => {
    const { repo } = setup();
    repo.upsert("nb1", "summary", "x [1]", cites);
    const got = repo.getByNotebookKind("nb1", "summary");
    expect(got?.citations).toEqual(cites);
    expect(got?.citations[0].locator.charStart).toBe(10);
  });

  it("xoá notebook → FK CASCADE xoá mọi studio_result của notebook đó; notebook khác không ảnh hưởng", () => {
    const { db, repo } = setup();
    repo.upsert("nb1", "summary", "s", []);
    repo.upsert("nb1", "faq", "f", []);
    repo.upsert("nb2", "summary", "s2", []);

    db.prepare("DELETE FROM notebook WHERE id = ?").run("nb1");

    expect(repo.listByNotebook("nb1")).toHaveLength(0);
    expect(repo.listByNotebook("nb2")).toHaveLength(1);
  });
});
