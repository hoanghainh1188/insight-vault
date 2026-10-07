import { cleanText } from "../cleaning";
import { orderRegions } from "./columns";
import { buildLines } from "./lines";
import { joinParagraphs } from "./paragraphs";
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

function layout(
  items: readonly LayoutItem[],
  page: PageGeometry,
): LayoutResult {
  const { lines, rotated } = buildLines(items);
  const parts: Part[] = orderRegions(lines, page).map((region) => ({
    text: cleanText(joinParagraphs(region)),
    table: false,
  }));
  if (rotated.length > 0) {
    parts.push({ text: cleanText(legacyJoin(rotated)), table: false });
  }
  return { ...assemble(parts), fallback: false };
}

export function layoutPage(
  items: readonly LayoutItem[],
  page: PageGeometry,
): LayoutResult {
  if (items.length > MAX_LAYOUT_ITEMS_PER_PAGE) {
    return { text: legacyJoin(items), blocks: [], fallback: true };
  }
  try {
    return layout(items, page);
  } catch {
    return { text: legacyJoin(items), blocks: [], fallback: true };
  }
}
