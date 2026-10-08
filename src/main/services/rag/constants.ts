// Hằng số RAG (ADR 2026-07-11-rag-retrieval-strategy). Một nơi duy nhất — dễ tinh chỉnh.

export const RETRIEVAL_TOP_K = 6; // số chunk truy hồi/câu hỏi
// Ngưỡng độ liên quan: xem relevance-calibration.ts (108 — hiệu chuẩn bằng bộ đánh giá, gắn phiên bản embedding).
export const CONTEXT_CHAR_BUDGET = 6000; // ngân sách ký tự ghép context
export const MAX_QUESTION_LEN = 2000; // giới hạn độ dài CÂU HỎI (input người dùng)
// Giới hạn độ dài NỘI DUNG mỗi lượt LỊCH SỬ — rộng hơn nhiều vì câu trả lời AI (đặc biệt Studio/markdown)
// dài hơn câu hỏi. Trước đây dùng nhầm MAX_QUESTION_LEN → câu trả lời cũ >2000 làm hỏng lượt multi-turn.
export const MAX_HISTORY_CONTENT_LEN = 20000;
export const MAX_HISTORY_TURNS = 6; // số lượt hội thoại gần nhất gửi cho chat

// 123 (FR-015): câu HIỂN THỊ "không tìm thấy" + gợi ý (108 FR-016) do GIAO DIỆN dịch theo cờ notFound (khoá
// chat.notFound/notFoundHint). Nội dung lưu cho lượt này là câu English trung tính — nó còn được gửi lại cho model làm
// lịch sử hội thoại, nên không phụ thuộc ngôn ngữ giao diện.
export const NOT_FOUND_CONTENT = "Not found in the sources.";
// 059: đang tái lập chỉ mục (đổi engine embedding) → cờ reindexing (giao diện dịch chat.reindexing); không lưu (FR-010).
export const REINDEXING_CONTENT =
  "Re-indexing sources. Please try again shortly.";

// 055 hybrid: hợp nhất vector + BM25 + đa dạng hoá.
export const RRF_K = 60; // hằng Reciprocal Rank Fusion: điểm = Σ 1/(k+rank)
export const MMR_LAMBDA = 0.7; // cân bằng liên quan (λ) ↔ đa dạng (1−λ)
export const HYBRID_BRANCH_TOPK = 10; // top-K lấy từ MỖI nhánh (vector, bm25) trước khi hợp nhất
