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

/** Điểm lưới: cấu hình bộ chấm + số token cắt mỗi cặp (maxTokens thuộc scorer, không thuộc RerankConfig). */
export interface RerankGridPoint {
  config: RerankConfig;
  maxTokens: number;
}

/** 187 PR 2: lưới mở rộng — ứng viên × maxTokens × minScore × relativeDelta (reorder luôn false = hành vi app hiện hành). */
export interface RerankGridSpec {
  maxCandidates: readonly number[];
  maxTokens: readonly number[];
  minScores: readonly number[];
  deltas: readonly (number | null)[];
}

/**
 * Dạng cũ (109): một số `maxCandidates` ⇒ 12 minScore × 4 relativeDelta × 2 reorder = 96 cấu hình (cổng #14).
 * Dạng mới (187): `RerankGridSpec` ⇒ mọi tổ hợp, theo thứ tự tất định (ứng viên, maxTokens, minScore, Δ).
 */
export function buildRerankGrid(maxCandidates?: number): RerankConfig[];
export function buildRerankGrid(spec: RerankGridSpec): RerankGridPoint[];
export function buildRerankGrid(
  arg: number | RerankGridSpec = 20,
): RerankConfig[] | RerankGridPoint[] {
  if (typeof arg !== "number") {
    const out: RerankGridPoint[] = [];
    for (const maxCandidates of arg.maxCandidates) {
      for (const maxTokens of arg.maxTokens) {
        for (const minScore of arg.minScores) {
          for (const relativeDelta of arg.deltas) {
            out.push({
              maxTokens,
              config: {
                minScore,
                relativeDelta,
                reorder: false,
                timeoutMs: RERANK_TIMEOUT_MS,
                maxCandidates,
              },
            });
          }
        }
      }
    }
    return out;
  }
  const out: RerankConfig[] = [];
  for (const minScore of MIN_SCORES) {
    for (const relativeDelta of RELATIVE_DELTAS) {
      for (const reorder of [false, true]) {
        out.push({
          minScore,
          relativeDelta,
          reorder,
          timeoutMs: RERANK_TIMEOUT_MS,
          maxCandidates: arg,
        });
      }
    }
  }
  return out;
}

/** Lưới quét của 187 PR 2 (clarify #1, tasks T015): minScore mở rộng lên 0,98 vì câu lọt có điểm tới 0,997. */
export const SWEEP_SPEC: RerankGridSpec = {
  maxCandidates: [8, 12, 16],
  maxTokens: [256, 384, 512],
  minScores: [
    0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.98,
  ],
  deltas: [null, 0.2, 0.4, 0.6],
};

/** Kết quả đo một điểm lưới — đầu vào của `eligibleRerankConfigs`. */
export interface SweepResult {
  point: RerankGridPoint;
  dev: EvalMetrics;
  holdout: EvalMetrics;
  en: EvalMetrics;
  viRejected: { successes: number; n: number };
  /** kết quả các câu bộ kiểm bảng (chỉ để LOẠI cấu hình, không để xếp hạng) */
  guards: { questionId: string; rejected: boolean; hitRank: number | null }[];
  /** p50 / p95 một lượt chấm (ms) đo cho (maxCandidates, maxTokens) của điểm này; null = chưa đo */
  latency: { p50Ms: number; p95Ms: number } | null;
}

export interface EligibilityRules {
  tableGuardIds: readonly string[];
  /** sàn tiếng Anh: số liệu cấu hình hiện hành trên bộ v5 (clarify #4) */
  enFloor: { recallAt6: number; correctRejection: number };
}

export interface LatencyBudget {
  p50Ms: number;
  p95Ms: number;
}

/** Ngân sách độ trễ của 109 (clarify #3): p50 ≤ 400 ms, p95 ≤ 800 ms (macOS arm64 tham chiếu). */
export const LATENCY_BUDGET: LatencyBudget = { p50Ms: 400, p95Ms: 800 };

/** Hạng tối đa của đoạn đúng ở câu bộ kiểm bảng (FR-004: trong top 6). */
const GUARD_MAX_RANK = 6;

/**
 * Loại cấu hình làm hỏng bộ kiểm bảng (bị từ chối hoặc hitRank > 6 / null), tiếng Anh dưới sàn, hoặc vượt ngân sách độ trễ.
 * Bộ kiểm bảng chỉ dùng để LOẠI — việc xếp hạng / chọn vẫn chỉ trên dev (clarify #1). Không mutate; giữ thứ tự đầu vào.
 */
