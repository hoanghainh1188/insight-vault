import { DatabaseSync } from "node:sqlite";

// Driver SQLite: node:sqlite built-in (ADR D2 cập nhật 2026-07-11) — chạy ở CẢ Electron main lẫn Node
// (vitest), không native module. Mở CHỈ ở main process (Constitution III).
export type Db = DatabaseSync;

/** Mở DB tại `path` (dùng ':memory:' cho test). Bật FK (cho cascade ở 004) + WAL (bền). */
export function openDatabase(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  return db;
}
