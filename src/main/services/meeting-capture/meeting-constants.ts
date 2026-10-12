// 186 — hằng số Ghi cuộc họp, MỘT chỗ để chỉnh (research R3, R13; quyết định A1, A7, D15).

import {
  END_CONFIRM_MIN_SEC as SHARED_END_CONFIRM_MIN_SEC,
  MEETING_SAMPLE_RATE,
} from "@shared/meeting/constants";

/** Tần số mẫu lưu trữ & nhận dạng (WAV PCM16 mono) — dùng chung với renderer. */
export const SAMPLE_RATE = MEETING_SAMPLE_RATE;
/** Byte mỗi giây audio (PCM16 mono). */
export const BYTES_PER_SEC = SAMPLE_RATE * 2;
/** Byte mỗi phút ghi — dùng cho ước lượng phút ghi còn lại (A7). */
export const BYTES_PER_MIN = BYTES_PER_SEC * 60;

/** Độ dài phân đoạn mặc định (giây). Override chỉ khi CHƯA đóng gói (soak test) — xem segmentSeconds(). */
export const DEFAULT_SEGMENT_SEC = 300;
/** Ghi xuống đĩa (fsync) mỗi N giây ⇒ sự cố mất ≤ N giây (D9). */
export const FSYNC_SEC = 5;
/** Checkpoint session.json (PR C1). */
export const CHECKPOINT_SEC = 30;

/** Lô PCM renderer→main tối đa (byte). Lô chuẩn 1 s = 32 000 byte. */
export const BATCH_MAX_BYTES = 65536;
/** Số lô tối đa mỗi cửa sổ 1 s (chống tràn). */
export const MAX_BATCHES_PER_SEC = 4;
/** Đệm phía renderer khi IPC chậm (giây). */
export const RENDERER_BUFFER_SEC = 30;
/** Không nhận lô nào quá N ms khi đang ghi ⇒ phiên bị gián đoạn (P1 / D7). */
export const NO_AUDIO_TIMEOUT_MS = 5000;

/** Cổng quyền micro mở sau hành động người dùng (R11). */
export const ARM_WINDOW_MS = 15_000;
/** Kết thúc ghi hỏi xác nhận khi phiên ≥ N giây (D15) — dùng chung với renderer. */
export const END_CONFIRM_MIN_SEC = SHARED_END_CONFIRM_MIN_SEC;

/** Bản chốt: chồng lấn với phân đoạn trước (D5). */
export const FINAL_OVERLAP_SEC = 5;
/** Model chốt = model đường nạp audio sẵn có (045, A2). */
export const FINAL_MODEL = "Xenova/whisper-base";

/** Kích thước ước lượng model chốt để hiển thị (MB). */
export const FINAL_MODEL_SIZE_MB = 150;

/** Override độ dài phân đoạn cho soak test — CHỈ khi chưa đóng gói, tối thiểu 5 s. */
export function segmentSeconds(
  isPackaged: boolean,
  env: NodeJS.ProcessEnv,
): number {
  if (isPackaged) return DEFAULT_SEGMENT_SEC;
  const raw = Number(env["IV_MEETING_SEGMENT_SEC"]);
  return Number.isFinite(raw) && raw >= 5
    ? Math.floor(raw)
    : DEFAULT_SEGMENT_SEC;
}
