import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  runMigrations,
  getUserVersion,
} from "../../src/main/db/migrations";

// Migration #5 (045-audio): chunk +t_start/t_end; source bỏ CHECK kind (nhận 'audio'). Tái tạo source
// KHÔNG mất chunk (backup/restore né cascade).

describe("migration #5 — audio timestamp + kind", () => {
  it("có migration version=5", () => {
    expect(MIGRATIONS.some((m) => m.version === 5)).toBe(true);
  });

  it("nâng từ v4 (có source+chunk) → chunk giữ nguyên; source nhận kind 'audio'; có cột t_start/t_end", () => {
    const db = openDatabase(":memory:");
    // DB cũ ở version 4.
    runMigrations(
      db,
      MIGRATIONS.filter((m) => m.version <= 4),
    );
    expect(getUserVersion(db)).toBe(4);
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb1", "N", "#4F46E5", 1, 1);
    db.prepare(
      "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("s1", "nb1", "pdf", "t", "/p", "ready", "h", 1, 1);
    db.prepare(
      "INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end) VALUES (?,?,?,?,?,?,?)",
    ).run("c1", "s1", 0, "abc", null, 0, 3);

    // Nâng cấp lên v5.
    runMigrations(db);
    expect(getUserVersion(db)).toBeGreaterThanOrEqual(5);

    // chunk cũ còn nguyên (backup/restore không mất).
    const c = db.prepare("SELECT * FROM chunk WHERE id=?").get("c1") as
      { text: string; t_start: number | null } | undefined;
    expect(c?.text).toBe("abc");
    expect(c?.t_start ?? null).toBeNull();

    // source cũ còn.
    const s = db.prepare("SELECT kind FROM source WHERE id=?").get("s1") as
      { kind: string } | undefined;
    expect(s?.kind).toBe("pdf");

    // Nay chèn được source kind 'audio' (CHECK đã bỏ) + chunk có t_start/t_end.
    db.prepare(
      "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("s2", "nb1", "audio", "ghi âm", "/a.mp3", "ready", "h2", 1, 1);
    db.prepare(
      "INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end, t_start, t_end) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("c2", "s2", 0, "lời nói", null, 0, 7, 1.5, 4.2);
    const c2 = db
      .prepare("SELECT t_start, t_end FROM chunk WHERE id=?")
      .get("c2") as { t_start: number; t_end: number };
    expect(c2.t_start).toBe(1.5);
    expect(c2.t_end).toBe(4.2);
  });

  it("FK CASCADE vẫn hoạt động sau tái tạo source (xoá notebook → xoá source+chunk)", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb1", "N", "#4F46E5", 1, 1);
    db.prepare(
      "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("s1", "nb1", "audio", "a", "/a.wav", "ready", "h", 1, 1);
    db.prepare(
      "INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end, t_start, t_end) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("c1", "s1", 0, "x", null, 0, 1, 0, 1);
    db.prepare("DELETE FROM notebook WHERE id=?").run("nb1");
    const sc = db.prepare("SELECT COUNT(*) c FROM source").get() as {
      c: number;
    };
    const cc = db.prepare("SELECT COUNT(*) c FROM chunk").get() as {
      c: number;
    };
    expect(sc.c).toBe(0);
    expect(cc.c).toBe(0);
  });
});
