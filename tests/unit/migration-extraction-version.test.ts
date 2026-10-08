import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  getUserVersion,
  runMigrations,
} from "../../src/main/db/migrations";

// 112 (FR-011, research R9): migration #9 — source.extraction_version INTEGER NOT NULL DEFAULT 1. ADD COLUMN thuần,
// append-only; nguồn cũ = 1 (cách trích trước 112).

const LATEST = Math.max(...MIGRATIONS.map((m) => m.version));

describe("migration #9 — extraction_version", () => {
  it("có migration version=9", () => {
    expect(MIGRATIONS.some((m) => m.version === 9)).toBe(true);
  });

  it("nâng từ v8 ⇒ cột tồn tại, nguồn cũ = 1, NOT NULL", () => {
    const db = openDatabase(":memory:");
    runMigrations(
      db,
      MIGRATIONS.filter((m) => m.version <= 8),
    );
    expect(getUserVersion(db)).toBe(8);
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb1", "N", "#4F46E5", 1, 1);
    db.prepare(
      "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("s1", "nb1", "pdf", "t", "/p.pdf", "ready", "h", 1, 1);

    runMigrations(db);
    expect(getUserVersion(db)).toBe(LATEST);
    const row = db
      .prepare("SELECT extraction_version FROM source WHERE id=?")
      .get("s1") as { extraction_version: number };
    expect(row.extraction_version).toBe(1);
    expect(() =>
      db
        .prepare("UPDATE source SET extraction_version = NULL WHERE id = ?")
        .run("s1"),
    ).toThrow();
  });

  it("idempotent: chạy lại không lỗi, không đổi version", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
    expect(getUserVersion(db)).toBe(LATEST);
  });
});
