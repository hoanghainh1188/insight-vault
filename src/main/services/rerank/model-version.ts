// 109: model bộ chấm độ liên quan (cross-encoder) đã hiệu chuẩn — Apache-2.0, ONNX lượng tử int8 (~119 MB), đa ngôn ngữ có
// tiếng Việt. Đổi model/tệp ⇒ đổi RERANK_MODEL_VERSION ⇒ test canh giữ (tests/unit/relevance-calibration.test.ts) fail cho tới
// khi đo lại (`EVAL_RERANK=... npm run eval:retrieval`). ADR docs/04-decisions/2026-10-08-unanswerable-detection.md.

export const RERANK_MODEL = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1";

/** Tệp ONNX lượng tử theo tập lệnh CPU (research R3): arm64 = macOS Apple Silicon, x64 = Windows/Intel. */
export const RERANK_MODEL_FILES = {
  arm64: "model_qint8_arm64",
  x64: "model_quint8_avx2",
} as const;

export const RERANK_MODEL_VERSION = `${RERANK_MODEL}@qint8`;

/** Tệp ONNX cho kiến trúc CPU hiện tại. */
export function rerankModelFile(arch: string = process.arch): string {
  return arch === "arm64" ? RERANK_MODEL_FILES.arm64 : RERANK_MODEL_FILES.x64;
}
