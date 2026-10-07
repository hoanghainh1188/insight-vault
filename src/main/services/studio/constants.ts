// Hằng số Studio (ADR 2026-07-11-studio-context-strategy). Một nơi duy nhất — dễ tinh chỉnh.

// Ngân sách ký tự MẶC ĐỊNH ghép ngữ cảnh tổng hợp toàn notebook — dùng khi KHÔNG đọc được cửa sổ ngữ cảnh của
// model. 105 (ADR studio-large-clarify): ngân sách thật tính theo cửa sổ model (context-window.ts) + num_ctx tường
// minh; vượt thì map-reduce với [n] toàn cục (map-reduce.ts) — chip vẫn trỏ đúng đoạn.
export const STUDIO_CONTEXT_BUDGET = 16000;

// 4 loại tổng hợp (khác nhau ở system prompt, chung kiến trúc).
export const STUDIO_KINDS = ["summary", "keyPoints", "faq", "outline"] as const;
