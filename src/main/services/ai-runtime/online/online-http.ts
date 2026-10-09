import { withEgress } from "../../app-shell/privacy-state";
import { errorForCause, errorForStatus } from "./online-error";
import { ChatAbortedError, assertNotAborted, linkAbort } from "../abort";

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
  /** 103: tính là egress (badge "đang gửi")? Mặc định true; Ollama (localhost) truyền false. */
  egress?: boolean;
  /** 149: huỷ từ ngoài (người dùng) ⇒ ChatAbortedError — KHÔNG phải timeout. Phạm vi gồm cả đọc body. */
  signal?: AbortSignal;
}

/**
 * POST JSON, trả về JSON đã parse. Ném OnlineProviderError khi non-2xx / abort / mạng. 103: cả request + đọc body
 * nằm trong withEgress ⇒ badge "Đang gửi dữ liệu ra ngoài…" đúng lúc dữ liệu thật sự rời máy.
 */
export function callJson(opts: CallJsonOptions): Promise<unknown> {
  return opts.egress === false
    ? callJsonInner(opts)
    : withEgress(() => callJsonInner(opts));
}

async function callJsonInner(opts: CallJsonOptions): Promise<unknown> {
  assertNotAborted(opts.signal);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_ONLINE_TIMEOUT_MS;
  const controller = new AbortController();
  const unlink = linkAbort(opts.signal, controller);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await opts.fetchFn(opts.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...opts.headers },
        body: JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch (cause) {
      // 149: huỷ do người dùng phải kiểm TRƯỚC errorForCause (vốn coi mọi AbortError là timeout ⇒ bật nút 098).
      if (opts.signal?.aborted) throw new ChatAbortedError();
      throw errorForCause(cause, opts.providerLabel);
    }
    if (!res.ok) throw errorForStatus(res.status, opts.providerLabel);
    try {
      return await res.json();
    } catch (cause) {
      if (opts.signal?.aborted) throw new ChatAbortedError();
      // Hết thời gian khi đang đọc body ⇒ cùng lỗi timeout như lúc chờ phản hồi; lỗi parse giữ nguyên như cũ.
      if (isAbort(cause)) throw errorForCause(cause, opts.providerLabel);
      throw cause;
    }
  } finally {
    clearTimeout(timer);
    unlink();
  }
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
  /** 103: tính là egress (badge "đang gửi")? Mặc định true; Ollama (localhost) truyền false — KHÔNG rời máy. */
  egress?: boolean;
}

/** POST + đọc body theo DÒNG (039). Gọi onLine mỗi dòng (NDJSON/SSE). Huỷ (abort) → dừng êm, giữ phần đã
 * nhận (không ném). Lỗi HTTP/mạng → OnlineProviderError. KHÔNG timeout (stream dài; dừng bằng signal). I/O.
 * 103: egress tính tới khi ĐỌC HẾT body (fetch trả về ngay khi có header, dữ liệu còn chạy tiếp). */
export function streamLines(
  opts: StreamOptions,
  onLine: (line: string) => void,
): Promise<void> {
  return opts.egress === false
    ? streamLinesInner(opts, onLine)
    : withEgress(() => streamLinesInner(opts, onLine));
}

async function streamLinesInner(
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
