import { describe, it, expect } from "vitest";
import {
  buildRerankGrid,
  eligibleRerankConfigs,
  rerankFunnel,
  RERANK_TIMEOUT_MS,
  type EligibilityRules,
  type LatencyBudget,
  type SweepResult,
} from "../../tests/eval/lib/rerank-grid";
import { compareOutcomes } from "../../tests/eval/lib/rerank-compare";
import { validateRerankConfig } from "../../src/main/services/rag/rerank-filter";
import type { EvalMetrics } from "../../src/main/services/rag/relevance-calibration";
import type { QuestionOutcome } from "../../tests/eval/lib/metrics";

// 187 PR 2 (T015): lưới mở rộng (ứng viên × maxTokens × minScore × Δ), loại cấu hình không đủ điều kiện, so từng câu với mốc.

const m = (cr: number, r6: number): EvalMetrics => ({
  nAnswerable: 10,
  nUnanswerable: 10,
  recallAt1: r6,
  recallAt3: r6,
  recallAt6: r6,
  mrr: r6,
  correctRejection: cr,
  falseRejection: 0,
  ci95: { recallAt6: [0, 1], correctRejection: [0, 1] },
});

describe("buildRerankGrid — dạng mở rộng", () => {
  const spec = {
    maxCandidates: [8, 12, 16],
    maxTokens: [256, 384, 512],
    minScores: [0.3, 0.6, 0.9],
    deltas: [null, 0.2] as (number | null)[],
  };

  it("sinh đủ tổ hợp, tất định, cấu hình hợp lệ, không sắp lại (reorder=false)", () => {
    const g = buildRerankGrid(spec);
    expect(g).toHaveLength(3 * 3 * 3 * 2);
    expect(new Set(g.map((p) => JSON.stringify(p))).size).toBe(g.length);
    for (const p of g) {
      expect(() => validateRerankConfig(p.config)).not.toThrow();
      expect(p.config.reorder).toBe(false);
      expect(p.config.timeoutMs).toBe(RERANK_TIMEOUT_MS);
    }
    expect(new Set(g.map((p) => p.maxTokens))).toEqual(
      new Set([256, 384, 512]),
    );
    expect(new Set(g.map((p) => p.config.maxCandidates))).toEqual(
      new Set([8, 12, 16]),
    );
    expect(buildRerankGrid(spec)).toEqual(g);
  });

  it("dạng cũ (một số) vẫn là 96 cấu hình", () => {
    expect(buildRerankGrid(12)).toHaveLength(96);
  });
});

