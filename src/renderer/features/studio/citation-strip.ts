// 178 (PR 4, FR-043, clarify #5): chữ TẠM khi stream lượt viết cuối — chưa hậu kiểm nên KHÔNG hiện chip hay số [n] thô.
// Hàm THUẦN: gỡ `[n]`, `[n, m]`, `[n-m]`, chuỗi liền `[12][3]` (kèm khoảng trắng ngay trước ⇒ không dư khoảng trắng trước dấu
// câu) và mẩu `[` / `[12` / `[1, ` chưa đóng ở CUỐI buffer (token tới dở). Ngoặc không phải số (`[abc]`, `[ ]`, link) giữ nguyên.
// Khi xong, chữ tạm được thay toàn bộ bằng bản đã hậu kiểm (có chip).
// Security M1: chạy lại mỗi token trên cả buffer ⇒ phải TUYẾN TÍNH. Regex không có tiền tố `[ \t]*` (từng gây backtracking bậc
// hai trên chuỗi dài toàn khoảng trắng); khoảng trắng trước chip gỡ bằng vòng lặp.

const MARKERS = /(?:\[\s*\d+(?:\s*[-–,]\s*\d+)*\s*\])+/g;
const OPEN_TAIL = /^\[[\d\s,\-–]*$/;

/** Bỏ dấu cách / tab ở cuối (tuyến tính). */
function trimSpaceTabEnd(s: string): string {
  let end = s.length;
  while (end > 0 && (s[end - 1] === " " || s[end - 1] === "\t")) end -= 1;
  return end === s.length ? s : s.slice(0, end);
}

export function stripCitationMarkers(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(MARKERS)) {
    out = trimSpaceTabEnd(out + text.slice(last, m.index));
    last = m.index + m[0].length;
  }
  out += text.slice(last);
  // Mẩu chip chưa đóng ở cuối: chỉ xét từ '[' CUỐI CÙNG.
  const open = out.lastIndexOf("[");
  if (open >= 0 && OPEN_TAIL.test(out.slice(open))) {
    out = trimSpaceTabEnd(out.slice(0, open));
  }
  return out;
}
