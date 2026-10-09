import { logEvent } from "../../../logging";
import type { ParseResult } from "./index";
import type { PageText } from "../chunker";
import {
  addLines,
  createLexicon,
  endsWithHyphenBreak,
  type MutableLexicon,
} from "../pdf-layout/hyphen";
import { layoutPage, legacyJoin } from "../pdf-layout/layout-page";
import type { LayoutItem, PageGeometry } from "../pdf-layout/types";

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

/** Nhân ma trận affine [a b c d e f] kiểu pdf.js (m1 ∘ m2: áp m2 trước, rồi m1). */
function multiply(m1: readonly number[], m2: readonly number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * 147 (c, research R3): TextItem pdf.js → LayoutItem trong hệ HIỂN THỊ (gốc trên-trái, y xuống), `vp` = ma trận viewport của pdf.js
 * (đã gồm `/Rotate` thừa kế + gốc MediaBox/CropBox). Chữ xoay = hướng hiển thị lệch đáng kể khỏi ngang, hoặc lộn ngược (180° —
 * clarify #13: best-effort, nối cuối trang như 112).
 */
export function toDisplayItem(
  it: PdfTextItem,
  vp: readonly number[],
): LayoutItem {
  const [a, b, c, d, e, f] = multiply(vp, it.transform);
  const scale = Math.hypot(a, b);
  return {
    text: it.str,
    x: e,
    y: f,
    w: it.width,
    h: it.height > 0 ? it.height : Math.hypot(c, d),
    rotated: scale > 0 && (Math.abs(b) / scale > ROTATION_MIN_SIN || a < 0),
  };
}

/** 112: TextItem pdf.js → LayoutItem (gốc trên-trái; `viewTop` = đỉnh trang theo page.view) — trang KHÔNG xoay. */
export function toLayoutItem(it: PdfTextItem, viewTop: number): LayoutItem {
  return toDisplayItem(it, [1, 0, 0, -1, 0, viewTop]);
}

/** 112 (hardening): tổng thời gian dựng bố cục tối đa cho một tài liệu; quá ⇒ các trang còn lại dùng cách nối cũ. */
export const LAYOUT_BUDGET_MS = 5000;

/**
 * 147 (a, clarify #17): số item tối đa được giữ lại để dựng lại các trang có ngắt dòng bằng gạch với bằng chứng của CẢ tài liệu.
 * Vượt ⇒ các trang sau chỉ dùng bằng chứng "trượt" (các trang đã gặp + chính trang) — một lượt, không giữ item.
 */
export const HYPHEN_RETAIN_MAX_ITEMS = 100_000;

interface RetainedPage {
  index: number;
  page: number;
  items: LayoutItem[];
  geometry: PageGeometry;
}

/** Thêm văn bản dòng của một trang vào bằng chứng tài liệu; lỗi ⇒ bỏ qua trang đó (hành vi cũ cho gạch nối), chỉ log mã. */
function addPageEvidence(doc: MutableLexicon, lines: readonly string[]): void {
  try {
    addLines(doc, lines);
  } catch (e) {
    logEvent("pdf.layout.fallback", {
      feature: "hyphen",
      errorType: e instanceof Error ? e.constructor.name : typeof e,
    });
  }
}

export async function parsePdf(
  bytes: Uint8Array,
  /** 112: tiến độ theo trang (0..1), gọi sau mỗi trang. */
  onProgress?: (frac: number) => void,
  opts: { layoutBudgetMs?: number; hyphenRetainMaxItems?: number } = {},
): Promise<ParseResult> {
  const budget = opts.layoutBudgetMs ?? LAYOUT_BUDGET_MS;
  const retainMax = opts.hyphenRetainMaxItems ?? HYPHEN_RETAIN_MAX_ITEMS;
  let spent = 0;
  // Import động: chỉ nạp pdfjs ở main khi thực sự parse PDF (không vào bundle renderer).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    useSystemFonts: false,
  }).promise;

  const pages: PageText[] = [];
  // Bằng chứng gạch nối của các trang đã gặp — một tập cộng dồn, tra O(1) (review 147 a).
  const evidence = createLexicon();
  const retained: RetainedPage[] = [];
  let retainedItems = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const [x0, y0, x1, y1] = page.view;
    // 147 (c): đưa toạ độ chữ về hệ HIỂN THỊ (áp /Rotate + gốc hộp trang) trước khi dựng bố cục. Lỗi ⇒ hệ chưa xoay như 112.
    let vp: number[] = [1, 0, 0, -1, -x0, y1];
    let geometry = { width: x1 - x0, height: y1 - y0 };
    try {
      const viewport = page.getViewport({ scale: 1 });
      vp = [...viewport.transform];
      geometry = { width: viewport.width, height: viewport.height };
    } catch {
      logEvent("pdf.layout.fallback", { feature: "rotate" });
    }
    const items = content.items.flatMap((it) =>
      "str" in it ? [toDisplayItem(it as PdfTextItem, vp)] : [],
    );
    // PDF bất thường (cố ý hay không) không được làm treo main process: hết ngân sách ⇒ cách nối cũ.
    const t0 = Date.now();
    let lines: readonly string[] = [];
    const { text, blocks } =
      spent < budget
        ? layoutPage(items, geometry, {
            lexicon: evidence,
            onLines: (ls) => {
              lines = ls;
            },
          })
        : { text: legacyJoin(items), blocks: [] };
    if (lines.length > 0) addPageEvidence(evidence, lines);
    // Trang có ngắt dòng bằng gạch ⇒ giữ item để dựng lại khi đã có bằng chứng của các trang SAU (trong giới hạn bộ nhớ).
    if (
      lines.some(endsWithHyphenBreak) &&
      retainedItems + items.length <= retainMax
    ) {
      retained.push({ index: pages.length, page: p, items, geometry });
      retainedItems += items.length;
    }
    spent += Date.now() - t0;
    pages.push(pageText(p, text, blocks));
    onProgress?.(p / doc.numPages);
  }
  const numPages = doc.numPages;
  await doc.cleanup();

  return {
    pageCount: numPages,
    pages: relayoutWithDocument(pages, retained, evidence, budget - spent),
  };
}

function pageText(
  page: number,
  text: string,
  blocks: PageText["blocks"] = [],
): PageText {
  return blocks && blocks.length > 0 ? { page, text, blocks } : { page, text };
}

/** 147 (a): dựng lại các trang có ngắt gạch với bằng chứng của cả tài liệu (hết ngân sách ⇒ giữ kết quả lượt đầu). */
function relayoutWithDocument(
  pages: readonly PageText[],
  retained: readonly RetainedPage[],
  lexicon: MutableLexicon,
  budgetLeftMs: number,
): PageText[] {
  if (retained.length === 0) return [...pages];
  const redone = new Map<number, PageText>();
  let spent = 0;
  for (const r of retained) {
    if (spent >= budgetLeftMs) break;
    const t0 = Date.now();
    const { text, blocks, fallback } = layoutPage(r.items, r.geometry, {
      lexicon,
    });
    spent += Date.now() - t0;
    // Dựng lại lỗi (rơi về cách nối cũ) ⇒ giữ kết quả lượt đầu (FR-012).
    if (!fallback) redone.set(r.index, pageText(r.page, text, blocks));
  }
  return pages.map((pg, i) => redone.get(i) ?? pg);
}
