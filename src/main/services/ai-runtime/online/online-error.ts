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

// 123: thông điệp English cho nhật ký/kỹ thuật — giao diện dịch theo `kind` (thẻ [[online:kind]], khoá online.<kind>).
const LABELS: Record<OnlineProviderError["kind"], string> = {
  auth: "Invalid or expired API key.",
  "rate-limit": "Provider is rate-limiting requests.",
  timeout: "Online AI server timed out.",
  network: "Could not reach the online AI server.",
  server: "Online AI server error.",
  unknown: "Online AI request failed.",
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
