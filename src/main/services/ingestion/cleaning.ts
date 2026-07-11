// Làm sạch văn bản đã parse trước khi chunk (FR-005). Hàm thuần — unit-test được.
// Chuẩn hoá xuống dòng, gộp khoảng trắng thừa, cắt trailing space; kết quả là văn bản CHÍNH TẮC mà
// chunker tính offset locator lên đó (Constitution II — locator tính đúng trên văn bản này).

/** Chuẩn hoá văn bản: CRLF→LF, gộp space/tab, bỏ trailing space mỗi dòng, gộp ≥3 dòng trống → 2. */
export function cleanText(input: string): string {
  const normalized = input
    .replace(/\r\n?/g, "\n") // CRLF / CR → LF
    .replace(/[ \t ]+/g, " ") // gộp space/tab/nbsp
    .replace(/ *\n/g, "\n") // bỏ khoảng trắng cuối dòng
    .replace(/\n{3,}/g, "\n\n"); // ≥3 dòng trống → 1 dòng trống
  return normalized.trim();
}
