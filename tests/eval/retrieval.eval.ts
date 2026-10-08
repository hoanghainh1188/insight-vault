import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EMBEDDING_MODEL_VERSION } from "../../src/main/services/embedding/model-version";
import { RELEVANCE_CALIBRATION } from "../../src/main/services/rag/relevance-calibration";
import {
  validateRelevanceConfig,
  type RelevanceConfig,
} from "../../src/main/services/rag/relevance-filter";
import {
  isReviewed,
  loadDataset,
  validateManifest,
  validateQuestions,
} from "./lib/dataset";
import { BASELINE_CONFIG, buildGrid } from "./lib/grid";
import {
  buildIndex,
  evaluateConfig,
  runWithLlm,
  warmUp,
  type EvalIndex,
} from "./lib/harness";
import {
  chooseConfig,
  computeMetrics,
  confirmOnHoldout,
  groupOutcomes,
  histogram,
} from "./lib/metrics";
import { runRerankModel } from "./lib/rerank-run";
import { loadScorer } from "./lib/rerank";
import {
  describeConfig,
  renderMarkdown,
  writeReport,
  type ConfigResult,
  type EvalReport,
} from "./lib/report";

// 108: công cụ đo truy xuất (US4) — `npm run eval:retrieval`. Contract: specs/20261007-111628-relevance-calibration/
// contracts/eval-retrieval-cli.md. Tham số qua biến môi trường (vitest không nhận flag tuỳ biến).

const EVAL_DIR = resolve(__dirname);
const CORPUS_DIR = resolve(EVAL_DIR, "corpus");
const REPORTS_DIR = resolve(EVAL_DIR, "reports");
const CACHE_DIR = resolve(
  process.env.EVAL_CACHE_DIR ?? resolve(EVAL_DIR, ".cache", "models"),
);
const key = (c: RelevanceConfig) => JSON.stringify(c);

