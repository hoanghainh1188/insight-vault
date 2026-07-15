import type {
  BuiltContext,
  RetrievedChunk,
  ScoredChunk,
} from "../rag/rag-types";
import { citationBlock } from "../rag/context-builder";

// Ghép context CHIA ĐỀU theo nguồn (021-studio, #65). Hàm THUẦN — test tất định.
//
// VẤN ĐỀ cũ: buildContext nhồi tuần tự từ đầu rồi bỏ phần đuôi → nguồn đứng trước/đủ dài chiếm hết
// ngân sách, các nguồn còn lại vắng mặt → bản tóm tắt thiên về 1 tài liệu. Ở đây interleave round-robin:
//
// - VÒNG 0 nhận chunk ĐẦU của MỌI nguồn VÔ ĐIỀU KIỆN (bỏ qua ngân sách) → BẢO ĐẢM mỗi nguồn góp ít nhất
//   1 đoạn, kể cả khi nguồn đầu có chunk quá khổ (đây là mục tiêu chính của #65; vòng 0 có thể vượt
//   `budget` một chút — chấp nhận được vì số nguồn/notebook nhỏ, đổi lại không nguồn nào bị bỏ trắng).
// - VÒNG ≥1 lấy chunk kế tiếp của từng nguồn, chỉ nhận khi CÒN ngân sách; bỏ NGUYÊN chunk vượt (KHÔNG
//   cắt giữa chunk → locator không lệch).
//
// Đánh số [n] theo thứ tự thêm; map n→chunk giữ locator (Constitution II — chip [n] kiểm chứng được).

/**
 * @param groups Mỗi phần tử là danh sách chunk của MỘT nguồn, theo thứ tự đọc (ordinal).
 * @param budget Ngân sách ký tự (áp cho vòng ≥1; vòng 0 luôn nhận chunk đầu mỗi nguồn).
 */
export function buildBalancedContext(
  groups: ScoredChunk[][],
  budget: number,
): BuiltContext {
  const map = new Map<number, RetrievedChunk>();
  const parts: string[] = [];
  let used = 0;
  let n = 0;

  const maxLen = groups.reduce((m, g) => Math.max(m, g.length), 0);
  for (let round = 0; round < maxLen; round += 1) {
    for (const group of groups) {
      if (round >= group.length) continue;
      const sc = group[round];
      const b = citationBlock(n + 1, sc);
      // Vòng 0: nhận chunk đầu của MỌI nguồn vô điều kiện (mỗi nguồn được đại diện).
      // Vòng ≥1: chỉ nhận nếu còn ngân sách.
      if (round > 0 && used + b.length + 2 > budget) continue;
      n += 1;
      map.set(n, { ...sc, n });
      parts.push(b);
      used += b.length + 2;
    }
  }

  return { contextText: parts.join("\n\n"), map };
}
