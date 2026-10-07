import type { SourceRelinkResult } from "@shared/ipc/types";

// 101 — câu giải thích kết quả "chọn lại tệp gốc" (thuần). Huỷ ⇒ null (không báo gì).
export function relinkMessage(
  status: SourceRelinkResult["status"],
): string | null {
  switch (status) {
    case "ok":
      return "Đã liên kết lại tệp gốc.";
    case "mismatch":
      return "Tệp đã chọn khác nội dung với tệp đã nạp — trích dẫn sẽ trỏ sai chỗ nên không thể dùng. Hãy chọn đúng tệp gốc, hoặc nạp tệp này thành nguồn mới.";
    case "wrongType":
      return "Tệp đã chọn không đúng loại của nguồn này.";
    case "error":
      return "Không đọc được tệp đã chọn.";
    case "notApplicable":
      return "Nguồn này không có tệp gốc để liên kết lại.";
    case "busy":
      return "Nguồn đang được xử lý — thử lại sau giây lát.";
    case "locked":
      return "Đang sao lưu/khôi phục — thử lại sau giây lát.";
    default:
      return null;
  }
}
