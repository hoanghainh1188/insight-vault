// Logging policy (T040, FR-014, Constitution III): KHÔNG log nội dung/payload người dùng.
// Chỉ log sự kiện + metadata an toàn. `redact` là hàm thuần (unit-test được).

const SENSITIVE_KEYS = [
  "text",
  "content",
  "body",
  "document",
  "query",
  "answer",
  "apiKey",
  "token",
];

/** Che các trường nhạy cảm trong object metadata trước khi log (đệ quy nông). */
export function redact(meta: unknown): unknown {
  if (meta === null || typeof meta !== "object") return meta;
  if (Array.isArray(meta)) return meta.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.includes(k) ? "[REDACTED]" : redact(v);
  }
  return out;
}

/** Log sự kiện an toàn: message tĩnh + metadata đã che. Không nhận nội dung tài liệu thô. */
export function logEvent(
  event: string,
  meta: Record<string, unknown> = {},
): void {
  console.log(`[InsightVault] ${event}`, redact(meta));
}
