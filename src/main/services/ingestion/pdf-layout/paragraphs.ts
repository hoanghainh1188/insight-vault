import { PARAGRAPH_GAP_RATIO, type Line } from "./types";

// 112 (FR-002, research R4): ghép dòng của một vùng thành đoạn — cùng đoạn nối bằng dấu cách, khoảng dọc lớn ⇒
// đoạn mới; nối từ bị ngắt bằng gạch nối cuối dòng. Không nhận diện heading. Hàm thuần.

const HARD_HYPHEN = /(\p{L})-$/u;
const SOFT_HYPHEN = /­$/;
const STARTS_LOWER = /^\p{Ll}/u;

export const lineText = (l: Line): string =>
  l.segments.map((s) => s.text).join(" ");

/** Nối dòng `next` vào cuối `acc` (cùng đoạn). */
function appendLine(acc: string, next: string): string {
  if (SOFT_HYPHEN.test(acc)) return acc.slice(0, -1) + next;
  if (HARD_HYPHEN.test(acc)) {
    return STARTS_LOWER.test(next) ? acc.slice(0, -1) + next : acc + next;
  }
  return `${acc} ${next}`;
}

export function joinParagraphs(region: readonly Line[]): string {
  const paras: string[] = [];
  let prev: Line | null = null;
  for (const l of region) {
    const text = lineText(l);
    if (prev && l.y - prev.y <= PARAGRAPH_GAP_RATIO * prev.h) {
      paras[paras.length - 1] = appendLine(paras[paras.length - 1], text);
    } else {
      paras.push(text);
    }
    prev = l;
  }
  return paras.join("\n\n");
}
