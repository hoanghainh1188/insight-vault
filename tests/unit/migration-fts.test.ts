import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  runMigrations,
  getUserVersion,
} from "../../src/main/db/migrations";

// Migration #7 (055): chunk_fts FTS5 own-storage + backfill (fold) + trigger đồng bộ delete.

describe("migration #7 — FTS5 keyword", () => {
  it("có migration version=7", () => {
    expect(MIGRATIONS.some((m) => m.version === 7)).toBe(true);
  });

  it("nâng từ v6: backfill chunk hiện có (fold) → khớp không dấu; trigger xoá đồng bộ", () => {
    const db = openDatabase(":memory:");
    runMigrations(
      db,
      MIGRATIONS.filter((m) => m.version <= 6),
    );
    expect(getUserVersion(db)).toBe(6);
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb1", "N", "#4F46E5", 1, 1);
    db.prepare(
      "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("s1", "nb1", "txt", "t", "/p", "ready", "h", 1, 1);
    db.prepare(
      "INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end) VALUES (?,?,?,?,?,?,?)",
    ).run("c1", "s1", 0, "Hợp đồng lao động", null, 0, 17);

    runMigrations(db); // → v7 (backfill)
    expect(getUserVersion(db)).toBeGreaterThanOrEqual(7);

    // Backfill fold → khớp không dấu.
    const rows = db
      .prepare("SELECT rowid FROM chunk_fts WHERE chunk_fts MATCH ?")
      .all('"hop" OR "dong"') as unknown[];
    expect(rows.length).toBe(1);

    // Trigger AFTER DELETE: xoá chunk → chunk_fts trống.
    db.prepare("DELETE FROM chunk WHERE id=?").run("c1");
    const after = db.prepare("SELECT count(*) AS n FROM chunk_fts").get() as {
      n: number;
    };
    expect(after.n).toBe(0);
  });
});
