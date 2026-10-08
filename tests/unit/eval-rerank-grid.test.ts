import { describe, it, expect } from "vitest";
import {
  buildRerankGrid,
  chooseRerankConfig,
  gateVerdict,
  paretoFront,
  RERANK_TIMEOUT_MS,
} from "../../tests/eval/lib/rerank-grid";
import { validateRerankConfig } from "../../src/main/services/rag/rerank-filter";
import type { EvalMetrics } from "../../src/main/services/rag/relevance-calibration";

// 109 (research R6/R7, T012): lưới cấu hình bộ chấm độ liên quan + chọn trên dev + kết luận cổng.

const m = (
  cr: number,
  r6: number,
  over: Partial<EvalMetrics> = {},
): EvalMetrics => ({
  nAnswerable: 10,
  nUnanswerable: 10,
  recallAt1: r6,
  recallAt3: r6,
  recallAt6: r6,
  mrr: r6,
  correctRejection: cr,
  falseRejection: 0,
  ci95: { recallAt6: [0, 1], correctRejection: [0, 1] },
  ...over,
});
const cfg = (
  minScore: number,
  relativeDelta: number | null = null,
  reorder = false,
) => ({
  minScore,
  relativeDelta,
  reorder,
  timeoutMs: RERANK_TIMEOUT_MS,
  maxCandidates: 20,
});

describe("buildRerankGrid", () => {
  it("96 cấu hình hợp lệ, không trùng", () => {
    const g = buildRerankGrid();
    expect(g).toHaveLength(96);
    for (const c of g) expect(() => validateRerankConfig(c)).not.toThrow();
    expect(new Set(g.map((c) => JSON.stringify(c))).size).toBe(96);
    expect(g.some((c) => c.reorder) && g.some((c) => !c.reorder)).toBe(true);
    expect(g.some((c) => c.relativeDelta === null)).toBe(true);
    expect(g.every((c) => c.maxCandidates === 20)).toBe(true);
    expect(buildRerankGrid(12).every((c) => c.maxCandidates === 12)).toBe(true);
  });
});

describe("chooseRerankConfig (chỉ dev)", () => {
  it("có cấu hình đạt ⇒ max Recall@6 → max CR → minScore nhỏ nhất", () => {
    const r = chooseRerankConfig([
      { config: cfg(0.5), dev: m(0.95, 0.88) },
      { config: cfg(0.3), dev: m(0.92, 0.9) },
      { config: cfg(0.2), dev: m(0.92, 0.9) },
      { config: cfg(0.1), dev: m(0.85, 0.97) }, // CR không đạt
    ]);
    expect(r.chosen).toEqual(cfg(0.2));
    expect(r.level).toBe("pass");
  });

  it("không đạt 85% nhưng ≥ sàn 75% (CR ≥ 90%) ⇒ chọn Recall@6 cao nhất, mức sàn", () => {
    const r = chooseRerankConfig([
      { config: cfg(0.6), dev: m(0.95, 0.78) },
      { config: cfg(0.5), dev: m(0.91, 0.8) },
    ]);
    expect(r.chosen).toEqual(cfg(0.5));
    expect(r.level).toBe("floor");
  });

  it("dưới sàn hoặc không cấu hình nào CR ≥ 90% ⇒ null + Pareto", () => {
    const r = chooseRerankConfig([
      { config: cfg(0.6), dev: m(0.95, 0.6) },
      { config: cfg(0.1), dev: m(0.5, 0.95) },
      { config: cfg(0.2), dev: m(0.4, 0.9) }, // bị trội bởi 0.1
    ]);
    expect(r.chosen).toBeNull();
    expect(r.level).toBe("none");
    expect(r.pareto.map((p) => p.config.minScore).sort()).toEqual([0.1, 0.6]);
  });
});

describe("chooseRerankConfig — hoà ⇒ đơn giản nhất (clarify #1)", () => {
  it("cùng số liệu ⇒ ưu tiên không Δ, không sắp lại", () => {
    const same = m(0.95, 0.9);
    const r = chooseRerankConfig([
      { config: cfg(0.6, 0.2, true), dev: same },
      { config: cfg(0.6, 0.2), dev: same },
      { config: cfg(0.6, null, true), dev: same },
      { config: cfg(0.6), dev: same },
    ]);
    expect(r.chosen).toEqual(cfg(0.6));
  });
});

describe("paretoFront", () => {
  it("giữ điểm không bị trội theo (CR, R@6), sắp CR giảm dần", () => {
    const f = paretoFront([
      { config: cfg(0.1), dev: m(0.5, 0.95) },
      { config: cfg(0.2), dev: m(0.7, 0.9) },
      { config: cfg(0.3), dev: m(0.6, 0.85) }, // trội bởi 0.2
      { config: cfg(0.4), dev: m(1, 0.4) },
    ]);
    expect(f.map((p) => p.config.minScore)).toEqual([0.4, 0.2, 0.1]);
  });
});

describe("gateVerdict (cổng R6)", () => {
  const base = {
    holdout: m(0.9, 0.9),
    viRejected: { successes: 30, n: 32 }, // Wilson cận dưới ≈ 0,80
    en: m(0.5, 0.8),
    enBaseline: m(0.4, 0.8),
  };

  it("ĐẠT khi hold-out CR ≥ 90%, R@6 ≥ 85%, Wilson gộp ≥ 0,75, English không tụt", () => {
    const v = gateVerdict(base);
    expect(v.verdict).toBe("ĐẠT");
    expect(v.reasons).toEqual([]);
  });

  it("R@6 hold-out trong [75%, 85%) ⇒ ĐẠT SÀN", () => {
    expect(gateVerdict({ ...base, holdout: m(0.9, 0.8) }).verdict).toBe(
      "ĐẠT SÀN",
    );
  });

  it("KHÔNG ĐẠT khi: CR hold-out < 90% / R@6 < sàn / Wilson < 0,75 / English tụt", () => {
    const cases = [
      { ...base, holdout: m(0.8, 0.9) },
      { ...base, holdout: m(0.9, 0.7) },
      { ...base, viRejected: { successes: 27, n: 32 } },
      { ...base, en: m(0.3, 0.8) },
      { ...base, en: m(0.5, 0.7) },
    ];
    for (const c of cases) {
      const v = gateVerdict(c);
      expect(v.verdict, JSON.stringify(c)).toBe("KHÔNG ĐẠT");
      expect(v.reasons.length).toBeGreaterThan(0);
    }
  });

  it("báo chênh lệch vi/en (cho quyết định ngưỡng theo ngôn ngữ)", () => {
    const v = gateVerdict(base);
    expect(v.langGap.correctRejection).toBeCloseTo(0.4);
    expect(v.langGap.recallAt6).toBeCloseTo(0.1);
  });
});
