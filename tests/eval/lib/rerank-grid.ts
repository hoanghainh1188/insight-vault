import type { RerankConfig } from "../../../src/main/services/rag/rerank-filter";
import type { EvalMetrics } from "../../../src/main/services/rag/relevance-calibration";
import {
  FLOOR_RECALL,
  TARGET_RECALL,
  TARGET_REJECTION,
  wilson95,
} from "./metrics";

// 109 (research R6/R7): lưới cấu hình bộ chấm độ liên quan + chọn trên dev + kết luận cổng. Hàm THUẦN — unit test ở
// tests/unit/eval-rerank-grid.test.ts. Điểm chấm tính một lần/(câu, đoạn, model) ⇒ mỗi cấu hình chỉ lọc lại.

/** Ngưỡng an toàn của bước chấm (research R8) — không phải mục tiêu độ trễ. */
export const RERANK_TIMEOUT_MS = 1500;
/** Cận dưới Wilson 95% tối thiểu của từ chối đúng trên vi dev + hold-out gộp (clarify #2, R6). */
export const WILSON_FLOOR = 0.75;

const MIN_SCORES = [
  0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8,
];
const RELATIVE_DELTAS: readonly (number | null)[] = [null, 0.2, 0.4, 0.6];

/** 12 minScore × 4 relativeDelta × 2 reorder = 96 cấu hình. */
export function buildRerankGrid(): RerankConfig[] {
  const out: RerankConfig[] = [];
  for (const minScore of MIN_SCORES) {
    for (const relativeDelta of RELATIVE_DELTAS) {
      for (const reorder of [false, true]) {
        out.push({
          minScore,
          relativeDelta,
          reorder,
          timeoutMs: RERANK_TIMEOUT_MS,
        });
      }
    }
  }
  return out;
}

export interface RerankCandidate {
  config: RerankConfig;
  dev: EvalMetrics;
}

export interface RerankChoice {
  chosen: RerankConfig | null;
  /** pass = đạt 85%; floor = chỉ đạt sàn 75%; none = không chọn được */
  level: "pass" | "floor" | "none";
  reason: string;
  /** đường đánh đổi (CR, R@6) trên dev — để báo cáo khi không đạt */
  pareto: RerankCandidate[];
}

const pct = (x: number) => `${Number((x * 100).toFixed(1))}%`;
const key = (c: RerankConfig) => JSON.stringify(c);

/** Các ứng viên không bị trội theo (từ chối đúng, Recall@6) trên dev; sắp CR giảm dần. */
export function paretoFront(
  cands: readonly RerankCandidate[],
): RerankCandidate[] {
  const dominated = (a: RerankCandidate) =>
    cands.some(
      (b) =>
        b !== a &&
        b.dev.correctRejection >= a.dev.correctRejection &&
        b.dev.recallAt6 >= a.dev.recallAt6 &&
        (b.dev.correctRejection > a.dev.correctRejection ||
          b.dev.recallAt6 > a.dev.recallAt6),
    );
  return cands
    .filter((c) => !dominated(c))
    .sort(
      (a, b) =>
        b.dev.correctRejection - a.dev.correctRejection ||
        b.dev.recallAt6 - a.dev.recallAt6 ||
        key(a.config).localeCompare(key(b.config)),
    );
}

/** Số tham số đang bật — hoà số liệu ⇒ chọn cấu hình đơn giản nhất (clarify #1). */
const complexity = (c: RerankConfig) =>
  (c.relativeDelta === null ? 0 : 1) + (c.reorder ? 1 : 0);

const better = (a: RerankCandidate, b: RerankCandidate) =>
  b.dev.recallAt6 - a.dev.recallAt6 ||
  b.dev.correctRejection - a.dev.correctRejection ||
  a.config.minScore - b.config.minScore ||
  complexity(a.config) - complexity(b.config) ||
  key(a.config).localeCompare(key(b.config));

/**
 * Chọn trên dev (R7): cấu hình có từ chối đúng ≥ 90% và Recall@6 ≥ 85% → max R@6 → max CR → minScore nhỏ nhất;
 * không có ⇒ (CR ≥ 90%) Recall@6 cao nhất nếu ≥ sàn 75%; còn lại ⇒ null + Pareto. Tất định.
 */
