// 147 (b, research R5, clarify #2): nhận ô "trông như số" cho bảng số căn phải — cả kiểu Việt (`1.234,5`) lẫn Anh (`1,234.5`),
// số âm trong ngoặc, dấu ±, %, tiền tệ phổ biến; KHÔNG đoán locale. Hàm thuần.

/** chặn chuỗi dài (ô số thật luôn ngắn) — tránh tốn công với đoạn văn */
const MAX_NUMERIC_LENGTH = 32;

/** phần nghìn nhất quán (`1.234.567`, `1,234`, `1 234`) + phần thập phân tuỳ chọn, hoặc số trơn */
const NUMBER = String.raw`(?:\d{1,3}([.,\s])\d{3}(?:\1\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)`;
/** đơn vị tiền phía sau số (đồng viết `\u0111` hoặc `₫`) */
const UNIT = /(?:\u0111|₫|VND|USD|EUR)/u;
const NUMERIC = new RegExp(
  String.raw`^[−\-+]?(?:[$€£¥₫]\s?)?${NUMBER}\s?%?(?:\s?${UNIT.source})?$`,
  "u",
);
const DIGIT = /\d/;
const SEPARATOR = /[.,]/;

export function looksNumeric(s: string): boolean {
  let t = s.trim();
  if (t === "" || t.length > MAX_NUMERIC_LENGTH) return false;
  if (t.startsWith("(") && t.endsWith(")")) t = t.slice(1, -1).trim();
  if (/[()]/.test(t)) return false;
  return NUMERIC.test(t);
}

/** Vị trí ký tự của dấu thập phân; số nguyên ⇒ ngay sau chữ số cuối. */
function decimalIndex(t: string): number {
  const digits = [...t].flatMap((c, i) => (DIGIT.test(c) ? [i] : []));
  if (digits.length === 0) return t.length;
  const first = digits[0];
  const last = digits[digits.length - 1];
  const seps: number[] = [];
  for (let i = first + 1; i < last; i++) {
    if (SEPARATOR.test(t[i]) && DIGIT.test(t[i - 1]) && DIGIT.test(t[i + 1]))
      seps.push(i);
  }
  if (seps.length === 0) return last + 1;
  const sep = seps[seps.length - 1];
  const after = last - sep;
  const repeated = seps.some((i) => i < sep && t[i] === t[sep]);
  // `1.234.567` / `1,234,567` ⇒ phân cách nghìn; còn lại (kể cả `1,234` mơ hồ) ⇒ dấu thập phân.
  return after === 3 && repeated ? last + 1 : sep;
}

/** Điểm neo thập phân: mép trái dấu thập phân (= mép phải phần nguyên), nội suy theo tỉ lệ ký tự trên bề rộng segment. */
export function decimalAnchor(seg: {
  text: string;
  x: number;
  w: number;
}): number {
  const t = seg.text;
  if (t.length === 0) return seg.x;
  return seg.x + (seg.w * decimalIndex(t)) / t.length;
}
