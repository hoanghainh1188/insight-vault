// Hằng số RAG (ADR 2026-07-11-rag-retrieval-strategy). Một nơi duy nhất — dễ tinh chỉnh.

export const RETRIEVAL_TOP_K = 6; // số chunk truy hồi/câu hỏi
export const RELEVANCE_MAX_DISTANCE = 1.0; // ngưỡng loại hit kém liên quan (tinh chỉnh theo model embedding)
export const CONTEXT_CHAR_BUDGET = 6000; // ngân sách ký tự ghép context
export const MAX_QUESTION_LEN = 2000; // giới hạn độ dài câu hỏi
export const MAX_HISTORY_TURNS = 6; // số lượt hội thoại gần nhất gửi cho chat

export const NOT_FOUND_ANSWER = "Không tìm thấy trong nguồn.";
