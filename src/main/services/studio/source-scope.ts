import type { Source } from "@shared/ipc/types";
import { STUDIO_MAX_SOURCE_IDS } from "@shared/studio-scope";

// 178 (PR 4, FR-030..FR-033, research R6): phạm vi nguồn của một lượt Studio — kiểm ở MAIN (tham số renderer KHÔNG tin).
// Hàm THUẦN: `sourceIds` (nếu có) thắng `sourceId` cũ; phải là mảng chuỗi không rỗng; khử trùng (giữ thứ tự); ≤ 50 id khác
// nhau; mỗi id phải thuộc notebook (sai ⇒ studioSourcesInvalid) và `ready` (sai ⇒ studioSourceNotReady) — lỗi ⇒ từ chối CẢ
// lượt, không bỏ qua âm thầm. Rỗng / thiếu ⇒ `ids: null` (= mọi nguồn ready). Không log id.

export { STUDIO_MAX_SOURCE_IDS };

export type SourceScopeErrorCode =
  "studioSourcesInvalid" | "studioSourceNotReady";

export type SourceScopeResult =
  | { ok: true; ids: string[] | null }
  | { ok: false; code: SourceScopeErrorCode };

export interface SourceScopeInput {
  readonly sourceId?: unknown;
  readonly sourceIds?: unknown;
}

/** Security M2: trần độ dài mảng THÔ (trước khử trùng) — chặn mảng khổng lồ toàn id trùng làm nghẽn main. */
export const STUDIO_MAX_RAW_SOURCE_IDS = STUDIO_MAX_SOURCE_IDS * 4;

const INVALID: SourceScopeResult = { ok: false, code: "studioSourcesInvalid" };

/** Danh sách id thô từ input — null khi sai kiểu. */
function rawIds(input: SourceScopeInput): readonly unknown[] | null {
  if (input.sourceIds !== undefined) {
    return Array.isArray(input.sourceIds) ? input.sourceIds : null;
  }
  if (input.sourceId === undefined || input.sourceId === "") return [];
  return typeof input.sourceId === "string" ? [input.sourceId] : null;
}

export function resolveSourceScope(
  input: SourceScopeInput,
  sources: readonly Source[],
): SourceScopeResult {
  const raw = rawIds(input);
  if (raw === null || raw.length > STUDIO_MAX_RAW_SOURCE_IDS) return INVALID;
  if (raw.length === 0) return { ok: true, ids: null };

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string" || v === "") return INVALID;
    if (seen.has(v)) continue;
    seen.add(v);
    if (seen.size > STUDIO_MAX_SOURCE_IDS) return INVALID;
    ids.push(v);
  }

  const byId = new Map(sources.map((s) => [s.id, s]));
  if (ids.some((id) => !byId.has(id))) return INVALID;
  if (ids.some((id) => byId.get(id)!.status !== "ready")) {
    return { ok: false, code: "studioSourceNotReady" };
  }
  return { ok: true, ids };
}
