import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  runMigrations,
  getUserVersion,
} from "../../src/main/db/migrations";

// Migration #6 (053-image): chunk +bbox_x/y/w/h (0..1) cho locator ảnh. ADD COLUMN thuần, append-only.

describe("migration #6 — image bbox", () => {
  it("có migration version=6", () => {
    expect(MIGRATIONS.some((m) => m.version === 6)).toBe(true);
  });

  it("nâng từ v5 → 4 cột bbox tồn tại; chunk cũ giữ nguyên (bbox null)", () => {
    const db = openDatabase(":memory:");
    runMigrations(
      db,
      MIGRATIONS.filter((m) => m.version <= 5),
    );
    expect(getUserVersion(db)).toBe(5);
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb1", "N", "#4F46E5", 1, 1);
    db.prepare(
      "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("s1", "nb1", "image", "t", "/p.png", "ready", "h", 1, 1);
    db.prepare(
      "INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end) VALUES (?,?,?,?,?,?,?)",
    ).run("c1", "s1", 0, "abc", null, 0, 3);

    runMigrations(db);
    expect(getUserVersion(db)).toBeGreaterThanOrEqual(6);

    // chunk cũ còn nguyên, bbox null.
    const c = db.prepare("SELECT * FROM chunk WHERE id=?").get("c1") as Record<
      string,
      unknown
    >;
    expect(c.text).toBe("abc");
    expect(c.bbox_x).toBeNull();

    // Ghi chunk có bbox → đọc lại đúng.
    db.prepare(
      "INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end, bbox_x, bbox_y, bbox_w, bbox_h) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ).run("c2", "s1", 1, "def", null, 4, 7, 0.1, 0.2, 0.3, 0.4);
    const c2 = db.prepare("SELECT * FROM chunk WHERE id=?").get("c2") as Record<
      string,
      number
    >;
    expect(c2.bbox_x).toBeCloseTo(0.1);
    expect(c2.bbox_h).toBeCloseTo(0.4);
  });
});
