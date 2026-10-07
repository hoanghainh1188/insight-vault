import { describe, expect, it } from "vitest";
import {
  FLOOR_RECALL,
  TARGET_RECALL,
  TARGET_REJECTION,
  chooseConfig,
  computeMetrics,
  configComplexity,
  confirmOnHoldout,
  correctRejectionRate,
  falseRejectionRate,
  groupOutcomes,
  histogram,
  mrr,
  recallAtK,
  wilson95,
  type QuestionOutcome,
} from "../eval/lib/metrics";
import { BASELINE_CONFIG, buildGrid } from "../eval/lib/grid";
import {
  validateRelevanceConfig,
  type RelevanceConfig,
} from "../../src/main/services/rag/relevance-filter";
import type { EvalMetrics } from "../../src/main/services/rag/relevance-calibration";

// 108: chỉ số đánh giá truy xuất + chọn cấu hình (FR-006, FR-011, FR-012) — hàm THUẦN.

const ans = (
  hitRank: number | null,
  over: Partial<QuestionOutcome> = {},
): QuestionOutcome => ({
  questionId: `a${Math.random()}`,
  lang: "vi",
  type: "answerable",
  split: "dev",
  rejected: false,
  hitRank,
  ...over,
});
const unans = (
  rejected: boolean,
  over: Partial<QuestionOutcome> = {},
): QuestionOutcome => ({
  questionId: `u${Math.random()}`,
  lang: "vi",
  type: "unanswerable",
  split: "dev",
  rejected,
  hitRank: null,
  ...over,
});

describe("recallAtK / mrr", () => {
  const outs = [ans(1), ans(3), ans(6), ans(null), unans(true)];

  it("Recall@k chỉ tính trên câu CÓ đáp án", () => {
    expect(recallAtK(outs, 1)).toBe(0.25);
    expect(recallAtK(outs, 3)).toBe(0.5);
    expect(recallAtK(outs, 6)).toBe(0.75);
  });

  it("MRR: 1/rank, 0 khi không trúng trong top-6", () => {
    expect(mrr(outs)).toBeCloseTo((1 + 1 / 3 + 1 / 6 + 0) / 4, 10);
    expect(mrr([ans(7)])).toBe(0);
  });

  it("nhóm rỗng ⇒ 0 (không NaN)", () => {
    expect(recallAtK([], 6)).toBe(0);
    expect(mrr([])).toBe(0);
    expect(correctRejectionRate([])).toBe(0);
    expect(falseRejectionRate([])).toBe(0);
  });
});

describe("tỉ lệ từ chối", () => {
  it("từ chối đúng = câu không có đáp án mà retrieve rỗng", () => {
    expect(
      correctRejectionRate([unans(true), unans(true), unans(false), ans(1)]),
    ).toBeCloseTo(2 / 3, 10);
  });

  it("từ chối nhầm = câu có đáp án mà retrieve rỗng", () => {
    expect(
      falseRejectionRate([
        ans(null, { rejected: true }),
        ans(1),
        ans(2),
        ans(null),
        unans(true),
      ]),
    ).toBe(0.25);
  });
});

describe("wilson95", () => {
  it("khoảng chứa tỉ lệ, trong [0,1]; n=0 ⇒ [0,1]", () => {
    const [lo, hi] = wilson95(18, 20);
    expect(lo).toBeGreaterThan(0.68);
    expect(lo).toBeLessThan(0.9);
    expect(hi).toBeGreaterThan(0.9);
    expect(hi).toBeLessThanOrEqual(1);
    expect(wilson95(0, 0)).toEqual([0, 1]);
    expect(wilson95(0, 10)[0]).toBe(0);
    expect(wilson95(10, 10)[1]).toBeCloseTo(1, 10);
  });
});

describe("histogram", () => {
  it("20 bucket mặc định, giá trị ngoài khoảng dồn vào bucket biên", () => {
    const h = histogram([0, 0.05, 0.1, 0.99, 2, -1], 0, 1);
    expect(h.counts).toHaveLength(20);
    expect(h.edges).toHaveLength(21);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(6);
    expect(h.counts[0]).toBe(2); // 0 và -1
    expect(h.counts[19]).toBe(2); // 0.99 và 2
  });
});

describe("computeMetrics / groupOutcomes", () => {
  it("gộp đủ trường EvalMetrics", () => {
    const m = computeMetrics([
      ans(1),
      ans(null, { rejected: true }),
      unans(true),
    ]);
    expect(m.nAnswerable).toBe(2);
    expect(m.nUnanswerable).toBe(1);
    expect(m.recallAt6).toBe(0.5);
    expect(m.correctRejection).toBe(1);
    expect(m.falseRejection).toBe(0.5);
    expect(m.ci95.recallAt6[0]).toBeLessThanOrEqual(0.5);
    expect(m.ci95.correctRejection[1]).toBeLessThanOrEqual(1);
  });

  it("dev/holdout chỉ gồm câu tiếng Việt; en tách riêng", () => {
    const g = groupOutcomes([
      ans(1),
      ans(1, { split: "holdout" }),
      ans(1, { lang: "en" }),
      ans(1, { lang: "en", split: "holdout" }),
    ]);
    expect(g.dev).toHaveLength(1);
    expect(g.holdout).toHaveLength(1);
    expect(g.en).toHaveLength(2);
  });
});

const cfg = (over: Partial<RelevanceConfig> = {}): RelevanceConfig => ({
  maxDistance: 0.2,
  relativeDelta: null,
  bm25Gate: "requireVector",
  bm25VectorMaxDistance: null,
  bm25MaxScore: null,
  ...over,
});
const metrics = (recallAt6: number, correctRejection: number): EvalMetrics => ({
  nAnswerable: 50,
  nUnanswerable: 14,
  recallAt1: recallAt6,
  recallAt3: recallAt6,
  recallAt6,
  mrr: recallAt6,
  correctRejection,
  falseRejection: 0,
  ci95: { recallAt6: [0, 1], correctRejection: [0, 1] },
});

