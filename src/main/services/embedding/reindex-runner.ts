import type { VectorRecord } from "../ingestion/vector-store";
import { planReindexBatches } from "./reindex-plan";
import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL_VERSION,
  EMBEDDING_VERSION_REINDEXING,
  reindexPhase,
} from "./model-version";

// Job nền tái lập chỉ mục (059, US2). Đổi model embedding → vector cũ (768d) không tương thích → nhúng lại
// toàn bộ chunk (passage) với engine mới, ghi đè LanceDB. Idempotent + resume: chunk "đã xong" ⇔ đã có
// vector trong bảng mới (nguồn sự thật là chính LanceDB — research R4, KHÔNG state riêng). I/O — loại khỏi
// ngưỡng coverage (phần thuần ở reindex-plan / model-version). KHÔNG log nội dung chunk.

export interface ChunkRef {
  id: string;
  notebookId: string;
  sourceId: string;
}

export interface ReindexVectorStore {
  add(records: VectorRecord[]): Promise<void>;
  getVectorsByIds(ids: string[]): Promise<Map<string, number[]>>;
  dropTable(): Promise<void>;
}

export interface ReindexDeps {
  /** Mọi chunk id + notebook/source (nhẹ — không kèm text). */
  listAllChunkRefs(): ChunkRef[];
  /** Lấy text cho một lô id (source-repo.getChunksByIds). */
  getChunkTexts(ids: string[]): Map<string, string>;
  /** Nhúng passage in-process (Embedder.embed(_,"passage")). */
  embedPassage(texts: string[]): Promise<number[][]>;
  vectorStore: ReindexVectorStore;
  readVersion(): string | undefined | null;
  writeVersion(v: string): void;
  batchSize?: number;
  onProgress?(done: number, total: number): void;
}

const DEFAULT_BATCH = 32;

/** Có cần tái lập chỉ mục không (startup): version đã lưu khác version hiện tại. */
export function needsReindex(stored: string | undefined | null): boolean {
  return reindexPhase(stored) !== "done";
}

/**
 * Chạy tái lập chỉ mục. An toàn gọi lại (idempotent) + resume sau khi tắt app giữa chừng.
 * - `fresh`  : drop bảng cũ (dim 768) → ghi marker "reindexing" → nhúng lại từ đầu.
 * - `resume` : bảng đã ở dim mới → KHÔNG drop; bỏ qua chunk đã có vector, nhúng phần còn lại.
 * Bump version về `EMBEDDING_MODEL_VERSION` CHỈ khi toàn bộ xong.
 */
export async function runReindex(deps: ReindexDeps): Promise<void> {
  const phase = reindexPhase(deps.readVersion());
  if (phase === "done") return;

  const refs = deps.listAllChunkRefs();
  const total = refs.length;
  const metaById = new Map(refs.map((r) => [r.id, r]));

  if (phase === "fresh") {
    // Vector cũ (768d) vô nghĩa với e5 → drop sạch để tái tạo dim 384. Ghi marker NGAY để nếu tắt giữa
    // chừng, lần sau vào nhánh resume (không drop lại phần đã nhúng).
    await deps.vectorStore.dropTable();
    deps.writeVersion(EMBEDDING_VERSION_REINDEXING);
  }

  const batches = planReindexBatches(
    refs.map((r) => r.id),
    deps.batchSize ?? DEFAULT_BATCH,
  );

  let done = 0;
  for (const batch of batches) {
    // Resume/idempotent: chunk đã có vector trong bảng mới → bỏ qua.
    const existing = await deps.vectorStore.getVectorsByIds(batch);
    const todo = batch.filter((id) => !existing.has(id));
    if (todo.length > 0) {
      const texts = deps.getChunkTexts(todo);
      const ordered = todo.map((id) => texts.get(id) ?? "");
      const vectors = await deps.embedPassage(ordered);
      const records: VectorRecord[] = todo.map((id, i) => {
        const m = metaById.get(id);
        return {
          id,
          notebookId: m?.notebookId ?? "",
          sourceId: m?.sourceId ?? "",
          vector: vectors[i],
          dim: EMBEDDING_DIM,
        };
      });
      await deps.vectorStore.add(records);
    }
    done += batch.length;
    deps.onProgress?.(done, total);
  }

  // Toàn bộ xong → bump version (lần khởi động sau: phase "done", không chạy lại).
  deps.writeVersion(EMBEDDING_MODEL_VERSION);
}
