import type { RelevanceConfig } from "../../../src/main/services/rag/relevance-filter";
import type { EvalMetrics } from "../../../src/main/services/rag/relevance-calibration";

// 108: chỉ số đánh giá truy xuất (research R5) + chọn cấu hình (FR-011/012) + xác nhận hold-out (C2).
// Hàm THUẦN — unit test ở tests/unit/eval-metrics.test.ts.

export const TARGET_REJECTION = 0.9;
export const TARGET_RECALL = 0.85;
export const FLOOR_RECALL = 0.75;
const MRR_DEPTH = 6;

/** Kết quả truy xuất của MỘT câu với MỘT cấu hình. */
export interface QuestionOutcome {
  questionId: string;
  lang: "vi" | "en";
  type: "answerable" | "unanswerable";
  split: "dev" | "holdout";
  /** retrieve() trả rỗng ⇒ "không tìm thấy" */
  rejected: boolean;
  /** hạng (1-based) của đoạn trúng đầu tiên trong kết quả cuối; null = không trúng */
  hitRank: number | null;
}

const answerable = (xs: readonly QuestionOutcome[]) =>
  xs.filter((o) => o.type === "answerable");
const unanswerable = (xs: readonly QuestionOutcome[]) =>
  xs.filter((o) => o.type === "unanswerable");

function rate<T>(xs: readonly T[], pred: (x: T) => boolean): number {
  return xs.length === 0 ? 0 : xs.filter(pred).length / xs.length;
}

export function recallAtK(xs: readonly QuestionOutcome[], k: number): number {
  return rate(answerable(xs), (o) => o.hitRank !== null && o.hitRank <= k);
}

export function mrr(xs: readonly QuestionOutcome[]): number {
  const a = answerable(xs);
  if (a.length === 0) return 0;
  const sum = a.reduce(
    (s, o) =>
      s + (o.hitRank !== null && o.hitRank <= MRR_DEPTH ? 1 / o.hitRank : 0),
    0,
  );
  return sum / a.length;
}

export function correctRejectionRate(xs: readonly QuestionOutcome[]): number {
  return rate(unanswerable(xs), (o) => o.rejected);
}

export function falseRejectionRate(xs: readonly QuestionOutcome[]): number {
  return rate(answerable(xs), (o) => o.rejected);
}

