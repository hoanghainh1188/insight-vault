// 098 — lỗi provider online đi qua IPC (ADR 2026-10-07-online-fallback-clarify). invoke() của Electron chỉ giữ
// MESSAGE của lỗi (kèm tiền tố "Error invoking remote method '…': <Tên>: ") ⇒ main gắn thẻ loại lỗi vào cuối
// message, renderer tách thẻ để biết có hiện nút "Trả lời bằng AI cục bộ" không. Thuần, dùng chung 2 phía.
// 123: tách thêm thẻ lỗi người-dùng-thấy [[err:<code>|<params>]] (UserFacingError) để renderer dịch theo ngôn ngữ.

import {
  decodeUserErrorParams,
  encodeUserError,
  isUserErrorCode,
  type UserErrorCode,
  type UserErrorParams,
} from "./codes/user-error";

export const ONLINE_ERROR_KINDS = [
  "auth",
  "rate-limit",
  "timeout",
  "network",
  "server",
  "unknown",
] as const;

export type OnlineErrorKind = (typeof ONLINE_ERROR_KINDS)[number];

const TAG_RE = /\s{0,16}\[\[online:([a-z-]{1,20})\]\]\s{0,16}$/;
const ERR_TAG_RE =
  /\s{0,16}\[\[err:([A-Za-z]{1,40})(?:\|([^\]]{0,2048}))?\]\]\s{0,16}$/;
/** 123 (security review): giới hạn độ dài chuỗi lỗi trước khi chạy regex. */
const MAX_RAW_LEN = 8192;
/** Tiền tố nhãn nhà cung cấp của lỗi online: "Claude (Anthropic): …". */
const PROVIDER_PREFIX_RE = /^([^:]{1,60}):\s/;
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
  /** 123: mã lỗi người-dùng-thấy (UserFacingError) để renderer dịch. */
  code?: UserErrorCode;
  params?: UserErrorParams;
  /** 123: nhãn nhà cung cấp tách từ tiền tố lỗi online (tham số {provider} khi dịch). */
  provider?: string;
}

export function parseIpcError(raw: string): ParsedIpcError {
  const bounded = raw.length > MAX_RAW_LEN ? raw.slice(-MAX_RAW_LEN) : raw;
  let message = bounded.replace(ELECTRON_PREFIX_RE, "");
  let onlineKind: OnlineErrorKind | null = null;
  const m = TAG_RE.exec(message);
  if (m) {
    message = message.slice(0, m.index);
    if ((ONLINE_ERROR_KINDS as readonly string[]).includes(m[1])) {
      onlineKind = m[1] as OnlineErrorKind;
    }
  }
  const out: ParsedIpcError = { message, onlineKind };
  if (onlineKind) {
    const p = PROVIDER_PREFIX_RE.exec(message);
    if (p) out.provider = p[1];
  }
  const e = ERR_TAG_RE.exec(out.message);
  if (e) {
    out.message = out.message.slice(0, e.index);
    if (isUserErrorCode(e[1])) {
      out.code = e[1];
      const params = decodeUserErrorParams(e[2]);
      if (params) out.params = params;
    }
  }
  return out;
}

/**
 * 123 (security review): chỉ giữ THẺ (mã lỗi người-dùng-thấy / loại lỗi online) của một thông điệp lỗi — dùng khi
 * gửi lỗi gốc sang renderer (vd RuntimeStatus.reasonError) để không mang theo văn bản thô (URL, thân phản hồi SDK).
 * Không có thẻ ⇒ undefined.
 */
export function errorTagsOnly(message: string): string | undefined {
  const p = parseIpcError(message);
  const parts: string[] = [];
  if (p.code) parts.push(encodeUserError(p.code, p.params));
  if (p.onlineKind) parts.push(`[[online:${p.onlineKind}]]`);
  if (parts.length === 0) return undefined;
  return `${p.provider ? `${p.provider}: ` : ""}error ${parts.join(" ")}`;
}
