import { UserFacingError } from "@shared/codes/user-error";
import type { Citation, StudioKind, StudioResult } from "@shared/ipc/types";
import type { Db } from "../../db/database";
import { STUDIO_MAX_VERSIONS } from "./constants";

// Repo lưu bền kết quả Studio (SQLite ở main). Nhận Db + deps (now/uuid) tiêm → unit-test với :memory:.
// 178: mỗi lần lưu = 1 PHIÊN BẢN mới (không ghi đè); giữ tối đa STUDIO_MAX_VERSIONS mỗi (notebook, kind), dọn bản cũ nhất
// trong CÙNG giao dịch với insert. KHÔNG log content.

interface StudioRow {
  id: string;
  notebook_id: string;
  kind: StudioKind;
  content: string;
  citations_json: string;
  custom_prompt: string | null;
  source_ids_json: string | null;
  parts: number | null;
  truncated: number | null;
  local: number | null;
  created_at: number;
  updated_at: number;
}

interface RepoDeps {
  now?: () => number;
  uuid?: () => string;
}

/** Dữ liệu một phiên bản cần lưu. */
export interface StudioVersionInput {
  notebookId: string;
  kind: StudioKind;
  content: string;
  citations: Citation[];
  parts?: number;
  truncated?: boolean;
  local?: boolean;
  /** 178 (PR 3): yêu cầu tuỳ chỉnh đã chuẩn hoá (chỉ kind "custom"). */
  customPrompt?: string;
  /** 178 (PR 4): phạm vi nguồn đã chuẩn hoá (resolveSourceScope); thiếu ⇒ NULL (mọi nguồn ready). */
  sourceIds?: string[];
}

export interface StudioRepo {
  /** Lưu một phiên bản mới + dọn trần (một giao dịch). Trả phiên bản đã lưu. */
  insert(version: StudioVersionInput): StudioResult;
  /** Mọi phiên bản của notebook, sắp theo kind rồi mới nhất trước. */
  listByNotebook(notebookId: string): StudioResult[];
  /** Phiên bản của một loại, mới nhất trước. */
  listVersions(notebookId: string, kind: StudioKind): StudioResult[];
  /** Xoá một phiên bản khi nó thuộc notebook. Trả true nếu đã xoá. */
  deleteVersion(notebookId: string, id: string): boolean;
}

// Mới nhất trước; created_at trùng ⇒ theo thứ tự chèn (rowid).
const NEWEST_FIRST = "created_at DESC, rowid DESC";

function parseCitations(json: string): Citation[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? (v as Citation[]) : [];
  } catch {
    // citations_json hỏng → coi như rỗng (không vỡ UI); nội dung vẫn hiển thị.
    return [];
  }
}

/** source_ids_json hỏng / không phải mảng chuỗi ⇒ null (bỏ trường, phiên bản vẫn đọc được). */
function parseSourceIds(json: string | null): string[] | null {
  if (json === null) return null;
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) && v.every((x) => typeof x === "string")
      ? (v as string[])
      : null;
  } catch {
    return null;
  }
}

function toResult(r: StudioRow): StudioResult {
  const sourceIds = parseSourceIds(r.source_ids_json);
  return {
    id: r.id,
    notebookId: r.notebook_id,
    kind: r.kind,
    content: r.content,
    citations: parseCitations(r.citations_json),
    createdAt: r.created_at,
    // Dòng trước v11 để NULL ⇒ không có trường (giao diện không hiện ghi chú, như trước).
    ...(r.parts !== null ? { parts: r.parts } : {}),
    ...(r.truncated !== null ? { truncated: r.truncated === 1 } : {}),
    ...(r.local !== null ? { local: r.local === 1 } : {}),
    ...(r.custom_prompt !== null ? { customPrompt: r.custom_prompt } : {}),
    ...(sourceIds ? { sourceIds } : {}),
  };
}

const flag = (b: boolean | undefined): number | null =>
  b === undefined ? null : b ? 1 : 0;

export function createStudioRepo(db: Db, deps: RepoDeps = {}): StudioRepo {
  const now = deps.now ?? (() => Date.now());
  const uuid = deps.uuid ?? (() => crypto.randomUUID());

  function getById(id: string): StudioResult | null {
    const row = db
      .prepare("SELECT * FROM studio_result WHERE id = ?")
      .get(id) as unknown as StudioRow | undefined;
    return row ? toResult(row) : null;
  }

  return {
    insert(v) {
      const ts = now();
      const id = uuid();
      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO studio_result
             (id, notebook_id, kind, content, citations_json, custom_prompt, source_ids_json, parts, truncated, local, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          v.notebookId,
          v.kind,
          v.content,
          JSON.stringify(v.citations),
          v.customPrompt ?? null,
          v.sourceIds ? JSON.stringify(v.sourceIds) : null,
          v.parts ?? null,
          flag(v.truncated),
          flag(v.local),
          ts,
          ts,
        );
        // Dọn trần: giữ STUDIO_MAX_VERSIONS bản mới nhất của (notebook, kind).
        db.prepare(
          `DELETE FROM studio_result WHERE id IN (
             SELECT id FROM studio_result WHERE notebook_id = ? AND kind = ?
             ORDER BY ${NEWEST_FIRST} LIMIT -1 OFFSET ?)`,
        ).run(v.notebookId, v.kind, STUDIO_MAX_VERSIONS);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      const saved = getById(id);
      if (!saved) throw new UserFacingError("studioSaveFailed");
      return saved;
    },

    listByNotebook(notebookId) {
      const rows = db
        .prepare(
          `SELECT * FROM studio_result WHERE notebook_id = ? ORDER BY kind ASC, ${NEWEST_FIRST}`,
        )
        .all(notebookId) as unknown as StudioRow[];
      return rows.map(toResult);
    },

    listVersions(notebookId, kind) {
      const rows = db
        .prepare(
          `SELECT * FROM studio_result WHERE notebook_id = ? AND kind = ? ORDER BY ${NEWEST_FIRST}`,
        )
        .all(notebookId, kind) as unknown as StudioRow[];
      return rows.map(toResult);
    },

    deleteVersion(notebookId, id) {
      const r = db
        .prepare("DELETE FROM studio_result WHERE id = ? AND notebook_id = ?")
        .run(id, notebookId);
      return Number(r.changes) > 0;
    },
  };
}
