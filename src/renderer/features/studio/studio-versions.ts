import type { StudioKind, StudioResult } from "@shared/ipc/types";
import { STUDIO_MAX_VERSIONS } from "@shared/studio-versions";

// 178 (research R3): phiên bản kết quả Studio ở renderer — hàm THUẦN, không mutate đầu vào (test tất định).
// versions[kind] = danh sách phiên bản, MỚI NHẤT TRƯỚC; selected[kind] = id đang xem (thiếu ⇒ mới nhất).

export type StudioVersions = Partial<Record<StudioKind, StudioResult[]>>;
export type StudioSelection = Partial<Record<StudioKind, string>>;

/** Gom kết quả `studio:list` theo loại, mới nhất trước (sắp ổn định: createdAt trùng ⇒ giữ thứ tự main trả). */
export function groupVersions(
  results: readonly StudioResult[],
): StudioVersions {
  const out: StudioVersions = {};
  for (const r of results) out[r.kind] = [...(out[r.kind] ?? []), r];
  for (const k of Object.keys(out) as StudioKind[]) {
    out[k] = [...(out[k] ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  }
  return out;
}

/** Phiên bản đang xem của loại: theo lựa chọn; lựa chọn thiếu / không còn ⇒ mới nhất; không có bản ⇒ undefined. */
export function currentVersion(
  versions: StudioVersions,
  selected: StudioSelection,
  kind: StudioKind,
): StudioResult | undefined {
  const list = versions[kind];
  if (!list || list.length === 0) return undefined;
  const id = selected[kind];
  return list.find((r) => r.id === id) ?? list[0];
}

/** Thêm phiên bản vừa tạo lên đầu, cắt theo trần (khớp việc main dọn bản cũ nhất). */
export function withInserted(
  versions: StudioVersions,
  result: StudioResult,
): StudioVersions {
  const rest = (versions[result.kind] ?? []).filter((r) => r.id !== result.id);
  return {
    ...versions,
    [result.kind]: [result, ...rest].slice(0, STUDIO_MAX_VERSIONS),
  };
}

export interface AfterDelete {
  versions: StudioVersions;
  selected: StudioSelection;
  /** Phiên bản được hiển thị sau khi xoá (undefined ⇒ loại không còn bản nào). */
  nextId: string | undefined;
}

/** Trạng thái sau khi xoá một phiên bản. Xoá bản đang xem ⇒ về bản mới nhất còn lại. */
export function afterDelete(
  versions: StudioVersions,
  selected: StudioSelection,
  kind: StudioKind,
  id: string,
): AfterDelete {
  const shownId = currentVersion(versions, selected, kind)?.id;
  const rest = (versions[kind] ?? []).filter((r) => r.id !== id);
  const nextVersions: StudioVersions = { ...versions };
  if (rest.length > 0) nextVersions[kind] = rest;
  else delete nextVersions[kind];
  const deletedShown = shownId === id;
  const nextSelected: StudioSelection = { ...selected };
  if (deletedShown) delete nextSelected[kind];
  return {
    versions: nextVersions,
    selected: nextSelected,
    nextId: deletedShown ? rest[0]?.id : shownId,
  };
}
