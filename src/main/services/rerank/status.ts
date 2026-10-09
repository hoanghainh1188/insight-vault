// 109 (data-model RerankerStatus): máy trạng thái THUẦN của bộ chấm độ liên quan — idle → downloading → ready; lỗi ⇒ error,
// lần thử sau quay lại downloading. Sự kiện lặp/không hợp lệ giữ nguyên trạng thái (idempotent).
// 153: model đã có trong cache ⇒ idle → loading → ready (nạp từ đĩa, không tải, không egress).

export type RerankerState =
  "idle" | "downloading" | "loading" | "ready" | "error";
export type RerankerEvent = "start" | "loaded" | "failed";

const isBusy = (s: RerankerState): boolean =>
  s === "downloading" || s === "loading";

export function nextRerankerState(
  state: RerankerState,
  event: RerankerEvent,
  opts: { cached?: boolean } = {},
): RerankerState {
  switch (event) {
    case "start":
      if (state !== "idle" && state !== "error") return state;
      return opts.cached ? "loading" : "downloading";
    case "loaded":
      return isBusy(state) ? "ready" : state;
    case "failed":
      return isBusy(state) ? "error" : state;
  }
}

/** Khoảng chờ tối thiểu giữa hai lần thử tải lại sau lỗi (review 109: offline không thử tải ở mỗi câu hỏi). */
export const RETRY_COOLDOWN_MS = 10 * 60 * 1000;

/** Được thử tải lại chưa: chưa lỗi lần nào, hoặc đã qua RETRY_COOLDOWN_MS kể từ lần lỗi gần nhất. */
export function canRetryDownload(
  lastFailedAt: number | null,
  now: number,
): boolean {
  return lastFailedAt === null || now - lastFailedAt >= RETRY_COOLDOWN_MS;
}
