import type { ChatMessage, RagAnswer, RagAskInput } from "@shared/ipc/types";
import type { ChatStreamOpts } from "../ai-runtime/provider";
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
  /** Bản streaming (039): gọi onToken mỗi delta, trả nội dung ĐẦY ĐỦ (hoặc phần đã nhận nếu huỷ). */
  chatStream: (
    messages: ChatMessage[],
    opts: ChatStreamOpts,
  ) => Promise<string>;
  /** Lưu bền lượt hỏi–đáp (027-chat-history). Best-effort; KHÔNG log nội dung. */
  saveTurn?: (
    notebookId: string,
    userContent: string,
    assistant: {
      content: string;
      citations: RagAnswer["citations"];
      notFound: boolean;
    },
  ) => void;
}

export function createRagService(deps: RagServiceDeps) {
  // Tính câu trả lời (không side-effect persist) — gom mọi nhánh return vào đây. chatFn cho phép tái dùng
  // cho non-stream (deps.chat) và stream (deps.chatStream + onToken) — 039.
  async function compute(
    input: RagAskInput,
    chatFn: (messages: ChatMessage[]) => Promise<string>,
  ): Promise<RagAnswer> {
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

    const raw = await chatFn(messages);
    const { answer, citations } = postprocessCitations(raw, built.map);

    if (mode === "open") {
      return { answer, citations, notFound: false, modeUsed: "open" };
    }

    // Grounded — đảm bảo "luôn kèm nguồn / kiểm chứng được" (Constitution II).
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
  }

  // Persist lượt (027) — best-effort: DB lỗi KHÔNG phá câu trả lời; KHÔNG log nội dung.
  function persist(input: RagAskInput, result: RagAnswer): void {
    if (!deps.saveTurn) return;
    try {
      deps.saveTurn(input.notebookId, validateQuestion(input.question), {
        content: result.answer,
        citations: result.citations,
        notFound: result.notFound,
      });
    } catch {
      // bỏ qua lỗi persist (best-effort)
    }
  }

  return {
    async ask(input: RagAskInput): Promise<RagAnswer> {
      // deps.chat ném ở compute → ask ném TRƯỚC persist → không lưu lượt lỗi (đúng A2).
      const result = await compute(input, deps.chat);
      persist(input, result);
      return result;
    },

    /**
     * Bản streaming (039): stream token qua opts.onToken; huỷ (opts.signal) → giữ phần đã nhận (chatStream
     * trả phần đã nhận, KHÔNG ném) → hậu kiểm chip trên phần đó. Lưu câu trả lời CUỐI như thường.
     */
    async askStream(
      input: RagAskInput,
      opts: ChatStreamOpts,
    ): Promise<RagAnswer> {
      const result = await compute(input, (messages) =>
        deps.chatStream(messages, opts),
      );
      persist(input, result);
      return result;
    },
  };
}

export type RagService = ReturnType<typeof createRagService>;
