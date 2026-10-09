import { joinAcrossLines, type Lexicon } from "./hyphen";
import { PARAGRAPH_GAP_RATIO, type Line } from "./types";

// 112 (FR-002, research R4): ghép dòng của một vùng thành đoạn — cùng đoạn nối bằng dấu cách, khoảng dọc lớn ⇒
// đoạn mới; nối từ bị ngắt bằng gạch nối cuối dòng (147 a: quyết định ở hyphen.ts). Không nhận diện heading. Hàm thuần.

export const lineText = (l: Line): string =>
  l.segments.map((s) => s.text).join(" ");

/** Nối dòng `next` vào cuối `acc` (cùng đoạn) — gạch nối cuối dòng theo quyết định 147 (a), còn lại dấu cách. */
function appendLine(acc: string, next: string, lexicon?: Lexicon): string {
  return joinAcrossLines(acc, next, lexicon)?.text ?? `${acc} ${next}`;
}

export function joinParagraphs(
  region: readonly Line[],
  lexicon?: Lexicon,
): string {
  const paras: string[] = [];
  let prev: Line | null = null;
  for (const l of region) {
    const text = lineText(l);
    if (prev && l.y - prev.y <= PARAGRAPH_GAP_RATIO * prev.h) {
      paras[paras.length - 1] = appendLine(
        paras[paras.length - 1],
        text,
        lexicon,
      );
    } else {
      paras.push(text);
    }
    prev = l;
  }
  return paras.join("\n\n");
}
