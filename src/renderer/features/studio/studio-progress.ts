import type {
  StudioKind,
  StudioProgressEvent,
  StudioProgressPhase,
} from "@shared/ipc/types";
import type { Translator } from "@shared/i18n";
import { STUDIO_PROGRESS_PHASES } from "@shared/studio-progress";

// 146 (contract renderer): trạng thái tiến độ Studio theo loại — hàm THUẦN, không mutate.

/** Tiến độ hiện tại của một loại (thuộc đúng một lượt tạo). */
export interface StudioProgressState {
  generationId: string;
  phase: StudioProgressPhase;
  index?: number;
  total?: number;
}

export type StudioProgressMap = Partial<
  Record<StudioKind, StudioProgressState>
>;

/** generationId của lượt đang chạy, theo loại. */
export type ActiveGenerationIds = Partial<Record<StudioKind, string>>;

const order = (p: StudioProgressPhase): number =>
  STUDIO_PROGRESS_PHASES.indexOf(p);

/** true khi `next` lùi so với `prev` (pha thấp hơn, hoặc cùng pha đọc mà index nhỏ hơn). */
function isBackward(
  prev: StudioProgressState,
  next: StudioProgressEvent,
): boolean {
  if (order(next.phase) !== order(prev.phase)) {
    return order(next.phase) < order(prev.phase);
  }
  return (next.index ?? 0) < (prev.index ?? 0);
}

/**
 * Áp một sự kiện tiến độ: chỉ khi đúng notebook đang mở VÀ đúng lượt đang chạy của loại đó; bỏ sự kiện lùi.
 * Bỏ qua ⇒ trả NGUYÊN `state` (cùng tham chiếu — React không render lại).
 */
export function applyStudioProgress(
  state: StudioProgressMap,
  activeIds: ActiveGenerationIds,
  notebookId: string | null,
  ev: StudioProgressEvent,
): StudioProgressMap {
  if (ev.notebookId !== notebookId) return state;
  if (activeIds[ev.kind] !== ev.generationId) return state;
  const prev = state[ev.kind];
  if (prev && prev.generationId === ev.generationId && isBackward(prev, ev)) {
    return state;
  }
  const next: StudioProgressState = {
    generationId: ev.generationId,
    phase: ev.phase,
  };
  if (ev.phase === "reading" && ev.index !== undefined) next.index = ev.index;
  if (ev.phase === "reading" && ev.total !== undefined) next.total = ev.total;
  return { ...state, [ev.kind]: next };
}

/** Câu hiển thị của pha (clarify #11). Đọc mà thiếu số ⇒ câu viết chung (không bịa số). */
export function progressText(p: StudioProgressState, tr: Translator): string {
  if (p.phase === "reading" && p.index !== undefined && p.total !== undefined) {
    return tr.t("studio.progress.reading", { i: p.index, n: p.total });
  }
  if (p.phase === "condensing") return tr.t("studio.progress.condensing");
  if (p.phase === "reading") return tr.t("studio.progress.readingNoCount");
  return tr.t("studio.progress.writing");
}

/**
 * 146 (clarify #5): câu báo trình đọc màn hình khi tiến độ đổi — vào pha đọc lần đầu, mốc giữa pha đọc (total ≥ 3,
 * index = ceil(total/2)), sang rút gọn, sang viết (chỉ khi có pha trước — một lượt đã có câu bắt đầu/xong). null còn lại.
 * `prev` của lượt khác coi như chưa có.
 */
export function progressAnnouncement(
  prev: StudioProgressState | undefined,
  next: StudioProgressState,
  label: string,
  tr: Translator,
): string | null {
  const before =
    prev && prev.generationId === next.generationId ? prev : undefined;
  if (next.phase === "reading") {
    if (next.index === undefined || next.total === undefined) return null;
    const entering = before?.phase !== "reading";
    const mid =
      next.total >= 3 &&
      next.index === Math.ceil(next.total / 2) &&
      before?.index !== next.index;
    return entering || mid
      ? tr.t("a11y.studioProgressReading", {
          label,
          i: next.index,
          n: next.total,
        })
      : null;
  }
  if (before?.phase === next.phase) return null;
  if (next.phase === "condensing") {
    return tr.t("a11y.studioProgressCondensing", { label });
  }
  return before ? tr.t("a11y.studioProgressWriting", { label }) : null;
}
