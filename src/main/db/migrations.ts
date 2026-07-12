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
  // 027-chat-history: lịch sử hội thoại Chat theo notebook. FK ON DELETE CASCADE (xoá notebook → xoá lịch
  // sử). Lưu cả citations (giữ kiểm chứng được khi nạp lại) + cờ not_found.
  {
    version: 4,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS chat_message (
          id             TEXT PRIMARY KEY,
          notebook_id    TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          role           TEXT NOT NULL CHECK (role IN ('user','assistant')),
          content        TEXT NOT NULL,
          citations_json TEXT NOT NULL DEFAULT '[]',
          not_found      INTEGER NOT NULL DEFAULT 0,
          created_at     INTEGER NOT NULL
        )
      `);
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_chat_notebook ON chat_message(notebook_id, created_at)",
      );
    },
  },
  // 045-audio-transcribe (Pha 2a): (a) chunk thêm t_start/t_end (giây) cho locator audio; (b) source.kind
  // BỎ CHECK cứng để nhận 'audio' (và video/ảnh sau) — validate loại ở app boundary (detectKindFromPath +
  // SourceKind). Tái tạo bảng source cần né cascade xoá chunk (FK ON): backup chunk → recreate → restore.
  {
    version: 5,
    up(db) {
      db.exec("ALTER TABLE chunk ADD COLUMN t_start REAL");
      db.exec("ALTER TABLE chunk ADD COLUMN t_end REAL");
      // Backup chunk (bảng thường, không FK → không bị cascade khi DROP source).
      db.exec(
        `CREATE TABLE chunk_bak_045 AS
           SELECT id, source_id, ordinal, text, page, char_start, char_end FROM chunk`,
      );
      // source mới — KHÔNG còn CHECK kind (validate ở app). Cột giữ nguyên thứ tự để INSERT SELECT *.
      db.exec(`
        CREATE TABLE source_new (
          id           TEXT PRIMARY KEY,
          notebook_id  TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          kind         TEXT NOT NULL,
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
      db.exec("INSERT INTO source_new SELECT * FROM source");
      db.exec("DROP TABLE source"); // implicit DELETE → cascade xoá chunk (đã backup)
      db.exec("ALTER TABLE source_new RENAME TO source");
      // Khôi phục chunk từ backup (giữ id → vector LanceDB vẫn khớp).
      db.exec(
        `INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end)
           SELECT id, source_id, ordinal, text, page, char_start, char_end FROM chunk_bak_045`,
      );
      db.exec("DROP TABLE chunk_bak_045");
      // Tái tạo index của source (mất khi DROP).
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_source_notebook ON source(notebook_id)",
      );
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_source_hash ON source(notebook_id, content_hash)",
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
