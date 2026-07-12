import { errorForCause, errorForStatus } from "./online-error";

// HTTP client JSON cho provider online (031, Constitution III: chỉ main). fetch tiêm vào để test; timeout
// mặc định 60s (quyết định #5 — chat online có thể chậm). Lỗi HTTP/mạng → OnlineProviderError thân thiện.
// Wiring I/O — loại khỏi ngưỡng coverage (phần build request/parse response nằm ở provider, test riêng).

type FetchFn = typeof fetch;

export const DEFAULT_ONLINE_TIMEOUT_MS = 60_000;

export interface CallJsonOptions {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  fetchFn: FetchFn;
  timeoutMs?: number;
  /** Nhãn provider để thêm vào thông báo lỗi. */
  providerLabel?: string;
}

/** POST JSON, trả về JSON đã parse. Ném OnlineProviderError khi non-2xx / abort / mạng. */
export async function callJson(opts: CallJsonOptions): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_ONLINE_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await opts.fetchFn(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...opts.headers },
      body: JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch (cause) {
    throw errorForCause(cause, opts.providerLabel);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw errorForStatus(res.status, opts.providerLabel);
  return res.json();
}
