import type { ChatMessage, RagTurn } from "@shared/ipc/types";
import { MAX_HISTORY_TURNS } from "./constants";

// Query rewriting (055): viết lại câu hỏi thành 1 truy vấn độc lập (giải tham chiếu hội thoại + mở rộng)
// TRƯỚC khi truy xuất. buildRewritePrompt THUẦN (test); rewriteQuery I/O gọi LLM (fallback câu gốc khi
// lỗi/rỗng). KHÔNG log nội dung (Constitution III). Badge egress: dùng provider active (031) — nếu online
// đang bật thì badge đã ở trạng thái online (không cần bật riêng cho bước này).

// 123 (FR-019, research R8): lời nhắc English; GIỮ NGUYÊN ngôn ngữ câu hỏi (truy xuất BM25/vector dùng câu này).
const SYSTEM = `Rewrite the follow-up question as ONE standalone question by ONLY replacing pronouns/references
with the actual subject from the earlier conversation. NEVER:
- add topics, fields or keywords that are not in the original question;
- expand, paraphrase or make the question longer than necessary;
- change the user's intent.
Keep the question in its original language. Keep it SHORT and as close to the original as possible (differing only
where pronouns were replaced). Return ONLY the rewritten question — no explanation, no quotes or prefixes.`;

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
            (t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`,
          )
          .join("\n")
      : "(no earlier conversation)";
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Earlier conversation:\n${historyText}\n\nQuestion to rewrite:\n${question}\n\nRewritten question:`,
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
