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

/**
 * 072: gộp câu trả lời + danh sách nguồn thành markdown để Copy/Export (kiểm chứng được — kèm trang).
 * Hàm THUẦN. Không nguồn → chỉ nội dung. Có nguồn → thêm mục "Nguồn:" ngăn bằng đường kẻ.
 */
export function formatAnswerMarkdown(
  content: string,
  citations: Citation[],
): string {
  const body = content.trimEnd();
  if (citations.length === 0) return `${body}\n`;
  return `${body}\n\n---\n\nNguồn:\n${citationLabels(citations).join("\n")}\n`;
}