export function eligibleRerankConfigs(
  results: readonly SweepResult[],
  rules: EligibilityRules,
  budget: LatencyBudget,
): {
  eligible: SweepResult[];
  excluded: { result: SweepResult; reasons: string[] }[];
} {
  const eligible: SweepResult[] = [];
  const excluded: { result: SweepResult; reasons: string[] }[] = [];
  for (const r of results) {
    const reasons: string[] = [];
    for (const id of rules.tableGuardIds) {
      const g = r.guards.find((x) => x.questionId === id);
      if (!g) reasons.push(`thiếu câu bộ kiểm bảng ${id}`);
      else if (g.rejected) reasons.push(`${id} bị từ chối`);
      else if (g.hitRank === null || g.hitRank > GUARD_MAX_RANK) {
        reasons.push(
          `${id} đoạn đúng ngoài top ${GUARD_MAX_RANK} (hạng ${g.hitRank ?? "không trúng"})`,
        );
      }
    }
    if (r.en.recallAt6 < rules.enFloor.recallAt6 - EPS) {
      reasons.push(
        `English Recall@6 ${pct(r.en.recallAt6)} < sàn ${pct(rules.enFloor.recallAt6)}`,
      );
    }
    if (r.en.correctRejection < rules.enFloor.correctRejection - EPS) {
      reasons.push(
        `English từ chối đúng ${pct(r.en.correctRejection)} < sàn ${pct(rules.enFloor.correctRejection)}`,
      );
    }
    if (!r.latency) reasons.push("chưa đo độ trễ");
    else {
      if (r.latency.p50Ms > budget.p50Ms) {
        reasons.push(`độ trễ p50 ${r.latency.p50Ms}ms > ${budget.p50Ms}ms`);
      }
      if (r.latency.p95Ms > budget.p95Ms) {
        reasons.push(`độ trễ p95 ${r.latency.p95Ms}ms > ${budget.p95Ms}ms`);
      }
    }
    if (reasons.length === 0) eligible.push(r);
    else excluded.push({ result: r, reasons });
  }
  return { eligible, excluded };
}

export interface RerankCandidate<C extends RerankConfig = RerankConfig> {
  config: C;
  dev: EvalMetrics;
}

export interface RerankChoice<C extends RerankConfig = RerankConfig> {
  chosen: C | null;
  /** pass = đạt 85%; floor = chỉ đạt sàn 75%; none = không chọn được */
  level: "pass" | "floor" | "none";
  reason: string;
  /** đường đánh đổi (CR, R@6) trên dev — để báo cáo khi không đạt */
  pareto: RerankCandidate<C>[];
}

const pct = (x: number) => `${Number((x * 100).toFixed(1))}%`;
const key = (c: RerankConfig) => JSON.stringify(c);

/** Các ứng viên không bị trội theo (từ chối đúng, Recall@6) trên dev; sắp CR giảm dần. */
export function paretoFront<C extends RerankConfig>(
  cands: readonly RerankCandidate<C>[],
): RerankCandidate<C>[] {
  const dominated = (a: RerankCandidate<C>) =>
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

const better = <C extends RerankConfig>(
  a: RerankCandidate<C>,
  b: RerankCandidate<C>,
) =>
  b.dev.recallAt6 - a.dev.recallAt6 ||
  b.dev.correctRejection - a.dev.correctRejection ||
  a.config.minScore - b.config.minScore ||
  complexity(a.config) - complexity(b.config) ||
  key(a.config).localeCompare(key(b.config));

/**
 * Chọn trên dev (R7): cấu hình có từ chối đúng ≥ 90% và Recall@6 ≥ 85% → max R@6 → max CR → minScore nhỏ nhất;
 * không có ⇒ (CR ≥ 90%) Recall@6 cao nhất nếu ≥ sàn 75%; còn lại ⇒ null + Pareto. Tất định.
 */
export function chooseRerankConfig<C extends RerankConfig>(
  cands: readonly RerankCandidate<C>[],
): RerankChoice<C> {
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

export interface FunnelStage {
  stage: string;
  remaining: number;
}

/**
 * Phễu loại dần (để báo cáo vì sao không cấu hình nào đạt): tổng → từ chối đúng dev ≥ 90% (FR-003) → Recall@6 dev ≥ 85% →
 * bộ kiểm bảng → sàn tiếng Anh → ngân sách độ trễ. Mỗi mức chỉ đếm cấu hình đã qua mọi mức trước.
 */
export function rerankFunnel(
  results: readonly SweepResult[],
  rules: EligibilityRules,
  budget: LatencyBudget,
): FunnelStage[] {
  const stages: FunnelStage[] = [];
  let cur = [...results];
  const step = (stage: string, keep: (r: SweepResult) => boolean) => {
    cur = cur.filter(keep);
    stages.push({ stage, remaining: cur.length });
  };
  stages.push({ stage: "Tổng cấu hình", remaining: cur.length });
  step(
    `Từ chối đúng dev ≥ ${pct(TARGET_REJECTION)}`,
    (r) => r.dev.correctRejection >= TARGET_REJECTION - EPS,
  );
  step(
    `Recall@6 dev ≥ ${pct(TARGET_RECALL)}`,
    (r) => r.dev.recallAt6 >= TARGET_RECALL - EPS,
  );
  const only = (reasonPart: RegExp) => (r: SweepResult) =>
    !eligibleRerankConfigs([r], rules, budget).excluded.some((e) =>
      e.reasons.some((x) => reasonPart.test(x)),
    );
  step("Bộ kiểm bảng", only(/^q-|bộ kiểm bảng/));
  step("Sàn tiếng Anh", only(/^English/));
  step("Ngân sách độ trễ", only(/độ trễ|chưa đo/));
  return stages;
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
