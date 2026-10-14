import { loadavg } from "node:os";
import type { RelevanceConfig } from "../../../src/main/services/rag/relevance-filter";
import type { EvalQuestion } from "./dataset";
import { evaluateConfig, type EvalIndex, type RerankRun } from "./harness";
import { computeMetrics, groupOutcomes, type QuestionOutcome } from "./metrics";
import { loadScorer, percentileOf } from "./rerank";
import {
  buildRerankGrid,
  type RerankGridSpec,
  type SweepResult,
} from "./rerank-grid";
import { rerankInput } from "./rerank-input";

// 187 PR 2 (T017, T021): quét lưới mở rộng (ứng viên × maxTokens × minScore × Δ) trên ĐÚNG retrieve() của app. Mỗi (ứng viên, maxTokens)
// dùng MỘT scorer riêng: lượt ấm đo độ trễ thật (không cache) rồi các cấu hình minScore × Δ chỉ lọc lại trên điểm đã chấm.
// `table` = trình bày lại đoạn bảng bằng `rerankInput` CHỈ ở chuỗi gửi bộ chấm (không đổi retrieve() / chunk). I/O, không tính coverage.

export type Presentation = "plain" | "table";

/** Ngân sách ký tự cho `rerankInput` theo maxTokens: ~2 ký tự / token (bảng nhiều số / dấu nên dày token), trừ ~48 token cho câu hỏi + token đặc biệt. */
export const tableBudgetChars = (maxTokens: number): number =>
  Math.max(0, (maxTokens - 48) * 2);

export interface KeyScores {
  /** id câu → điểm cao nhất của ứng viên trong N đầu (câu không đáp án) hoặc điểm của đoạn đúng (câu có đáp án; null = không trong ứng viên) */
  [questionId: string]: number | null;
}

export interface SweepRun {
  presentation: Presentation;
  results: SweepResult[];
  /** kết quả từng câu của từng điểm lưới — cùng chỉ số với `results` */
  outcomes: QuestionOutcome[][];
  /** điểm các câu quan tâm theo (ứng viên, maxTokens) */
  keyScores: { maxCandidates: number; maxTokens: number; scores: KeyScores }[];
  loadAvgStart: number;
  loadAvgEnd: number;
}

export async function runRerankSweep(args: {
  presentation: Presentation;
  model: string;
  index: EvalIndex;
  questions: readonly EvalQuestion[];
  relevance: RelevanceConfig;
  cacheDir: string;
  fileOverride?: string;
  /** 187: commit ghim của model thí nghiệm */
  revision?: string;
  spec: RerankGridSpec;
  tableGuardIds: readonly string[];
  mustRejectIds: readonly string[];
  keyQuestionIds: readonly string[];
  log: (msg: string) => void;
}): Promise<SweepRun> {
  const { index, questions, relevance } = args;
  const run: SweepRun = {
    presentation: args.presentation,
    results: [],
    outcomes: [],
    keyScores: [],
    loadAvgStart: loadavg()[0],
    loadAvgEnd: 0,
  };
  const grid = buildRerankGrid(args.spec);
  const combos = new Map<
    string,
    { maxCandidates: number; maxTokens: number }
  >();
  for (const p of grid) {
    combos.set(`${p.config.maxCandidates}|${p.maxTokens}`, {
      maxCandidates: p.config.maxCandidates,
      maxTokens: p.maxTokens,
    });
  }
  for (const { maxCandidates, maxTokens } of combos.values()) {
    const scorer = await loadScorer(
      args.model,
      args.cacheDir,
      args.fileOverride,
      maxTokens,
      args.revision,
    );
    try {
      const budget = tableBudgetChars(maxTokens);
      const score: RerankRun["score"] =
        args.presentation === "table"
          ? (query, passages) =>
              scorer.score(
                query,
                passages.map((p) => ({
                  id: p.id,
                  text: rerankInput(p.text, query, budget),
                })),
              )
          : scorer.score;
      // Lượt ấm: không lọc, timeout rất lớn ⇒ chấm mọi câu một lần (độ trễ thật, KHÔNG cache) + nạp cache điểm; kèm ghi điểm.
      const { outcomes: warm } = await evaluateConfig(
        index,
        questions,
        relevance,
        {
          score,
          cfg: {
            minScore: 0,
            relativeDelta: null,
            reorder: false,
            timeoutMs: 600_000,
            maxCandidates,
          },
          record: { windowText: scorer.windowText },
        },
      );
      const st = scorer.stats();
      const latency = {
        p50Ms: Math.round(percentileOf(st.callMs, 50)),
        p95Ms: Math.round(percentileOf(st.callMs, 95)),
      };
      run.keyScores.push({
        maxCandidates,
        maxTokens,
        scores: keyScores(warm, args.keyQuestionIds),
      });
      args.log(
        `[${args.presentation}] N=${maxCandidates} tokens=${maxTokens}: p50 ${latency.p50Ms}ms p95 ${latency.p95Ms}ms`,
      );
      for (const p of grid.filter(
        (g) =>
          g.config.maxCandidates === maxCandidates && g.maxTokens === maxTokens,
      )) {
        const { outcomes } = await evaluateConfig(index, questions, relevance, {
          score,
          cfg: p.config,
        });
        const g = groupOutcomes(outcomes);
        const vi = outcomes.filter(
          (o) => o.lang === "vi" && o.type === "unanswerable",
        );
        run.results.push({
          point: p,
          dev: computeMetrics(g.dev),
          holdout: computeMetrics(g.holdout),
          en: computeMetrics(g.en),
          viRejected: {
            successes: vi.filter((o) => o.rejected).length,
            n: vi.length,
          },
          guards: args.tableGuardIds.flatMap((id) => {
            const o = outcomes.find((x) => x.questionId === id);
            return o
              ? [{ questionId: id, rejected: o.rejected, hitRank: o.hitRank }]
              : [];
          }),
          mustReject: args.mustRejectIds.flatMap((id) => {
            const o = outcomes.find((x) => x.questionId === id);
            return o ? [{ questionId: id, rejected: o.rejected }] : [];
          }),
          latency,
        });
        run.outcomes.push(outcomes);
      }
    } finally {
      scorer.dispose();
    }
  }
  run.loadAvgEnd = loadavg()[0];
  return run;
}

function keyScores(
  outcomes: readonly QuestionOutcome[],
  ids: readonly string[],
): KeyScores {
  const out: KeyScores = {};
  for (const id of ids) {
    const o = outcomes.find((x) => x.questionId === id);
    const cands = o?.rerankCandidates;
    if (!o || !cands) continue;
    out[id] =
      o.type === "unanswerable"
        ? cands.length === 0
          ? null
          : Math.max(...cands.map((c) => c.score))
        : (cands.filter((c) => c.hit).sort((a, b) => b.score - a.score)[0]
            ?.score ?? null);
  }
  return out;
}
