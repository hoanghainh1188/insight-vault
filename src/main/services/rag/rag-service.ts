import type { ChatMessage, RagAnswer, RagAskInput } from "@shared/ipc/types";
import {
  validateHistory,
  validateMode,
  validateQuestion,
} from "./question-validation";
import { retrieve, type RetrievalDeps } from "./retrieval";
import { buildContext } from "./context-builder";
import { systemPromptFor } from "./prompt";
import { citationsFromMap, postprocessCitations } from "./citation";
import { MAX_HISTORY_TURNS, NOT_FOUND_ANSWER } from "./constants";

// Điều phối hỏi đáp (rag:ask). DI: retrieval deps + chat. KHÔNG log câu hỏi/nội dung (Constitution III).

export interface RagServiceDeps extends RetrievalDeps {
  /** Gọi LLM chat với messages[], trả nội dung câu trả lời (wrap LLMProvider.chat → content). */
  chat: (messages: ChatMessage[]) => Promise<string>;
}

export function createRagService(deps: RagServiceDeps) {
  return {
    async ask(input: RagAskInput): Promise<RagAnswer> {
      // Validate ở boundary (Constitution III). mode lạ KHÔNG âm thầm hạ về 'open' (giữ ràng buộc grounded).
      const question = validateQuestion(input.question);
      const mode = validateMode(input.mode);
      const history = validateHistory(input.history);

      const scored = await retrieve(question, input.notebookId, deps);

      // Grounded + không có căn cứ → "không tìm thấy" (không gọi model, không bịa).
      if (mode === "grounded" && scored.length === 0) {
        return {
          answer: NOT_FOUND_ANSWER,
          citations: [],
          notFound: true,
          modeUsed: "grounded",
        };
      }

      const built = buildContext(scored);
      const system = systemPromptFor(mode, built.contextText);
      const recent = history.slice(-MAX_HISTORY_TURNS);
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        ...recent.map((t) => ({ role: t.role, content: t.content })),
        { role: "user", content: question },
      ];

      const raw = await deps.chat(messages);
      const { answer, citations } = postprocessCitations(raw, built.map);

      if (mode === "open") {
        return { answer, citations, notFound: false, modeUsed: "open" };
      }

      // Grounded — đảm bảo "luôn kèm nguồn / kiểm chứng được" (Constitution II):
      // 1) có [n] hợp lệ → dùng trực tiếp (trích dẫn chính xác).
      // 2) model tự báo không có / rỗng → notFound.
      // 3) có nội dung thật nhưng model quên chèn [n] (vd tóm tắt) → gắn CÁC NGUỒN ĐÃ TRUY HỒI làm
      //    citation để câu trả lời vẫn mở/đối chiếu được — KHÔNG ẩn (retrieval đã có căn cứ; context
      //    đưa cho model CHỈ gồm các chunk này).
      if (citations.length > 0) {
        return { answer, citations, notFound: false, modeUsed: "grounded" };
      }
      if (answer.trim() === "" || /không tìm thấy/i.test(answer)) {
        return {
          answer: NOT_FOUND_ANSWER,
          citations: [],
          notFound: true,
          modeUsed: "grounded",
        };
      }
      return {
        answer,
        citations: citationsFromMap(built.map),
        notFound: false,
        modeUsed: "grounded",
      };
    },
  };
}

export type RagService = ReturnType<typeof createRagService>;
