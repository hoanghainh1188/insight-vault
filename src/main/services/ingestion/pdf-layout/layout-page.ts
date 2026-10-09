import { logEvent } from "../../../logging";
import { cleanText } from "../cleaning";
import { orderRegions } from "./columns";
import { buildLines } from "./lines";
import {
  buildLexicon,
  endsWithHyphenBreak,
  mergeLexicons,
  type Lexicon,
} from "./hyphen";
import { joinParagraphs, lineText } from "./paragraphs";
import { detectTables, renderTable } from "./tables";
import {
  MAX_LAYOUT_ITEMS_PER_PAGE,
  type LayoutItem,
  type LayoutResult,
  type PageGeometry,
  type TextBlock,
} from "./types";

// 112 (contracts/pdf-layout.md): dựng văn bản một trang PDF từ item — dòng → vùng (cột) → đoạn (+ bảng ở US2).
// Kết quả ở dạng cố định của cleanText (cleanText(text) === text) để locator tính trên văn bản chính tắc không lệch.
// Trang quá nhiều item hoặc lỗi bất kỳ ⇒ dùng cách nối cũ cho riêng trang đó (FR-007). Hàm thuần.

const PART_SEP = "\n\n";

/** Cách trích trước 112: nối mọi mẩu chữ bằng dấu cách. */
export function legacyJoin(items: readonly LayoutItem[]): string {
  return items.map((i) => i.text).join(" ");
}

export interface LayoutOptions {
  /** 147 (a): bằng chứng gạch nối từ phần còn lại của tài liệu (trang hiện tại tự góp thêm bằng chứng của chính nó) */
  lexicon?: Lexicon;
  /** 147 (a): nhận văn bản các dòng của trang (theo thứ tự dòng) — để dựng bằng chứng cả tài liệu mà không giữ item */
  onLines?: (lines: readonly string[]) => void;
}

interface Part {
  text: string;
  table: boolean;
}

function assemble(parts: Part[]): { text: string; blocks: TextBlock[] } {
  let text = "";
  const blocks: TextBlock[] = [];
  for (const p of parts) {
    if (p.text === "") continue;
    if (text !== "") text += PART_SEP;
    if (p.table)
      blocks.push({ start: text.length, end: text.length + p.text.length });
    text += p.text;
  }
  return { text, blocks };
}

/** Bằng chứng cho trang: tài liệu + chính trang (chỉ dựng khi trang có ngắt dòng bằng gạch). Lỗi ⇒ chỉ dùng bằng chứng tài liệu. */
function pageLexicon(
  texts: readonly string[],
  doc: Lexicon | undefined,
): Lexicon | undefined {
  if (!texts.some(endsWithHyphenBreak)) return doc;
  try {
    const own = buildLexicon(texts);
    return doc ? mergeLexicons(doc, own) : own;
  } catch (e) {
    logEvent("pdf.layout.fallback", {
      feature: "hyphen",
      errorType: e instanceof Error ? e.constructor.name : typeof e,
    });
    return doc;
  }
}

function layout(
  items: readonly LayoutItem[],
  page: PageGeometry,
  opts: LayoutOptions,
): LayoutResult {
  const { lines, rotated } = buildLines(items);
  const texts = lines.map(lineText);
  opts.onLines?.(texts);
  const lexicon = pageLexicon(texts, opts.lexicon);
  const parts: Part[] = orderRegions(lines, page).flatMap((region) =>
    detectTables(region, page, lexicon).map((p) =>
      p.kind === "table"
        ? { text: renderTable(p.rows), table: true }
        : { text: cleanText(joinParagraphs(p.lines, lexicon)), table: false },
    ),
  );
  if (rotated.length > 0) {
    parts.push({ text: cleanText(legacyJoin(rotated)), table: false });
  }
  return { ...assemble(parts), fallback: false };
}

export function layoutPage(
  items: readonly LayoutItem[],
  page: PageGeometry,
  opts: LayoutOptions = {},
): LayoutResult {
  if (items.length > MAX_LAYOUT_ITEMS_PER_PAGE) {
    return { text: legacyJoin(items), blocks: [], fallback: true };
  }
  try {
    return layout(items, page, opts);
  } catch {
    return { text: legacyJoin(items), blocks: [], fallback: true };
  }
}
