import type { VectorStore } from "../ingestion/vector-store";

// 116 (contracts C2, research R8): bọc VectorStore để đếm thao tác ghi cho bộ lên lịch bảo trì — mọi điểm ghi
// (nạp/xử lý lại/xoá nguồn/xoá notebook/reindex) đi qua đây nên không phải gọi tay ở từng nơi.

/** Trả VectorStore MỚI (không sửa `store`); mỗi lần ghi thành công gọi `onWrite()`. Lỗi của onWrite bị nuốt. */
export function trackVectorWrites(
  store: VectorStore,
  onWrite: () => void,
): VectorStore {
  const wrote = (): void => {
    try {
      onWrite();
    } catch {
      // Đếm ghi chỉ phục vụ lên lịch — không bao giờ làm hỏng thao tác ghi của người dùng.
    }
  };

  return {
    async add(records) {
      await store.add(records);
      if (records.length > 0) wrote();
    },
    async deleteBySource(sourceId) {
      await store.deleteBySource(sourceId);
      wrote();
    },
    async deleteByIds(ids) {
      await store.deleteByIds(ids);
      if (ids.length > 0) wrote();
    },
    async deleteByNotebook(notebookId) {
      await store.deleteByNotebook(notebookId);
      wrote();
    },
    async dropTable() {
      await store.dropTable();
      wrote();
    },
    countBySource: (sourceId) => store.countBySource(sourceId),
    countByNotebook: (notebookId) => store.countByNotebook(notebookId),
    search: (queryVector, notebookId, topK) =>
      store.search(queryVector, notebookId, topK),
    getVectorsByIds: (ids) => store.getVectorsByIds(ids),
    stats: (retentionMs) => store.stats(retentionMs),
    optimize: (retentionMs) => store.optimize(retentionMs),
    activeOperations: () => store.activeOperations(),
    close: () => store.close(),
  };
}
