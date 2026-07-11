import type { Db } from "./database";

// Migration runner (ADR 2026-07-11-sqlite-migrations): PRAGMA user_version, append-only, 1 transaction/bước.
// THÊM migration mới ở CUỐI mảng — KHÔNG sửa migration đã phát hành (dữ liệu người dùng đã áp).

export interface Migration {
  version: number;
  up(db: Db): void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS notebook (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          color      TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    },
  },
];

export function getUserVersion(db: Db): number {
  const row = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  return row.user_version;
}

/** Chạy các migration có version > user_version hiện tại. Trả version cuối. Ném nếu DB mới hơn app. */
export function runMigrations(
  db: Db,
  migrations: Migration[] = MIGRATIONS,
): number {
  const current = getUserVersion(db);
  const max = migrations.reduce((m, x) => Math.max(m, x.version), 0);
  if (current > max) {
    throw new Error(
      `Schema DB (v${current}) mới hơn phiên bản ứng dụng (v${max}) — không tự hạ cấp để tránh mất dữ liệu.`,
    );
  }
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);
  for (const m of pending) {
    db.exec("BEGIN");
    try {
      m.up(db);
      // An toàn: m.version là HẰNG SỐ nội bộ (mảng MIGRATIONS), KHÔNG phải input người dùng; PRAGMA
      // không hỗ trợ bind parameter `?`. Mọi SQL còn lại dùng parameterized `?` (xem notebook-repo).
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return getUserVersion(db);
}