describe("configComplexity", () => {
  it("none/requireVector < vectorWithin < minScore; relativeDelta thêm 1", () => {
    const none = configComplexity(cfg({ bm25Gate: "none" }));
    const req = configComplexity(cfg());
    const within = configComplexity(
      cfg({ bm25Gate: "vectorWithin", bm25VectorMaxDistance: 0.22 }),
    );
    const min = configComplexity(
      cfg({ bm25Gate: "minScore", bm25MaxScore: -3 }),
    );
    expect(none).toBe(req);
    expect(req).toBeLessThan(within);
    expect(within).toBeLessThan(min);
    expect(configComplexity(cfg({ relativeDelta: 0.02 }))).toBe(req + 1);
  });
});

describe("chooseConfig (CHỈ dùng số liệu dev — FR-011/012)", () => {
  it("nhiều cấu hình ĐẠT ⇒ chọn ít tham số nhất, hoà thì biên lớn nhất", () => {
    const simple = cfg({ maxDistance: 0.19 });
    const simpleWide = cfg({ maxDistance: 0.21 });
    const complex = cfg({ relativeDelta: 0.02 });
    const r = chooseConfig([
      { config: complex, dev: metrics(0.97, 0.97) },
      { config: simple, dev: metrics(0.86, 0.91) },
      { config: simpleWide, dev: metrics(0.9, 0.93) },
    ]);
    expect(r.chosen).toEqual(simpleWide);
    expect(r.reason).toMatch(/ĐẠT/);
  });

  it("không cấu hình nào đạt cả hai ⇒ giữ từ chối đúng ≥ 90%, Recall@6 cao nhất (≥ sàn)", () => {
    const a = cfg({ maxDistance: 0.18 });
    const b = cfg({ maxDistance: 0.22 });
    const r = chooseConfig([
      { config: a, dev: metrics(0.78, 0.95) },
      { config: b, dev: metrics(0.83, 0.92) },
      { config: cfg({ maxDistance: 0.3 }), dev: metrics(0.99, 0.5) },
    ]);
    expect(r.chosen).toEqual(b);
    expect(r.reason).toMatch(/sàn/);
  });

  it("Recall@6 tốt nhất dưới sàn 75% ⇒ null + lý do", () => {
    const r = chooseConfig([{ config: cfg(), dev: metrics(0.7, 0.95) }]);
    expect(r.chosen).toBeNull();
    expect(r.reason).toMatch(/75%/);
  });

  it("không cấu hình nào giữ được từ chối đúng ≥ 90% ⇒ null", () => {
    const r = chooseConfig([{ config: cfg(), dev: metrics(0.99, 0.8) }]);
    expect(r.chosen).toBeNull();
    expect(r.reason).toMatch(/90%/);
  });

  it("tất định: thứ tự đầu vào không đổi kết quả", () => {
    const xs = [
      { config: cfg({ maxDistance: 0.2 }), dev: metrics(0.9, 0.95) },
      { config: cfg({ maxDistance: 0.21 }), dev: metrics(0.9, 0.95) },
    ];
    expect(chooseConfig(xs).chosen).toEqual(
      chooseConfig([...xs].reverse()).chosen,
    );
  });

  it("ngưỡng mục tiêu đúng như spec", () => {
    expect(TARGET_REJECTION).toBe(0.9);
    expect(TARGET_RECALL).toBe(0.85);
    expect(FLOOR_RECALL).toBe(0.75);
  });
});

describe("confirmOnHoldout (C2)", () => {
  it("đạt cả hai ⇒ pass, không lý do", () => {
    expect(confirmOnHoldout(metrics(0.8, 0.9))).toEqual({
      pass: true,
      reasons: [],
    });
  });

  it("mỗi điều kiện trượt ⇒ một lý do", () => {
    const r = confirmOnHoldout(metrics(0.7, 0.85));
    expect(r.pass).toBe(false);
    expect(r.reasons).toHaveLength(2);
    expect(r.reasons.join(" ")).toMatch(/từ chối đúng/);
    expect(r.reasons.join(" ")).toMatch(/Recall@6/);
  });
});

describe("buildGrid (T018)", () => {
  const grid = buildGrid([-4, -2]);

  it("mọi cấu hình hợp lệ, không trùng", () => {
    for (const c of grid)
      expect(() => validateRelevanceConfig(c)).not.toThrow();
    const keys = new Set(grid.map((c) => JSON.stringify(c)));
    expect(keys.size).toBe(grid.length);
  });

  it("chứa baseline (0.5 / null / none) và các gate mới", () => {
    expect(grid).toContainEqual(BASELINE_CONFIG);
    const gates = new Set(grid.map((c) => c.bm25Gate));
    expect(gates).toEqual(
      new Set(["none", "requireVector", "vectorWithin", "minScore"]),
    );
  });

  it("maxDistance quét 0.14..0.30 bước 0.01 (không lệch số thực)", () => {
    const ds = [...new Set(grid.map((c) => c.maxDistance))]
      .filter((d) => d < 0.5)
      .sort((a, b) => a - b);
    expect(ds[0]).toBe(0.14);
    expect(ds.at(-1)).toBe(0.3);
    expect(ds).toHaveLength(17);
  });

  it("không có mốc BM25 ⇒ không sinh minScore", () => {
    expect(buildGrid().some((c) => c.bm25Gate === "minScore")).toBe(false);
  });
});
