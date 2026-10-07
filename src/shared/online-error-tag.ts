// 098 — lỗi provider online đi qua IPC (ADR 2026-10-07-online-fallback-clarify). invoke() của Electron chỉ giữ
// MESSAGE của lỗi (kèm tiền tố "Error invoking remote method '…': <Tên>: ") ⇒ main gắn thẻ loại lỗi vào cuối
// message, renderer tách thẻ để biết có hiện nút "Trả lời bằng AI cục bộ" không. Thuần, dùng chung 2 phía.

export const ONLINE_ERROR_KINDS = [
  "auth",
  "rate-limit",
  "timeout",
  "network",
  "server",
  "unknown",
] as const;

export type OnlineErrorKind = (typeof ONLINE_ERROR_KINDS)[number];

const TAG_RE = /\s*\[\[online:([a-z-]+)\]\]\s*$/;
const ELECTRON_PREFIX_RE =
  /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/;

export function tagOnlineError(message: string, kind: OnlineErrorKind): string {
  return `${message} [[online:${kind}]]`;
}

export interface ParsedIpcError {
  /** Thông điệp cho người dùng (đã bỏ tiền tố kỹ thuật + thẻ). */
  message: string;
  /** Loại lỗi provider online; null nếu không phải lỗi online. */
  onlineKind: OnlineErrorKind | null;
}

export function parseIpcError(raw: string): ParsedIpcError {
  let message = raw.replace(ELECTRON_PREFIX_RE, "");
  let onlineKind: OnlineErrorKind | null = null;
  const m = TAG_RE.exec(message);
  if (m) {
    message = message.slice(0, m.index);
    if ((ONLINE_ERROR_KINDS as readonly string[]).includes(m[1])) {
      onlineKind = m[1] as OnlineErrorKind;
    }
  }
  return { message, onlineKind };
}
