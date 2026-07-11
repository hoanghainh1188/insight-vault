import type {
  Chunk,
  Source,
  SourceKind,
  SourceStatus,
} from "@shared/ipc/types";
import type { Db } from "../../db/database";
import type { ChunkDraft } from "./chunker";

// Repo CRUD source/chunk (SQLite ở main). Nhận Db + deps (now/uuid) tiêm → unit-test với :memory:.
// SQL parameterized (?) — không nối chuỗi (Constitution III / bảo mật).

interface RepoDeps {
  now?: () => number;
  uuid?: () => string;
}

interface SourceRow {
  id: string;
  notebook_id: string;
  kind: SourceKind;
  title: string;
  origin: string;
  status: SourceStatus;
  error_label: string | null;
  page_count: number | null;
  content_hash: string;
  created_at: number;
  updated_at: number;
}

interface ChunkRow {
  id: string;
  source_id: string;
  ordinal: number;
  text: string;
  page: number | null;
  char_start: number;
  char_end: number;
}

function toSource(r: SourceRow): Source {
  return {
    id: r.id,
    notebookId: r.notebook_id,
    kind: r.kind,
    title: r.title,
    status: r.status,
    errorLabel: r.error_label,
    pageCount: r.page_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toChunk(r: ChunkRow): Chunk {
  return {
    id: r.id,
    sourceId: r.source_id,
    ordinal: r.ordinal,
    text: r.text,
    locator: { page: r.page, charStart: r.char_start, charEnd: r.char_end },
  };
}

export interface CreateSourceInput {
  notebookId: string;
  kind: SourceKind;
  title: string;
  origin: string;
  contentHash: string;
  pageCount?: number | null;
}

export interface SourceRepo {
  create(input: CreateSourceInput): Source;
  getById(id: string): Source | null;
  /** Đường dẫn tệp/URL gốc (KHÔNG expose ra renderer; chỉ main dùng để parse/resume). */
  getOrigin(id: string): string | null;
  listByNotebook(notebookId: string): Source[];
  listByStatus(status: SourceStatus): Source[];
  countByNotebook(notebookId: string): number;
  findDuplicate(notebookId: string, contentHash: string): Source | null;
  updateStatus(
    id: string,
    status: SourceStatus,
    errorLabel?: string | null,
  ): void;
  setPageCount(id: string, pageCount: number | null): void;
  setTitle(id: string, title: string): void;
  insertChunks(sourceId: string, drafts: ChunkDraft[]): string[];
  listChunks(sourceId: string): Chunk[];
  /** Lấy nhiều chunk theo danh sách id bất kỳ (kết quả vector search), trả theo THỨ TỰ ids. */
  getChunksByIds(ids: string[]): Chunk[];
  chunkIds(sourceId: string): string[];
  deleteChunks(sourceId: string): void;
  delete(id: string): { deleted: true };
}

export function createSourceRepo(db: Db, deps: RepoDeps = {}): SourceRepo {
  const now = deps.now ?? (() => Date.now());
  const uuid = deps.uuid ?? (() => crypto.randomUUID());

  const getById = (id: string): Source | null => {
    const row = db
      .prepare("SELECT * FROM source WHERE id = ?")
      .get(id) as unknown as SourceRow | undefined;
    return row ? toSource(row) : null;
  };

  return {
    create(input) {
      const id = uuid();
      const ts = now();
      db.prepare(
        `INSERT INTO source
         (id, notebook_id, kind, title, origin, status, error_label, page_count, content_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'queued', NULL, ?, ?, ?, ?)`,
      ).run(
        id,
        input.notebookId,
        input.kind,
        input.title,
        input.origin,
        input.pageCount ?? null,
        input.contentHash,
        ts,
        ts,
      );
      return getById(id)!;
    },

    getById,

    getOrigin(id) {
      const row = db
        .prepare("SELECT origin FROM source WHERE id = ?")
        .get(id) as unknown as { origin: string } | undefined;
      return row?.origin ?? null;
    },

    listByNotebook(notebookId) {
      const rows = db
        .prepare(
          "SELECT * FROM source WHERE notebook_id = ? ORDER BY created_at ASC",
        )
        .all(notebookId) as unknown as SourceRow[];
      return rows.map(toSource);
    },

    listByStatus(status) {
      const rows = db
        .prepare(
          "SELECT * FROM source WHERE status = ? ORDER BY created_at ASC",
        )
        .all(status) as unknown as SourceRow[];
      return rows.map(toSource);
    },

    countByNotebook(notebookId) {
      const row = db
        .prepare("SELECT COUNT(*) AS c FROM source WHERE notebook_id = ?")
        .get(notebookId) as unknown as { c: number };
      return row.c;
    },

    findDuplicate(notebookId, contentHash) {
      const row = db
        .prepare(
          "SELECT * FROM source WHERE notebook_id = ? AND content_hash = ? LIMIT 1",
        )
        .get(notebookId, contentHash) as unknown as SourceRow | undefined;
      return row ? toSource(row) : null;
    },

    updateStatus(id, status, errorLabel = null) {
      db.prepare(
        "UPDATE source SET status = ?, error_label = ?, updated_at = ? WHERE id = ?",
      ).run(status, errorLabel, now(), id);
    },

    setPageCount(id, pageCount) {
      db.prepare(
        "UPDATE source SET page_count = ?, updated_at = ? WHERE id = ?",
      ).run(pageCount, now(), id);
    },

    setTitle(id, title) {
      db.prepare(
        "UPDATE source SET title = ?, updated_at = ? WHERE id = ?",
      ).run(title, now(), id);
    },

    insertChunks(sourceId, drafts) {
      const ids: string[] = [];
      const stmt = db.prepare(
        "INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      db.exec("BEGIN");
      try {
        for (const d of drafts) {
          const cid = uuid();
          ids.push(cid);
          stmt.run(
            cid,
            sourceId,
            d.ordinal,
            d.text,
            d.locator.page,
            d.locator.charStart,
            d.locator.charEnd,
          );
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return ids;
    },

    listChunks(sourceId) {
      const rows = db
        .prepare("SELECT * FROM chunk WHERE source_id = ? ORDER BY ordinal ASC")
        .all(sourceId) as unknown as ChunkRow[];
      return rows.map(toChunk);
    },

    getChunksByIds(ids) {
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT * FROM chunk WHERE id IN (${placeholders})`)
        .all(...ids) as unknown as ChunkRow[];
      const byId = new Map(rows.map((r) => [r.id, toChunk(r)]));
      // Trả theo đúng thứ tự ids đầu vào (SQL IN không đảm bảo thứ tự); bỏ id không tồn tại.
      return ids.map((id) => byId.get(id)).filter((c): c is Chunk => c != null);
    },

    chunkIds(sourceId) {
      const rows = db
        .prepare(
          "SELECT id FROM chunk WHERE source_id = ? ORDER BY ordinal ASC",
        )
        .all(sourceId) as unknown as { id: string }[];
      return rows.map((r) => r.id);
    },

    deleteChunks(sourceId) {
      db.prepare("DELETE FROM chunk WHERE source_id = ?").run(sourceId);
    },

    delete(id) {
      db.prepare("DELETE FROM source WHERE id = ?").run(id); // cascade xoá chunk (FK)
      return { deleted: true };
    },
  };
}
