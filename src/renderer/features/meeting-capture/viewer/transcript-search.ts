import { foldWithIndex, foldVietnamese } from "@shared/text/fold";

// 186 PR C2 (R18) — tìm trong transcript của trình xem cuộc họp. Bỏ dấu + không phân biệt hoa thường như FTS (đ ↔ d); so khớp
// theo nghĩa đen (không regex); không chồng lấn. Trả vị trí trên văn bản GỐC (kể cả dấu tổ hợp theo sau) để tô sáng. THUẦN.

export interface TextMatch {
  start: number;
  end: number;
}

const COMBINING = /\p{M}/u;

export function searchTranscript(text: string, query: string): TextMatch[] {
  const q = foldVietnamese(query.trim().replace(/\s+/g, " "));
  if (q === "") return [];
  const { folded, starts, ends } = foldWithIndex(text);
  const out: TextMatch[] = [];
  let from = 0;
  for (;;) {
    const i = folded.indexOf(q, from);
    if (i < 0) break;
    const start = starts[i] ?? 0;
    let end = ends[i + q.length - 1] ?? start;
    while (end < text.length && COMBINING.test(text[end] ?? "")) end++;
    out.push({ start, end });
    from = i + q.length;
  }
  return out;
}
