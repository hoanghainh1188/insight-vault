import type { ParseResult } from "./index";
import type { PageText } from "../chunker";
import { layoutPage } from "../pdf-layout/layout-page";
import type { LayoutItem } from "../pdf-layout/types";

// Parse PDF → text theo TỪNG TRANG (pdfjs-dist legacy build, research R1). Chạy ở main.
// Chỉ trích text (getTextContent) — không render canvas/worker. Giữ page cho locator (Constitution II).
// 112: adapter MỎNG — chuyển item pdf.js sang LayoutItem (toạ độ gốc trên-trái) rồi dựng bố cục bằng hàm thuần
// layoutPage (dòng / cột / đoạn / bảng). Mọi logic bố cục nằm ở pdf-layout/ (có test riêng).

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

const EPS = 1e-6;

function toLayoutItem(it: PdfTextItem, viewTop: number): LayoutItem {
  const [, b, c, d, e, f] = it.transform;
  return {
    text: it.str,
    x: e,
    y: viewTop - f,
    w: it.width,
    h: it.height > 0 ? it.height : Math.hypot(c, d),
    rotated: Math.abs(b) > EPS || Math.abs(c) > EPS,
  };
}

export async function parsePdf(
  bytes: Uint8Array,
  /** 112: tiến độ theo trang (0..1), gọi sau mỗi trang. */
  onProgress?: (frac: number) => void,
): Promise<ParseResult> {
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
    const [x0, y0, x1, y1] = page.view;
    const items = content.items.flatMap((it) =>
      "str" in it ? [toLayoutItem(it as PdfTextItem, y1)] : [],
    );
    const { text } = layoutPage(items, { width: x1 - x0, height: y1 - y0 });
    pages.push({ page: p, text });
    onProgress?.(p / doc.numPages);
  }
  const numPages = doc.numPages;
  await doc.cleanup();

  return { pageCount: numPages, pages };
}
