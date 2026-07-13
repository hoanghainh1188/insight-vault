// Hằng số RAG (ADR 2026-07-11-rag-retrieval-strategy). Một nơi duy nhất — dễ tinh chỉnh.

export const RETRIEVAL_TOP_K = 6; // số chunk truy hồi/câu hỏi
// Ngưỡng loại hit kém liên quan theo COSINE distance (0..2; 0 = trùng hướng, 1 = trực giao).
// 059: đổi engine embedding sang e5-small in-process (vector CHUẨN HOÁ L2, cosine sim cao & nén hẹp —
// VERIFY: đoạn liên quan dist ~0.14, khác chủ đề ~0.20) → hạ ngưỡng 0.75→0.5 (giữ 0.75 sẽ nhận gần như
// mọi thứ, mất tác dụng "không tìm thấy"). Đây là ngưỡng THÔ — hybrid RRF/MMR + BM25 (055) mới lọc chính;
// cần tinh chỉnh thêm bằng dữ liệu thật (calibration, research R5). "Không bịa" còn dựa grounded prompt +
// ép notFound khi 0 citation hợp lệ.
export const RELEVANCE_MAX_DISTANCE = 0.5;
export const CONTEXT_CHAR_BUDGET = 6000; // ngân sách ký tự ghép context
export const MAX_QUESTION_LEN = 2000; // giới hạn độ dài CÂU HỎI (input người dùng)
// Giới hạn độ dài NỘI DUNG mỗi lượt LỊCH SỬ — rộng hơn nhiều vì câu trả lời AI (đặc biệt Studio/markdown)
// dài hơn câu hỏi. Trước đây dùng nhầm MAX_QUESTION_LEN → câu trả lời cũ >2000 làm hỏng lượt multi-turn.
export const MAX_HISTORY_CONTENT_LEN = 20000;
export const MAX_HISTORY_TURNS = 6; // số lượt hội thoại gần nhất gửi cho chat

export const NOT_FOUND_ANSWER = "Không tìm thấy trong nguồn.";
// 059: đang tái lập chỉ mục (đổi engine embedding) → trả thông báo thay vì kết quả sai/thiếu (FR-010).
export const REINDEXING_ANSWER =
  "Đang tái lập chỉ mục nguồn (cập nhật công cụ tìm kiếm cục bộ). Vui lòng thử lại sau giây lát.";

// 055 hybrid: hợp nhất vector + BM25 + đa dạng hoá.
export const RRF_K = 60; // hằng Reciprocal Rank Fusion: điểm = Σ 1/(k+rank)
export const MMR_LAMBDA = 0.7; // cân bằng liên quan (λ) ↔ đa dạng (1−λ)
export const HYBRID_BRANCH_TOPK = 10; // top-K lấy từ MỖI nhánh (vector, bm25) trước khi hợp nhất
