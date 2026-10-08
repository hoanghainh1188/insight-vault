import {
  normalizeSourceErrorCode,
  type SourceErrorCode,
} from "@shared/codes/source-error";
import type {
  Chunk,
  Source,
  SourceKind,
  SourceStatus,
} from "@shared/ipc/types";
import { foldVietnamese } from "./fts-fold";
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
  extraction_version: number;
}

interface ChunkRow {
  id: string;
  source_id: string;
  ordinal: number;
  text: string;
  page: number | null;
  char_start: number;
  char_end: number;
  t_start: number | null; // 045 — audio timestamp (giây); null cho loại khác
  t_end: number | null;
  bbox_x: number | null; // 053 — vùng chữ OCR (chuẩn hoá 0..1); null cho loại khác
  bbox_y: number | null;
  bbox_w: number | null;
  bbox_h: number | null;
}

function toSource(r: SourceRow): Source {
  return {
    id: r.id,
    notebookId: r.notebook_id,
    kind: r.kind,
    title: r.title,
    status: r.status,
    errorCode: normalizeSourceErrorCode(r.error_label),
    pageCount: r.page_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    extractionVersion: r.extraction_version,
  };
}

function toChunk(r: ChunkRow): Chunk {
  return {
    id: r.id,
    sourceId: r.source_id,
    ordinal: r.ordinal,
    text: r.text,
    locator: {
      page: r.page,
      charStart: r.char_start,
      charEnd: r.char_end,
      // 045: chỉ gắn timestamp khi có (audio) — giữ locator gọn cho loại khác.
      ...(r.t_start != null
        ? { tStart: r.t_start, tEnd: r.t_end ?? r.t_start }
        : {}),
      // 053: chỉ gắn bbox khi có (ảnh OCR).
      ...(r.bbox_x != null
        ? {
            bbox: {
              x: r.bbox_x,
              y: r.bbox_y ?? 0,
              w: r.bbox_w ?? 0,
              h: r.bbox_h ?? 0,
            },
          }
        : {}),
    },
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
  /** 101: thông tin để liên kết lại file gốc (loại + đường dẫn hiện tại + băm nội dung đã nạp). */
  getRelinkInfo(id: string): {
    kind: SourceKind;
    origin: string;
    contentHash: string;
    status: SourceStatus;
  } | null;
  /** 101: cập nhật đường dẫn file gốc (sau khi đã kiểm cùng nội dung). */
  updateOrigin(id: string, origin: string): void;
  listByNotebook(notebookId: string): Source[];
  listByStatus(status: SourceStatus): Source[];
  countByNotebook(notebookId: string): number;
  findDuplicate(notebookId: string, contentHash: string): Source | null;
  updateStatus(
    id: string,
    status: SourceStatus,
    errorCode?: SourceErrorCode | null,
  ): void;
  setPageCount(id: string, pageCount: number | null): void;
  setTitle(id: string, title: string): void;
  /** 112: ghi phiên bản cách trích đã dùng cho chunk hiện tại. */
  setExtractionVersion(id: string, version: number): void;
  insertChunks(sourceId: string, drafts: ChunkDraft[]): string[];
  /**
   * 112 (xử lý lại nguyên tử): trong MỘT transaction — xoá chunk cũ (trigger xoá FTS), chèn chunk mới với `ids` định
   * trước (vector đã ghi theo các id này), cập nhật extraction_version + page_count. Lỗi ⇒ rollback, không đổi gì.
   */
  replaceChunks(
    sourceId: string,
    drafts: ChunkDraft[],
    ids: string[],
    meta: { extractionVersion: number; pageCount: number | null },
  ): void;
  listChunks(sourceId: string): Chunk[];
  /** Lấy nhiều chunk theo danh sách id bất kỳ (kết quả vector search), trả theo THỨ TỰ ids. */
  getChunksByIds(ids: string[]): Chunk[];
  chunkIds(sourceId: string): string[];
  /** 059: đếm số chunk của một notebook. */
  countChunksByNotebook(notebookId: string): number;
  /** 059: mọi chunk (id + notebook + source) để tái lập chỉ mục toàn cục. */
  allChunkRefs(): { id: string; notebookId: string; sourceId: string }[];
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

  const inTransaction = (fn: () => void): void => {
    db.exec("BEGIN");
    try {
      fn();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };

  // Ghi chunk + đồng bộ FTS keyword (055: text đã FOLD theo rowid vừa insert; xoá do trigger AFTER DELETE).
  // Gọi BÊN TRONG transaction.
  const writeChunks = (
    sourceId: string,
    drafts: ChunkDraft[],
    ids: string[],
  ): void => {
    const stmt = db.prepare(
      "INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end, t_start, t_end, bbox_x, bbox_y, bbox_w, bbox_h) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const ftsStmt = db.prepare(
      "INSERT INTO chunk_fts (rowid, text) VALUES (?, ?)",
    );
    drafts.forEach((d, i) => {
      const bb = d.locator.bbox;
      const res = stmt.run(
        ids[i],
        sourceId,
        d.ordinal,
        d.text,
        d.locator.page,
        d.locator.charStart,
        d.locator.charEnd,
        d.locator.tStart ?? null,
        d.locator.tEnd ?? null,
        bb?.x ?? null,
        bb?.y ?? null,
        bb?.w ?? null,
        bb?.h ?? null,
      );
      ftsStmt.run(Number(res.lastInsertRowid), foldVietnamese(d.text));
    });
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

    getRelinkInfo(id) {
      const row = db
        .prepare(
          "SELECT kind, origin, content_hash, status FROM source WHERE id = ?",
        )
        .get(id) as unknown as
        | {
            kind: SourceKind;
            origin: string;
            content_hash: string;
            status: SourceStatus;
          }
        | undefined;
      return row
        ? {
            kind: row.kind,
            origin: row.origin,
            contentHash: row.content_hash,
            status: row.status,
          }
        : null;
    },

    updateOrigin(id, origin) {
      db.prepare(
        "UPDATE source SET origin = ?, updated_at = ? WHERE id = ?",
      ).run(origin, now(), id);
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

    updateStatus(id, status, errorCode = null) {
      db.prepare(
        "UPDATE source SET status = ?, error_label = ?, updated_at = ? WHERE id = ?",
      ).run(status, errorCode, now(), id);
    },

    setPageCount(id, pageCount) {
      db.prepare(
        "UPDATE source SET page_count = ?, updated_at = ? WHERE id = ?",
      ).run(pageCount, now(), id);
    },

    setExtractionVersion(id, version) {
      db.prepare(
        "UPDATE source SET extraction_version = ?, updated_at = ? WHERE id = ?",
      ).run(version, now(), id);
    },

    setTitle(id, title) {
      db.prepare(
        "UPDATE source SET title = ?, updated_at = ? WHERE id = ?",
      ).run(title, now(), id);
    },

    insertChunks(sourceId, drafts) {
      const ids = drafts.map(() => uuid());
      inTransaction(() => writeChunks(sourceId, drafts, ids));
      return ids;
    },

    replaceChunks(sourceId, drafts, ids, meta) {
      if (ids.length !== drafts.length) {
        throw new Error("replaceChunks: số id không khớp số chunk.");
      }
      inTransaction(() => {
        db.prepare("DELETE FROM chunk WHERE source_id = ?").run(sourceId);
        writeChunks(sourceId, drafts, ids);
        db.prepare(
          "UPDATE source SET extraction_version = ?, page_count = ?, updated_at = ? WHERE id = ?",
        ).run(meta.extractionVersion, meta.pageCount, now(), sourceId);
      });
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

    // 059: đếm số chunk của một notebook (so với số vector để biết notebook đã nhúng lại xong chưa).
    // chunk KHÔNG có notebook_id → JOIN qua source.
    countChunksByNotebook(notebookId) {
      const row = db
        .prepare(
          "SELECT COUNT(*) AS n FROM chunk c JOIN source s ON c.source_id = s.id WHERE s.notebook_id = ?",
        )
        .get(notebookId) as { n: number };
      return row.n;
    },

    // 059: liệt kê MỌI chunk (id + notebook + source) để tái lập chỉ mục toàn cục. Nhẹ — không kèm text.
    // notebook_id lấy từ source (chunk chỉ có source_id).
    allChunkRefs() {
      const rows = db
        .prepare(
          "SELECT c.id AS id, s.notebook_id AS notebook_id, c.source_id AS source_id " +
            "FROM chunk c JOIN source s ON c.source_id = s.id",
        )
        .all() as unknown as {
        id: string;
        notebook_id: string;
        source_id: string;
      }[];
      return rows.map((r) => ({
        id: r.id,
        notebookId: r.notebook_id,
        sourceId: r.source_id,
      }));
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
