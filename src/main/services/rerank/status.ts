// 109 (data-model RerankerStatus): máy trạng thái THUẦN của bộ chấm độ liên quan — idle → downloading → ready; lỗi ⇒ error,
// lần thử sau quay lại downloading. Sự kiện lặp/không hợp lệ giữ nguyên trạng thái (idempotent).

export type RerankerState = "idle" | "downloading" | "ready" | "error";
export type RerankerEvent = "start" | "loaded" | "failed";

export function nextRerankerState(
  state: RerankerState,
  event: RerankerEvent,
): RerankerState {
  switch (event) {
    case "start":
      return state === "idle" || state === "error" ? "downloading" : state;
    case "loaded":
      return state === "downloading" ? "ready" : state;
    case "failed":
      return state === "downloading" ? "error" : state;
  }
}
