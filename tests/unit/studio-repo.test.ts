import { describe, it, expect } from "vitest";
import type { Citation } from "../../src/shared/ipc/types";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createStudioRepo } from "../../src/main/services/studio/studio-repo";
import { STUDIO_MAX_VERSIONS } from "../../src/main/services/studio/constants";

// 178 (research R2): mỗi lần lưu = 1 PHIÊN BẢN mới; trần STUDIO_MAX_VERSIONS mỗi (notebook, kind), dọn bản cũ nhất trong
// cùng giao dịch; liệt kê / xoá từng phiên bản; parts / truncated / local lưu cùng phiên bản (G4).

function setup(opts: { sameTime?: boolean } = {}) {
  const db = openDatabase(":memory:");
  runMigrations(db);
  for (const id of ["nb1", "nb2"]) {
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run(id, id, "#4F46E5", 1, 1);
  }
  let t = 1000;
  let n = 0;
  const repo = createStudioRepo(db, {
    now: () => (opts.sameTime ? t : ++t),
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

function count(
  db: ReturnType<typeof openDatabase>,
  nb: string,
  kind: string,
): number {
  return (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM studio_result WHERE notebook_id=? AND kind=?",
      )
      .get(nb, kind) as { c: number }
  ).c;
}

describe("studio-repo — phiên bản (178)", () => {
  it("STUDIO_MAX_VERSIONS = 10", () => {
    expect(STUDIO_MAX_VERSIONS).toBe(10);
  });

  it("insert luôn tạo phiên bản MỚI (id mới), không ghi đè", () => {
    const { db, repo } = setup();
    const a = repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "bản 1 [1]",
      citations: cites,
    });
    const b = repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "bản 2",
      citations: [],
    });
    expect(a.id).toBe("id-1");
    expect(b.id).toBe("id-2");
    expect(b.content).toBe("bản 2");
    expect(b.createdAt).toBeGreaterThan(a.createdAt);
    expect(count(db, "nb1", "summary")).toBe(2);
  });

  it("insert lưu và trả parts / truncated / local; thiếu ⇒ không có trường", () => {
    const { repo } = setup();
    const full = repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "x",
      citations: [],
      parts: 3,
      truncated: true,
      local: true,
    });
    expect(full).toMatchObject({ parts: 3, truncated: true, local: true });
    const bare = repo.insert({
      notebookId: "nb1",
      kind: "faq",
      content: "y",
      citations: [],
      truncated: false,
      local: false,
    });
    expect(bare.truncated).toBe(false);
    expect(bare.local).toBe(false);
    expect("parts" in bare).toBe(false);
    const listed = repo.listVersions("nb1", "summary")[0];
    expect(listed).toMatchObject({ parts: 3, truncated: true, local: true });
  });

  it("dòng cũ (cột mới NULL) ⇒ không có parts / truncated / local", () => {
    const { db, repo } = setup();
    db.prepare(
      "INSERT INTO studio_result (id, notebook_id, kind, content, citations_json, created_at, updated_at) VALUES ('old','nb1','outline','o','[]',5,5)",
    ).run();
    const [r] = repo.listVersions("nb1", "outline");
    expect(r.id).toBe("old");
    expect("parts" in r).toBe(false);
    expect("truncated" in r).toBe(false);
    expect("local" in r).toBe(false);
  });

  it("lưu bản thứ 11 ⇒ còn 10, bản cũ nhất bị xoá; trần riêng từng kind / notebook", () => {
    const { db, repo } = setup();
    for (let i = 1; i <= 11; i++) {
      repo.insert({
        notebookId: "nb1",
        kind: "summary",
        content: `v${i}`,
        citations: [],
      });
    }
    repo.insert({
      notebookId: "nb1",
      kind: "faq",
      content: "f",
      citations: [],
    });
    repo.insert({
      notebookId: "nb2",
      kind: "summary",
      content: "s",
      citations: [],
    });
    expect(count(db, "nb1", "summary")).toBe(10);
    const contents = repo.listVersions("nb1", "summary").map((r) => r.content);
    expect(contents[0]).toBe("v11");
    expect(contents).not.toContain("v1");
    expect(contents).toContain("v2");
    expect(count(db, "nb1", "faq")).toBe(1);
    expect(count(db, "nb2", "summary")).toBe(1);
  });

  it("created_at trùng ⇒ thứ tự và dọn trần theo thứ tự chèn (rowid)", () => {
    const { repo } = setup({ sameTime: true });
    for (let i = 1; i <= 11; i++) {
      repo.insert({
        notebookId: "nb1",
        kind: "summary",
        content: `v${i}`,
        citations: [],
      });
    }
    const contents = repo.listVersions("nb1", "summary").map((r) => r.content);
    expect(contents).toHaveLength(10);
    expect(contents[0]).toBe("v11");
    expect(contents[9]).toBe("v2");
  });

  it("listByNotebook trả MỌI phiên bản của notebook, sắp kind rồi mới nhất trước", () => {
    const { repo } = setup();
    repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "s1",
      citations: [],
    });
    repo.insert({
      notebookId: "nb1",
      kind: "faq",
      content: "f1",
      citations: [],
    });
    repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "s2",
      citations: [],
    });
    repo.insert({
      notebookId: "nb2",
      kind: "outline",
      content: "o",
      citations: [],
    });
    const list = repo.listByNotebook("nb1");
    expect(list.map((r) => `${r.kind}:${r.content}`)).toEqual([
      "faq:f1",
      "summary:s2",
      "summary:s1",
    ]);
    expect(repo.listByNotebook("nb2")).toHaveLength(1);
  });

  it("citations_json khứ hồi giữ nguyên Citation[]; JSON hỏng ⇒ rỗng", () => {
    const { db, repo } = setup();
    repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "x [1]",
      citations: cites,
    });
    expect(repo.listVersions("nb1", "summary")[0].citations).toEqual(cites);
    db.prepare(
      "INSERT INTO studio_result (id, notebook_id, kind, content, citations_json, created_at, updated_at) VALUES ('bad','nb1','faq','f','{hỏng',5,5)",
    ).run();
    expect(repo.listVersions("nb1", "faq")[0].citations).toEqual([]);
  });

  it("deleteVersion chỉ xoá khi khớp notebook; id lạ / khác notebook / đã xoá ⇒ false", () => {
    const { db, repo } = setup();
    const a = repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "a",
      citations: [],
    });
    repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "b",
      citations: [],
    });
    expect(repo.deleteVersion("nb2", a.id)).toBe(false);
    expect(repo.deleteVersion("nb1", "nope")).toBe(false);
    expect(repo.deleteVersion("nb1", a.id)).toBe(true);
    expect(repo.deleteVersion("nb1", a.id)).toBe(false);
    expect(count(db, "nb1", "summary")).toBe(1);
  });

  it("xoá notebook → CASCADE xoá mọi phiên bản; notebook khác không ảnh hưởng", () => {
    const { db, repo } = setup();
    repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "s",
      citations: [],
    });
    repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "s'",
      citations: [],
    });
    repo.insert({
      notebookId: "nb2",
      kind: "summary",
      content: "s2",
      citations: [],
    });
    db.prepare("DELETE FROM notebook WHERE id = ?").run("nb1");
    expect(repo.listByNotebook("nb1")).toHaveLength(0);
    expect(repo.listByNotebook("nb2")).toHaveLength(1);
  });
});

describe("studio-repo — giao dịch insert (178)", () => {
  it("insert lỗi (vi phạm CHECK) ⇒ ROLLBACK, không để lại dòng nào, DB vẫn dùng được", () => {
    const { db, repo } = setup();
    repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "ok",
      citations: [],
    });
    expect(() =>
      repo.insert({
        notebookId: "nb1",
        kind: "bogus" as never,
        content: "x",
        citations: [],
      }),
    ).toThrow();
    expect(count(db, "nb1", "bogus")).toBe(0);
    expect(count(db, "nb1", "summary")).toBe(1);
    repo.insert({
      notebookId: "nb1",
      kind: "summary",
      content: "ok2",
      citations: [],
    });
    expect(count(db, "nb1", "summary")).toBe(2);
  });
});
