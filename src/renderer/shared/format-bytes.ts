// Định dạng số byte → chuỗi dễ đọc (037 — section Lưu trữ). THUẦN, unit-test được.

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

/** VD 0 → "0 B"; 1536 → "1.5 KB"; 1073741824 → "1 GB". Số âm/không hợp lệ → "0 B". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const i = Math.min(
    UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  // ≥ 100 hoặc đơn vị B → không thập phân; còn lại 1 chữ số thập phân (bỏ ".0").
  const str =
    i === 0 || value >= 100
      ? String(Math.round(value))
      : value.toFixed(1).replace(/\.0$/, "");
  return `${str} ${UNITS[i]}`;
}
