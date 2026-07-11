import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  runMigrations,
  getUserVersion,
  MIGRATIONS,
  type Migration,
} from "../../src/main/db/migrations";

describe("migrations", () => {
  it("DB rỗng → migration #1 tạo bảng notebook, user_version = 1", () => {
    const db = openDatabase(":memory:");
    expect(getUserVersion(db)).toBe(0);
    expect(runMigrations(db)).toBe(1);
    // bảng tồn tại
    const t = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='notebook'",
      )
      .get();
    expect(t).toBeTruthy();
  });

  it("chạy lại idempotent (không lỗi, version giữ nguyên)", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);
    expect(runMigrations(db)).toBe(1);
  });

  it("guard: DB version > max migration → ném (không hạ cấp)", () => {
    const db = openDatabase(":memory:");
    db.exec("PRAGMA user_version = 99");
    expect(() => runMigrations(db)).toThrow(/không tự hạ cấp/);
  });

  it("áp thêm migration mới (append) nâng version tiếp", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);
    const extra: Migration[] = [
      ...MIGRATIONS,
      { version: 2, up: (d) => d.exec("CREATE TABLE t2(x)") },
    ];
    expect(runMigrations(db, extra)).toBe(2);
  });
});
