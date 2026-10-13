// 186 PR B — tự hạ cấp model nháp theo tốc độ đo được trên chính máy người dùng (ADR meeting-asr-spike mục 4–5, chốt tạm
// 2026-10-13: chưa có số đo máy yếu nên app tự đo). THUẦN, không mutate. Chỉ tính cửa sổ nháp ĐỦ 10 s có lời.
// - Trung bình trượt RTF_WINDOW mẫu > DOWNGRADE_RTF ⇒ nháp chuyển sang model dự phòng (một lần mỗi phiên, không nâng lại).
// - Trung bình > PARTIAL_OFF_RTF ⇒ tắt lượt 5 s (không bật lại trong phiên).
// - Model dự phòng không tải/nạp được (offline) ⇒ quay về model chính, không thử hạ cấp nữa (hàng việc tự bỏ cửa sổ — R6).
// - Model dự phòng CHƯA có trên máy ⇒ không hạ cấp (không bao giờ tự tải giữa cuộc họp — quyết định 2026-10-13); nó chỉ được
//   tải khi người dùng bấm "Tải model".

export const DOWNGRADE_RTF = 0.5;
export const PARTIAL_OFF_RTF = 0.25;
export const RTF_WINDOW = 3;
/** Trần số mẫu giữ cho tóm tắt chẩn đoán (≈ 3 giờ cửa sổ 10 s). */
const MAX_SAMPLES = 1200;

export type DraftTier = "primary" | "fallback";

export interface DraftPerf {
  tier: DraftTier;
  /** Mẫu gần nhất cho trung bình trượt (xoá khi đổi model). */
  recent: number[];
  /** Mọi mẫu của phiên (có trần) — chỉ để tóm tắt chẩn đoán. */
  all: number[];
  partialPass: boolean;
  downgraded: boolean;
  fallbackUnavailable: boolean;
}

export function initialDraftPerf(partialPass = true): DraftPerf {
  return {
    tier: "primary",
    recent: [],
    all: [],
    partialPass,
    downgraded: false,
    fallbackUnavailable: false,
  };
}

export function recordDraftRtf(
  s: DraftPerf,
  rtf: number,
  fallbackReady = true,
): DraftPerf {
  if (!Number.isFinite(rtf) || rtf < 0) return s;
  const all = [...s.all, rtf].slice(-MAX_SAMPLES);
  const recent = [...s.recent, rtf].slice(-RTF_WINDOW);
  if (recent.length < RTF_WINDOW) return { ...s, recent, all };
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const partialPass = s.partialPass && avg <= PARTIAL_OFF_RTF;
  if (s.tier === "primary" && !s.fallbackUnavailable && avg > DOWNGRADE_RTF) {
    if (!fallbackReady)
      return { ...s, recent: [], all, partialPass, fallbackUnavailable: true };
    return {
      ...s,
      tier: "fallback",
      recent: [],
      all,
      partialPass,
      downgraded: true,
    };
  }
  return { ...s, recent, all, partialPass };
}

export function fallbackFailed(s: DraftPerf): DraftPerf {
  return { ...s, tier: "primary", recent: [], fallbackUnavailable: true };
}

export interface RtfSummary {
  count: number;
  mean: number;
  p95: number;
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Trung bình + p95 (nearest-rank), làm tròn 3 chữ số — cho dòng chẩn đoán. */
export function summarizeRtf(values: readonly number[]): RtfSummary | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { count: values.length, mean: round3(mean), p95: round3(p95) };
}

/** Model dự phòng vừa được tải (người dùng bấm "Tải model") ⇒ cho phép hạ cấp lại nếu chưa từng hạ cấp. */
export function fallbackNowReady(s: DraftPerf): DraftPerf {
  return s.downgraded || !s.fallbackUnavailable
    ? s
    : { ...s, fallbackUnavailable: false };
}
