import type {
  Chunk,
  ChatMessage,
  Source,
  StudioGenerateInput,
  StudioResult,
} from "@shared/ipc/types";
import type { ScoredChunk } from "../rag/rag-types";
import { buildContext } from "../rag/context-builder";
import { postprocessCitations, citationsFromMap } from "../rag/citation";
import { STUDIO_CONTEXT_BUDGET, STUDIO_KINDS } from "./constants";
import { systemPromptFor } from "./prompt";
import type { StudioRepo } from "./studio-repo";

// Điều phối Studio (studio:generate / studio:list). DI: nguồn chunk + chat + repo lưu.
// Gom TOÀN BỘ chunk nguồn ready của notebook → buildContext(STUDIO_CONTEXT_BUDGET) đánh số [1..k] →
// 1 lượt chat → hậu kiểm chip (Constitution II) → upsert. KHÔNG log nội dung (Constitution III).

export interface StudioServiceDeps {
  /** Nguồn của notebook (011) — chỉ đọc. */
  listSources: (notebookId: string) => Source[];
  listChunks: (sourceId: string) => Chunk[];
  studioRepo: StudioRepo;
  /** Gọi LLM chat với messages[], trả nội dung (wrap LLMProvider.chat → content). */
  chat: (messages: ChatMessage[]) => Promise<string>;
}

function isStudioKind(k: string): k is (typeof STUDIO_KINDS)[number] {
  return (STUDIO_KINDS as readonly string[]).includes(k);
}

export function createStudioService(deps: StudioServiceDeps) {
  async function generate(input: StudioGenerateInput): Promise<StudioResult> {
    const { notebookId, kind } = input;
    if (!notebookId || !isStudioKind(kind)) {
      throw new Error("Yêu cầu Studio không hợp lệ.");
    }

    // Gom chunk theo thứ tự source.created_at (listByNotebook đã ORDER) → chunk.ordinal (listChunks ORDER).
    const scored: ScoredChunk[] = [];
    for (const src of deps.listSources(notebookId)) {
      if (src.status !== "ready") continue;
      for (const chunk of deps.listChunks(src.id)) {
        scored.push({ chunk, sourceTitle: src.title, score: 0 });
      }
    }
    if (scored.length === 0) {
      throw new Error(
        "Chưa có nguồn sẵn sàng để tạo Studio. Hãy nạp nguồn trước.",
      );
    }

    const { contextText, map } = buildContext(scored, STUDIO_CONTEXT_BUDGET);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPromptFor(kind) },
      { role: "user", content: contextText },
    ];

    const raw = await deps.chat(messages); // ném nếu runtime chưa sẵn sàng → bubble lên (không bịa)
    const { answer, citations } = postprocessCitations(raw, map);

    if (answer.trim() === "") {
      throw new Error("Mô hình không tạo được nội dung. Vui lòng thử lại.");
    }
    // Grounded fallback: có nội dung nhưng model không chèn [n] hợp lệ → gắn nguồn đã dùng (kiểm chứng được).
    const finalCitations =
      citations.length > 0 ? citations : citationsFromMap(map);

    const saved = deps.studioRepo.upsert(
      notebookId,
      kind,
      answer,
      finalCitations,
    );
    return { ...saved, truncated: map.size < scored.length };
  }

  function list(notebookId: string): StudioResult[] {
    return deps.studioRepo.listByNotebook(notebookId);
  }

  return { generate, list };
}

export type StudioService = ReturnType<typeof createStudioService>;
