import type { RelevanceConfig } from "../../../src/main/services/rag/relevance-filter";

// 108: lưới cấu hình quét (research R4). Mỗi cấu hình chỉ lọc lại trên hit đã tính sẵn ⇒ quét rẻ.

/** Hành vi trước 108 — luôn đo để làm mốc (SC-001). */
export const BASELINE_CONFIG: RelevanceConfig = {
  maxDistance: 0.5,
  relativeDelta: null,
  bm25Gate: "none",
  bm25VectorMaxDistance: null,
  bm25MaxScore: null,
};

const round2 = (x: number) => Math.round(x * 100) / 100;

const MAX_DISTANCES = Array.from({ length: 17 }, (_, i) =>
  round2(0.14 + i * 0.01),
);
const RELATIVE_DELTAS: readonly (number | null)[] = [
  null,
  0.01,
  0.02,
  0.03,
  0.05,
];
const WITHIN_SLACK = [0.02, 0.04];

/**
 * maxDistance 0.14..0.30 × relativeDelta × gate {none, requireVector, vectorWithin(+0.02/+0.04)}; thêm minScore
 * theo các mốc điểm bm25 đo được (`bm25Marks`, vd phân vị) với relativeDelta = null. Kèm baseline.
 */
export function buildGrid(
  bm25Marks: readonly number[] = [],
): RelevanceConfig[] {
  const out: RelevanceConfig[] = [BASELINE_CONFIG];
  for (const maxDistance of MAX_DISTANCES) {
    for (const relativeDelta of RELATIVE_DELTAS) {
      const base = {
        maxDistance,
        relativeDelta,
        bm25VectorMaxDistance: null,
        bm25MaxScore: null,
      };
      out.push({ ...base, bm25Gate: "none" });
      out.push({ ...base, bm25Gate: "requireVector" });
      for (const slack of WITHIN_SLACK) {
        out.push({
          ...base,
          bm25Gate: "vectorWithin",
          bm25VectorMaxDistance: round2(maxDistance + slack),
        });
      }
    }
    for (const mark of bm25Marks) {
      out.push({
        maxDistance,
        relativeDelta: null,
        bm25Gate: "minScore",
        bm25VectorMaxDistance: null,
        bm25MaxScore: Number(mark.toFixed(3)),
      });
    }
  }
  return out;
}
