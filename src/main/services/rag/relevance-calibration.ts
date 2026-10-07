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

// BASELINE = hành vi trước 108 (vector ≤ 0.5, BM25 không chặn). Được thay bằng cấu hình đã quét ở T033.
export const RELEVANCE_CALIBRATION: RelevanceCalibration = {
  embeddingModelVersion: EMBEDDING_MODEL_VERSION,
  config: {
    maxDistance: 0.5,
    relativeDelta: null,
    bm25Gate: "none",
    bm25VectorMaxDistance: null,
    bm25MaxScore: null,
  },
  calibratedAt: null,
  datasetVersion: null,
  metrics: null,
};
