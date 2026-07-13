// Phiên bản model embedding (059). Đổi model làm vector cũ (768d Ollama) không tương thích (khác chiều +
// không gian ngữ nghĩa) → lưu định danh này gắn với dữ liệu vector để phát hiện lệch → kích hoạt tái lập
// chỉ mục (reindex). Bump khi TOÀN BỘ reindex xong (research R4).

// Định danh = tên model + số chiều. Đổi model/dim ở tương lai → đổi hằng này → tự động reindex.
export const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";
export const EMBEDDING_DIM = 384;
export const EMBEDDING_MODEL_VERSION = "e5-small-384";
// Marker "đang tái lập chỉ mục": ghi khi BẮT ĐẦU reindex (sau khi drop bảng cũ). Dùng để, nếu tắt app
// giữa chừng, lần mở sau biết bảng LanceDB đã ở dim mới (KHÔNG drop lại) và tiếp tục phần dở.
export const EMBEDDING_VERSION_REINDEXING = "e5-small-384-reindexing";

/** So khớp version đã lưu với version hiện tại (đã reindex xong). undefined/khác → cần tái lập chỉ mục. */
export function matchesVersion(stored: string | undefined | null): boolean {
  return stored === EMBEDDING_MODEL_VERSION;
}

export type ReindexPhase = "done" | "resume" | "fresh";

/**
 * Xác định pha reindex từ version đã lưu:
 * - `done`   : đã ở version hiện tại → không cần reindex.
 * - `resume` : đang dở (marker) → tiếp tục, KHÔNG drop bảng (đã ở dim mới).
 * - `fresh`  : version cũ/thiếu → drop bảng cũ (dim cũ) rồi nhúng lại từ đầu.
 */
export function reindexPhase(stored: string | undefined | null): ReindexPhase {
  if (stored === EMBEDDING_MODEL_VERSION) return "done";
  if (stored === EMBEDDING_VERSION_REINDEXING) return "resume";
  return "fresh";
}
