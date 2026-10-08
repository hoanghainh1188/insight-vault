import type { RelevanceConfig } from "../../../src/main/services/rag/relevance-filter";
import type { RerankConfig } from "../../../src/main/services/rag/rerank-filter";
import type { EvalMetrics } from "../../../src/main/services/rag/relevance-calibration";
import type { EvalQuestion } from "./dataset";
import { evaluateConfig, type EvalIndex } from "./harness";
import { computeMetrics, groupOutcomes } from "./metrics";
import { loadScorer, percentileOf } from "./rerank";
import {
  buildRerankGrid,
  chooseRerankConfig,
  gateVerdict,
  type GateResult,
  type RerankChoice,
} from "./rerank-grid";

// 109 (contracts/eval-rerank-cli.md): đo từng model bộ chấm độ liên quan trên ĐÚNG retrieve() của app — lượt ấm (đo độ trễ
// thật, nạp cache điểm) rồi quét 96 cấu hình, chọn trên dev, kết luận cổng. I/O, không tính coverage.

export interface RerankConfigResult {
  config: RerankConfig;
  dev: EvalMetrics;
  holdout: EvalMetrics;
  en: EvalMetrics;
  /** từ chối đúng trên vi dev + hold-out gộp (đếm) — cho cận dưới Wilson ở cổng */
  viRejected: { successes: number; n: number };
}

export interface RerankModelReport {
  model: string;
  /** biến thể đo (cổng #14) */
  variant?: { maxLength?: number; topN?: number };
  modelFile: string | null;
  error?: string;
  results: RerankConfigResult[];
  choice?: RerankChoice;
  chosen?: RerankConfigResult;
  gate?: GateResult;
  latency?: {
    coldLoadMs: number;
    p50Ms: number;
    p95Ms: number;
    rssDeltaMb: number;
    eventLoopP99Ms: number;
  };
  /** số lần bước chấm bị bỏ qua (fail-open) trong lúc quét — phải = 0 */
  skips: number;
}

const key = (c: RerankConfig) => JSON.stringify(c);

export async function runRerankModel(
  model: string,
  index: EvalIndex,
  questions: readonly EvalQuestion[],
  relevance: RelevanceConfig,
  enBaseline: EvalMetrics,
  cacheDir: string,
  fileOverride?: string,
  variant: { maxLength?: number; topN?: number } = {},
  /** chỉ đo đúng cấu hình này (kiểm hồi quy `EVAL_MODE=current`) thay vì quét lưới */
  only?: RerankConfig,
): Promise<RerankModelReport> {
  let scorer;
  try {
    scorer = await loadScorer(model, cacheDir, fileOverride, variant.maxLength);
  } catch (e) {
    return {
      model,
      modelFile: null,
      error: e instanceof Error ? e.message : String(e),
      results: [],
      skips: 0,
    };
  }
  let skips = 0;
  const onSkip = () => {
    skips += 1;
  };
  try {
    // Lượt ấm: không lọc, timeout rất lớn ⇒ chấm mọi câu một lần (độ trễ thật) và nạp cache điểm cho lượt quét.
    await evaluateConfig(index, questions, relevance, {
      score: scorer.score,
      cfg: {
        minScore: 0,
        relativeDelta: null,
        reorder: false,
        timeoutMs: 600_000,
        maxCandidates: variant.topN ?? 20,
      },
      onSkip,
    });
    const results: RerankConfigResult[] = [];
    for (const cfg of only ? [only] : buildRerankGrid(variant.topN ?? 20)) {
      const { outcomes } = await evaluateConfig(index, questions, relevance, {
        score: scorer.score,
        cfg,
        onSkip,
      });
      const g = groupOutcomes(outcomes);
      const vi = outcomes.filter(
        (o) => o.lang === "vi" && o.type === "unanswerable",
      );
      results.push({
        config: cfg,
        dev: computeMetrics(g.dev),
        holdout: computeMetrics(g.holdout),
        en: computeMetrics(g.en),
        viRejected: {
          successes: vi.filter((o) => o.rejected).length,
          n: vi.length,
        },
      });
    }
    const choice = chooseRerankConfig(
      results.map((r) => ({ config: r.config, dev: r.dev })),
    );
    const chosen = choice.chosen
      ? results.find((r) => key(r.config) === key(choice.chosen!))
      : undefined;
    const gate = chosen
      ? gateVerdict({
          holdout: chosen.holdout,
          viRejected: chosen.viRejected,
          en: chosen.en,
          enBaseline,
        })
      : undefined;
    const st = scorer.stats();
    return {
      model,
      variant,
      modelFile: scorer.modelFile,
      results,
      choice,
      ...(chosen ? { chosen } : {}),
      ...(gate ? { gate } : {}),
      latency: {
        coldLoadMs: st.coldLoadMs,
        p50Ms: percentileOf(st.callMs, 50),
        p95Ms: percentileOf(st.callMs, 95),
        rssDeltaMb: st.rssDeltaMb,
        eventLoopP99Ms: st.eventLoopP99Ms,
      },
      skips,
    };
  } finally {
    scorer.dispose();
  }
}
