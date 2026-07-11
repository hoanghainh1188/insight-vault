import type { ChatMessage, RagAnswer, RagAskInput } from "@shared/ipc/types";
import {
  validateHistory,
  validateMode,
  validateQuestion,
} from "./question-validation";
import { retrieve, type RetrievalDeps } from "./retrieval";
import { buildContext } from "./context-builder";
import { systemPromptFor } from "./prompt";
import { postprocessCitations } from "./citation";
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

      // Constitution II / SC-003: grounded PHẢI có căn cứ. Câu trả lời không có citation hợp lệ nào
      // (model bỏ qua chỉ dẫn / chỉ chèn chip bịa đã bị gỡ) → coi là "không tìm thấy", KHÔNG hiển thị
      // nội dung có thể bịa. Không dựa vào string-match mong manh.
      if (mode === "grounded" && citations.length === 0) {
        return {
          answer: NOT_FOUND_ANSWER,
          citations: [],
          notFound: true,
          modeUsed: "grounded",
        };
      }

      return { answer, citations, notFound: false, modeUsed: mode };
    },
  };
}

export type RagService = ReturnType<typeof createRagService>;
