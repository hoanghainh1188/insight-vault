import type { ChatMessage, StudioKind } from "@shared/ipc/types";
import type { RetrievedChunk, ScoredChunk } from "../rag/rag-types";
import { citationBlock } from "../rag/context-builder";
import { postprocessCitations } from "../rag/citation";
import { systemPromptFor } from "./prompt";

// 105 — map-reduce cho notebook vượt ngân sách, GIỮ chip [n] tới ĐÚNG ĐOẠN (ADR 2026-10-07-studio-large-clarify).
// Khác phương án đã bác (2026-07-11-studio-mapreduce-citation — citation mức NGUỒN): ở đây mọi đoạn được đánh số
// TOÀN CỤC [1..N] trước; ghi chú từng lô kèm [n] (hậu kiểm theo BẢNG CỦA LÔ — gỡ số không thuộc lô); bước cuối
// giữ nguyên [n] và hậu kiểm theo bảng toàn cục ⇒ chip trỏ đoạn thật. KHÔNG log nội dung.

export const MAX_MAP_CALLS = 12;
/** Số vòng rút gọn ghi chú tối đa trước bước cuối (chặn vòng lặp vô hạn khi model không rút gọn). */
const MAX_CONDENSE_ROUNDS = 3;

export interface NumberedBlock {
  n: number;
  text: string;
}

type Chat = (messages: ChatMessage[]) => Promise<string>;

const NOTES_RULES = [
  "Mỗi ghi chú một dòng bắt đầu bằng '- ', ngắn gọn, KẾT THÚC bằng chip [n] của đoạn chứa ý đó.",
  "Dùng ĐÚNG số [n] đã cho (không tạo số mới, không đổi số).",
  "Chỉ dùng thông tin trong các đoạn đã cho, TUYỆT ĐỐI KHÔNG bịa. Viết tiếng Việt.",
].join(" ");

const MAP_PROMPT = `Bạn trích GHI CHÚ các ý chính từ các đoạn nguồn được ĐÁNH SỐ [n] dưới đây. ${NOTES_RULES}`;
const CONDENSE_PROMPT = `Rút gọn các GHI CHÚ dưới đây: gộp ý trùng, bỏ chi tiết vụn, GIỮ NGUYÊN chip [n] của mỗi ý. ${NOTES_RULES}`;
const FROM_NOTES =
  "LƯU Ý: đầu vào là GHI CHÚ đã tổng hợp từ nhiều phần của tài liệu; mỗi ghi chú kèm chip [n] trỏ về đoạn nguồn GỐC. Khi viết, GIỮ NGUYÊN các chip [n] của ý bạn dùng — KHÔNG tạo số mới.";

/** Đánh số [n] TOÀN CỤC cho mọi đoạn (theo nguồn → thứ tự đọc) + bảng n → đoạn thật. */
export function numberAll(groups: ScoredChunk[][]): {
  blocks: NumberedBlock[];
  map: Map<number, RetrievedChunk>;
} {
  const blocks: NumberedBlock[] = [];
  const map = new Map<number, RetrievedChunk>();
  let n = 0;
  for (const group of groups) {
    for (const sc of group) {
      n += 1;
      map.set(n, { ...sc, n });
      blocks.push({ n, text: citationBlock(n, sc) });
    }
  }
  return { blocks, map };
}

/** Gom tham lam các khối vào lô ≤ budget ký tự (khối quá khổ đứng riêng — KHÔNG cắt giữa đoạn). */
export function packBatches<T extends { text: string }>(
  items: T[],
  budget: number,
): T[][] {
  const batches: T[][] = [];
  let cur: T[] = [];
  let used = 0;
  for (const it of items) {
    const len = it.text.length + 2;
    if (cur.length > 0 && used + len > budget) {
      batches.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(it);
    used += len;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

const joined = (items: { text: string }[]): string =>
  items.map((i) => i.text).join("\n\n");

/** Ghi chú → chỉ giữ dòng có ít nhất 1 [n] hợp lệ theo `map` (gỡ số bịa / ngoài lô). */
function cleanNotes(raw: string, map: Map<number, RetrievedChunk>): string[] {
  const { answer } = postprocessCitations(raw, map);
  return answer
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /\[\d+\]/.test(l));
}

/** Rút gọn ghi chú theo lô tới khi vừa ngân sách (tối đa MAX_CONDENSE_ROUNDS vòng). */
async function condense(
  notes: string[],
  budget: number,
  map: Map<number, RetrievedChunk>,
  chat: Chat,
): Promise<string[]> {
  let cur = notes;
  for (
    let round = 0;
    round < MAX_CONDENSE_ROUNDS &&
    joined(cur.map((text) => ({ text }))).length > budget;
    round += 1
  ) {
    const next: string[] = [];
    for (const batch of packBatches(
      cur.map((text) => ({ text })),
      budget,
    )) {
      const raw = await chat([
        { role: "system", content: CONDENSE_PROMPT },
        { role: "user", content: batch.map((b) => b.text).join("\n") },
      ]);
      next.push(...cleanNotes(raw, map));
    }
    if (next.length === 0) break; // model trả rỗng ⇒ giữ ghi chú cũ (không mất nội dung)
    cur = next;
  }
  return cur;
}

export interface MapReduceInput {
  kind: StudioKind;
  groups: ScoredChunk[][];
  /** Ngân sách ký tự mỗi lượt (theo cửa sổ ngữ cảnh của model). */
  budget: number;
  chat: Chat;
  maxMapCalls?: number;
}

export interface MapReduceOutput {
  /** Câu trả lời thô của bước cuối (còn [n] — caller hậu kiểm bằng `map`). */
  raw: string;
  /** Bảng n → đoạn thật TOÀN CỤC. */
  map: Map<number, RetrievedChunk>;
  /** Số phần (lượt map) đã tổng hợp. */
  parts: number;
  /** true khi vượt số lượt map tối đa (phần cuối tài liệu không được tổng hợp). */
  truncated: boolean;
}

export async function runMapReduce({
  kind,
  groups,
  budget,
  chat,
  maxMapCalls = MAX_MAP_CALLS,
}: MapReduceInput): Promise<MapReduceOutput> {
  const { blocks, map } = numberAll(groups);
  const allBatches = packBatches(blocks, budget);
  const batches = allBatches.slice(0, maxMapCalls);

  let notes: string[] = [];
  for (const batch of batches) {
    const batchMap = new Map(
      batch.map((b) => [b.n, map.get(b.n)!] as [number, RetrievedChunk]),
    );
    const raw = await chat([
      { role: "system", content: MAP_PROMPT },
      { role: "user", content: joined(batch) },
    ]);
    notes.push(...cleanNotes(raw, batchMap));
  }

  notes = await condense(notes, budget, map, chat);

  const raw = await chat([
    { role: "system", content: `${systemPromptFor(kind)}\n\n${FROM_NOTES}` },
    { role: "user", content: notes.join("\n") },
  ]);

  return {
    raw,
    map,
    parts: batches.length,
    truncated: allBatches.length > batches.length,
  };
}