function percentile(xs: readonly number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

function configsToRun(bm25Scores: readonly number[]): {
  mode: EvalReport["mode"];
  configs: RelevanceConfig[];
} {
  if (process.env.EVAL_CONFIG) {
    const c = JSON.parse(process.env.EVAL_CONFIG) as RelevanceConfig;
    validateRelevanceConfig(c);
    return { mode: "single", configs: [BASELINE_CONFIG, c] };
  }
  if ((process.env.EVAL_MODE ?? "sweep") === "current") {
    return {
      mode: "current",
      configs: [BASELINE_CONFIG, RELEVANCE_CALIBRATION.config],
    };
  }
  const marks = [10, 25, 50].map((p) => percentile(bm25Scores, p));
  return { mode: "sweep", configs: buildGrid(bm25Scores.length ? marks : []) };
}

describe("eval:retrieval", () => {
  it("đo truy xuất trên bộ đánh giá và ghi báo cáo", async () => {
    // 1. Kiểm dữ liệu — lỗi ⇒ fail kèm danh sách (contract bước 1).
    const ds = loadDataset(EVAL_DIR);
    const docIds = new Set(ds.documents.map((d) => d.id));
    const noiseIds = new Set(
      ds.documents.filter((d) => d.noise).map((d) => d.id),
    );
    const errors = [
      ...ds.loadErrors,
      ...validateManifest(ds.documents),
      ...validateQuestions(ds.questions, ds.texts, docIds, noiseIds),
    ];
    expect(errors, `Lỗi bộ dữ liệu:\n${errors.join("\n")}`).toEqual([]);

    const warnings: string[] = [];
    const reviewed = isReviewed(ds.questions);
    if (!reviewed) {
      warnings.push(
        "BỘ DỮ LIỆU CHƯA DUYỆT (questions.json → reviewed = null) — không dùng để chọn cấu hình (FR-003)",
      );
    }
    if (
      RELEVANCE_CALIBRATION.embeddingModelVersion !== EMBEDDING_MODEL_VERSION
    ) {
      warnings.push(
        `Bản ghi hiệu chuẩn gắn ${RELEVANCE_CALIBRATION.embeddingModelVersion}, mô hình hiện hành ${EMBEDDING_MODEL_VERSION}`,
      );
    }

    // 2. Dựng chỉ mục thật trên thư mục tạm.
    const questions = ds.questions.questions;
    let index: EvalIndex | null = null;
    try {
      index = await buildIndex(ds, CORPUS_DIR, CACHE_DIR);
      await warmUp(index, questions, BASELINE_CONFIG);

      // 3. Đo từng cấu hình.
      const { mode, configs } = configsToRun(index.bm25Scores);
      const results: ConfigResult[] = [];
      for (const cfg of configs) {
        const { outcomes, avgRetrieveMs } = await evaluateConfig(
          index,
          questions,
          cfg,
        );
        const g = groupOutcomes(outcomes);
        results.push({
          config: cfg,
          dev: computeMetrics(g.dev),
          holdout: computeMetrics(g.holdout),
          en: computeMetrics(g.en),
          avgRetrieveMs,
        });
      }
      const baseline = results.find(
        (r) => key(r.config) === key(BASELINE_CONFIG),
      )!;

      // 4. Chọn cấu hình (chỉ sweep + đã duyệt) — CHỈ trên dev; hold-out để xác nhận (C2).
      let chosen: EvalReport["chosen"];
      if (mode === "sweep" && reviewed) {
        const choice = chooseConfig(
          results.map((r) => ({ config: r.config, dev: r.dev })),
        );
        const picked = choice.chosen
          ? results.find((r) => key(r.config) === key(choice.chosen!))
          : undefined;
        chosen = {
          config: choice.chosen,
          reason: choice.reason,
          ...(picked ? { holdoutCheck: confirmOnHoldout(picked.holdout) } : {}),
        };
      }

      // SC-006: cấu hình đang đo (được chọn / hiện hành / EVAL_CONFIG) so với baseline, CÙNG lần chạy.
      const candidateCfg =
        chosen?.config ??
        (mode === "sweep" ? null : configs[configs.length - 1]);
      const candidate = candidateCfg
        ? results.find((r) => key(r.config) === key(candidateCfg))
        : undefined;
      const latency =
        candidate && baseline.avgRetrieveMs > 0
          ? {
              baselineMs: baseline.avgRetrieveMs,
              candidateMs: candidate.avgRetrieveMs,
              increasePct:
                ((candidate.avgRetrieveMs - baseline.avgRetrieveMs) /
                  baseline.avgRetrieveMs) *
                100,
            }
          : undefined;

      // T035: chế độ current ⇒ so cấu hình hiện hành với số liệu đã ghi trong RELEVANCE_CALIBRATION (hồi quy).
      const recorded = RELEVANCE_CALIBRATION.metrics;
      const current = results.find(
        (r) => key(r.config) === key(RELEVANCE_CALIBRATION.config),
      );
      if (mode === "current" && recorded && current) {
        const fields = ["recallAt6", "correctRejection", "mrr"] as const;
        const drift = (["dev", "holdout"] as const).flatMap((g) =>
          fields
            .filter((f) => Math.abs(current[g][f] - recorded[g][f]) > 0.001)
            .map(
              (f) =>
                `${g}.${f}: đo ${current[g][f].toFixed(4)} ≠ ghi ${recorded[g][f]}`,
            ),
        );
        if (drift.length > 0) {
          warnings.push(
            `Số liệu lệch bản ghi hiệu chuẩn — cần hiệu chuẩn lại: ${drift.join("; ")}`,
          );
        } else {
          warnings.push(
            "✓ Khớp số liệu ghi trong RELEVANCE_CALIBRATION (hồi quy OK)",
          );
        }
      }

      // 109: phần LLM chạy với bộ chấm đã hiệu chuẩn (nếu bật) — đúng luồng của app.
      const llmRerank =
        process.env.EVAL_WITH_LLM === "1" && RELEVANCE_CALIBRATION.rerank
          ? await loadScorer(
              RELEVANCE_CALIBRATION.rerank.model,
              CACHE_DIR,
              process.env.EVAL_RERANK_FILE,
              RELEVANCE_CALIBRATION.rerank.maxTokens,
            )
          : undefined;
      const llm =
        process.env.EVAL_WITH_LLM === "1"
          ? await runWithLlm(
              index,
              questions,
              candidateCfg ?? RELEVANCE_CALIBRATION.config,
              process.env.EVAL_LLM_MODEL,
              llmRerank?.score,
            )
          : undefined;
      llmRerank?.dispose();

      // 109: bộ chấm độ liên quan (EVAL_RERANK=model1,model2) — đo trên ĐÚNG retrieve() của app với cấu hình 108 hiện hành.
      const rerankModels = (process.env.EVAL_RERANK ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const rerank = [];
      for (const model of rerankModels) {
        rerank.push(
          await runRerankModel(
            model,
            index,
            questions,
            RELEVANCE_CALIBRATION.config,
            baseline.en,
            CACHE_DIR,
            process.env.EVAL_RERANK_FILE,
            {
              ...(process.env.EVAL_RERANK_MAXLEN
                ? { maxLength: Number(process.env.EVAL_RERANK_MAXLEN) }
                : {}),
              ...(process.env.EVAL_RERANK_TOPN
                ? { topN: Number(process.env.EVAL_RERANK_TOPN) }
                : {}),
            },
          ),
        );
      }

      // 109: chế độ current (không chỉ định EVAL_RERANK) ⇒ đo lại ĐÚNG cấu hình bộ chấm đã ghi và so số liệu (hồi quy).
      const recordedRerank = RELEVANCE_CALIBRATION.rerank;
      if (mode === "current" && rerankModels.length === 0 && recordedRerank) {
        const r = await runRerankModel(
          recordedRerank.model,
          index,
          questions,
          RELEVANCE_CALIBRATION.config,
          baseline.en,
          CACHE_DIR,
          process.env.EVAL_RERANK_FILE,
          {
            maxLength: recordedRerank.maxTokens,
            topN: recordedRerank.config.maxCandidates,
          },
          recordedRerank.config,
        );
        rerank.push(r);
        const got = r.results[0];
        const fields = ["recallAt6", "correctRejection", "mrr"] as const;
        const drift = got
          ? (["dev", "holdout", "en"] as const).flatMap((g) =>
              fields
                .filter(
                  (f) =>
                    Math.abs(got[g][f] - recordedRerank.metrics[g][f]) > 0.001,
                )
                .map(
                  (f) =>
                    `rerank ${g}.${f}: đo ${got[g][f].toFixed(4)} ≠ ghi ${recordedRerank.metrics[g][f]}`,
                ),
            )
          : [`rerank: không đo được (${r.error ?? "?"})`];
        warnings.push(
          drift.length > 0
            ? `Bộ chấm lệch bản ghi hiệu chuẩn — cần đo lại: ${drift.join("; ")}`
            : "✓ Bộ chấm khớp số liệu ghi trong RELEVANCE_CALIBRATION.rerank (hồi quy OK)",
        );
      }

      const report: EvalReport = {
        runAt: new Date().toISOString(),
        mode,
        embeddingModelVersion: EMBEDDING_MODEL_VERSION,
        datasetVersion: ds.questions.datasetVersion,
        reviewed: ds.questions.reviewed,
        configs: results,
        baseline,
        ...(chosen ? { chosen } : {}),
        ...(latency ? { latency } : {}),
        histograms: {
          answerHit: histogram(index.distances.answerHit, 0, 0.4),
          answerMiss: histogram(index.distances.answerMiss, 0, 0.4),
          unanswerable: histogram(index.distances.unanswerable, 0, 0.4),
        },
        coldRetrieveMs: index.coldRetrieveMs,
        ...(llm ? { llm } : {}),
        ...(rerank.length > 0 ? { rerank } : {}),
        warnings,
      };

      // 5. Ghi báo cáo + in ra console.
      const dir = writeReport(report, REPORTS_DIR);
      process.stdout.write(`\n${renderMarkdown(report)}\nBáo cáo: ${dir}\n`);
      if (chosen?.config) {
        process.stdout.write(
          `Cấu hình được chọn: ${describeConfig(chosen.config)}\n`,
        );
      }
    } finally {
      await index?.close();
    }
  });
});
