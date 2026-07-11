import type { Citation } from "@shared/ipc/types";

// Định dạng hiển thị trích dẫn ở dòng "Nguồn:" (srcnote). Hàm thuần — unit-test được.

/** Nhãn 1 trích dẫn: "[n] Tên nguồn · trang X" (bỏ phần trang nếu không có). */
export function formatCitationLabel(c: Citation): string {
  const page = c.locator.page != null ? ` · trang ${c.locator.page}` : "";
  return `[${c.n}] ${c.sourceTitle}${page}`;
}

/** Danh sách nhãn nguồn (dedup theo n, sắp tăng dần — citations vốn đã dedup/sort ở main). */
export function citationLabels(citations: Citation[]): string[] {
  return citations.map(formatCitationLabel);
}