export function chooseRerankConfig(
  cands: readonly RerankCandidate[],
): RerankChoice {
  const pareto = paretoFront(cands);
  const eligible = cands.filter(
    (c) => c.dev.correctRejection >= TARGET_REJECTION,
  );
  const passing = eligible.filter((c) => c.dev.recallAt6 >= TARGET_RECALL);
  if (passing.length > 0) {
    const best = [...passing].sort(better)[0];
    return {
      chosen: best.config,
      level: "pass",
      reason: `ĐẠT trên dev (từ chối đúng ${pct(best.dev.correctRejection)}, Recall@6 ${pct(best.dev.recallAt6)}); ${passing.length} cấu hình đạt`,
      pareto,
    };
  }
  const best = [...eligible].sort(better)[0];
  if (best && best.dev.recallAt6 >= FLOOR_RECALL) {
    return {
      chosen: best.config,
      level: "floor",
      reason: `chỉ đạt sàn: Recall@6 ${pct(best.dev.recallAt6)} (< ${pct(TARGET_RECALL)}) khi từ chối đúng ${pct(best.dev.correctRejection)}`,
      pareto,
    };
  }
  return {
    chosen: null,
    level: "none",
    reason: best
      ? `Recall@6 tốt nhất ${pct(best.dev.recallAt6)} dưới sàn ${pct(FLOOR_RECALL)} khi giữ từ chối đúng ≥ ${pct(TARGET_REJECTION)}`
      : `không cấu hình nào giữ được từ chối đúng ≥ ${pct(TARGET_REJECTION)} trên dev`,
    pareto,
  };
}

export interface GateInput {
  /** cấu hình chọn trên vi hold-out */
  holdout: EvalMetrics;
  /** từ chối đúng trên vi dev + hold-out gộp (đếm) */
  viRejected: { successes: number; n: number };
  /** cấu hình chọn trên nhóm English */
  en: EvalMetrics;
  /** cấu hình hiện hành (không rerank) trên nhóm English, đo cùng lượt */
  enBaseline: EvalMetrics;
}

export interface GateResult {
  verdict: "ĐẠT" | "ĐẠT SÀN" | "KHÔNG ĐẠT";
  reasons: string[];
  wilsonLower: number;
  /** vi hold-out − en (dương = tiếng Việt tốt hơn) — cho quyết định ngưỡng theo ngôn ngữ (FR-011) */
  langGap: { correctRejection: number; recallAt6: number };
}

const EPS = 1e-9;

/** Kết luận cổng R6 cho cấu hình đã chọn. */
export function gateVerdict(g: GateInput): GateResult {
  const reasons: string[] = [];
  const [wilsonLower] = wilson95(g.viRejected.successes, g.viRejected.n);
  if (g.holdout.correctRejection < TARGET_REJECTION - EPS) {
    reasons.push(
      `từ chối đúng hold-out ${pct(g.holdout.correctRejection)} < ${pct(TARGET_REJECTION)}`,
    );
  }
  if (g.holdout.recallAt6 < FLOOR_RECALL - EPS) {
    reasons.push(
      `Recall@6 hold-out ${pct(g.holdout.recallAt6)} < sàn ${pct(FLOOR_RECALL)}`,
    );
  }
  if (wilsonLower < WILSON_FLOOR - EPS) {
    reasons.push(
      `cận dưới Wilson từ chối đúng vi gộp ${pct(wilsonLower)} < ${pct(WILSON_FLOOR)}`,
    );
  }
  if (g.en.correctRejection < g.enBaseline.correctRejection - EPS) {
    reasons.push(
      `English từ chối đúng ${pct(g.en.correctRejection)} < mốc ${pct(g.enBaseline.correctRejection)}`,
    );
  }
  if (g.en.recallAt6 < g.enBaseline.recallAt6 - EPS) {
    reasons.push(
      `English Recall@6 ${pct(g.en.recallAt6)} < mốc ${pct(g.enBaseline.recallAt6)}`,
    );
  }
  const verdict =
    reasons.length > 0
      ? "KHÔNG ĐẠT"
      : g.holdout.recallAt6 >= TARGET_RECALL - EPS
        ? "ĐẠT"
        : "ĐẠT SÀN";
  return {
    verdict,
    reasons,
    wilsonLower,
    langGap: {
      correctRejection: g.holdout.correctRejection - g.en.correctRejection,
      recallAt6: g.holdout.recallAt6 - g.en.recallAt6,
    },
  };
}
