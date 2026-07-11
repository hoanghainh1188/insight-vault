import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  runMigrations,
  getUserVersion,
  MIGRATIONS,
  type Migration,
} from "../../src/main/db/migrations";

describe("migrations", () => {
  it("DB rỗng → migration #1 tạo bảng notebook", () => {
    const db = openDatabase(":memory:");
    expect(getUserVersion(db)).toBe(0);
    // Áp riêng migration #1 để khẳng định nó tạo bảng notebook + đưa version về 1.
    expect(
      runMigrations(
        db,
        MIGRATIONS.filter((m) => m.version === 1),
      ),
    ).toBe(1);
    const t = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='notebook'",
      )
      .get();
    expect(t).toBeTruthy();
  });

  it("chạy toàn bộ migration → version = max (2 sau 011-ingestion)", () => {
    const db = openDatabase(":memory:");
    const max = MIGRATIONS.reduce((m, x) => Math.max(m, x.version), 0);
    expect(runMigrations(db)).toBe(max);
  });

  it("chạy lại idempotent (không lỗi, version giữ nguyên)", () => {
    const db = openDatabase(":memory:");
    const max = runMigrations(db);
    expect(runMigrations(db)).toBe(max);
  });

  it("guard: DB version > max migration → ném (không hạ cấp)", () => {
    const db = openDatabase(":memory:");
    db.exec("PRAGMA user_version = 99");
    expect(() => runMigrations(db)).toThrow(/không tự hạ cấp/);
  });

  it("áp thêm migration mới (append) nâng version tiếp", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);
    const next = MIGRATIONS.reduce((m, x) => Math.max(m, x.version), 0) + 1;
    const extra: Migration[] = [
      ...MIGRATIONS,
      { version: next, up: (d) => d.exec("CREATE TABLE t2(x)") },
    ];
    expect(runMigrations(db, extra)).toBe(next);
  });
});
