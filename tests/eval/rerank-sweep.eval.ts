import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RELEVANCE_CALIBRATION } from "../../src/main/services/rag/relevance-calibration";
import { RERANK_MODEL } from "../../src/main/services/rerank/model-version";
import {
  loadDataset,
  validateManifest,
  validateQuestions,
} from "./lib/dataset";
import { BASELINE_CONFIG } from "./lib/grid";
import { buildIndex, warmUp, type EvalIndex } from "./lib/harness";
import {
  chooseRerankConfig,
  eligibleRerankConfigs,
  gateVerdict,
  LATENCY_BUDGET,
  paretoFront,
  rerankFunnel,
  SWEEP_SPEC,
  type RerankGridSpec,
  type SweepResult,
} from "./lib/rerank-grid";
import { compareOutcomes } from "./lib/rerank-compare";
import {
  runRerankSweep,
  tableBudgetChars,
  type Presentation,
  type SweepRun,
} from "./lib/rerank-sweep";
import type { QuestionOutcome } from "./lib/metrics";
import type { RerankConfig } from "../../src/main/services/rag/rerank-filter";

// 187 PR 2 (T017/T018/T021): quét lưới bộ chấm mở rộng — `EVAL_RERANK_SWEEP=1 npm run eval:retrieval -- tests/eval/rerank-sweep.eval.ts`.
// Chọn CHỈ trên dev (chooseRerankConfig) sau khi loại cấu hình làm hỏng bộ kiểm bảng / dưới sàn tiếng Anh / vượt độ trễ; hold-out qua
// gateVerdict; so từng câu với mốc v5 (cấu hình hiện hành, đường app). Biến môi trường: EVAL_SWEEP_PRESENT (plain,table), EVAL_SWEEP_SPEC
// (JSON một phần của RerankGridSpec), EVAL_SWEEP_OUT (thư mục ghi), EVAL_CACHE_DIR, EVAL_RERANK_FILE.

const EVAL_DIR = resolve(__dirname);
const CACHE_DIR = resolve(
  process.env.EVAL_CACHE_DIR ?? resolve(EVAL_DIR, ".cache", "models"),
);
// EVAL_SWEEP_MODEL: model thí nghiệm (bước 2, T023) — khi khác model đã hiệu chuẩn, mốc v5 lấy từ report.json của lượt quét model
// hiện hành (EVAL_SWEEP_BASE_REPORT) vì cấu hình hiện hành chỉ có nghĩa với model của nó.
const MODEL = process.env.EVAL_SWEEP_MODEL ?? RERANK_MODEL;
// Model lớn quét lâu hơn timeout mặc định 30 phút của vitest.eval.config.ts (lượt bge-reranker-base đầu tiên bị cắt ở mốc đó).
const SWEEP_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const TABLE_GUARDS = ["q-162", "q-170", "q-171"] as const;
const KEY_IDS = [
  ...TABLE_GUARDS,
  "q-176",
  "q-179",
  "q-184",
  "q-185",
  "q-186",
  "q-188",
  "q-198",
  "q-204",
  "q-206",
  "q-089",
  "q-090",
];
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
type Ext = RerankConfig & { maxTokens: number; idx: number };
const label = (r: SweepResult) =>
  `N${r.point.config.maxCandidates}/T${r.point.maxTokens}/min${r.point.config.minScore}/Δ${r.point.config.relativeDelta ?? "–"}`;

