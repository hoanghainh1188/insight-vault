import type { ParseResult } from "./index";
import type { PageText } from "../chunker";

// Parse PDF → text theo TỪNG TRANG (pdfjs-dist legacy build, research R1). Chạy ở main.
// Chỉ trích text (getTextContent) — không render canvas/worker. Giữ page cho locator (Constitution II).

export async function parsePdf(bytes: Uint8Array): Promise<ParseResult> {
  // Import động: chỉ nạp pdfjs ở main khi thực sự parse PDF (không vào bundle renderer).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    useSystemFonts: false,
  }).promise;

  const pages: PageText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ");
    pages.push({ page: p, text });
  }
  const numPages = doc.numPages;
  await doc.cleanup();

  return { pageCount: numPages, pages };
}
