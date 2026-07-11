// Chống SSRF khi fetch URL người dùng nhập (FR-019, A6, Constitution I/III). Hàm THUẦN — unit-test
// được (không DNS). Việc phân giải DNS + kiểm mỗi hop nằm ở url.ts (adapter, gọi các hàm này).

/** IPv4 dạng "a.b.c.d" thuộc dải nội bộ/loopback/link-local/unspecified? */
function isBlockedIpv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return false;
  const [a, b] = o;
  if (a === 0) return true; // 0.0.0.0/8 (bao gồm unspecified)
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  return false;
}

/**
 * Giải nén địa chỉ IPv6 (kể cả dạng nén `::` và IPv4-nhúng `::ffff:1.2.3.4`) thành 8 nhóm 16-bit.
 * Trả null nếu không hợp lệ. KHÔNG dựa regex chuỗi → không bị lách bởi chuẩn hoá của WHATWG URL
 * (vd `::ffff:127.0.0.1` bị URL nén thành `::ffff:7f00:1`).
 */
function parseIpv6(raw: string): number[] | null {
  let s = raw.toLowerCase().trim();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  if (!s.includes(":")) return null;

  // Đuôi IPv4 nhúng (::ffff:1.2.3.4 / ::1.2.3.4) → chuyển thành 2 nhóm hex.
  const dot = s.indexOf(".");
  if (dot !== -1) {
    const lastColon = s.lastIndexOf(":", dot);
    if (lastColon === -1) return null;
    const m = s
      .slice(lastColon + 1)
      .match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const o = m.slice(1).map(Number);
    if (o.some((n) => n > 255)) return null;
    const g6 = ((o[0] << 8) | o[1]).toString(16);
    const g7 = ((o[2] << 8) | o[3]).toString(16);
    s = `${s.slice(0, lastColon + 1)}${g6}:${g7}`;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const h of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(h)) return null;
      out.push(parseInt(h, 16));
    }
    return out;
  };
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (head === null || tail === null) return null;

  let groups: number[];
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...new Array<number>(fill).fill(0), ...tail];
  } else {
    groups = head;
  }
  return groups.length === 8 ? groups : null;
}

/** IPv6 thuộc loopback/unspecified/IPv4-nhúng-nội-bộ/unique-local(fc00::/7)/link-local(fe80::/10)? */
function isBlockedIpv6(ip: string): boolean {
  const g = parseIpv6(ip);
  if (!g) return false;
  if (g.every((x) => x === 0)) return true; // :: (unspecified)
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1 loopback
  // IPv4-mapped (::ffff:x) hoặc IPv4-compatible (::x) → kiểm phần IPv4 (bao gồm dạng nén hex).
  const embedded =
    g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0);
  if (embedded && (g[6] !== 0 || g[7] !== 0)) {
    const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    return isBlockedIpv4(v4);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
  return false;
}

/** IP (v4/v6) có bị chặn (nội bộ/loopback/link-local) không? */
export function isBlockedIp(ip: string): boolean {
  return isBlockedIpv4(ip) || isBlockedIpv6(ip);
}

/** Hostname bị chặn theo tên (không cần DNS): localhost và *.localhost. */
export function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h.endsWith(".localhost");
}

export class SsrfError extends Error {
  readonly label = "Lỗi tải trang";
  constructor(msg: string) {
    super(msg);
    this.name = "SsrfError";
  }
}

/**
 * Kiểm URL ở mức cú pháp (chưa DNS): chỉ http/https, hostname không phải localhost, và nếu hostname
 * đã là IP literal thì không thuộc dải nội bộ. Ném SsrfError nếu vi phạm. Trả về URL đã phân tích.
 */
export function assertSafeUrl(rawUrl: string): URL {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new SsrfError("URL không hợp lệ.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new SsrfError("Chỉ hỗ trợ http/https.");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(host)) throw new SsrfError("Địa chỉ nội bộ bị chặn.");
  // Nếu host đã là IP literal → kiểm ngay.
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isBlockedIp(host)) throw new SsrfError("Địa chỉ nội bộ bị chặn.");
  }
  return u;
}

/** Ném nếu IP phân giải được thuộc dải nội bộ (gọi sau DNS lookup, cho mỗi hop). */
export function assertResolvedIpAllowed(ip: string): void {
  if (isBlockedIp(ip)) throw new SsrfError("Địa chỉ nội bộ bị chặn.");
}
