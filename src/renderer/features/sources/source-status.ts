import type { IngestStep, Source, SourceStatus } from "@shared/ipc/types";
import { createTranslator, type Translator } from "@shared/i18n";
import { sourceErrorText } from "../../shared/a11y/messages";

// Ánh xạ trạng thái nguồn → class .stat của prototype + nhãn hiển thị + trạng thái tổng hợp.
// Hàm thuần (không React) — unit-test được, nằm trong coverage. 123: dịch theo Translator truyền vào (mặc định Việt).

const VI = createTranslator("vi");

/** Class chấm trạng thái ở cột Nguồn (prototype: ready | proc | err). */
export function statClass(status: SourceStatus): "ready" | "proc" | "err" {
  if (status === "ready") return "ready";
  if (status === "error") return "err";
  return "proc"; // queued | processing | awaiting_embedding
}

/** Nhãn hiển thị cho một trạng thái; lỗi có error_label (mã hoặc văn bản Việt cũ) ⇒ dịch nhãn lỗi. */
export function statusLabel(
  source: Pick<Source, "status" | "errorLabel">,
  tr: Translator = VI,
): string {
  if (source.status === "error" && source.errorLabel)
    return sourceErrorText(source.errorLabel, tr);
  return tr.t(`sources.status.${source.status}`);
}

/** Nhãn bước xử lý hiện tại (037). Dùng cho thanh tiến độ ở dòng nguồn. */
export function stepLabel(step: IngestStep, tr: Translator = VI): string {
  return tr.t(`sources.step.${step}`);
}

/**
 * Trạng thái tổng hợp ở header cột Nguồn (FR-012, A13):
 * - 0 nguồn → "" (ẩn phần chỉ mục)
 * - mọi nguồn ready → "N nguồn · đã lập chỉ mục"
 * - còn nguồn chưa xong → "N nguồn · đang xử lý M"
 */
export function aggregateLabel(
  sources: Pick<Source, "status">[],
  tr: Translator = VI,
): string {
  const n = sources.length;
  if (n === 0) return "";
  const pending = sources.filter(
    (s) => s.status !== "ready" && s.status !== "error",
  ).length;
  if (pending === 0) return tr.plural("sources.aggregate.indexed", n);
  return tr.plural("sources.aggregate.pending", n, { pending });
}
