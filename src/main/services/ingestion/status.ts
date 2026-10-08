import type { IngestStep, SourceStatus } from "@shared/ipc/types";
import type { SourceErrorCode } from "@shared/codes/source-error";

// Trạng thái nguồn + chuyển trạng thái hợp lệ (data-model state machine). Hàm thuần.

export const SOURCE_STATUSES: readonly SourceStatus[] = [
  "queued",
  "processing",
  "awaiting_embedding",
  "ready",
  "error",
] as const;

// Chuyển trạng thái cho phép (nguồn: state machine data-model.md).
const ALLOWED: Record<SourceStatus, readonly SourceStatus[]> = {
  queued: ["processing", "error"],
  processing: ["awaiting_embedding", "ready", "error"],
  awaiting_embedding: ["processing", "ready", "error"],
  ready: [],
  error: ["queued"], // retry
};

export function canTransition(from: SourceStatus, to: SourceStatus): boolean {
  return ALLOWED[from].includes(to);
}

// Mã lỗi theo bước lỗi (FR-013, A14; 123: lưu MÃ, giao diện dịch). Chi tiết kỹ thuật KHÔNG lộ (chỉ log redact).
const STEP_ERROR_CODE: Record<IngestStep, SourceErrorCode> = {
  parse: "extract",
  clean: "extract",
  chunk: "extract",
  embed: "embed",
  store: "store",
  done: "generic",
};

/** Mã lỗi cho một bước pipeline. URL fetch coi là bước 'parse' → "fetch" nếu là url. */
export function errorCodeForStep(
  step: IngestStep,
  kind?: string,
): SourceErrorCode {
  if (step === "parse" && kind === "url") return "fetch";
  return STEP_ERROR_CODE[step];
}
