import type { Widen } from "../translate";

// 123 — khoá dịch domain "search" (tìm toàn văn trong nội dung nguồn — 073).
// vi nguồn as const; en phải cùng cấu trúc + placeholder.

export const searchVi = {
  content: {
    placeholder: "Tìm trong nội dung nguồn…",
    label: "Tìm trong nội dung nguồn",
    searching: "Đang tìm…",
    error: "Không tìm được lúc này. Thử lại.",
    empty: "Không có kết quả.",
  },
} as const;

export const searchEn: Widen<typeof searchVi> = {
  content: {
    placeholder: "Search source content…",
    label: "Search source content",
    searching: "Searching…",
    error: "Search isn't available right now. Try again.",
    empty: "No results.",
  },
};
