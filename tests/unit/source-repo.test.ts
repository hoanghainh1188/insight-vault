import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSourceRepo } from "../../src/main/services/ingestion/source-repo";
import type { ChunkDraft } from "../../src/main/services/ingestion/chunker";

function setup() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  let t = 1000;
  let n = 0;
  const repo = createSourceRepo(db, {
    now: () => ++t,
    uuid: () => `id-${++n}`,
  });
  return { db, repo };
}

const drafts: ChunkDraft[] = [
  { ordinal: 0, text: "a", locator: { page: 1, charStart: 0, charEnd: 1 } },
  { ordinal: 1, text: "bc", locator: { page: 2, charStart: 1, charEnd: 3 } },
];

describe("source-repo", () => {
  it("create → queued; getById; listByNotebook; countByNotebook", () => {
    const { repo } = setup();
    const s = repo.create({
      notebookId: "nb1",
      kind: "pdf",
      title: "tài liệu.pdf",
      origin: "/p/tai-lieu.pdf",
      contentHash: "h1",
      pageCount: 2,
    });
    expect(s.status).toBe("queued");
    expect(s.pageCount).toBe(2);
    expect(repo.getById(s.id)?.title).toBe("tài liệu.pdf");
    expect(repo.listByNotebook("nb1")).toHaveLength(1);
    expect(repo.countByNotebook("nb1")).toBe(1);
    expect(repo.getById("khong-co")).toBeNull();
  });

  it("findDuplicate theo (notebook_id, content_hash)", () => {
    const { repo } = setup();
    repo.create({
      notebookId: "nb1",
      kind: "txt",
      title: "a",
      origin: "/a",
      contentHash: "dup",
    });
    expect(repo.findDuplicate("nb1", "dup")).not.toBeNull();
    expect(repo.findDuplicate("nb1", "other")).toBeNull();
    expect(repo.findDuplicate("nb2", "dup")).toBeNull();
  });

  it("updateStatus + setPageCount", () => {
    const { repo } = setup();
    const s = repo.create({
      notebookId: "nb1",
      kind: "txt",
      title: "a",
      origin: "/a",
      contentHash: "h",
    });
    repo.updateStatus(s.id, "error", "Lỗi trích xuất");
    const after = repo.getById(s.id)!;
    expect(after.status).toBe("error");
    expect(after.errorLabel).toBe("Lỗi trích xuất");
    repo.setPageCount(s.id, 5);
    expect(repo.getById(s.id)!.pageCount).toBe(5);
  });

  it("insertChunks + listChunks + chunkIds; locator lưu đúng", () => {
    const { repo } = setup();
    const s = repo.create({
      notebookId: "nb1",
      kind: "pdf",
      title: "a",
      origin: "/a",
      contentHash: "h",
    });
    const ids = repo.insertChunks(s.id, drafts);
    expect(ids).toHaveLength(2);
    const chunks = repo.listChunks(s.id);
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1]);
    expect(chunks[1].locator).toEqual({ page: 2, charStart: 1, charEnd: 3 });
    expect(repo.chunkIds(s.id)).toEqual(ids);
  });

  it("059: allChunkRefs + countChunksByNotebook (JOIN qua source — chunk không có notebook_id)", () => {
    const { db, repo } = setup();
    // notebook thứ 2 để kiểm map notebookId đúng.
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb2", "N2", "#4F46E5", 1, 1);
    const s1 = repo.create({
      notebookId: "nb1",
      kind: "pdf",
      title: "a",
      origin: "/a",
      contentHash: "h1",
    });
    const s2 = repo.create({
      notebookId: "nb2",
      kind: "txt",
      title: "b",
      origin: "/b",
      contentHash: "h2",
    });
    repo.insertChunks(s1.id, drafts); // 2 chunk nb1
    repo.insertChunks(s2.id, [drafts[0]]); // 1 chunk nb2

    const refs = repo.allChunkRefs();
    expect(refs).toHaveLength(3);
    // notebookId map đúng theo source (JOIN), KHÔNG throw "no such column".
    expect(refs.filter((r) => r.notebookId === "nb1")).toHaveLength(2);
    expect(refs.filter((r) => r.notebookId === "nb2")).toHaveLength(1);
    expect(refs.every((r) => r.id && r.sourceId)).toBe(true);

    expect(repo.countChunksByNotebook("nb1")).toBe(2);
    expect(repo.countChunksByNotebook("nb2")).toBe(1);
    expect(repo.countChunksByNotebook("nb-khong-ton-tai")).toBe(0);
  });

  it("deleteChunks xoá chunk giữ source (cho retry)", () => {
    const { repo } = setup();
    const s = repo.create({
      notebookId: "nb1",
      kind: "txt",
      title: "a",
      origin: "/a",
      contentHash: "h",
    });
    repo.insertChunks(s.id, drafts);
    repo.deleteChunks(s.id);
    expect(repo.listChunks(s.id)).toHaveLength(0);
    expect(repo.getById(s.id)).not.toBeNull();
  });

  it("delete source → cascade xoá chunk", () => {
    const { repo, db } = setup();
    const s = repo.create({
      notebookId: "nb1",
      kind: "txt",
      title: "a",
      origin: "/a",
      contentHash: "h",
    });
    repo.insertChunks(s.id, drafts);
    expect(repo.delete(s.id)).toEqual({ deleted: true });
    expect(repo.getById(s.id)).toBeNull();
    const c = db.prepare("SELECT COUNT(*) c FROM chunk").get() as unknown as {
      c: number;
    };
    expect(c.c).toBe(0);
  });

  it("xoá notebook → cascade xoá source + chunk", () => {
    const { repo, db } = setup();
    const s = repo.create({
      notebookId: "nb1",
      kind: "txt",
      title: "a",
      origin: "/a",
      contentHash: "h",
    });
    repo.insertChunks(s.id, drafts);
    db.prepare("DELETE FROM notebook WHERE id=?").run("nb1");
    expect(repo.countByNotebook("nb1")).toBe(0);
    const c = db.prepare("SELECT COUNT(*) c FROM chunk").get() as unknown as {
      c: number;
    };
    expect(c.c).toBe(0);
  });
});

