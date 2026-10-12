// 186 — hằng số Ghi cuộc họp dùng chung main + renderer (MỘT chỗ để chỉnh).

/** Tần số mẫu thu & lưu (WAV PCM16 mono, A1). */
export const MEETING_SAMPLE_RATE = 16000;
/** Lô PCM renderer→main: 1 giây. */
export const MEETING_BATCH_SAMPLES = MEETING_SAMPLE_RATE;
/** Kết thúc ghi hỏi xác nhận khi phiên ≥ N giây (D15). */
export const END_CONFIRM_MIN_SEC = 300;
