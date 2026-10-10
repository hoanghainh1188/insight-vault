import type { StudioKind, StudioStreamTokenEvent } from "@shared/ipc/types";
import type { ActiveGenerationIds } from "./studio-progress";

// 178 (PR 4, FR-042/FR-043, research R8): chữ TẠM khi stream lượt viết cuối, theo loại — hàm THUẦN, không mutate.
// Token chỉ được nhận khi generationId là lượt HIỆN HÀNH của một loại (lượt bị thay / huỷ / notebook cũ ⇒ bỏ).

/** Chữ tạm (thô, còn [n]) theo loại — hiển thị qua stripCitationMarkers. */
export type StudioStreamMap = Partial<Record<StudioKind, string>>;

/** Security L2: trần chữ tạm mỗi loại (ký tự) — mô hình sinh vô hạn không làm phình buffer; phần sau chỉ có ở bản cuối. */
export const STUDIO_STREAM_TEXT_MAX = 200_000;

/** Nối delta vào loại có lượt hiện hành = `e.generationId`; không khớp / loại bị chặn (đang huỷ) ⇒ trả nguyên `map`. */
export function applyStreamToken(
  map: StudioStreamMap,
  active: ActiveGenerationIds,
  e: StudioStreamTokenEvent,
  blocked: ReadonlySet<StudioKind> = new Set(),
): StudioStreamMap {
  if (typeof e?.generationId !== "string" || typeof e.delta !== "string") {
    return map;
  }
  const kind = (Object.keys(active) as StudioKind[]).find(
    (k) => active[k] === e.generationId,
  );
  if (!kind || blocked.has(kind) || e.delta === "") return map;
  const prev = map[kind] ?? "";
  if (prev.length >= STUDIO_STREAM_TEXT_MAX) return map;
  return {
    ...map,
    [kind]: (prev + e.delta).slice(0, STUDIO_STREAM_TEXT_MAX),
  };
}
