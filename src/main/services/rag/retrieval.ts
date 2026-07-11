import type { VectorSearchHit } from "../ingestion/vector-store";
import type { ScoredChunk } from "./rag-types";
import { RELEVANCE_MAX_DISTANCE, RETRIEVAL_TOP_K } from "./constants";

// Truy hồi chunk liên quan (ADR retrieval-strategy §1). DI để test không cần LanceDB/Ollama.

export interface RetrievalDeps {
  embed: (text: string) => Promise<number[]>;
  search: (
    vector: number[],
    notebookId: string,
    topK: number,
  ) => Promise<VectorSearchHit[]>;
  getChunksByIds: (ids: string[]) => import("@shared/ipc/types").Chunk[];
  /** Tiêu đề nguồn theo sourceId (từ source-repo.getById); null nếu không có. */
  sourceTitle: (sourceId: string) => string;
}

/**
 * embed câu hỏi → search top-k → lọc ngưỡng liên quan → lấy text+locator → ScoredChunk[] (sắp theo
 * score tăng dần). Trả [] nếu không có hit đủ liên quan (→ "không tìm thấy" ở grounded).
 */
export async function retrieve(
  question: string,
  notebookId: string,
  deps: RetrievalDeps,
): Promise<ScoredChunk[]> {
  const vector = await deps.embed(question);
  const hits = await deps.search(vector, notebookId, RETRIEVAL_TOP_K);
  const relevant = hits.filter((h) => h.score <= RELEVANCE_MAX_DISTANCE);
  if (relevant.length === 0) return [];

  const chunks = deps.getChunksByIds(relevant.map((h) => h.id));
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const scoreById = new Map(relevant.map((h) => [h.id, h.score]));

  const scored: ScoredChunk[] = [];
  for (const h of relevant) {
    const chunk = byId.get(h.id);
    if (!chunk) continue; // chunk đã bị xoá giữa chừng → bỏ
    scored.push({
      chunk,
      sourceTitle: deps.sourceTitle(chunk.sourceId),
      score: scoreById.get(h.id) ?? h.score,
    });
  }
  // hits đã sắp theo score tăng; giữ nguyên thứ tự.
  return scored;
}