/** Khoảng tin cậy Wilson 95% cho tỉ lệ successes/n. */
export function wilson95(successes: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.96;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export interface Histogram {
  edges: number[];
  counts: number[];
}

/** Histogram đều `buckets` ngăn trên [min, max]; giá trị ngoài khoảng dồn vào ngăn biên. */
export function histogram(
  values: readonly number[],
  min: number,
  max: number,
  buckets = 20,
): Histogram {
  const width = (max - min) / buckets;
  const edges = Array.from({ length: buckets + 1 }, (_, i) =>
    Number((min + i * width).toFixed(6)),
  );
  const counts = new Array<number>(buckets).fill(0);
  for (const v of values) {
    const i = Math.floor((v - min) / width);
    counts[Math.min(buckets - 1, Math.max(0, i))] += 1;
  }
  return { edges, counts };
}

export function computeMetrics(xs: readonly QuestionOutcome[]): EvalMetrics {
  const a = answerable(xs);
  const u = unanswerable(xs);
  const hits6 = a.filter((o) => o.hitRank !== null && o.hitRank <= 6).length;
  const rejected = u.filter((o) => o.rejected).length;
  return {
    nAnswerable: a.length,
    nUnanswerable: u.length,
    recallAt1: recallAtK(xs, 1),
    recallAt3: recallAtK(xs, 3),
    recallAt6: recallAtK(xs, 6),
    mrr: mrr(xs),
    correctRejection: correctRejectionRate(xs),
    falseRejection: falseRejectionRate(xs),
    ci95: {
      recallAt6: wilson95(hits6, a.length),
      correctRejection: wilson95(rejected, u.length),
    },
  };
}

/** dev / holdout: chỉ câu tiếng Việt (tiêu chí ĐẠT); en: tham khảo (cả hai split). */
export function groupOutcomes(xs: readonly QuestionOutcome[]): {
  dev: QuestionOutcome[];
  holdout: QuestionOutcome[];
  en: QuestionOutcome[];
} {
  return {
    dev: xs.filter((o) => o.lang === "vi" && o.split === "dev"),
    holdout: xs.filter((o) => o.lang === "vi" && o.split === "holdout"),
    en: xs.filter((o) => o.lang === "en"),
  };
}

const GATE_COST: Record<RelevanceConfig["bm25Gate"], number> = {
  none: 0,
  requireVector: 0,
  vectorWithin: 1,
  minScore: 2,
};

/** Độ phức tạp cấu hình (FR-012 — "ít tham số nhất"). */
export function configComplexity(cfg: RelevanceConfig): number {
  return 1 + (cfg.relativeDelta === null ? 0 : 1) + GATE_COST[cfg.bm25Gate];
}

export interface Candidate {
  config: RelevanceConfig;
  dev: EvalMetrics;
}

export interface Choice {
  chosen: RelevanceConfig | null;
  reason: string;
}

const pct = (x: number) => `${Number((x * 100).toFixed(1))}%`;
const margin = (m: EvalMetrics) =>
  Math.min(m.correctRejection - TARGET_REJECTION, m.recallAt6 - TARGET_RECALL);
const key = (c: RelevanceConfig) => JSON.stringify(c);

/**
 * Chọn cấu hình theo FR-011/012, CHỈ trên số liệu dev (hold-out để xác nhận — confirmOnHoldout):
 * từ chối đúng ≥ 90% → nếu có cấu hình Recall@6 ≥ 85% (ĐẠT): ít tham số nhất, hoà thì biên lớn nhất;
 * nếu không: Recall@6 cao nhất, phải ≥ sàn 75%. Tie-break cuối theo khoá cấu hình ⇒ tất định.
 */
export function chooseConfig(candidates: readonly Candidate[]): Choice {
  const eligible = candidates.filter(
    (c) => c.dev.correctRejection >= TARGET_REJECTION,
  );
  if (eligible.length === 0) {
    return {
      chosen: null,
      reason: `không cấu hình nào giữ được từ chối đúng ≥ ${pct(TARGET_REJECTION)} trên dev`,
    };
  }
  const passing = eligible.filter((c) => c.dev.recallAt6 >= TARGET_RECALL);
  if (passing.length > 0) {
    const best = [...passing].sort(
      (a, b) =>
        configComplexity(a.config) - configComplexity(b.config) ||
        margin(b.dev) - margin(a.dev) ||
        key(a.config).localeCompare(key(b.config)),
    )[0];
    return {
      chosen: best.config,
      reason: `ĐẠT trên dev (từ chối đúng ${pct(best.dev.correctRejection)}, Recall@6 ${pct(best.dev.recallAt6)}); ${passing.length} cấu hình đạt, chọn ít tham số nhất`,
    };
  }
  const best = [...eligible].sort(
    (a, b) =>
      b.dev.recallAt6 - a.dev.recallAt6 ||
      configComplexity(a.config) - configComplexity(b.config) ||
      b.dev.correctRejection - a.dev.correctRejection ||
      key(a.config).localeCompare(key(b.config)),
  )[0];
  if (best.dev.recallAt6 < FLOOR_RECALL) {
    return {
      chosen: null,
      reason: `Recall@6 tốt nhất ${pct(best.dev.recallAt6)} dưới sàn ${pct(FLOOR_RECALL)} (khi giữ từ chối đúng ≥ ${pct(TARGET_REJECTION)})`,
    };
  }
  return {
    chosen: best.config,
    reason: `không đạt Recall@6 ≥ ${pct(TARGET_RECALL)}; chọn Recall@6 cao nhất ${pct(best.dev.recallAt6)} (≥ sàn ${pct(FLOOR_RECALL)})`,
  };
}

/** Xác nhận cấu hình đã chọn trên hold-out (C2): từ chối đúng ≥ 90% VÀ Recall@6 ≥ sàn 75%. */
export function confirmOnHoldout(m: EvalMetrics): {
  pass: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (m.correctRejection < TARGET_REJECTION) {
    reasons.push(
      `từ chối đúng ${pct(m.correctRejection)} < ${pct(TARGET_REJECTION)}`,
    );
  }
  if (m.recallAt6 < FLOOR_RECALL) {
    reasons.push(`Recall@6 ${pct(m.recallAt6)} < sàn ${pct(FLOOR_RECALL)}`);
  }
  return { pass: reasons.length === 0, reasons };
}
