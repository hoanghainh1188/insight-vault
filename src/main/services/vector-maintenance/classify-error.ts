// 116 (research R5, plan design note 4): phân loại lỗi của optimize. Xung đột commit với một lần ghi đồng thời là
// tạm thời ⇒ "hoãn" (không tính lỗi). Thông điệp CHỈ dùng để phân loại — không bao giờ đưa vào nhật ký (có thể
// chứa đường dẫn), chỉ log tên lớp lỗi (Constitution III).

export type ClassifiedError =
  { kind: "conflict" } | { kind: "error"; errorType: string };

const CONFLICT = /conflict|retryable/i;

export function classifyOptimizeError(e: unknown): ClassifiedError {
  if (e instanceof Error) {
    if (CONFLICT.test(e.name) || CONFLICT.test(e.message)) {
      return { kind: "conflict" };
    }
    return { kind: "error", errorType: e.constructor.name };
  }
  return { kind: "error", errorType: typeof e };
}
