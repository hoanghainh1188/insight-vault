// 186 PR B — hàng việc ASR khi đang ghi (research R6). THUẦN, không mutate. Ưu tiên detect > draft (cửa sổ cũ trước) > final.
// Tồn > MAX_PENDING_WINDOWS cửa sổ nháp ⇒ bỏ các cửa sổ cũ nhất (bản chốt sẽ phủ) và bật `lagging`; chỉ tắt khi tồn ≤ 1 (trễ
// để thông báo "Đang xử lý bản ghi" không nhấp nháy). Lượt 5 s (partial) của cửa sổ đã có lượt đủ là lỗi thời ⇒ bỏ.

export const MAX_PENDING_WINDOWS = 3;
const LAG_CLEAR_AT = 1;

export interface AsrJob {
  kind: "detect" | "draft" | "final";
  /** Chỉ số cửa sổ nháp 10 s (draft) — detect/final không dùng. */
  window: number;
  partial: boolean;
}

export interface DraftQueuePlan {
  ordered: AsrJob[];
  /** Cửa sổ nháp bị bỏ do tồn đọng (không hiện nháp — bản chốt phủ). */
  dropped: number[];
  lagging: boolean;
}

const RANK: Record<AsrJob["kind"], number> = { detect: 0, draft: 1, final: 2 };

export function planDraftQueue(
  pending: readonly AsrJob[],
  wasLagging: boolean,
): DraftQueuePlan {
  const fullWindows = new Set(
    pending
      .filter((j) => j.kind === "draft" && !j.partial)
      .map((j) => j.window),
  );
  const live = pending.filter(
    (j) => !(j.kind === "draft" && j.partial && fullWindows.has(j.window)),
  );
  const windows = [
    ...new Set(live.filter((j) => j.kind === "draft").map((j) => j.window)),
  ].sort((a, b) => a - b);
  const dropped =
    windows.length > MAX_PENDING_WINDOWS
      ? windows.slice(0, windows.length - MAX_PENDING_WINDOWS)
      : [];
  const kept = live.filter(
    (j) => !(j.kind === "draft" && dropped.includes(j.window)),
  );
  const remaining = windows.length - dropped.length;
  const lagging =
    windows.length > MAX_PENDING_WINDOWS ||
    (wasLagging && remaining > LAG_CLEAR_AT);
  const ordered = [...kept].sort(
    (a, b) =>
      RANK[a.kind] - RANK[b.kind] ||
      a.window - b.window ||
      Number(b.partial) - Number(a.partial),
  );
  return { ordered, dropped, lagging };
}
