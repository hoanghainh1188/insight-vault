import type { RagTurn } from "@shared/ipc/types";
import type { VectorSearchHit } from "../ingestion/vector-store";
import type { ScoredChunk } from "./rag-types";
import {
  RELEVANCE_MAX_DISTANCE,
  RETRIEVAL_TOP_K,
  HYBRID_BRANCH_TOPK,
} from "./constants";
import { reciprocalRankFusion, mmrSelect } from "./fusion";

// Truy hồi hybrid (055, nâng 013): rewrite câu hỏi → vector ∥ BM25 → RRF → MMR → ScoredChunk (GIỮ locator
// — Constitution II). DI để test không cần LanceDB/FTS/Ollama.

export interface RetrievalDeps {
  embed: (text: string) => Promise<number[]>;
  search: (
    vector: number[],
    notebookId: string,
    topK: number,
  ) => Promise<VectorSearchHit[]>;
  getChunksByIds: (ids: string[]) => import("@shared/ipc/types").Chunk[];
  sourceTitle: (sourceId: string) => string;
  // 055 (tuỳ chọn — thiếu thì lùi về hành vi 013 chỉ-vector, không rewrite):
  rewrite?: (question: string, history: RagTurn[]) => Promise<string>;
  searchBm25?: (
    notebookId: string,
    query: string,
    topK: number,
  ) => { id: string; score: number }[];
  getVectorsByIds?: (ids: string[]) => Promise<Map<string, number[]>>;
}

export async function retrieve(
  question: string,
  notebookId: string,
  deps: RetrievalDeps,
  history: RagTurn[] = [],
): Promise<ScoredChunk[]> {
  // 1. Query rewriting (fallback câu gốc khi lỗi/rỗng) — chỉ đổi TRUY VẤN, không đổi chunk/locator.
  let q = question;
  if (deps.rewrite) {
    try {
      const rw = (await deps.rewrite(question, history)).trim();
      if (rw !== "") q = rw;
    } catch {
      /* lỗi rewrite → dùng câu gốc (FR-004) */
    }
  }

  // 2. Hai nhánh: vector (ngữ nghĩa) + BM25 (từ khoá).
  const vector = await deps.embed(q);
  const vHits = await deps.search(vector, notebookId, HYBRID_BRANCH_TOPK);
  // Lọc hit vector kém liên quan (013). BM25 không có distance → tin xếp hạng BM25 (giữ).
  const vRelevant = vHits.filter((h) => h.score <= RELEVANCE_MAX_DISTANCE);
  const vScore = new Map(vRelevant.map((h) => [h.id, h.score]));

  let kHits: { id: string; score: number }[] = [];
  if (deps.searchBm25) {
    try {
      kHits = deps.searchBm25(notebookId, q, HYBRID_BRANCH_TOPK);
    } catch {
      kHits = []; // FTS lỗi → vector-only (FR-008)
    }
  }

  // 3. Hợp nhất RRF theo rank hai nhánh.
  const fused = reciprocalRankFusion([
    vRelevant.map((h) => h.id),
    kHits.map((h) => h.id),
  ]);
  if (fused.length === 0) return []; // → grounded "không tìm thấy" (013 giữ nguyên)

  // 4. MMR đa dạng hoá (cần vector chunk; thiếu vector → giữ theo RRF order).
  let order = fused;
  if (deps.getVectorsByIds) {
    const vecMap = await deps.getVectorsByIds(fused);
    order = mmrSelect(
      fused.map((id) => ({ id, vector: vecMap.get(id) })),
      vector,
      RETRIEVAL_TOP_K,
    );
  } else {
    order = fused.slice(0, RETRIEVAL_TOP_K);
  }

  // 5. Lấy chunk (GIỮ locator) → ScoredChunk theo thứ tự MMR.
  const chunks = deps.getChunksByIds(order);
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const scored: ScoredChunk[] = [];
  for (const id of order) {
    const chunk = byId.get(id);
    if (!chunk) continue; // chunk đã bị xoá giữa chừng → bỏ
    scored.push({
      chunk,
      sourceTitle: deps.sourceTitle(chunk.sourceId),
      score: vScore.get(id) ?? RELEVANCE_MAX_DISTANCE, // bm25-only: không có distance
    });
  }
  return scored;
}
