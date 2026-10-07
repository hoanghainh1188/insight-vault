// 108: bộ lọc độ liên quan của truy xuất hỏi đáp — hàm THUẦN dùng chung retrieve() (app) và công cụ đo
// (tests/eval). Chỉ chọn hit NÀO được giữ; không đổi id/chunk/locator (Constitution II).
// Contract: specs/20261007-111628-relevance-calibration/contracts/relevance-filter.md

export type Bm25Gate = "none" | "requireVector" | "vectorWithin" | "minScore";

export interface RelevanceConfig {
  /** Ngưỡng cosine distance tuyệt đối cho nhánh vector (nhỏ = gần). */
  maxDistance: number;
  /** Loại hit vector có distance > (min mọi vHits) + delta; null = tắt. */
  relativeDelta: number | null;
  /** Cách chặn nhánh BM25 (`none` = hành vi trước 108, chỉ dùng làm baseline). */
  bm25Gate: Bm25Gate;
  /** Bắt buộc khi `vectorWithin`: distance câu hỏi↔chunk tối đa cho hit BM25. */
  bm25VectorMaxDistance: number | null;
  /** Bắt buộc khi `minScore`: bm25() FTS5 (âm) tối đa được giữ. */
  bm25MaxScore: number | null;
}

export interface Hit {
  id: string;
  score: number;
}

export interface RelevanceInput {
  vHits: readonly Hit[];
  kHits: readonly Hit[];
  distanceOf?: (id: string) => number | undefined;
}

export interface RelevanceSelection {
  vector: Hit[];
  keyword: Hit[];
}

const GATES: readonly Bm25Gate[] = [
  "none",
  "requireVector",
  "vectorWithin",
  "minScore",
];

function assertNonNegativeFinite(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0) {
    throw new Error(
      `RelevanceConfig.${name} phải là số hữu hạn ≥ 0 (nhận ${v})`,
    );
  }
}

/** Ném lỗi khi cấu hình không hợp lệ (thiếu trường phụ theo gate, số không hữu hạn/âm). */
export function validateRelevanceConfig(cfg: RelevanceConfig): void {
  assertNonNegativeFinite("maxDistance", cfg.maxDistance);
  if (cfg.relativeDelta !== null) {
    assertNonNegativeFinite("relativeDelta", cfg.relativeDelta);
  }
  if (!GATES.includes(cfg.bm25Gate)) {
    throw new Error(`RelevanceConfig.bm25Gate không hợp lệ: ${cfg.bm25Gate}`);
  }
  if (cfg.bm25Gate === "vectorWithin") {
    if (cfg.bm25VectorMaxDistance === null) {
      throw new Error("bm25Gate 'vectorWithin' cần bm25VectorMaxDistance");
    }
    assertNonNegativeFinite("bm25VectorMaxDistance", cfg.bm25VectorMaxDistance);
  }
  if (cfg.bm25Gate === "minScore") {
    if (cfg.bm25MaxScore === null || !Number.isFinite(cfg.bm25MaxScore)) {
      throw new Error("bm25Gate 'minScore' cần bm25MaxScore hữu hạn");
    }
  }
}

function filterVector(vHits: readonly Hit[], cfg: RelevanceConfig): Hit[] {
  if (vHits.length === 0) return [];
  const best = Math.min(...vHits.map((h) => h.score));
  const relLimit =
    cfg.relativeDelta === null ? Infinity : best + cfg.relativeDelta;
  return vHits
    .filter((h) => h.score <= cfg.maxDistance && h.score <= relLimit)
    .map((h) => ({ ...h }));
}

function filterKeyword(
  input: RelevanceInput,
  vector: readonly Hit[],
  cfg: RelevanceConfig,
): Hit[] {
  const keep = (h: Hit): boolean => {
    switch (cfg.bm25Gate) {
      case "none":
        return true;
      case "requireVector":
        return vector.some((v) => v.id === h.id);
      case "vectorWithin": {
        const d = input.distanceOf?.(h.id);
        return d !== undefined && d <= (cfg.bm25VectorMaxDistance ?? -Infinity);
      }
      case "minScore":
        return h.score <= (cfg.bm25MaxScore ?? -Infinity);
    }
  };
  return input.kHits.filter(keep).map((h) => ({ ...h }));
}

/** Lọc hai nhánh theo cấu hình. Giữ nguyên thứ tự trong mỗi nhánh; không mutate input. */
export function selectRelevant(
  input: RelevanceInput,
  cfg: RelevanceConfig,
): RelevanceSelection {
  const vector = filterVector(input.vHits, cfg);
  return { vector, keyword: filterKeyword(input, vector, cfg) };
}
