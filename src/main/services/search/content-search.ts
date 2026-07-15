import type { Chunk, ContentSearchHit } from "@shared/ipc/types";
import { makeSnippet } from "./snippet";

// Tìm toàn văn nội dung nguồn (073): BM25 (FTS5, 055) → lấy chunk (011) → dựng ContentSearchHit (Citation +
// snippet). DI thuần (không chạm electron/DB trực tiếp) → unit-test được. KHÔNG log câu hỏi/nội dung
// (Constitution III). Kết quả giữ locator gốc → bấm mở Source Viewer đúng vị trí (kiểm chứng được).

export const SEARCH_TOP_K = 20;

export interface ContentSearchDeps {
  searchBm25: (
    notebookId: string,
    query: string,
    topK: number,
  ) => { id: string; score: number }[];
  getChunksByIds: (ids: string[]) => Chunk[];
  getSourceTitle: (sourceId: string) => string;
}

export function createContentSearch(deps: ContentSearchDeps) {
  return {
    /** Tìm topK đoạn khớp keyword trong notebook. Query rỗng/không token → []. */
    search(notebookId: string, query: string): ContentSearchHit[] {
      if (typeof query !== "string" || query.trim() === "") return [];
      const hits = deps.searchBm25(notebookId, query, SEARCH_TOP_K);
      if (hits.length === 0) return [];
      // getChunksByIds giữ đúng thứ tự ids (theo score) + bỏ id không còn tồn tại.
      const chunks = deps.getChunksByIds(hits.map((h) => h.id));
      const titleCache = new Map<string, string>();
      return chunks.map((chunk, i) => {
        let title = titleCache.get(chunk.sourceId);
        if (title === undefined) {
          title = deps.getSourceTitle(chunk.sourceId);
          titleCache.set(chunk.sourceId, title);
        }
        return {
          n: i + 1,
          chunkId: chunk.id,
          sourceId: chunk.sourceId,
          sourceTitle: title,
          locator: chunk.locator,
          snippet: makeSnippet(chunk.text),
        };
      });
    },
  };
}

export type ContentSearch = ReturnType<typeof createContentSearch>;
