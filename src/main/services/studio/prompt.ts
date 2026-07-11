import type { StudioKind } from "@shared/ipc/types";

// System prompt cho Studio (ADR 2026-07-11-studio-context-strategy). Hàm THUẦN — test tất định.
// Khung chung ép: chỉ dùng đoạn ĐÁNH SỐ, chèn [n], KHÔNG bịa, tiếng Việt (Constitution II — kiểm chứng
// được; nội dung luôn truy được về chunk thật qua [n]).

const COMMON = [
  "Bạn là trợ lý tổng hợp tài liệu. Dưới đây là các đoạn nguồn được ĐÁNH SỐ [1], [2], …",
  "Chỉ dùng thông tin trong các đoạn đó, TUYỆT ĐỐI KHÔNG bịa hay thêm kiến thức ngoài.",
  "Sau mỗi ý lấy từ một đoạn, chèn chip trích dẫn [n] tương ứng (n là số đoạn nguồn).",
  "Trả lời bằng tiếng Việt, rõ ràng, súc tích.",
].join(" ");

const BY_KIND: Record<StudioKind, string> = {
  summary:
    "Nhiệm vụ: viết BẢN TÓM TẮT ngắn gọn toàn bộ tài liệu thành vài đoạn/gạch đầu dòng, nêu các nội dung chính.",
  keyPoints:
    "Nhiệm vụ: liệt kê các Ý CHÍNH dưới dạng danh sách gạch đầu dòng, mỗi ý một dòng bắt đầu bằng '- '.",
  faq: "Nhiệm vụ: soạn các câu HỎI–ĐÁP thường gặp từ tài liệu, mỗi cặp trình bày 'Hỏi: …' rồi 'Đáp: … [n]'.",
  outline:
    "Nhiệm vụ: dựng DÀN Ý phân cấp của tài liệu (mục lớn và mục con thụt lề), phản ánh cấu trúc nội dung.",
};

/** Trả system prompt theo loại. Ném nếu kind không hợp lệ (biên hệ thống). */
export function systemPromptFor(kind: StudioKind): string {
  const task = BY_KIND[kind];
  if (!task) {
    throw new Error(`StudioKind không hợp lệ: ${String(kind)}`);
  }
  return `${COMMON}\n\n${task}`;
}
