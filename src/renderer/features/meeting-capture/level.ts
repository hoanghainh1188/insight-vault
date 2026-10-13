// 186 PR B (FR-024) — chỉ báo âm lượng 3 trạng thái (yếu / tốt / quá to) từ RMS + peak mỗi 100 ms của worklet. THUẦN.
// Có độ trễ: đổi trạng thái chỉ khi điều kiện giữ đủ LEVEL_HOLD_MS; "quá to" hiện NGAY nhưng cần CLIP_HOLD_MS mới rời —
// tránh nhấp nháy (và tránh trình đọc màn hình đọc liên tục).

export type LevelKind = "weak" | "ok" | "clipping";

export const WEAK_RMS_DBFS = -50;
export const CLIP_PEAK_DBFS = -1;
export const LEVEL_HOLD_MS = 500;
export const CLIP_HOLD_MS = 1000;

export function classifyLevel(m: {
  rmsDbfs: number;
  peakDbfs: number;
}): LevelKind {
  if (m.peakDbfs > CLIP_PEAK_DBFS) return "clipping";
  if (!(m.rmsDbfs >= WEAK_RMS_DBFS)) return "weak";
  return "ok";
}

export interface LevelTracker {
  state: LevelKind;
  /** Trạng thái đang chờ đủ thời gian giữ, và mốc bắt đầu. */
  candidate: LevelKind | null;
  since: number;
}

export const INITIAL_LEVEL: LevelTracker = Object.freeze({
  state: "ok",
  candidate: null,
  since: 0,
});

export function nextLevel(
  s: LevelTracker,
  m: { rmsDbfs: number; peakDbfs: number },
  nowMs: number,
): LevelTracker {
  const raw = classifyLevel(m);
  if (raw === s.state) return s.candidate ? { ...s, candidate: null } : s;
  if (raw === "clipping")
    return { state: "clipping", candidate: null, since: nowMs };
  const since = s.candidate === raw ? s.since : nowMs;
  const hold = s.state === "clipping" ? CLIP_HOLD_MS : LEVEL_HOLD_MS;
  return nowMs - since >= hold
    ? { state: raw, candidate: null, since: nowMs }
    : { state: s.state, candidate: raw, since };
}
