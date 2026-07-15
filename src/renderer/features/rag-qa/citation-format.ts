import type { Citation } from "@shared/ipc/types";

// Định dạng hiển thị trích dẫn ở dòng "Nguồn:" (srcnote). Hàm thuần — unit-test được.

/** Hậu tố " · trang X" nếu có số trang, ngược lại "". Dùng chung cho citation + kết quả tìm (073). */
export function pageSuffix(page: number | null): string {
  return page != null ? ` · trang ${page}` : "";
}

/** Nhãn 1 trích dẫn: "[n] Tên nguồn · trang X" (bỏ phần trang nếu không có). */
export function formatCitationLabel(c: Citation): string {
  return `[${c.n}] ${c.sourceTitle}${pageSuffix(c.locator.page)}`;
}

/** Danh sách nhãn nguồn (dedup theo n, sắp tăng dần — citations vốn đã dedup/sort ở main). */
export function citationLabels(citations: Citation[]): string[] {
  return citations.map(formatCitationLabel);
}
