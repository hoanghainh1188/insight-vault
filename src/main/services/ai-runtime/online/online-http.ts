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

function isAbort(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "name" in e &&
    (e as { name?: unknown }).name === "AbortError"
  );
}

export interface StreamOptions {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  fetchFn: FetchFn;
  signal?: AbortSignal;
  providerLabel?: string;
}

/** POST + đọc body theo DÒNG (039). Gọi onLine mỗi dòng (NDJSON/SSE). Huỷ (abort) → dừng êm, giữ phần đã
 * nhận (không ném). Lỗi HTTP/mạng → OnlineProviderError. KHÔNG timeout (stream dài; dừng bằng signal). I/O. */
export async function streamLines(
  opts: StreamOptions,
  onLine: (line: string) => void,
): Promise<void> {
  let res: Response;
  try {
    res = await opts.fetchFn(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...opts.headers },
      body: JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (cause) {
    if (isAbort(cause)) return;
    throw errorForCause(cause, opts.providerLabel);
  }
  if (!res.ok) throw errorForStatus(res.status, opts.providerLabel);
  const body = res.body;
  if (!body) return;
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        onLine(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    }
  } catch (cause) {
    // Giải phóng stream tường minh (không dựa GC) rồi phân biệt abort (êm) vs lỗi mạng thật (ném).
    void reader.cancel().catch(() => {});
    if (!isAbort(cause)) throw errorForCause(cause, opts.providerLabel);
  }
  if (buf.trim() !== "") onLine(buf);
}
