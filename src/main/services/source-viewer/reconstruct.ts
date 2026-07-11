import type { Chunk, PageBreak } from "@shared/ipc/types";

// Tái dựng toàn văn nguồn từ chunk đã lưu (ADR source-viewer-strategy). Hàm THUẦN — test tất định.
// CRUX Constitution II: T tái dựng PHẢI == văn bản đã-làm-sạch gốc để offset locator khớp highlight.

type ChunkLike = Pick<Chunk, "text" | "locator">;

/**
 * Nối `chunk.text` theo `charStart` tăng dần, FILL GAP ranh giới trang (PDF nối trang bằng "\n\n" mà chunk
 * không chứa → phải bù `"\n".repeat(gap)`), cắt overlap bằng `pos - charStart`.
 * Đã verify: reconstructText(chunks) === joinPages(pages) tuyệt đối + T.slice(charStart,charEnd)===chunk.text.
 */
export function reconstructText(chunks: ChunkLike[]): string {
  const sorted = [...chunks].sort(
    (a, b) => a.locator.charStart - b.locator.charStart,
  );
  let out = "";
  let pos = 0;
  for (const c of sorted) {
    const cs = c.locator.charStart;
    const ce = c.locator.charEnd;
    if (cs > pos) {
      // Gap = ranh giới trang (PAGE_SEP "\n\n"). Bù để offset toàn cục khớp locator.
      out += "\n".repeat(cs - pos);
      pos = cs;
    }
    if (ce <= pos) continue; // đã phủ hoàn toàn (overlap)
    out += c.text.slice(pos - cs);
    pos = ce;
  }
  return out;
}

/** Mốc bắt đầu mỗi trang (PDF): offset = min(charStart) các chunk cùng page. Non-PDF (page=null) → []. */
export function derivePageBreaks(chunks: ChunkLike[]): PageBreak[] {
  const minByPage = new Map<number, number>();
  for (const c of chunks) {
    const p = c.locator.page;
    if (p == null) continue;
    const cur = minByPage.get(p);
    if (cur === undefined || c.locator.charStart < cur) {
      minByPage.set(p, c.locator.charStart);
    }
  }
  return [...minByPage.entries()]
    .map(([page, offset]) => ({ page, offset }))
    .sort((a, b) => a.offset - b.offset);
}
