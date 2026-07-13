import { RRF_K, MMR_LAMBDA } from "./constants";

// Hợp nhất + đa dạng hoá kết quả hybrid (055). THUẦN — unit-test kỹ (crux). Không phụ thuộc DB/LLM.

/**
 * Reciprocal Rank Fusion: gộp nhiều danh sách id (mỗi list đã xếp tốt→xấu) → 1 danh sách hợp nhất theo
 * tổng điểm Σ 1/(k+rank) (rank 0-based). Dedup, sắp giảm dần. List rỗng bỏ qua.
 */
export function reciprocalRankFusion(
  lists: string[][],
  k: number = RRF_K,
): string[] {
  const score = new Map<string, number>();
  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank];
      score.set(id, (score.get(id) ?? 0) + 1 / (k + rank));
    }
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function cosine(a: number[], b: number[]): number {
  const na = Math.sqrt(dot(a, a));
  const nb = Math.sqrt(dot(b, b));
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

export interface MmrCandidate {
  id: string;
  vector?: number[];
}

/**
 * Maximal Marginal Relevance: chọn ≤ n id đa dạng — tối đa `λ·cos(q,c) − (1−λ)·max cos(c, đã-chọn)`.
 * Candidate KHÔNG có vector (vd chunk chưa embed) → không tính MMR, xếp cuối theo thứ tự đầu vào (order).
 * Nếu queryVector rỗng → giữ nguyên thứ tự đầu vào (cắt n).
 */
export function mmrSelect(
  candidates: MmrCandidate[],
  queryVector: number[],
  n: number,
  lambda: number = MMR_LAMBDA,
): string[] {
  const withVec = candidates.filter((c) => c.vector && c.vector.length > 0);
  const withoutVec = candidates.filter(
    (c) => !c.vector || c.vector.length === 0,
  );
  if (queryVector.length === 0 || withVec.length === 0) {
    return candidates.slice(0, n).map((c) => c.id);
  }
  const selected: MmrCandidate[] = [];
  const pool = [...withVec];
  while (selected.length < n && pool.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const rel = cosine(pool[i].vector as number[], queryVector);
      let maxSim = 0;
      for (const s of selected) {
        const sim = cosine(pool[i].vector as number[], s.vector as number[]);
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = lambda * rel - (1 - lambda) * maxSim;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }
    selected.push(pool.splice(bestIdx, 1)[0]);
  }
  // Bù chỗ trống bằng candidate không vector (giữ order gốc) nếu chưa đủ n.
  const ids = selected.map((c) => c.id);
  for (const c of withoutVec) {
    if (ids.length >= n) break;
    ids.push(c.id);
  }
  return ids;
}
