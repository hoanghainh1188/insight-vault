import type { Citation } from "@shared/ipc/types";
import type { RetrievedChunk } from "./rag-types";

// HẬU KIỂM chip [n] (CRUX Constitution II / SC-002). Hàm THUẦN — test tất định, không cần model.
// Nguyên tắc: KHÔNG tin số LLM tự sinh. Chỉ [n] ánh xạ được tới chunk THẬT trong context mới giữ lại;
// [n] ngoài phạm vi bị GỠ khỏi câu trả lời hiển thị và không vào danh sách citation.

const CITE_RE = /\[(\d+)\]/g;

export interface Postprocessed {
  answer: string; // đã gỡ chip lỗi
  citations: Citation[]; // chỉ [n] hợp lệ & thực xuất hiện, dedup, sắp theo n
}

/**
 * Đối chiếu mọi `[n]` trong `rawAnswer` với `map` (n → chunk thật):
 * - n hợp lệ (map có) → giữ chip, thêm vào citations (dedup).
 * - n ngoài phạm vi → gỡ token `[n]` khỏi answer.
 */
export function postprocessCitations(
  rawAnswer: string,
  map: Map<number, RetrievedChunk>,
): Postprocessed {
  const seen = new Set<number>();
  const citations: Citation[] = [];

  const answer = rawAnswer.replace(CITE_RE, (whole, digits: string) => {
    const n = Number(digits);
    const rc = map.get(n);
    if (!rc) return ""; // chip lỗi → gỡ
    if (!seen.has(n)) {
      seen.add(n);
      citations.push({
        n,
        chunkId: rc.chunk.id,
        sourceId: rc.chunk.sourceId,
        sourceTitle: rc.sourceTitle,
        locator: rc.chunk.locator,
      });
    }
    return whole; // chip hợp lệ → giữ
  });

  citations.sort((a, b) => a.n - b.n);
  // Dọn khoảng trắng thừa do gỡ chip (vd "abc  ." → "abc .").
  const cleaned = answer
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1");
  return { answer: cleaned, citations };
}