// 112 (FR-011): phiên bản cách trích của nguồn.
describe("source-repo — extractionVersion (112)", () => {
  it("nguồn mới mặc định 1; setExtractionVersion đổi giá trị", async () => {
    const { openDatabase } = await import("../../src/main/db/database");
    const { runMigrations } = await import("../../src/main/db/migrations");
    const { createSourceRepo } =
      await import("../../src/main/services/ingestion/source-repo");
    const db = openDatabase(":memory:");
    runMigrations(db);
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb1", "N", "#4F46E5", 1, 1);
    const repo = createSourceRepo(db, { now: () => 5, uuid: () => "s-1" });
    const s = repo.create({
      notebookId: "nb1",
      kind: "pdf",
      title: "a.pdf",
      origin: "/a.pdf",
      contentHash: "h",
    });
    expect(s.extractionVersion).toBe(1);
    repo.setExtractionVersion(s.id, 2);
    expect(repo.getById(s.id)!.extractionVersion).toBe(2);
    expect(repo.listByNotebook("nb1")[0].extractionVersion).toBe(2);
  });
});

// 112 (FR-015, research R10): thay chunk của nguồn trong MỘT transaction (xử lý lại nguyên tử).
describe("source-repo — replaceChunks (112)", () => {
  async function seeded() {
    const { openDatabase } = await import("../../src/main/db/database");
    const { runMigrations } = await import("../../src/main/db/migrations");
    const { createSourceRepo } =
      await import("../../src/main/services/ingestion/source-repo");
    const { chunkPages } =
      await import("../../src/main/services/ingestion/chunker");
    const db = openDatabase(":memory:");
    runMigrations(db);
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb1", "N", "#4F46E5", 1, 1);
    let n = 0;
    const repo = createSourceRepo(db, {
      now: () => 7,
      uuid: () => `old-${++n}`,
    });
    const s = repo.create({
      notebookId: "nb1",
      kind: "pdf",
      title: "a.pdf",
      origin: "/a.pdf",
      contentHash: "h",
      pageCount: 1,
    });
    const oldIds = repo.insertChunks(
      s.id,
      chunkPages([{ page: 1, text: "chu cu tren trang mot" }]),
    );
    const ftsCount = () =>
      (db.prepare("SELECT count(*) AS c FROM chunk_fts").get() as { c: number })
        .c;
    const ftsHit = (q: string) =>
      (
        db
          .prepare(
            "SELECT count(*) AS c FROM chunk_fts WHERE chunk_fts MATCH ?",
          )
          .get(q) as { c: number }
      ).c;
    return { repo, s, oldIds, chunkPages, ftsCount, ftsHit };
  }

  it("thay toàn bộ chunk bằng id định trước + FTS khớp + version/pageCount cập nhật", async () => {
    const { repo, s, oldIds, chunkPages, ftsCount, ftsHit } = await seeded();
    const drafts = chunkPages([
      { page: 1, text: "noi dung moi trang mot" },
      { page: 2, text: "noi dung moi trang hai" },
    ]);
    repo.replaceChunks(s.id, drafts, ["new-a", "new-b"], {
      extractionVersion: 2,
      pageCount: 2,
    });
    const chunks = repo.listChunks(s.id);
    expect(chunks.map((c) => c.id)).toEqual(["new-a", "new-b"]);
    expect(chunks[1].locator.page).toBe(2);
    expect(repo.getChunksByIds(oldIds)).toEqual([]);
    expect(ftsCount()).toBe(2);
    expect(ftsHit("moi")).toBe(2);
    expect(ftsHit("cu")).toBe(0);
    const src = repo.getById(s.id)!;
    expect(src.extractionVersion).toBe(2);
    expect(src.pageCount).toBe(2);
  });

  it("lỗi giữa chừng (id trùng) ⇒ rollback: chunk + FTS + version cũ nguyên vẹn", async () => {
    const { repo, s, oldIds, chunkPages, ftsCount, ftsHit } = await seeded();
    const drafts = chunkPages([
      { page: 1, text: "noi dung moi mot" },
      { page: 2, text: "noi dung moi hai" },
    ]);
    expect(() =>
      repo.replaceChunks(s.id, drafts, ["dup", "dup"], {
        extractionVersion: 2,
        pageCount: 2,
      }),
    ).toThrow();
    expect(repo.listChunks(s.id).map((c) => c.id)).toEqual(oldIds);
    expect(ftsCount()).toBe(1);
    expect(ftsHit("cu")).toBe(1);
    expect(repo.getById(s.id)!.extractionVersion).toBe(1);
  });

  it("số id ≠ số draft ⇒ ném, không đổi gì", async () => {
    const { repo, s, oldIds, chunkPages } = await seeded();
    const drafts = chunkPages([{ page: 1, text: "x" }]);
    expect(() =>
      repo.replaceChunks(s.id, drafts, [], {
        extractionVersion: 2,
        pageCount: 1,
      }),
    ).toThrow();
    expect(repo.listChunks(s.id).map((c) => c.id)).toEqual(oldIds);
  });
});
