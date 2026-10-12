import type { DiskLevel } from "@shared/ipc/types";

// 186 — cảnh báo đĩa theo PHÚT GHI CÒN LẠI (A7, FR-040). THUẦN. Dự phòng cho bước hoàn tất (ghép meeting.wav +
// vector + DB) = 2× dữ liệu đã ghi + 500 MB, theo tiền lệ bảo trì vector freeBytes ≥ 2×.

const RESERVE_FIXED_BYTES = 500 * 1024 * 1024;
export const DISK_WARN_MIN = 30;
export const DISK_URGENT_MIN = 5;
export const DISK_STOP_MIN = 1;
export const DISK_START_MIN = 10;

export function minutesRemaining(input: {
  freeBytes: number;
  recordedBytes: number;
  bytesPerMin: number;
}): number {
  const { freeBytes, recordedBytes, bytesPerMin } = input;
  if (
    ![freeBytes, recordedBytes, bytesPerMin].every(Number.isFinite) ||
    bytesPerMin <= 0
  )
    return 0;
  const usable =
    freeBytes - (2 * Math.max(0, recordedBytes) + RESERVE_FIXED_BYTES);
  return usable <= 0 ? 0 : Math.floor(usable / bytesPerMin);
}

export function diskLevel(minutes: number): DiskLevel {
  if (minutes < DISK_STOP_MIN) return "stop";
  if (minutes < DISK_URGENT_MIN) return "urgent";
  if (minutes < DISK_WARN_MIN) return "warn";
  return "ok";
}

export function canStart(minutes: number): boolean {
  return minutes >= DISK_START_MIN;
}
