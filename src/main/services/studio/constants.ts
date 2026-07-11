// Hằng số Studio (ADR 2026-07-11-studio-context-strategy). Một nơi duy nhất — dễ tinh chỉnh.

// Ngân sách ký tự ghép ngữ cảnh tổng hợp toàn notebook. Rộng hơn CONTEXT_CHAR_BUDGET (rag hỏi-đáp = 6000)
// vì Studio tóm lược cả tài liệu, nhưng vẫn dưới context window model local để tránh cắt cụt/oom.
export const STUDIO_CONTEXT_BUDGET = 8000;

// 4 loại tổng hợp (khác nhau ở system prompt, chung kiến trúc).
export const STUDIO_KINDS = ["summary", "keyPoints", "faq", "outline"] as const;
