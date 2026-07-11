import type { Citation, StudioKind, StudioResult } from "@shared/ipc/types";
import type { Db } from "../../db/database";

// Repo lưu bền kết quả Studio (SQLite ở main). Nhận Db + deps (now/uuid) tiêm → unit-test với :memory:.
// UPSERT theo UNIQUE(notebook_id, kind): 1 bản mới nhất mỗi loại/notebook (FR-008). KHÔNG log content.

interface StudioRow {
  id: string;
  notebook_id: string;
  kind: StudioKind;
  content: string;
  citations_json: string;
  created_at: number;
  updated_at: number;
}

interface RepoDeps {
  now?: () => number;
  uuid?: () => string;
}

export interface StudioRepo {
  /** Tạo/ghi đè bản tổng hợp cho (notebookId, kind). Trả bản đã lưu. */
  upsert(
    notebookId: string,
    kind: StudioKind,
    content: string,
    citations: Citation[],
  ): StudioResult;
  /** Danh sách kết quả đã lưu của notebook (≤ 4, mỗi kind ≤ 1). */
  listByNotebook(notebookId: string): StudioResult[];
  /** Bản của 1 loại, hoặc null. */
  getByNotebookKind(notebookId: string, kind: StudioKind): StudioResult | null;
}

function parseCitations(json: string): Citation[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? (v as Citation[]) : [];
  } catch {
    // citations_json hỏng → coi như rỗng (không vỡ UI); nội dung vẫn hiển thị.
    return [];
  }
}

function toResult(r: StudioRow): StudioResult {
  return {
    id: r.id,
    notebookId: r.notebook_id,
    kind: r.kind,
    content: r.content,
    citations: parseCitations(r.citations_json),
    createdAt: r.created_at,
  };
}

export function createStudioRepo(db: Db, deps: RepoDeps = {}): StudioRepo {
  const now = deps.now ?? (() => Date.now());
  const uuid = deps.uuid ?? (() => crypto.randomUUID());

  return {
    upsert(notebookId, kind, content, citations) {
      const ts = now();
      const citationsJson = JSON.stringify(citations);
      // Giữ id/created_at cũ khi ghi đè; chỉ đổi content/citations/updated_at.
      db.prepare(
        `INSERT INTO studio_result
           (id, notebook_id, kind, content, citations_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (notebook_id, kind) DO UPDATE SET
           content = excluded.content,
           citations_json = excluded.citations_json,
           updated_at = excluded.updated_at`,
      ).run(uuid(), notebookId, kind, content, citationsJson, ts, ts);

      const saved = this.getByNotebookKind(notebookId, kind);
      if (!saved) throw new Error("Lưu kết quả Studio thất bại.");
      return saved;
    },

    listByNotebook(notebookId) {
      const rows = db
        .prepare(
          "SELECT * FROM studio_result WHERE notebook_id = ? ORDER BY created_at ASC",
        )
        .all(notebookId) as unknown as StudioRow[];
      return rows.map(toResult);
    },

    getByNotebookKind(notebookId, kind) {
      const row = db
        .prepare(
          "SELECT * FROM studio_result WHERE notebook_id = ? AND kind = ? LIMIT 1",
        )
        .get(notebookId, kind) as unknown as StudioRow | undefined;
      return row ? toResult(row) : null;
    },
  };
}
