// 186 — thời lượng hh:mm:ss cho đồng hồ ghi, timestamp transcript và bản xuất Markdown. THUẦN (dùng chung main/renderer).

export function formatDuration(totalSec: number): string {
  const s =
    Number.isFinite(totalSec) && totalSec > 0 ? Math.floor(totalSec) : 0;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
