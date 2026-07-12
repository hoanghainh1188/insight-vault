// Ánh xạ lỗi provider online → thông báo thân thiện tiếng Việt (031, quyết định #5). KHÔNG auto-fallback
// về Ollama — người dùng phải biết provider online của họ lỗi (Constitution I: chỉ báo trung thực).
// KHÔNG nhét nội dung phản hồi/secret vào message (chỉ mã trạng thái).

export class OnlineProviderError extends Error {
  constructor(
    message: string,
    readonly kind:
      "auth" | "rate-limit" | "timeout" | "network" | "server" | "unknown",
  ) {
    super(message);
    this.name = "OnlineProviderError";
  }
}

const LABELS: Record<OnlineProviderError["kind"], string> = {
  auth: "Khóa API không hợp lệ hoặc đã hết hạn.",
  "rate-limit": "Nhà cung cấp đang giới hạn tốc độ, vui lòng thử lại sau.",
  timeout: "Máy chủ AI online phản hồi quá lâu (hết thời gian chờ).",
  network: "Không kết nối được tới máy chủ AI online (kiểm tra mạng).",
  server: "Máy chủ AI online gặp lỗi, vui lòng thử lại.",
  unknown: "Gọi AI online thất bại.",
};

/** Ánh xạ HTTP status → OnlineProviderError với thông báo rõ ràng. */
export function errorForStatus(
  status: number,
  providerLabel?: string,
): OnlineProviderError {
  const kind: OnlineProviderError["kind"] =
    status === 401 || status === 403
      ? "auth"
      : status === 429
        ? "rate-limit"
        : status >= 500
          ? "server"
          : "unknown";
  return new OnlineProviderError(prefix(providerLabel, LABELS[kind]), kind);
}

/** Ánh xạ lỗi ném ra từ fetch (abort/timeout/mạng) → OnlineProviderError. */
export function errorForCause(
  cause: unknown,
  providerLabel?: string,
): OnlineProviderError {
  const name =
    cause && typeof cause === "object" && "name" in cause
      ? String((cause as { name?: unknown }).name)
      : "";
  const kind: OnlineProviderError["kind"] =
    name === "AbortError" ? "timeout" : "network";
  return new OnlineProviderError(prefix(providerLabel, LABELS[kind]), kind);
}

function prefix(providerLabel: string | undefined, msg: string): string {
  return providerLabel ? `${providerLabel}: ${msg}` : msg;
}
