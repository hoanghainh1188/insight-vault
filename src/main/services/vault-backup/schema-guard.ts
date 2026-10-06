import { DatabaseSync } from "node:sqlite";
import type { Db } from "../../db/database";
import { MIGRATIONS, runMigrations } from "../../db/migrations";
import { VaultBackupFailure } from "./errors";

// Kiểm schema DB khôi phục (085, security S3). DB trong bản sao lưu là dữ liệu KHÔNG tin cậy: trigger/view lạ sẽ
// chạy khi migration hoặc app ghi về sau (sửa/xoá dữ liệu ngầm, treo main). So `sqlite_master` (type+name+sql)
// với schema mà CHÍNH migration của app tạo ra ở cùng version — thừa/thiếu/khác định nghĩa ⇒ từ chối cả file.
// Object nội bộ `sqlite_*` (autoindex/sequence/stat) bỏ qua.

type Schema = Map<string, string | null>;

function readSchema(db: Db): Schema {
  const rows = db
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite\\_%' ESCAPE '\\'",
    )
    .all() as { type: string; name: string; sql: string | null }[];
  return new Map(rows.map((r) => [`${r.type}:${r.name}`, r.sql]));
}

const cache = new Map<number, Schema>();

/** Schema chuẩn do migration 1..version tạo ra (DB tạm trong RAM, cache theo version). */
export function expectedSchema(version: number): Schema {
  const hit = cache.get(version);
  if (hit) return hit;
  const mem = new DatabaseSync(":memory:");
  try {
    runMigrations(
      mem,
      MIGRATIONS.filter((m) => m.version <= version),
    );
    const schema = readSchema(mem);
    cache.set(version, schema);
    return schema;
  } finally {
    mem.close();
  }
}

export function assertSchemaMatches(db: Db, version: number): void {
  const expected = expectedSchema(version);
  const actual = readSchema(db);
  const same =
    actual.size === expected.size &&
    [...expected].every(
      ([key, sql]) => actual.has(key) && actual.get(key) === sql,
    );
  if (!same) throw new VaultBackupFailure("badPasswordOrCorrupt");
}
