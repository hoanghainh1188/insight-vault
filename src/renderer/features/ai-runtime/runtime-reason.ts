import type { Translator } from "@shared/i18n";
import type { RuntimeStatus } from "@shared/ipc/types";
import { parseIpcError } from "@shared/online-error-tag";
import { describeIpcError } from "../../shared/i18n/describe-error";

// 123 (FR-008): lý do runtime chưa sẵn sàng theo ngôn ngữ hiện tại — main gửi reasonCode + tham số (không gửi câu
// tiếng Việt). Kiểm tra kết nối online lỗi: ưu tiên lỗi gốc có thẻ (mã/loại lỗi online) nếu có.

export function runtimeReasonText(
  status: Pick<RuntimeStatus, "reasonCode" | "reasonParams" | "reasonError">,
  tr: Translator,
): string | null {
  if (!status.reasonCode) return null;
  const p = status.reasonParams ?? {};
  if (status.reasonCode === "connectionFailed" && status.reasonError) {
    const parsed = parseIpcError(status.reasonError);
    if (parsed.code || parsed.onlineKind) return describeIpcError(parsed, tr);
  }
  return tr.t(`ai.runtimeReason.${status.reasonCode}`, {
    models: p.models ?? "",
    provider: p.provider ?? "",
  } as never);
}
