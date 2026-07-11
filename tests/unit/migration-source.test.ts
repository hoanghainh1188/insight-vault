import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  runMigrations,
  getUserVersion,
} from "../../src/main/db/migrations";

// Migration #2 (011-ingestion): thêm bảng source + chunk, FK CASCADE. KHÔNG phá dữ liệu notebook.

function tableNames(db: ReturnType<typeof openDatabase>): string[] {
  return (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as unknown as { name: string }[]
  ).map((r) => r.name);
}

describe("migration #2 — source/chunk", () => {
  it("có migration version=2 trong mảng", () => {
    expect(MIGRATIONS.some((m) => m.version === 2)).toBe(true);
  });

  it("chạy từ v1 (đã có notebook) → v2, tạo bảng source+chunk, giữ dữ liệu notebook", () => {
    const db = openDatabase(":memory:");
    // Áp riêng migration #1 để mô phỏng DB cũ ở version 1.
    runMigrations(
      db,
      MIGRATIONS.filter((m) => m.version === 1),
    );
    expect(getUserVersion(db)).toBe(1);
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb1", "Cũ", "#4F46E5", 1, 1);

    // Nâng cấp toàn bộ → v2.
    runMigrations(db);
    expect(getUserVersion(db)).toBe(2);
    const names = tableNames(db);
    expect(names).toContain("source");
    expect(names).toContain("chunk");
    // dữ liệu notebook còn nguyên
    const n = db
      .prepare("SELECT name FROM notebook WHERE id=?")
      .get("nb1") as unknown as { name: string } | undefined;
    expect(n?.name).toBe("Cũ");
  });

  it("FK CASCADE: xoá notebook → xoá source; xoá source → xoá chunk", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run("nb1", "N", "#4F46E5", 1, 1);
    db.prepare(
      "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("s1", "nb1", "txt", "t", "/p", "ready", "h", 1, 1);
    db.prepare(
      "INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end) VALUES (?,?,?,?,?,?,?)",
    ).run("c1", "s1", 0, "abc", null, 0, 3);

    db.prepare("DELETE FROM notebook WHERE id=?").run("nb1");
    const srcCount = db
      .prepare("SELECT COUNT(*) c FROM source")
      .get() as unknown as { c: number };
    const chkCount = db
      .prepare("SELECT COUNT(*) c FROM chunk")
      .get() as unknown as { c: number };
    expect(srcCount.c).toBe(0);
    expect(chkCount.c).toBe(0);
  });
});
