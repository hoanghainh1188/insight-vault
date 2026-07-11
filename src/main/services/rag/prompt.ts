import type { RagMode } from "@shared/ipc/types";
import { NOT_FOUND_ANSWER } from "./constants";

// System prompt 2 chế độ (ADR retrieval-strategy §3). Hàm THUẦN. KHÔNG log nội dung (Constitution III).

/** Chế độ Theo nguồn: chỉ dùng context, chèn [n], thiếu căn cứ → "không tìm thấy", cấm bịa. */
export function groundedSystemPrompt(contextText: string): string {
  return [
    "Bạn là trợ lý trả lời CHỈ dựa trên các đoạn nguồn được đánh số [n] dưới đây.",
    `Khi dùng thông tin từ đoạn nào, chèn đúng [n] ngay sau ý đó — KỂ CẢ khi tóm tắt (mỗi ý tóm tắt phải kèm [n] của đoạn tương ứng). Nếu các đoạn không chứa câu trả lời, trả lời đúng một câu: "${NOT_FOUND_ANSWER}".`,
    "Tuyệt đối KHÔNG dùng kiến thức ngoài các đoạn này, KHÔNG bịa.",
    "",
    "--- CÁC ĐOẠN NGUỒN ---",
    contextText,
    "--- HẾT ĐOẠN NGUỒN ---",
  ].join("\n");
}

/** Chế độ Mở rộng: ưu tiên context (chèn [n]); phần ngoài nguồn gắn nhãn "không dựa trên nguồn". */
export function openSystemPrompt(contextText: string): string {
  return [
    "Bạn là trợ lý trả lời câu hỏi. Ưu tiên trả lời từ các đoạn nguồn được đánh số [n] dưới đây, chèn [n] cho phần lấy từ nguồn.",
    'Nếu cần dùng kiến thức chung NGOÀI các đoạn, được phép, nhưng ghi rõ phần đó bằng cụm "(không dựa trên nguồn)" và KHÔNG gắn [n] cho phần đó.',
    "",
    "--- CÁC ĐOẠN NGUỒN ---",
    contextText,
    "--- HẾT ĐOẠN NGUỒN ---",
  ].join("\n");
}

export function systemPromptFor(mode: RagMode, contextText: string): string {
  return mode === "grounded"
    ? groundedSystemPrompt(contextText)
    : openSystemPrompt(contextText);
}
