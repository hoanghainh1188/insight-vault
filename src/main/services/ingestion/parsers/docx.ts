import type { ParseResult } from "./index";

// Parse .docx → văn bản (mammoth extractRawText). Chạy ở main. 1 "trang" logic (page=null).

export async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const mammoth = (await import("mammoth")).default;
  const res = await mammoth.extractRawText({ buffer });
  return { pageCount: null, pages: [{ page: null, text: res.value }] };
}
