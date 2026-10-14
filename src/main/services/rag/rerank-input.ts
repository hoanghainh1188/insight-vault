// 187 PR 2: trình bày lại đoạn bảng CHỈ cho chuỗi gửi bộ chấm độ liên quan (cross-encoder) — hàm THUẦN, tất định.
// chunk / locator / chip [n] / văn bản hiển thị KHÔNG đổi (Constitution II). Contract: specs/20261012-120856-reranker-near-topic/
// contracts/rerank-input.md.

const isTableLine = (l: string): boolean => l.trimStart().startsWith("|");
const isSeparator = (l: string): boolean => /^\s*\|[\s:|-]*-[\s:|-]*$/.test(l);

/** Từ so khớp: NFC, chữ thường, dấu câu / ký hiệu thành khoảng trắng; bỏ trùng. */
function tokens(s: string): Set<string> {
  return new Set(
    s
      .normalize("NFC")
      .toLowerCase()
      .replace(/[\p{P}\p{S}]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

/** Cắt không làm đôi cặp thay thế (surrogate pair). */
function cut(s: string, max: number): string {
  if (max <= 0) return "";
  if (s.length <= max) return s;
  const end = s.charCodeAt(max - 1);
  const safe = end >= 0xd800 && end <= 0xdbff ? max - 1 : max;
  return s.slice(0, safe);
}

/**
 * - Không có dòng bảng, hoặc đã vừa `budgetChars` ⇒ nguyên văn.
 * - Có bảng và quá ngân sách ⇒ [văn bản ngoài bảng (cắt nếu cần)] + dòng tiêu đề + dòng phân cách + các dòng trùng từ với câu hỏi
 *   (nhiều từ trùng trước, hoà ⇒ thứ tự gốc; dòng quá dài bị cắt) + các dòng còn lại theo thứ tự gốc, tới khi chạm ngân sách.
 * Kết quả luôn ≤ `budgetChars` khi đã trình bày lại.
 */
export function rerankInput(
  chunkText: string,
  query: string,
  budgetChars: number,
): string {
  const lines = chunkText.split("\n");
  const table = lines.filter(isTableLine);
  if (table.length === 0 || chunkText.length <= budgetChars) return chunkText;

  const prose = lines
    .filter((l) => !isTableLine(l))
    .join("\n")
    .trim();
  const [header, ...afterHeader] = table;
  const hasSep = afterHeader.length > 0 && isSeparator(afterHeader[0]);
  const head = hasSep ? [header, afterHeader[0]] : [header];
  const body = hasSep ? afterHeader.slice(1) : afterHeader;

  const q = tokens(query);
  const scored = body.map((line, pos) => {
    let hits = 0;
    for (const t of tokens(line)) if (q.has(t)) hits += 1;
    return { line, pos, hits };
  });
  const matched = scored
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.pos - b.pos);
  const rest = scored.filter((r) => r.hits === 0);

  // Lõi bảng (tiêu đề + phân cách + dòng trùng từ) có ưu tiên cao nhất; văn bản ngoài bảng lấy phần còn lại; dòng khác lấp chỗ trống.
  const core: string[] = [];
  let used = 0;
  const take = (line: string, truncate: boolean): boolean => {
    const cost = line.length + (core.length > 0 ? 1 : 0);
    if (used + cost <= budgetChars) {
      core.push(line);
      used += cost;
      return true;
    }
    const room = budgetChars - used - (core.length > 0 ? 1 : 0);
    if (truncate && room > 0) {
      core.push(cut(line, room));
      used = budgetChars;
    }
    return false;
  };
  for (const l of head) take(l, true);
  for (const r of matched) {
    if (used >= budgetChars) break;
    take(r.line, true);
  }

  const gap = 2; // "\n\n" giữa văn bản ngoài bảng và bảng
  const proseRoom = Math.max(0, budgetChars - used - gap);
  const proseOut = proseRoom > 0 ? cut(prose, proseRoom).trim() : "";
  if (proseOut) used += proseOut.length + gap;
  const tail: string[] = [];
  for (const r of rest) {
    const cost = r.line.length + 1;
    if (used + cost > budgetChars) break;
    tail.push(r.line);
    used += cost;
  }

  const tableText = [...core, ...tail].join("\n");
  const out = proseOut ? `${proseOut}\n\n${tableText}` : tableText;
  return cut(out, budgetChars);
}
