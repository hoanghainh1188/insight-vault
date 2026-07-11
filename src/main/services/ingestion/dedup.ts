import { createHash } from "node:crypto";

// Phát hiện nguồn trùng (FR-016, A8). Hàm thuần — unit-test được.

/** sha256 (hex) của nội dung tệp (bytes). Dùng làm content_hash để dò trùng trong cùng notebook. */
export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** sha256 (hex) của một chuỗi (vd URL đã chuẩn hoá). */
export function hashString(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Chuẩn hoá URL để dò trùng: hạ thấp scheme/host, bỏ fragment, bỏ dấu "/" cuối path.
 * Ném nếu URL không phân tích được.
 */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = "";
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  let s = u.toString();
  if (u.pathname !== "/" && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

/** content_hash cho nguồn URL = hash của URL đã chuẩn hoá. */
export function urlContentHash(raw: string): string {
  return hashString(normalizeUrl(raw));
}
