// Chuẩn hoá L2 (059). transformers `normalize:true` đã cho vector ‖v‖≈1, nhưng thêm lớp này làm nguồn
// sự thật cho cosine ổn định (MMR 055 + search cosine). Hàm thuần → test.

/** Trả vector chuẩn hoá L2 (‖v‖₂ = 1). Vector 0 (hoặc rỗng) giữ nguyên (tránh chia 0). */
export function l2normalize(v: number[]): number[] {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return v.slice();
  return v.map((x) => x / norm);
}
