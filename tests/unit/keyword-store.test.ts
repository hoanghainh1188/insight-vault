import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSourceRepo } from "../../src/main/services/ingestion/source-repo";
import { createKeywordStore } from "../../src/main/services/ingestion/keyword-store";

// keyword-store (055): SQLite in-memory THẬT + FTS5 (migration #7). insertChunks đồng bộ FTS (fold);
// searchBm25 khớp có/không dấu (kể cả đ), lọc notebook, xếp bm25.

function setup() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb2", "N2", "#4F46E5", 1, 1);
  let t = 0;
  let n = 0;
  const repo = createSourceRepo(db, {
    now: () => ++t,
    uuid: () => `id-${++n}`,
  });
  const s1 = repo.create({
    notebookId: "nb1",
    kind: "txt",
    title: "a",
    origin: "/a",
    contentHash: "h1",
    pageCount: null,
  });
  const s2 = repo.create({
    notebookId: "nb2",
    kind: "txt",
    title: "b",
    origin: "/b",
    contentHash: "h2",
    pageCount: null,
  });
  repo.insertChunks(s1.id, [
    {
      ordinal: 0,
      text: "Hợp đồng lao động điều 47",
      locator: { page: null, charStart: 0, charEnd: 25 },
    },
    {
      ordinal: 1,
      text: "Hoá đơn tiền điện tháng 7",
      locator: { page: null, charStart: 0, charEnd: 25 },
    },
  ]);
  repo.insertChunks(s2.id, [
    {
      ordinal: 0,
      text: "Hợp đồng ở notebook khác",
      locator: { page: null, charStart: 0, charEnd: 24 },
    },
  ]);
  return { db, repo, ks: createKeywordStore(db), s1 };
}

describe("keyword-store searchBm25 (055)", () => {
  it("khớp có dấu, lọc đúng notebook", () => {
    const { ks } = setup();
    const hits = ks.searchBm25("nb1", "hợp đồng", 10);
    expect(hits.length).toBe(1); // chỉ chunk nb1 (không lấy nb2)
  });
  it("khớp KHÔNG dấu (kể cả đ): 'hop dong' ↔ 'Hợp đồng'", () => {
    const { ks } = setup();
    expect(ks.searchBm25("nb1", "hop dong", 10).length).toBe(1);
    expect(ks.searchBm25("nb1", "dieu 47", 10).length).toBe(1);
  });
  it("query rỗng token → []", () => {
    const { ks } = setup();
    expect(ks.searchBm25("nb1", "  *()  ", 10)).toEqual([]);
  });
  it("xoá chunk → FTS đồng bộ (trigger): không còn khớp", () => {
    const { ks, repo, s1 } = setup();
    expect(ks.searchBm25("nb1", "hoá đơn", 10).length).toBe(1);
    repo.deleteChunks(s1.id);
    expect(ks.searchBm25("nb1", "hoá đơn", 10).length).toBe(0);
  });
});
