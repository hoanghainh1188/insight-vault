import { EMBEDDING_MODEL_VERSION } from "../embedding/model-version";
import type { RelevanceConfig } from "./relevance-filter";

// 108: bản ghi hiệu chuẩn bộ lọc độ liên quan — MỘT nguồn sự thật cho retrieve() (thay RELEVANCE_MAX_DISTANCE).
// Gắn phiên bản mô hình embedding đã dùng để đo: đổi mô hình mà không hiệu chuẩn lại ⇒ test canh giữ fail
// (tests/unit/relevance-calibration.test.ts). Cập nhật bằng `npm run eval:retrieval` (tests/eval/README.md).

/** Chỉ số một nhóm câu hỏi (tỉ lệ 0..1). */
export interface EvalMetrics {
  /** số câu có đáp án / không có đáp án trong nhóm */
  nAnswerable: number;
  nUnanswerable: number;
  recallAt1: number;
  recallAt3: number;
  recallAt6: number;
  mrr: number;
  /** câu không có đáp án ⇒ không còn đoạn liên quan */
  correctRejection: number;
  /** câu có đáp án ⇒ không còn đoạn liên quan */
  falseRejection: number;
  ci95: {
    recallAt6: [number, number];
    correctRejection: [number, number];
  };
}

export interface RelevanceCalibration {
  embeddingModelVersion: string;
  config: RelevanceConfig;
  /** null = chưa hiệu chuẩn bằng bộ đánh giá (cấu hình kế thừa trước 108). */
  calibratedAt: string | null;
  datasetVersion: string | null;
  metrics: { dev: EvalMetrics; holdout: EvalMetrics } | null;
}

// Hiệu chuẩn 2026-10-07 (ADR docs/04-decisions/2026-10-07-relevance-calibration.md): quét 392 cấu hình — KHÔNG cấu hình
// nào đạt từ chối đúng ≥ 90% với Recall@6 ≥ 75% (e5-small: khoảng cách câu không có đáp án chồng vùng đoạn đúng) ⇒ giữ
// cấu hình hiện hành (vector ≤ 0.5, không chặn BM25). Số liệu dưới đây là của cấu hình này trên bộ đánh giá v1.
export const RELEVANCE_CALIBRATION: RelevanceCalibration = {
  embeddingModelVersion: EMBEDDING_MODEL_VERSION,
  config: {
    maxDistance: 0.5,
    relativeDelta: null,
    bm25Gate: "none",
    bm25VectorMaxDistance: null,
    bm25MaxScore: null,
  },
  calibratedAt: "2026-10-07",
  datasetVersion: "1",
  metrics: {
    dev: {
      nAnswerable: 58,
      nUnanswerable: 14,
      recallAt1: 0.7586,
      recallAt3: 0.8966,
      recallAt6: 0.9655,
      mrr: 0.8307,
      correctRejection: 0,
      falseRejection: 0,
      ci95: { recallAt6: [0.8827, 0.9905], correctRejection: [0, 0.2153] },
    },
    holdout: {
      nAnswerable: 24,
      nUnanswerable: 6,
      recallAt1: 0.875,
      recallAt3: 0.9583,
      recallAt6: 0.9583,
      mrr: 0.9097,
      correctRejection: 0,
      falseRejection: 0,
      ci95: { recallAt6: [0.7976, 0.9926], correctRejection: [0, 0.3903] },
    },
  },
};
