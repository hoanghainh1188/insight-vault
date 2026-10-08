import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  getUserVersion,
  runMigrations,
} from "../../src/main/db/migrations";

// 123 (FR-014, data-model.md, research R5): migration #10 CHỈ dữ liệu — source.error_label văn bản Việt ⇒ mã
// (SourceErrorCode); lạ ⇒ unknown; NULL giữ; mã sẵn giữ. Không đổi schema (schema-guard sao lưu không đổi).

type Db = ReturnType<typeof openDatabase>;

function columns(db: Db): string[] {
  return (db.prepare("PRAGMA table_info(source)").all() as { name: string }[])
    .map((c) => c.name)
    .sort();
}

function seedV9(): Db {
  const db = openDatabase(":memory:");
  runMigrations(
    db,
    MIGRATIONS.filter((m) => m.version <= 9),
  );
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  const ins = db.prepare(
    "INSERT INTO source (id, notebook_id, kind, title, origin, status, error_label, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
  );
  const rows: [string, string | null][] = [
    ["s1", "Lỗi trích xuất"],
    ["s2", "Lỗi nhúng"],
    ["s3", "Lỗi lưu trữ"],
    ["s4", "Lỗi"],
    ["s5", "Lỗi tải trang"],
    ["s6", "Tệp quá lớn"],
    ["s7", "Gián đoạn khi nạp — thử lại"],
    ["s8", "Nhãn lạ do sửa tay"],
    ["s9", null],
    ["s10", "embed"],
  ];
  for (const [id, label] of rows) {
    ins.run(
      id,
      "nb1",
      "pdf",
      id,
      `/${id}.pdf`,
      label ? "error" : "ready",
      label,
      "h",
      1,
      1,
    );
  }
  return db;
}

const label = (db: Db, id: string) =>
  (
    db.prepare("SELECT error_label FROM source WHERE id=?").get(id) as {
      error_label: string | null;
    }
  ).error_label;

describe("migration #10 — error_label ⇒ mã", () => {
  it("có migration version=10", () => {
    expect(MIGRATIONS.some((m) => m.version === 10)).toBe(true);
  });

  it("v9 ⇒ v10: văn bản cũ ⇒ mã, lạ ⇒ unknown, NULL giữ, mã giữ; schema không đổi", () => {
    const db = seedV9();
    const before = columns(db);
    runMigrations(db);
    expect(getUserVersion(db)).toBeGreaterThanOrEqual(10);
    expect(columns(db)).toEqual(before);
    expect(label(db, "s1")).toBe("extract");
    expect(label(db, "s2")).toBe("embed");
    expect(label(db, "s3")).toBe("store");
    expect(label(db, "s4")).toBe("generic");
    expect(label(db, "s5")).toBe("fetch");
    expect(label(db, "s6")).toBe("tooLarge");
    expect(label(db, "s7")).toBe("interrupted");
    expect(label(db, "s8")).toBe("unknown");
    expect(label(db, "s9")).toBeNull();
    expect(label(db, "s10")).toBe("embed");
  });

  it("idempotent", () => {
    const db = seedV9();
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
    expect(label(db, "s1")).toBe("extract");
  });
});
