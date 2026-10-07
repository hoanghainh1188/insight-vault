import type { ParseResult } from "./index";
import type { PageText } from "../chunker";
import { layoutPage, legacyJoin } from "../pdf-layout/layout-page";
import type { LayoutItem } from "../pdf-layout/types";

// Parse PDF → text theo TỪNG TRANG (pdfjs-dist legacy build, research R1). Chạy ở main.
// Chỉ trích text (getTextContent) — không render canvas/worker. Giữ page cho locator (Constitution II).
// 112: adapter MỎNG — chuyển item pdf.js sang LayoutItem (toạ độ gốc trên-trái) rồi dựng bố cục bằng hàm thuần
// layoutPage (dòng / cột / đoạn / bảng). Mọi logic bố cục nằm ở pdf-layout/ (có test riêng).

export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/** sin(góc) tối thiểu để coi là chữ XOAY (~17°): chữ nghiêng (shear, chỉ c ≠ 0) và lệch nhỏ vẫn là chữ thường. */
const ROTATION_MIN_SIN = 0.3;

/** 112: TextItem pdf.js → LayoutItem (gốc trên-trái; `viewTop` = đỉnh trang theo page.view). */
export function toLayoutItem(it: PdfTextItem, viewTop: number): LayoutItem {
  const [a, b, c, d, e, f] = it.transform;
  const scale = Math.hypot(a, b);
  return {
    text: it.str,
    x: e,
    y: viewTop - f,
    w: it.width,
    h: it.height > 0 ? it.height : Math.hypot(c, d),
    rotated: scale > 0 && Math.abs(b) / scale > ROTATION_MIN_SIN,
  };
}

/** 112 (hardening): tổng thời gian dựng bố cục tối đa cho một tài liệu; quá ⇒ các trang còn lại dùng cách nối cũ. */
export const LAYOUT_BUDGET_MS = 5000;

export async function parsePdf(
  bytes: Uint8Array,
  /** 112: tiến độ theo trang (0..1), gọi sau mỗi trang. */
  onProgress?: (frac: number) => void,
  opts: { layoutBudgetMs?: number } = {},
): Promise<ParseResult> {
  const budget = opts.layoutBudgetMs ?? LAYOUT_BUDGET_MS;
  let spent = 0;
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
    // PDF bất thường (cố ý hay không) không được làm treo main process: hết ngân sách ⇒ cách nối cũ.
    const t0 = Date.now();
    const { text, blocks } =
      spent < budget
        ? layoutPage(items, { width: x1 - x0, height: y1 - y0 })
        : { text: legacyJoin(items), blocks: [] };
    spent += Date.now() - t0;
    pages.push(
      blocks.length > 0 ? { page: p, text, blocks } : { page: p, text },
    );
    onProgress?.(p / doc.numPages);
  }
  const numPages = doc.numPages;
  await doc.cleanup();

  return { pageCount: numPages, pages };
}
