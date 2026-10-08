import type { Widen } from "../translate";

// 123 — khoá dịch domain "studio" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const studioVi = {
  title: "Studio",
  hint: "Tạo nhanh bản tổng hợp từ nguồn của notebook.",
  blockModel: "Mô hình AI chưa sẵn sàng. Kiểm tra Cài đặt để chọn mô hình.",
  blockNoSources: "Nạp nguồn để tạo Studio.",
  scope: "Phạm vi",
  scopeAll: "Tất cả nguồn",
  creating: "Đang tạo…",
  regenerate: "Tạo lại",
  kind: {
    summary: "Tóm tắt tài liệu",
    keyPoints: "Ý chính",
    faq: "FAQ",
    outline: "Dàn ý",
  },
  localRetry: "Tạo bằng AI cục bộ",
  localRetryAria: "Tạo {kind} bằng AI cục bộ",
  retryAria: "Thử lại {kind}",
  localBadge: "AI cục bộ",
  localBadgeTitle:
    "Kết quả này được tạo bằng AI cục bộ (Ollama) vì AI online gặp lỗi.",
  parts: {
    one: "Tổng hợp từ {count} phần của tài liệu — mỗi trích dẫn [n] vẫn trỏ đúng đoạn nguồn.",
    other:
      "Tổng hợp từ {count} phần của tài liệu — mỗi trích dẫn [n] vẫn trỏ đúng đoạn nguồn.",
  },
  truncated:
    "Tài liệu quá dài nên phần cuối chưa được tổng hợp — hãy lọc theo từng nguồn để tổng hợp đầy đủ.",
  exportName: "{kind} — {date}",
} as const;

export const studioEn: Widen<typeof studioVi> = {
  title: "Studio",
  hint: "Quickly create summaries from this notebook's sources.",
  blockModel: "The AI model is not ready. Check Settings to choose a model.",
  blockNoSources: "Add sources to use Studio.",
  scope: "Scope",
  scopeAll: "All sources",
  creating: "Creating…",
  regenerate: "Regenerate",
  kind: {
    summary: "Document summary",
    keyPoints: "Key points",
    faq: "FAQ",
    outline: "Outline",
  },
  localRetry: "Create with local AI",
  localRetryAria: "Create {kind} with local AI",
  retryAria: "Retry {kind}",
  localBadge: "Local AI",
  localBadgeTitle:
    "This result was created with local AI (Ollama) because the online AI failed.",
  parts: {
    one: "Combined from {count} part of the document — each [n] citation still points to the right source passage.",
    other:
      "Combined from {count} parts of the document — each [n] citation still points to the right source passage.",
  },
  truncated:
    "The document is too long, so the last part wasn't summarized — filter by individual source for a complete summary.",
  exportName: "{kind} — {date}",
};
