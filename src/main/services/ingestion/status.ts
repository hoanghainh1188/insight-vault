import type { IngestStep, SourceStatus } from "@shared/ipc/types";

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

// Nhãn lỗi thân thiện theo bước lỗi (FR-013, A14). Chi tiết kỹ thuật KHÔNG lộ (chỉ log redact).
const STEP_ERROR_LABEL: Record<IngestStep, string> = {
  parse: "Lỗi trích xuất",
  clean: "Lỗi trích xuất",
  chunk: "Lỗi trích xuất",
  embed: "Lỗi nhúng",
  store: "Lỗi lưu trữ",
  done: "Lỗi",
};

/** Nhãn lỗi cho một bước pipeline. URL fetch coi là bước 'parse' → "Lỗi tải trang" nếu là url. */
export function errorLabelForStep(step: IngestStep, kind?: string): string {
  if (step === "parse" && kind === "url") return "Lỗi tải trang";
  return STEP_ERROR_LABEL[step];
}
