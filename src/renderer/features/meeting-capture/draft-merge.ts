import type { MeetingDraftLine } from "@shared/ipc/types";

// 186 PR B (R6) — gộp nháp đẩy từ main vào danh sách đang hiển thị. THUẦN, không mutate. Thay theo id ⇒ key React ổn định,
// dòng không đổi giữ nguyên tham chiếu (không render lại, không mất vùng chọn); sắp theo tStart.

export function mergeDraft(
  prev: readonly MeetingDraftLine[],
  incoming: readonly MeetingDraftLine[],
): readonly MeetingDraftLine[] {
  if (incoming.length === 0) return prev;
  const byId = new Map(incoming.map((l) => [l.id, l]));
  const replaced = prev.map((l) => byId.get(l.id) ?? l);
  const known = new Set(prev.map((l) => l.id));
  const added = incoming.filter((l) => !known.has(l.id));
  return [...replaced, ...added].sort((a, b) => a.tStart - b.tStart);
}
