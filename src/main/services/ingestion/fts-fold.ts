// Fold tiếng Việt cho FTS5 keyword (055). THUẦN — unit-test kỹ (crux). Tokenizer unicode61 chỉ bỏ dấu
// thanh (NFD combining marks) NHƯNG KHÔNG xử lý "đ"→"d" (đ là ký tự Latin riêng). Fold ở JS để khớp
// có/không dấu KỂ CẢ đ. Lưu bản fold vào chunk_fts; query cũng fold.

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
 * Chuỗi MATCH FTS5 an toàn từ câu truy vấn: fold → tách token (chữ+số Unicode) → mỗi token bọc trong nháy
 * kép (string literal FTS5, vô hiệu toán tử AND OR NEAR và ký tự đặc biệt) escape nháy → nối bằng OR
 * (lenient). Rỗng (không token) → "" (caller bỏ nhánh BM25).
 */
export function buildFtsMatch(query: string): string {
  const folded = foldVietnamese(query);
  const tokens = folded.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");
}
