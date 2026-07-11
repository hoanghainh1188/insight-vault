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
  // 011-ingestion: bảng source + chunk. FK ON DELETE CASCADE (xoá notebook→source→chunk).
  // Vector ở LanceDB (không FK xuyên store) — dọn bằng lệnh riêng theo source_id/notebook_id.
  {
    version: 2,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS source (
          id           TEXT PRIMARY KEY,
          notebook_id  TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          kind         TEXT NOT NULL CHECK (kind IN ('pdf','docx','txt','md','url')),
          title        TEXT NOT NULL,
          origin       TEXT NOT NULL,
          status       TEXT NOT NULL CHECK (status IN ('queued','processing','awaiting_embedding','ready','error')),
          error_label  TEXT,
          page_count   INTEGER,
          content_hash TEXT NOT NULL,
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS chunk (
          id         TEXT PRIMARY KEY,
          source_id  TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
          ordinal    INTEGER NOT NULL,
          text       TEXT NOT NULL,
          page       INTEGER,
          char_start INTEGER NOT NULL,
          char_end   INTEGER NOT NULL
        )
      `);
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_source_notebook ON source(notebook_id)",
      );
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_source_hash ON source(notebook_id, content_hash)",
      );
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_chunk_source ON chunk(source_id)",
      );
    },
  },
  // 021-studio: bảng studio_result (bản tổng hợp Studio lưu bền). FK ON DELETE CASCADE (xoá notebook →
  // xoá kết quả). UNIQUE(notebook_id, kind) → 1 bản mới nhất mỗi loại/notebook; regenerate = UPSERT.
  {
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS studio_result (
          id             TEXT PRIMARY KEY,
          notebook_id    TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          kind           TEXT NOT NULL CHECK (kind IN ('summary','keyPoints','faq','outline')),
          content        TEXT NOT NULL,
          citations_json TEXT NOT NULL,
          created_at     INTEGER NOT NULL,
          updated_at     INTEGER NOT NULL,
          UNIQUE (notebook_id, kind)
        )
      `);
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_studio_notebook ON studio_result(notebook_id)",
      );
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
