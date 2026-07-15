import type { BuiltContext, RetrievedChunk, ScoredChunk } from "./rag-types";
import { CONTEXT_CHAR_BUDGET } from "./constants";

// Ghép context từ các chunk trúng tuyển (ADR retrieval-strategy). Hàm THUẦN.
// Đánh số [1..k] theo thứ tự điểm số; ngân sách ~CONTEXT_CHAR_BUDGET ký tự — BỎ NGUYÊN chunk điểm thấp
// khi không đủ chỗ (KHÔNG cắt giữa chunk → locator không lệch). Luôn giữ ít nhất 1 chunk.

function pageLabel(page: number | null): string {
  return page == null ? "—" : String(page);
}

/** Khối đoạn nguồn đánh số `[n]` (định dạng chung cho buildContext + buildBalancedContext). Hàm THUẦN. */
export function citationBlock(n: number, sc: ScoredChunk): string {
  return `[${n}] (Nguồn: ${sc.sourceTitle}, trang ${pageLabel(sc.chunk.locator.page)})\n${sc.chunk.text}`;
}

/**
 * `scored` đã sắp theo score tăng dần (liên quan nhất trước).
 * `budget` mặc định `CONTEXT_CHAR_BUDGET` (rag hỏi-đáp). 021-studio truyền `STUDIO_CONTEXT_BUDGET` rộng hơn
 * để tổng hợp toàn notebook — additive, KHÔNG đổi hành vi caller cũ.
 */
export function buildContext(
  scored: ScoredChunk[],
  budget: number = CONTEXT_CHAR_BUDGET,
): BuiltContext {
  const map = new Map<number, RetrievedChunk>();
  const parts: string[] = [];
  let used = 0;
  let n = 0;

  for (const sc of scored) {
    const b = citationBlock(n + 1, sc);
    // Bỏ nguyên chunk nếu vượt ngân sách (nhưng luôn nhận chunk đầu tiên).
    if (n > 0 && used + b.length + 2 > budget) continue;
    n += 1;
    map.set(n, { ...sc, n });
    parts.push(b);
    used += b.length + 2;
  }

  return { contextText: parts.join("\n\n"), map };
}
