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
  return repo;
}

const drafts: ChunkDraft[] = [
  { ordinal: 0, text: "alpha", locator: { page: 1, charStart: 0, charEnd: 5 } },
  {
    ordinal: 1,
    text: "beta",
    locator: { page: null, charStart: 5, charEnd: 9 },
  },
  {
    ordinal: 2,
    text: "gamma",
    locator: { page: 2, charStart: 9, charEnd: 14 },
  },
];

describe("source-repo.getChunksByIds", () => {
  it("trả chunk theo ĐÚNG thứ tự ids đầu vào (không theo thứ tự SQL)", () => {
    const repo = setup();
    const s = repo.create({
      notebookId: "nb1",
      kind: "txt",
      title: "t",
      origin: "/p",
      contentHash: "h",
    });
    const ids = repo.insertChunks(s.id, drafts);
    const picked = repo.getChunksByIds([ids[2], ids[0]]);
    expect(picked.map((c) => c.text)).toEqual(["gamma", "alpha"]);
    expect(picked[0].locator).toEqual({ page: 2, charStart: 9, charEnd: 14 });
  });

  it("id không tồn tại bị bỏ; mảng rỗng → []", () => {
    const repo = setup();
    const s = repo.create({
      notebookId: "nb1",
      kind: "txt",
      title: "t",
      origin: "/p",
      contentHash: "h",
    });
    const ids = repo.insertChunks(s.id, drafts);
    expect(repo.getChunksByIds([])).toEqual([]);
    expect(
      repo.getChunksByIds(["khong-co", ids[1]]).map((c) => c.text),
    ).toEqual(["beta"]);
  });
});
