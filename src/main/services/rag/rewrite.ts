import type { ChatMessage, RagTurn } from "@shared/ipc/types";
import { MAX_HISTORY_TURNS } from "./constants";

// Query rewriting (055): viết lại câu hỏi thành 1 truy vấn độc lập (giải tham chiếu hội thoại + mở rộng)
// TRƯỚC khi truy xuất. buildRewritePrompt THUẦN (test); rewriteQuery I/O gọi LLM (fallback câu gốc khi
// lỗi/rỗng). KHÔNG log nội dung (Constitution III). Badge egress: dùng provider active (031) — nếu online
// đang bật thì badge đã ở trạng thái online (không cần bật riêng cho bước này).

const SYSTEM = `Bạn viết lại câu hỏi của người dùng thành MỘT truy vấn tìm kiếm độc lập, đầy đủ ngữ cảnh.
Quy tắc:
- Nếu câu hỏi có đại từ/tham chiếu ("nó", "cái đó", "vấn đề trên"...), thay bằng chủ thể thật từ hội thoại.
- Nếu câu quá ngắn/mơ hồ, mở rộng thành truy vấn rõ ràng.
- Nếu câu ĐÃ rõ ràng và đầy đủ, GIỮ NGUYÊN (không bịa thêm, không đổi ý).
- CHỈ trả về truy vấn viết lại, KHÔNG giải thích, KHÔNG thêm dấu ngoặc/tiền tố.`;

/** Messages cho LLM: system + vài lượt hội thoại gần nhất + câu hỏi cần viết lại. THUẦN (test). */
export function buildRewritePrompt(
  question: string,
  history: RagTurn[],
): ChatMessage[] {
  const recent = history.slice(-MAX_HISTORY_TURNS);
  const historyText =
    recent.length > 0
      ? recent
          .map(
            (t) =>
              `${t.role === "user" ? "Người dùng" : "Trợ lý"}: ${t.content}`,
          )
          .join("\n")
      : "(chưa có hội thoại trước)";
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Hội thoại trước:\n${historyText}\n\nCâu hỏi cần viết lại:\n${question}\n\nTruy vấn viết lại:`,
    },
  ];
}

/**
 * Viết lại câu hỏi qua LLM (provider active). Trả truy vấn viết lại; rỗng/lỗi → trả câu gốc (FR-004).
 * `chat` = wrap LLMProvider.chat → content (như rag-service.chat).
 */
export async function rewriteQuery(
  question: string,
  history: RagTurn[],
  chat: (messages: ChatMessage[]) => Promise<string>,
): Promise<string> {
  try {
    const out = (await chat(buildRewritePrompt(question, history))).trim();
    // Loại nháy bao ngoài nếu LLM lỡ thêm; rỗng → câu gốc.
    const cleaned = out.replace(/^["'“”]+|["'“”]+$/g, "").trim();
    return cleaned === "" ? question : cleaned;
  } catch {
    return question;
  }
}
