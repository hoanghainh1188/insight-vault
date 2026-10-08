// #129: model hay viết trích dẫn gộp "[1, 2]", "[1;2]", "[2-4]" / "[2–4]". Hậu kiểm (main) và chip (renderer) chỉ hiểu
// [n] đơn ⇒ tách nhóm thành "[1] [2]" trước. Hàm THUẦN, dùng chung main + renderer. Nhóm không rõ ràng (khoảng ngược,
// khoảng > MAX_RANGE, số > 6 chữ số) giữ nguyên văn bản — không đoán.

const MAX_DIGITS = 6;
const MAX_RANGE = 20;
const GROUP_RE =
  /\[(\d{1,6}(?:\s*[,;]\s*\d{1,6})+|\d{1,6}\s*[-–]\s*\d{1,6})\]/g;

function numbersOf(group: string): number[] | null {
  const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(group);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (to <= from || to - from > MAX_RANGE) return null;
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
  const parts = group.split(/[,;]/).map((p) => p.trim());
  if (parts.some((p) => p.length === 0 || p.length > MAX_DIGITS)) return null;
  return parts.map(Number);
}

/** "[1, 2]" ⇒ "[1] [2]"; "[2-4]" ⇒ "[2] [3] [4]"; số trùng trong nhóm bỏ bớt; nhóm không hợp lệ giữ nguyên. */
export function expandGroupedCitations(text: string): string {
  return text.replace(GROUP_RE, (whole, group: string) => {
    const ns = numbersOf(group);
    if (!ns) return whole;
    return [...new Set(ns)].map((n) => `[${n}]`).join(" ");
  });
}
