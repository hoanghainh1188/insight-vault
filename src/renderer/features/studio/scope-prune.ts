import type { Source } from "@shared/ipc/types";

// 178 (PR 4, review code-reviewer): phạm vi đã chọn chỉ giữ id còn READY. Hàm THUẦN, không mutate; không đổi ⇒ trả CHÍNH mảng
// cũ (caller so tham chiếu để biết có cần báo "phạm vi đã đổi" hay không).

export function pruneScope(
  scope: readonly string[],
  readySources: readonly Pick<Source, "id">[],
): readonly string[] {
  const ready = new Set(readySources.map((s) => s.id));
  return scope.every((id) => ready.has(id))
    ? scope
    : scope.filter((id) => ready.has(id));
}
