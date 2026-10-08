import { describe, expect, it } from "vitest";
import { EMBEDDING_MODEL_VERSION } from "../../src/main/services/embedding/model-version";
import { RELEVANCE_CALIBRATION } from "../../src/main/services/rag/relevance-calibration";
import { validateRelevanceConfig } from "../../src/main/services/rag/relevance-filter";
import { validateRerankConfig } from "../../src/main/services/rag/rerank-filter";
import { RERANK_MODEL_VERSION } from "../../src/main/services/rerank/model-version";
import questions from "../eval/questions.json";

// 108 (FR-019, SC-007): ngưỡng độ liên quan chỉ đúng với mô hình embedding đã dùng để đo. Đổi mô hình mà không đo lại
// ⇒ test này PHẢI fail.

describe("RELEVANCE_CALIBRATION — test canh giữ", () => {
  it("gắn đúng phiên bản mô hình embedding hiện hành", () => {
    expect(
      RELEVANCE_CALIBRATION.embeddingModelVersion,
      "Đổi mô hình embedding ⇒ chạy `npm run eval:retrieval` và cập nhật src/main/services/rag/relevance-calibration.ts (xem tests/eval/README.md)",
    ).toBe(EMBEDDING_MODEL_VERSION);
  });

  it("cấu hình hợp lệ", () => {
    expect(() =>
      validateRelevanceConfig(RELEVANCE_CALIBRATION.config),
    ).not.toThrow();
  });

  it("đã hiệu chuẩn bằng bộ đánh giá: có ngày, phiên bản bộ dữ liệu và số liệu dev/hold-out", () => {
    expect(RELEVANCE_CALIBRATION.calibratedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(RELEVANCE_CALIBRATION.datasetVersion).toBeTruthy();
    const m = RELEVANCE_CALIBRATION.metrics;
    expect(m).not.toBeNull();
    for (const g of [m!.dev, m!.holdout]) {
      expect(g.nAnswerable).toBeGreaterThan(0);
      expect(g.recallAt6).toBeGreaterThanOrEqual(0);
      expect(g.recallAt6).toBeLessThanOrEqual(1);
    }
  });
});

describe("109: canh giữ bộ đo + bộ chấm độ liên quan", () => {
  it("phiên bản bộ đo trong bản ghi khớp tests/eval/questions.json", () => {
    expect(
      RELEVANCE_CALIBRATION.datasetVersion,
      "Đổi bộ đo ⇒ chạy `EVAL_MODE=current npm run eval:retrieval` và cập nhật số liệu + datasetVersion trong relevance-calibration.ts",
    ).toBe(questions.datasetVersion);
  });

  it("bộ chấm (nếu bật) gắn đúng phiên bản model + cấu hình hợp lệ + có số liệu", () => {
    const r = RELEVANCE_CALIBRATION.rerank;
    if (r === null) return;
    expect(
      r.modelVersion,
      "Đổi model bộ chấm ⇒ đo lại bằng `EVAL_RERANK=... npm run eval:retrieval` và cập nhật relevance-calibration.ts",
    ).toBe(RERANK_MODEL_VERSION);
    expect(() => validateRerankConfig(r.config)).not.toThrow();
    expect(r.maxTokens).toBeGreaterThan(0);
    for (const g of [r.metrics.dev, r.metrics.holdout, r.metrics.en]) {
      expect(g.nUnanswerable).toBeGreaterThan(0);
    }
  });
});