describe("eligibleRerankConfigs", () => {
  const rules: EligibilityRules = {
    tableGuardIds: ["q-162", "q-170", "q-171"],
    enFloor: { recallAt6: 0.7273, correctRejection: 0.8333 },
  };
  const budget: LatencyBudget = { p50Ms: 400, p95Ms: 800 };
  const okGuards = [
    { questionId: "q-162", rejected: false, hitRank: 3 },
    { questionId: "q-170", rejected: false, hitRank: 1 },
    { questionId: "q-171", rejected: false, hitRank: 6 },
  ];
  const mk = (over: Partial<SweepResult> = {}): SweepResult => ({
    point: {
      maxTokens: 256,
      config: {
        minScore: 0.6,
        relativeDelta: null,
        reorder: false,
        timeoutMs: RERANK_TIMEOUT_MS,
        maxCandidates: 12,
      },
    },
    dev: m(0.9, 0.9),
    holdout: m(0.9, 0.9),
    en: m(0.8333, 0.7273),
    viRejected: { successes: 9, n: 10 },
    guards: okGuards,
    latency: { p50Ms: 340, p95Ms: 438 },
    ...over,
  });

  it("giữ cấu hình đủ điều kiện (đúng bằng sàn vẫn đạt)", () => {
    const r = eligibleRerankConfigs([mk()], rules, budget);
    expect(r.eligible).toHaveLength(1);
    expect(r.excluded).toEqual([]);
  });

  it("loại khi một câu bộ kiểm bảng bị từ chối", () => {
    const bad = mk({
      guards: [
        { questionId: "q-162", rejected: true, hitRank: null },
        ...okGuards.slice(1),
      ],
    });
    const r = eligibleRerankConfigs([bad], rules, budget);
    expect(r.eligible).toEqual([]);
    expect(r.excluded[0].reasons.join(" ")).toContain("q-162");
  });

  it("loại khi đoạn đúng không trong top 6 (hitRank > 6 hoặc null)", () => {
    for (const hitRank of [7, null]) {
      const bad = mk({
        guards: [
          okGuards[0],
          { questionId: "q-170", rejected: false, hitRank },
          okGuards[2],
        ],
      });
      expect(eligibleRerankConfigs([bad], rules, budget).eligible).toEqual([]);
    }
  });

  it("loại khi thiếu câu bộ kiểm (không kiểm chứng được)", () => {
    const bad = mk({ guards: okGuards.slice(0, 2) });
    const r = eligibleRerankConfigs([bad], rules, budget);
    expect(r.eligible).toEqual([]);
    expect(r.excluded[0].reasons.join(" ")).toContain("q-171");
  });

  it("loại khi tiếng Anh dưới sàn (Recall@6 hoặc từ chối đúng)", () => {
    expect(
      eligibleRerankConfigs([mk({ en: m(0.8333, 0.6) })], rules, budget)
        .eligible,
    ).toEqual([]);
    expect(
      eligibleRerankConfigs([mk({ en: m(0.7, 0.7273) })], rules, budget)
        .eligible,
    ).toEqual([]);
  });

  it("loại khi vượt ngân sách độ trễ p50 / p95, hoặc chưa đo độ trễ", () => {
    for (const latency of [
      { p50Ms: 401, p95Ms: 500 },
      { p50Ms: 300, p95Ms: 801 },
      null,
    ]) {
      const r = eligibleRerankConfigs([mk({ latency })], rules, budget);
      expect(r.eligible).toEqual([]);
      expect(r.excluded[0].reasons.join(" ")).toMatch(/độ trễ|p50|p95/);
    }
  });

  it("gom đủ mọi lý do và không mutate đầu vào", () => {
    const input = [
      mk({
        en: m(0.1, 0.1),
        latency: { p50Ms: 999, p95Ms: 999 },
        guards: [],
      }),
    ];
    const snapshot = JSON.stringify(input);
    const r = eligibleRerankConfigs(input, rules, budget);
    expect(r.excluded[0].reasons.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("compareOutcomes (FR-005 — so từng câu với mốc)", () => {
  const o = (
    questionId: string,
    type: QuestionOutcome["type"],
    rejected: boolean,
    hitRank: number | null,
  ): QuestionOutcome => ({
    questionId,
    lang: "vi",
    type,
    split: "dev",
    rejected,
    hitRank,
  });

  it("câu không đáp án: lọt → từ chối là được cứu; từ chối → lọt là tụt", () => {
    const base = [
      o("u1", "unanswerable", false, null),
      o("u2", "unanswerable", true, null),
    ];
    const cand = [
      o("u1", "unanswerable", true, null),
      o("u2", "unanswerable", false, null),
    ];
    const d = compareOutcomes(base, cand);
    expect(d.rescued.map((x) => x.questionId)).toEqual(["u1"]);
    expect(d.regressed.map((x) => x.questionId)).toEqual(["u2"]);
  });

  it("câu có đáp án: bị từ chối mới / hạng xấu đi là tụt; hết bị từ chối / hạng tốt lên là được cứu", () => {
    const base = [
      o("a1", "answerable", false, 2),
      o("a2", "answerable", false, 2),
      o("a3", "answerable", true, null),
      o("a4", "answerable", false, 3),
      o("a5", "answerable", false, null),
    ];
    const cand = [
      o("a1", "answerable", true, null), // bị từ chối mới
      o("a2", "answerable", false, 4), // hạng xấu đi
      o("a3", "answerable", false, 1), // hết bị từ chối
      o("a4", "answerable", false, 1), // hạng tốt lên
      o("a5", "answerable", false, null), // không đổi
    ];
    const d = compareOutcomes(base, cand);
    expect(d.regressed.map((x) => x.questionId)).toEqual(["a1", "a2"]);
    expect(d.rescued.map((x) => x.questionId)).toEqual(["a3", "a4"]);
    expect(d.unchanged).toBe(1);
  });

  it("bỏ qua câu chỉ có ở một phía, không mutate, mang theo lang / split", () => {
    const base = [
      o("a1", "answerable", false, 1),
      o("x", "answerable", false, 1),
    ];
    const cand = [
      {
        ...o("a1", "answerable", false, 5),
        lang: "en" as const,
        split: "holdout" as const,
      },
    ];
    const snap = JSON.stringify([base, cand]);
    const d = compareOutcomes(base, cand);
    expect(d.regressed).toHaveLength(1);
    expect(d.regressed[0]).toMatchObject({
      questionId: "a1",
      lang: "en",
      split: "holdout",
    });
    expect(d.rescued).toEqual([]);
    expect(JSON.stringify([base, cand])).toBe(snap);
  });
});

const budget: LatencyBudget = { p50Ms: 400, p95Ms: 800 };

describe("rerankFunnel", () => {
  const rules: EligibilityRules = {
    tableGuardIds: ["q-162"],
    enFloor: { recallAt6: 0.7, correctRejection: 0.8 },
  };
  const point = (minScore: number): SweepResult["point"] => ({
    maxTokens: 256,
    config: {
      minScore,
      relativeDelta: null,
      reorder: false,
      timeoutMs: RERANK_TIMEOUT_MS,
      maxCandidates: 12,
    },
  });
  const mk = (
    minScore: number,
    devCr: number,
    devR6: number,
    guardOk: boolean,
    enOk: boolean,
    latOk: boolean,
  ): SweepResult => ({
    point: point(minScore),
    dev: m(devCr, devR6),
    holdout: m(devCr, devR6),
    en: enOk ? m(0.9, 0.9) : m(0.1, 0.1),
    viRejected: { successes: 1, n: 1 },
    guards: [
      { questionId: "q-162", rejected: !guardOk, hitRank: guardOk ? 1 : null },
    ],
    latency: latOk ? { p50Ms: 1, p95Ms: 1 } : { p50Ms: 999, p95Ms: 999 },
  });

  it("đếm số cấu hình còn lại sau từng điều kiện nối tiếp", () => {
    const f = rerankFunnel(
      [
        mk(0.1, 0.5, 0.95, true, true, true), // rớt FR-003
        mk(0.2, 0.95, 0.5, true, true, true), // rớt Recall@6 dev
        mk(0.3, 0.95, 0.9, false, true, true), // rớt bộ kiểm bảng
        mk(0.4, 0.95, 0.9, true, false, true), // rớt tiếng Anh
        mk(0.5, 0.95, 0.9, true, true, false), // rớt độ trễ
        mk(0.6, 0.95, 0.9, true, true, true), // đạt
      ],
      rules,
      budget,
    );
    expect(f.map((s) => s.remaining)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(f[0].stage).toMatch(/tổng/i);
    expect(f.at(-1)!.stage).toMatch(/độ trễ/i);
  });

  it("không mutate", () => {
    const input = [mk(0.1, 0.95, 0.9, true, true, true)];
    const snap = JSON.stringify(input);
    rerankFunnel(input, rules, budget);
    expect(JSON.stringify(input)).toBe(snap);
  });
});
