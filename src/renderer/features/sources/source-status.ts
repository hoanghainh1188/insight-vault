import type { Source, SourceStatus } from "@shared/ipc/types";

// Ánh xạ trạng thái nguồn → class .stat của prototype + nhãn tiếng Việt + trạng thái tổng hợp.
// Hàm thuần (không React) — unit-test được, nằm trong coverage.

/** Class chấm trạng thái ở cột Nguồn (prototype: ready | proc | err). */
export function statClass(status: SourceStatus): "ready" | "proc" | "err" {
  if (status === "ready") return "ready";
  if (status === "error") return "err";
  return "proc"; // queued | processing | awaiting_embedding
}

const STATUS_LABEL: Record<SourceStatus, string> = {
  queued: "Trong hàng đợi",
  processing: "Đang xử lý…",
  awaiting_embedding: "Chờ nhúng",
  ready: "Sẵn sàng",
  error: "Lỗi",
};

/** Nhãn hiển thị cho một trạng thái (dùng khi không có error_label riêng). */
export function statusLabel(
  source: Pick<Source, "status" | "errorLabel">,
): string {
  if (source.status === "error" && source.errorLabel) return source.errorLabel;
  return STATUS_LABEL[source.status];
}

/**
 * Trạng thái tổng hợp ở header cột Nguồn (FR-012, A13):
 * - 0 nguồn → "" (ẩn phần chỉ mục)
 * - mọi nguồn ready → "N nguồn · đã lập chỉ mục"
 * - còn nguồn chưa xong → "N nguồn · đang xử lý M"
 */
export function aggregateLabel(sources: Pick<Source, "status">[]): string {
  const n = sources.length;
  if (n === 0) return "";
  const noun = `${n} nguồn`;
  const pending = sources.filter(
    (s) => s.status !== "ready" && s.status !== "error",
  ).length;
  if (pending === 0) return `${noun} · đã lập chỉ mục`;
  return `${noun} · đang xử lý ${pending}`;
}
