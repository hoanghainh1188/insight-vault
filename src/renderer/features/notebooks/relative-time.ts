// "Sửa <thời gian>" tiếng Việt (A9). Thuần + nhận `now` tiêm vào → test tất định. Không lib.

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatRelativeTime(thenMs: number, nowMs: number): string {
  const diff = nowMs - thenMs;
  if (diff < 0) return "vừa xong";
  if (diff < MIN) return "vừa xong";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} phút trước`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`;
  if (diff < 2 * DAY) return "hôm qua";
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} ngày trước`;
  if (diff < 14 * DAY) return "tuần trước";
  const d = new Date(thenMs);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
