import { EMBEDDING_MODEL_VERSION } from "../embedding/model-version";
import { RERANK_MODEL, RERANK_MODEL_VERSION } from "../rerank/model-version";
import type { RelevanceConfig } from "./relevance-filter";
import type { RerankConfig } from "./rerank-filter";

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
  /** 109: bộ chấm độ liên quan; null = tắt (retrieve() giữ hành vi 108). */
  rerank: RerankCalibration | null;
}

/** 109: bản ghi hiệu chuẩn bộ chấm độ liên quan (cross-encoder) — gắn phiên bản model để test canh giữ. */
export interface RerankCalibration {
  model: string;
  modelVersion: string;
  /** cắt mỗi cặp (câu hỏi, đoạn) ở số token này (cổng #14) */
  maxTokens: number;
  config: RerankConfig;
  metrics: { dev: EvalMetrics; holdout: EvalMetrics; en: EvalMetrics };
  /** đo trên máy tham chiếu (macOS arm64) */
  latency: { p50Ms: number; p95Ms: number };
}

// Hiệu chuẩn 2026-10-07 (ADR docs/04-decisions/2026-10-07-relevance-calibration.md): quét 392 cấu hình — KHÔNG cấu hình
// nào đạt từ chối đúng ≥ 90% với Recall@6 ≥ 75% (e5-small: khoảng cách câu không có đáp án chồng vùng đoạn đúng) ⇒ giữ
// cấu hình hiện hành (vector ≤ 0.5, không chặn BM25). 109 (2026-10-08): số liệu của cấu hình này đo lại trên bộ đo v3 (thêm câu
// không có đáp án) + bộ chấm độ liên quan a1 (ADR docs/04-decisions/2026-10-08-unanswerable-detection.md). 177 (2026-10-12): đo lại
// trên bộ đo v4 (thêm 2 PDF + câu PDF; cấu hình KHÔNG đổi) — ADR docs/04-decisions/2026-10-12-eval-pdf.md. Lưu ý: từ chối đúng dev
// của bộ chấm 85,7% < 90% (2 câu không đáp án sát chủ đề PDF lọt) — theo dõi #187; cổng gateVerdict vẫn ĐẠT.
export const RELEVANCE_CALIBRATION: RelevanceCalibration = {
  embeddingModelVersion: EMBEDDING_MODEL_VERSION,
  config: {
    maxDistance: 0.5,
    relativeDelta: null,
    bm25Gate: "none",
    bm25VectorMaxDistance: null,
    bm25MaxScore: null,
  },
  calibratedAt: "2026-10-12",
  datasetVersion: "4",
  // Cấu hình vector/BM25 ở trên, KHÔNG bộ chấm (mốc + kiểm hồi quy `EVAL_MODE=current`).
  metrics: {
    dev: {
      nAnswerable: 77,
      nUnanswerable: 28,
      recallAt1: 0.7662,
      recallAt3: 0.9351,
      recallAt6: 0.974,
      mrr: 0.8468,
      correctRejection: 0,
      falseRejection: 0,
      ci95: {
        recallAt6: [0.9102, 0.9928],
        correctRejection: [0, 0.1206],
      },
    },
    holdout: {
      nAnswerable: 32,
      nUnanswerable: 12,
      recallAt1: 0.875,
      recallAt3: 0.9688,
      recallAt6: 0.9688,
      mrr: 0.9115,
      correctRejection: 0,
      falseRejection: 0,
      ci95: {
        recallAt6: [0.8426, 0.9945],
        correctRejection: [0, 0.2425],
      },
    },
  },
  // 109: chỉ chấm 12 ứng viên đầu (thứ tự RRF), cắt 256 token, giữ đoạn có điểm ≥ 0,6 (cổng T023 #13–#15).
  rerank: {
    model: RERANK_MODEL,
    modelVersion: RERANK_MODEL_VERSION,
    maxTokens: 256,
    config: {
      minScore: 0.6,
      relativeDelta: null,
      reorder: false,
      timeoutMs: 1500,
      maxCandidates: 12,
    },
    metrics: {
      dev: {
        nAnswerable: 77,
        nUnanswerable: 28,
        recallAt1: 0.7922,
        recallAt3: 0.9351,
        recallAt6: 0.9351,
        mrr: 0.855,
        correctRejection: 0.8571,
        falseRejection: 0.0649,
        ci95: {
          recallAt6: [0.8568, 0.9719],
          correctRejection: [0.6851, 0.943],
        },
      },
      holdout: {
        nAnswerable: 32,
        nUnanswerable: 12,
        recallAt1: 0.9062,
        recallAt3: 0.9688,
        recallAt6: 0.9688,
        mrr: 0.9375,
        correctRejection: 1,
        falseRejection: 0,
        ci95: {
          recallAt6: [0.8426, 0.9945],
          correctRejection: [0.7575, 1],
        },
      },
      en: {
        nAnswerable: 22,
        nUnanswerable: 12,
        recallAt1: 0.5909,
        recallAt3: 0.6818,
        recallAt6: 0.7273,
        mrr: 0.6402,
        correctRejection: 0.8333,
        falseRejection: 0.0909,
        ci95: {
          recallAt6: [0.5185, 0.8685],
          correctRejection: [0.552, 0.953],
        },
      },
    },
    latency: { p50Ms: 340, p95Ms: 438 },
  },
};
