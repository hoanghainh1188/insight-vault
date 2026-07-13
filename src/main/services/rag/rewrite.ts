import type { ChatMessage, RagTurn } from "@shared/ipc/types";
import { MAX_HISTORY_TURNS } from "./constants";

// Query rewriting (055): viết lại câu hỏi thành 1 truy vấn độc lập (giải tham chiếu hội thoại + mở rộng)
// TRƯỚC khi truy xuất. buildRewritePrompt THUẦN (test); rewriteQuery I/O gọi LLM (fallback câu gốc khi
// lỗi/rỗng). KHÔNG log nội dung (Constitution III). Badge egress: dùng provider active (031) — nếu online
// đang bật thì badge đã ở trạng thái online (không cần bật riêng cho bước này).

const SYSTEM = `Bạn viết lại câu hỏi nối tiếp thành MỘT câu hỏi độc lập bằng cách CHỈ thay đại từ/tham chiếu
bằng chủ thể thật từ hội thoại trước. TUYỆT ĐỐI KHÔNG:
- thêm chủ đề, lĩnh vực, từ khoá mới không có trong câu gốc;
- mở rộng, diễn giải, hay làm câu dài hơn cần thiết;
- đổi ý định của người dùng.
Giữ câu NGẮN GỌN, sát câu gốc nhất có thể (chỉ khác ở phần đại từ được thay). CHỈ trả về câu viết lại,
KHÔNG giải thích, KHÔNG dấu ngoặc/tiền tố.`;

// Guardrail: rewrite dài hơn câu gốc quá nhiều = model "phình" → bỏ, dùng câu gốc.
const MAX_EXPAND_CHARS = 200;

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
    if (cleaned === "") return question;
    // Guardrail: model "phình" câu (dài hơn gốc quá nhiều) → dùng câu gốc (tránh pha loãng truy xuất).
    if (cleaned.length > question.length + MAX_EXPAND_CHARS) return question;
    return cleaned;
  } catch {
    return question;
  }
}
