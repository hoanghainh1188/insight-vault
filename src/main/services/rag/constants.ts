// Hằng số RAG (ADR 2026-07-11-rag-retrieval-strategy). Một nơi duy nhất — dễ tinh chỉnh.

export const RETRIEVAL_TOP_K = 6; // số chunk truy hồi/câu hỏi
// Ngưỡng loại hit kém liên quan theo COSINE distance (0..2; 0 = trùng hướng, 1 = trực giao). 0.75 ⇔
// cosine similarity ≥ 0.25 — đủ lỏng để nội dung thật lọt (issue #15: L2 sai với vector chưa chuẩn hoá);
// tính "không bịa" dựa thêm grounded prompt + ép notFound khi 0 citation hợp lệ.
export const RELEVANCE_MAX_DISTANCE = 0.75;
export const CONTEXT_CHAR_BUDGET = 6000; // ngân sách ký tự ghép context
export const MAX_QUESTION_LEN = 2000; // giới hạn độ dài CÂU HỎI (input người dùng)
// Giới hạn độ dài NỘI DUNG mỗi lượt LỊCH SỬ — rộng hơn nhiều vì câu trả lời AI (đặc biệt Studio/markdown)
// dài hơn câu hỏi. Trước đây dùng nhầm MAX_QUESTION_LEN → câu trả lời cũ >2000 làm hỏng lượt multi-turn.
export const MAX_HISTORY_CONTENT_LEN = 20000;
export const MAX_HISTORY_TURNS = 6; // số lượt hội thoại gần nhất gửi cho chat

export const NOT_FOUND_ANSWER = "Không tìm thấy trong nguồn.";

// 055 hybrid: hợp nhất vector + BM25 + đa dạng hoá.
export const RRF_K = 60; // hằng Reciprocal Rank Fusion: điểm = Σ 1/(k+rank)
export const MMR_LAMBDA = 0.7; // cân bằng liên quan (λ) ↔ đa dạng (1−λ)
export const HYBRID_BRANCH_TOPK = 10; // top-K lấy từ MỖI nhánh (vector, bm25) trước khi hợp nhất
