import { describe, expect, it } from "vitest";
import {
  selectRelevant,
  validateRelevanceConfig,
  type RelevanceConfig,
} from "../../src/main/services/rag/relevance-filter";

// 108: bộ lọc độ liên quan — hàm thuần dùng chung retrieve() + công cụ đo (contracts/relevance-filter.md).

const base: RelevanceConfig = {
  maxDistance: 0.2,
  relativeDelta: null,
  bm25Gate: "none",
  bm25VectorMaxDistance: null,
  bm25MaxScore: null,
};

const vHits = [
  { id: "v1", score: 0.12 },
  { id: "v2", score: 0.15 },
  { id: "v3", score: 0.19 },
  { id: "v4", score: 0.25 },
];
const kHits = [
  { id: "v2", score: -9 },
  { id: "k1", score: -4 },
  { id: "k2", score: -1.5 },
];

describe("selectRelevant — nhánh vector", () => {
  it("ngưỡng tuyệt đối: giữ score ≤ maxDistance, giữ thứ tự", () => {
    const r = selectRelevant({ vHits, kHits: [] }, base);
    expect(r.vector.map((h) => h.id)).toEqual(["v1", "v2", "v3"]);
  });

  it("ngưỡng tương đối: score ≤ min(tất cả vHits) + delta", () => {
    const r = selectRelevant(
      { vHits, kHits: [] },
      { ...base, relativeDelta: 0.04 },
    );
    expect(r.vector.map((h) => h.id)).toEqual(["v1", "v2"]);
  });

  it("ngưỡng tương đối dùng min TRƯỚC lọc tuyệt đối (best vượt ngưỡng ⇒ rỗng)", () => {
    const r = selectRelevant(
      {
        vHits: [
          { id: "a", score: 0.3 },
          { id: "b", score: 0.31 },
        ],
        kHits: [],
      },
      { ...base, relativeDelta: 0.05 },
    );
    expect(r.vector).toEqual([]);
  });

  it("notebook 1 đoạn: tương đối không loại đoạn đúng duy nhất", () => {
    const r = selectRelevant(
      { vHits: [{ id: "only", score: 0.13 }], kHits: [] },
      { ...base, relativeDelta: 0.01 },
    );
    expect(r.vector.map((h) => h.id)).toEqual(["only"]);
  });

  it("vHits rỗng ⇒ vector rỗng", () => {
    expect(selectRelevant({ vHits: [], kHits: [] }, base).vector).toEqual([]);
  });
});

describe("selectRelevant — chặn nhánh BM25", () => {
  it("none: giữ toàn bộ kHits (baseline)", () => {
    const r = selectRelevant({ vHits, kHits }, base);
    expect(r.keyword).toEqual(kHits);
  });

  it("requireVector: chỉ giữ hit có id thuộc vector đã lọc", () => {
    const r = selectRelevant(
      { vHits, kHits: [...kHits, { id: "v4", score: -2 }] },
      { ...base, bm25Gate: "requireVector" },
    );
    // v4 vượt ngưỡng vector ⇒ không có hỗ trợ ⇒ loại
    expect(r.keyword.map((h) => h.id)).toEqual(["v2"]);
  });

  it("vectorWithin: giữ hit có distanceOf ≤ bm25VectorMaxDistance; thiếu distance ⇒ loại", () => {
    const dist: Record<string, number> = { v2: 0.15, k1: 0.21, k2: 0.3 };
    const r = selectRelevant(
      {
        vHits,
        kHits: [...kHits, { id: "nodist", score: -3 }],
        distanceOf: (id) => dist[id],
      },
      { ...base, bm25Gate: "vectorWithin", bm25VectorMaxDistance: 0.22 },
    );
    expect(r.keyword.map((h) => h.id)).toEqual(["v2", "k1"]);
  });

  it("vectorWithin không có distanceOf ⇒ loại hết", () => {
    const r = selectRelevant(
      { vHits, kHits },
      { ...base, bm25Gate: "vectorWithin", bm25VectorMaxDistance: 0.5 },
    );
    expect(r.keyword).toEqual([]);
  });

  it("minScore: giữ score ≤ bm25MaxScore (bm25 âm, nhỏ = liên quan)", () => {
    const r = selectRelevant(
      { vHits, kHits },
      { ...base, bm25Gate: "minScore", bm25MaxScore: -3 },
    );
    expect(r.keyword.map((h) => h.id)).toEqual(["v2", "k1"]);
  });

  it("không thêm/đổi id, không mutate input", () => {
    const vCopy = structuredClone(vHits);
    const kCopy = structuredClone(kHits);
    selectRelevant({ vHits, kHits }, { ...base, bm25Gate: "requireVector" });
    expect(vHits).toEqual(vCopy);
    expect(kHits).toEqual(kCopy);
  });
});

describe("validateRelevanceConfig", () => {
  it("cấu hình hợp lệ không ném", () => {
    expect(() => validateRelevanceConfig(base)).not.toThrow();
    expect(() =>
      validateRelevanceConfig({
        ...base,
        bm25Gate: "minScore",
        bm25MaxScore: -2,
      }),
    ).not.toThrow();
  });

  it("thiếu trường phụ theo gate ⇒ ném", () => {
    expect(() =>
      validateRelevanceConfig({ ...base, bm25Gate: "vectorWithin" }),
    ).toThrow(/bm25VectorMaxDistance/);
    expect(() =>
      validateRelevanceConfig({ ...base, bm25Gate: "minScore" }),
    ).toThrow(/bm25MaxScore/);
  });

  it("số không hữu hạn hoặc âm ⇒ ném (trừ bm25MaxScore)", () => {
    expect(() =>
      validateRelevanceConfig({ ...base, maxDistance: Number.NaN }),
    ).toThrow();
    expect(() =>
      validateRelevanceConfig({ ...base, maxDistance: -0.1 }),
    ).toThrow();
    expect(() =>
      validateRelevanceConfig({ ...base, relativeDelta: -0.01 }),
    ).toThrow();
    expect(() =>
      validateRelevanceConfig({
        ...base,
        bm25Gate: "vectorWithin",
        bm25VectorMaxDistance: Infinity,
      }),
    ).toThrow();
    expect(() =>
      validateRelevanceConfig({
        ...base,
        bm25Gate: "minScore",
        bm25MaxScore: Number.NaN,
      }),
    ).toThrow();
  });

  it("gate không hợp lệ ⇒ ném", () => {
    expect(() =>
      validateRelevanceConfig({
        ...base,
        bm25Gate: "bogus" as RelevanceConfig["bm25Gate"],
      }),
    ).toThrow();
  });
});
