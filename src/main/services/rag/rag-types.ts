import type { Chunk } from "@shared/ipc/types";

// Type nội bộ main (không qua IPC). Nguồn: data-model.md.

/** Chunk trúng tuyển + điểm số + tiêu đề nguồn (từ retrieval, sắp theo score tăng dần). */
export interface ScoredChunk {
  chunk: Chunk;
  sourceTitle: string;
  score: number; // = _distance (nhỏ = liên quan hơn)
}

/** ScoredChunk đã được đánh số [n] để ghép context + hậu kiểm citation. */
export interface RetrievedChunk extends ScoredChunk {
  n: number; // 1-based
}

/** Kết quả build context: chuỗi context + bảng ánh xạ n → chunk (nguồn sự thật cho hậu kiểm). */
export interface BuiltContext {
  contextText: string;
  map: Map<number, RetrievedChunk>;
}
