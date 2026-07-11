import type { ParseResult } from "./index";

// Parse txt/md: nội dung là văn bản thô (đọc file ở pipeline qua node:fs). Hàm thuần — unit-test được.
export function parseText(content: string): ParseResult {
  return { pageCount: null, pages: [{ page: null, text: content }] };
}
