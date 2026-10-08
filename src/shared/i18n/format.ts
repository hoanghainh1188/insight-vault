import { intlLocaleOf, type LanguageCode } from "./languages";
import type { Translator } from "./translate";

// 123 (FR-023, research R7): định dạng theo ngôn ngữ giao diện. Thuần (chỉ Intl). Tên tệp xuất dùng isoDate (ổn định).

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateTime(ms: number, lang: LanguageCode): string {
  return new Intl.DateTimeFormat(intlLocaleOf(lang), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(ms);
}

export function formatNumber(
  n: number,
  lang: LanguageCode,
  maxFractionDigits = 1,
): string {
  return new Intl.NumberFormat(intlLocaleOf(lang), {
    maximumFractionDigits: maxFractionDigits,
  }).format(n);
}

/** 0 → "0 B"; 1536 → "1.5 KB" (en) / "1,5 KB" (vi); ≥ 100 hoặc đơn vị B → không thập phân. */
export function formatBytes(bytes: number, lang: LanguageCode): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const i = Math.min(
    UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  const digits = i === 0 || value >= 100 ? 0 : 1;
  const rounded = digits === 0 ? Math.round(value) : value;
  const text = new Intl.NumberFormat(intlLocaleOf(lang), {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(rounded);
  return `${text} ${UNITS[i]}`;
}

/** Ngày "yyyy-mm-dd" theo giờ địa phương — cho tên tệp xuất, không theo ngôn ngữ. */
export function isoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Sửa <thời gian>" — bucket như relative-time (009); quá 2 tuần ⇒ ngày ngắn theo ngôn ngữ (vi giữ dd/mm/yyyy). */
export function formatRelativeTime(
  thenMs: number,
  nowMs: number,
  tr: Translator,
): string {
  const diff = nowMs - thenMs;
  if (diff < MIN) return tr.t("time.justNow");
  if (diff < HOUR) return tr.plural("time.minutesAgo", Math.floor(diff / MIN));
  if (diff < DAY) return tr.plural("time.hoursAgo", Math.floor(diff / HOUR));
  if (diff < 2 * DAY) return tr.t("time.yesterday");
  if (diff < 7 * DAY) return tr.plural("time.daysAgo", Math.floor(diff / DAY));
  if (diff < 14 * DAY) return tr.t("time.lastWeek");
  const d = new Date(thenMs);
  if (tr.lang === "vi") {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  return new Intl.DateTimeFormat(intlLocaleOf(tr.lang), {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(d);
}
