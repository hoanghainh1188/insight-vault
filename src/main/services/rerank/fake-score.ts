// 109 (T029): điểm giả TẤT ĐỊNH cho e2e (`IV_RERANK_FAKE=1`, chỉ bản chưa đóng gói) — tỉ lệ từ ≥ 3 ký tự của câu hỏi có mặt
// trong đoạn. Không tải model; đủ để kiểm luồng chặn câu không liên quan.

const words = (s: string): string[] =>
  s
    .toLocaleLowerCase("vi")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);

export function fakeRerankScore(query: string, passage: string): number {
  const q = [...new Set(words(query))];
  if (q.length === 0) return 0;
  const p = new Set(words(passage));
  return q.filter((w) => p.has(w)).length / q.length;
}
