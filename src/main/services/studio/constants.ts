// Hằng số Studio (ADR 2026-07-11-studio-context-strategy). Một nơi duy nhất — dễ tinh chỉnh.

// Ngân sách ký tự MẶC ĐỊNH ghép ngữ cảnh tổng hợp toàn notebook — dùng khi KHÔNG đọc được cửa sổ ngữ cảnh của
// model. 105 (ADR studio-large-clarify): ngân sách thật tính theo cửa sổ model (context-window.ts) + num_ctx tường
// minh; vượt thì map-reduce với [n] toàn cục (map-reduce.ts) — chip vẫn trỏ đúng đoạn.
export const STUDIO_CONTEXT_BUDGET = 16000;

// 4 loại tổng hợp (khác nhau ở system prompt, chung kiến trúc).
export const STUDIO_KINDS = ["summary", "keyPoints", "faq", "outline"] as const;

// 178: mọi giá trị `kind` DB chấp nhận (khớp CHECK của migration v11) — mở sẵn cho 4 loại mới + yêu cầu tuỳ chỉnh để
// không cần migration thứ hai; loại hiển thị/sinh được vẫn là STUDIO_KINDS.
export const STUDIO_ALL_KINDS = [
  "summary",
  "keyPoints",
  "faq",
  "outline",
  "studyGuide",
  "briefing",
  "timeline",
  "keyTerms",
  "custom",
] as const;

// 178 (ADR studio-enhance-2-clarify #1): giữ tối đa 10 phiên bản mỗi (notebook, kind); lưu bản thứ 11 ⇒ xoá bản cũ nhất.
export const STUDIO_MAX_VERSIONS = 10;
