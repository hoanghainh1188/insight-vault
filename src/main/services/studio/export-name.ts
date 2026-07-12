// Làm sạch tên tệp gợi ý cho Export (025) — THUẦN (không phụ thuộc electron → unit-test được).
// Bỏ ký tự cấm, gộp khoảng trắng, cắt dài, rỗng → mặc định.

const FORBIDDEN = /[/\\:*?"<>|]/g;
const MAX_NAME = 80;

export function sanitizeName(name: string): string {
  const cleaned = name
    .replace(FORBIDDEN, " ")
    .replace(/\.{2,}/g, ".") // chặn chuỗi ".." (phòng thủ traversal qua tên gợi ý)
    .replace(/\s+/g, " ")
    .trim();
  const cut = cleaned.slice(0, MAX_NAME).trim();
  return cut === "" ? "studio" : cut;
}
