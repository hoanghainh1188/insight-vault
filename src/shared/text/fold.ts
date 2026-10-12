// Fold tiếng Việt dùng chung main + renderer (FTS 055/073, tìm trong transcript 186). THUẦN.

/** NFD + bỏ dấu (combining 0300–036F, gồm horn ơ/ư) + đ→d + Đ→D + lowercase. */
export function foldVietnamese(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Fold kèm bản đồ vị trí: `starts[i]`/`ends[i]` = khoảng trên văn bản GỐC sinh ra ký tự fold thứ i (fold từng code point nên
 * độ dài có thể khác văn bản gốc — vd. dấu tổ hợp NFD biến mất). Dùng để tô sáng đúng chỗ trên văn bản gốc.
 */
export function foldWithIndex(text: string): {
  folded: string;
  starts: number[];
  ends: number[];
} {
  let folded = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = foldVietnamese(ch);
    for (let k = 0; k < f.length; k++) {
      starts.push(i);
      ends.push(i + ch.length);
    }
    folded += f;
    i += ch.length;
  }
  return { folded, starts, ends };
}