describe.skipIf(process.env.EVAL_RERANK_SWEEP !== "1")(
  "eval:rerank-sweep",
  () => {
    it(
      "quét lưới bộ chấm và kết luận",
      async () => {
        const ds = await loadDataset(EVAL_DIR);
        const docIds = new Set(ds.documents.map((d) => d.id));
        const noiseIds = new Set(
          ds.documents.filter((d) => d.noise).map((d) => d.id),
        );
        const errors = [
          ...ds.loadErrors,
          ...validateManifest(ds.documents),
          ...validateQuestions(
            ds.questions,
            ds.texts,
            docIds,
            noiseIds,
            ds.documents,
          ),
        ];
        expect(errors, errors.join("\n")).toEqual([]);

        const spec: RerankGridSpec = {
          ...SWEEP_SPEC,
          ...(process.env.EVAL_SWEEP_SPEC
            ? (JSON.parse(
                process.env.EVAL_SWEEP_SPEC,
              ) as Partial<RerankGridSpec>)
            : {}),
        };
        const presentations = (process.env.EVAL_SWEEP_PRESENT ?? "plain,table")
          .split(",")
          .map((s) => s.trim()) as Presentation[];
        const outDir = resolve(
          process.env.EVAL_SWEEP_OUT ??
            resolve(
              EVAL_DIR,
              "reports",
              `${new Date().toISOString().replace(/[:.]/g, "-")}-sweep`,
            ),
        );
        mkdirSync(outDir, { recursive: true });
        const log = (m: string) => process.stdout.write(`${m}\n`);

        const questions = ds.questions.questions;
        let index: EvalIndex | null = null;
        try {
          index = await buildIndex(ds, resolve(EVAL_DIR, "corpus"), CACHE_DIR);
          await warmUp(index, questions, BASELINE_CONFIG);
          const rr = RELEVANCE_CALIBRATION.rerank!;
          const runs: Record<string, SweepRun> = {};
          for (const presentation of presentations) {
            runs[presentation] = await runRerankSweep({
              presentation,
              model: MODEL,
              revision: process.env.EVAL_SWEEP_REVISION,
              index,
              questions,
              relevance: RELEVANCE_CALIBRATION.config,
              cacheDir: CACHE_DIR,
              fileOverride: process.env.EVAL_RERANK_FILE,
              spec,
              tableGuardIds: TABLE_GUARDS,
              keyQuestionIds: KEY_IDS,
              log,
            });
          }

          // Mốc v5 = cấu hình hiện hành (model hiện hành, trình bày nguyên văn). Model thí nghiệm ⇒ đọc từ báo cáo lượt quét trước.
          const isBase = (r: SweepResult) =>
            r.point.maxTokens === rr.maxTokens &&
            JSON.stringify(r.point.config) === JSON.stringify(rr.config);
          let base: SweepResult;
          let baseOutcomes: QuestionOutcome[];
          if (MODEL === RERANK_MODEL) {
            const plain = runs.plain;
            if (!plain)
              throw new Error("cần chạy presentation=plain để có mốc v5");
            const baseIdx = plain.results.findIndex(isBase);
            if (baseIdx < 0)
              throw new Error("lưới không chứa cấu hình hiện hành");
            base = plain.results[baseIdx];
            baseOutcomes = plain.outcomes[baseIdx];
          } else {
            const file = process.env.EVAL_SWEEP_BASE_REPORT;
            if (!file)
              throw new Error(
                "model thí nghiệm cần EVAL_SWEEP_BASE_REPORT (report.json của lượt quét model hiện hành)",
              );
            const prev = JSON.parse(readFileSync(file, "utf8")) as {
              runs: { plain: SweepRun };
            };
            const baseIdx = prev.runs.plain.results.findIndex(isBase);
            if (baseIdx < 0)
              throw new Error("báo cáo trước không chứa cấu hình hiện hành");
            base = prev.runs.plain.results[baseIdx];
            baseOutcomes = prev.runs.plain.outcomes[baseIdx];
          }
          const enFloor = {
            recallAt6: base.en.recallAt6,
            correctRejection: base.en.correctRejection,
          };

          const md: string[] = [
            `# Quét bộ chấm 187 PR 2 — ${new Date().toISOString()}`,
            "",
            `Model đo: ${MODEL}${process.env.EVAL_SWEEP_REVISION ? ` @${process.env.EVAL_SWEEP_REVISION}` : ""}. Mốc v5 (model hiện hành, cấu hình hiện hành ${label(base)}): dev CR ${pct(base.dev.correctRejection)} / R@6 ${pct(base.dev.recallAt6)}; hold-out CR ${pct(base.holdout.correctRejection)} / R@6 ${pct(base.holdout.recallAt6)}; en CR ${pct(base.en.correctRejection)} / R@6 ${pct(base.en.recallAt6)} (sàn đã ghi: R@6 72,7% / CR 83,3%).`,
            `Độ trễ mốc: p50 ${base.latency?.p50Ms}ms, p95 ${base.latency?.p95Ms}ms. Tải máy (loadavg 1') đầu/cuối lượt đầu: ${Object.values(runs)[0].loadAvgStart.toFixed(2)} / ${Object.values(runs)[0].loadAvgEnd.toFixed(2)}.`,
            "",
          ];

          const summary: Record<string, unknown> = {};
          for (const presentation of presentations) {
            const run = runs[presentation];
            const rules = { tableGuardIds: TABLE_GUARDS, enFloor };
            const funnel = rerankFunnel(run.results, rules, LATENCY_BUDGET);
            const { eligible } = eligibleRerankConfigs(
              run.results,
              rules,
              LATENCY_BUDGET,
            );
            const ext = (r: SweepResult): Ext => ({
              ...r.point.config,
              maxTokens: r.point.maxTokens,
              idx: run.results.indexOf(r),
            });
            const choice = chooseRerankConfig(
              eligible.map((r) => ({ config: ext(r), dev: r.dev })),
            );
            md.push(
              `## Trình bày: ${presentation}${presentation === "table" ? ` (rerankInput, ngân sách = (maxTokens−48)×2 ký tự: ${spec.maxTokens.map((t) => `${t}→${tableBudgetChars(t)}`).join(", ")})` : ""}`,
              "",
              `Tải máy đầu/cuối: ${run.loadAvgStart.toFixed(2)} / ${run.loadAvgEnd.toFixed(2)}`,
              "",
              "### Phễu loại dần",
              "",
              "| Điều kiện | Còn lại |",
              "| --- | --- |",
              ...funnel.map((f) => `| ${f.stage} | ${f.remaining} |`),
              "",
              `### Chọn trên dev (chỉ trong cấu hình đủ điều kiện): ${choice.chosen ? `${choice.level} — ${choice.reason}` : `KHÔNG CHỌN ĐƯỢC — ${choice.reason}`}`,
              "",
            );
            let focus: SweepResult | undefined = choice.chosen
              ? run.results[choice.chosen.idx]
              : undefined;
            if (focus) {
              const g = gateVerdict({
                holdout: focus.holdout,
                viRejected: focus.viRejected,
                en: focus.en,
                enBaseline: base.en,
              });
              md.push(
                `Cổng gateVerdict cho ${label(focus)}: **${g.verdict}** ${g.reasons.join("; ")}`,
                "",
              );
            }

            // Đường Pareto (dev) trên MỌI cấu hình — để thấy giới hạn, KHÔNG dùng để chọn.
            const front = paretoFront(
              run.results.map((r) => ({ config: ext(r), dev: r.dev })),
            ).slice(0, 14);
            md.push(
              "### Đường Pareto trên dev (mọi cấu hình, không loại; chỉ để đọc giới hạn)",
              "",
              "| Cấu hình | dev CR | dev R@6 | hold-out CR | hold-out R@6 | en CR | en R@6 | bộ kiểm bảng | p50/p95 ms | lý do loại |",
              "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
            );
            for (const p of front) {
              const r = run.results[p.config.idx];
              const ex = eligibleRerankConfigs([r], rules, LATENCY_BUDGET)
                .excluded[0];
              md.push(
                `| ${label(r)} | ${pct(r.dev.correctRejection)} | ${pct(r.dev.recallAt6)} | ${pct(r.holdout.correctRejection)} | ${pct(r.holdout.recallAt6)} | ${pct(r.en.correctRejection)} | ${pct(r.en.recallAt6)} | ${r.guards.map((x) => `${x.questionId.slice(2)}:${x.rejected ? "✗" : `#${x.hitRank}`}`).join(" ")} | ${r.latency?.p50Ms}/${r.latency?.p95Ms} | ${ex ? ex.reasons.join("; ") : "—"} |`,
              );
            }
            md.push("");

            // Cấu hình "gần đạt nhất" (ít điều kiện hỏng nhất, rồi dev CR cao) — chỉ để báo từng câu tụt / được cứu, không phải lựa chọn.
            const misses = (r: SweepResult) =>
              (r.dev.correctRejection >= 0.9 - 1e-9 ? 0 : 1) +
              (r.dev.recallAt6 >= 0.85 - 1e-9 ? 0 : 1) +
              (eligibleRerankConfigs([r], rules, LATENCY_BUDGET).excluded[0]
                ?.reasons.length ?? 0);
            const closest = [...run.results].sort(
              (a, b) =>
                misses(a) - misses(b) ||
                b.dev.correctRejection - a.dev.correctRejection ||
                b.dev.recallAt6 - a.dev.recallAt6,
            )[0];
            focus ??= closest;
            const fi = run.results.indexOf(focus);
            const diff = compareOutcomes(baseOutcomes, run.outcomes[fi]);
            const fmt = (d: (typeof diff)["rescued"]) =>
              d.length === 0
                ? "(không)"
                : d
                    .map(
                      (x) =>
                        `${x.questionId} [${x.lang}/${x.split}] ${x.detail}`,
                    )
                    .join("; ");
            const g = gateVerdict({
              holdout: focus.holdout,
              viRejected: focus.viRejected,
              en: focus.en,
              enBaseline: base.en,
            });
            const o = (id: string) =>
              run.outcomes[fi].find((x) => x.questionId === id);
            md.push(
              `### So từng câu với mốc v5 — ${choice.chosen ? "cấu hình ĐƯỢC CHỌN" : "cấu hình GẦN ĐẠT NHẤT (không phải lựa chọn)"}: ${label(focus)}`,
              "",
              `- Điều kiện còn hỏng: ${misses(focus)} (${eligibleRerankConfigs([focus], rules, LATENCY_BUDGET).excluded[0]?.reasons.join("; ") || "không"}); gateVerdict nếu áp dụng: ${g.verdict} ${g.reasons.join("; ")}`,
              `- q-176: ${o("q-176")?.rejected ? "từ chối" : "LỌT"}; q-179: ${o("q-179")?.rejected ? "từ chối" : "LỌT"}`,
              `- Được cứu (${diff.rescued.length}): ${fmt(diff.rescued)}`,
              `- Tụt (${diff.regressed.length}): ${fmt(diff.regressed)}`,
              `- Không đổi: ${diff.unchanged}`,
              "",
              "### Điểm bộ chấm các câu quan tâm (câu không đáp án = điểm cao nhất trong N ứng viên; có đáp án = điểm đoạn đúng)",
              "",
              `| Câu | ${run.keyScores.map((k) => `N${k.maxCandidates}/T${k.maxTokens}`).join(" | ")} |`,
              `| --- | ${run.keyScores.map(() => "---").join(" | ")} |`,
              ...KEY_IDS.map(
                (id) =>
                  `| ${id} | ${run.keyScores.map((k) => (k.scores[id] === undefined ? "?" : k.scores[id] === null ? "—" : k.scores[id]!.toFixed(3))).join(" | ")} |`,
              ),
              "",
            );
            summary[presentation] = {
              funnel,
              choice: {
                level: choice.level,
                reason: choice.reason,
                chosen: choice.chosen && label(run.results[choice.chosen.idx]),
              },
              focus: label(focus),
              diff,
            };
          }
          writeFileSync(resolve(outDir, "report.md"), md.join("\n"));
          writeFileSync(
            resolve(outDir, "report.json"),
            JSON.stringify(
              { spec, enFloor, base: label(base), summary, runs },
              null,
              1,
            ),
          );
          process.stdout.write(`\n${md.join("\n")}\nBáo cáo: ${outDir}\n`);
        } finally {
          await index?.close();
        }
      },
      SWEEP_TIMEOUT_MS,
    );
  },
);
