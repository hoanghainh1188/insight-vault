// 109: model bộ chấm độ liên quan (cross-encoder) đã hiệu chuẩn — Apache-2.0, ONNX lượng tử int8 (~119 MB), đa ngôn ngữ có
// tiếng Việt. Đổi model/tệp ⇒ đổi RERANK_MODEL_VERSION ⇒ test canh giữ (tests/unit/relevance-calibration.test.ts) fail cho tới
// khi đo lại (`EVAL_RERANK=... npm run eval:retrieval`). ADR docs/04-decisions/2026-10-08-unanswerable-detection.md.

export const RERANK_MODEL = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1";

/** Tệp ONNX lượng tử theo tập lệnh CPU (research R3): arm64 = macOS Apple Silicon, x64 = Windows/Intel. */
export const RERANK_MODEL_FILES = {
  arm64: "model_qint8_arm64",
  x64: "model_quint8_avx2",
} as const;

/**
 * Commit cố định trên Hugging Face (review bảo mật 109): không kéo `main` — đổi trọng số phía upstream không lặng lẽ đổi bộ chấm
 * đã hiệu chuẩn. Đổi commit ⇒ đổi RERANK_MODEL_VERSION ⇒ phải đo lại.
 */
export const RERANK_MODEL_REVISION = "1427fd652930e4ba29e8149678df786c240d8825";

export const RERANK_MODEL_VERSION = `${RERANK_MODEL}@${RERANK_MODEL_REVISION.slice(0, 12)}-qint8`;

/** Tệp ONNX cho kiến trúc CPU hiện tại. */
export function rerankModelFile(arch: string = process.arch): string {
  return arch === "arm64" ? RERANK_MODEL_FILES.arm64 : RERANK_MODEL_FILES.x64;
}
