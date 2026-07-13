# Contract — Hybrid retrieve + fusion (055)

## fusion.ts (THUẦN)

```
reciprocalRankFusion(lists: string[][], k = 60): string[]
```

- Input: mảng các danh sách id (đã xếp theo rank tốt→xấu). Output: id hợp nhất theo tổng `Σ 1/(k+rank)`
  (rank 0-based), giảm dần. Dedup. List rỗng bỏ qua.

```
mmrSelect(candidates: { id: string; vector?: number[] }[], queryVector: number[], n: number,
          lambda = 0.7): string[]
```

- Chọn tuần tự tối đa `λ·cos(q, c) − (1−λ)·max cos(c, đã-chọn)`. Trả ≤ n id đa dạng. **Thứ tự mảng
  `candidates` = RRF rank** (không có tham số `order` riêng). Cand KHÔNG vector → không tính MMR, xếp cuối
  theo thứ tự đầu vào. `queryVector` rỗng → giữ nguyên thứ tự đầu vào (cắt n).

## retrieve() (retrieval.ts) — nâng cấp, DI

```
retrieve(question, notebookId, deps, history?): Promise<ScoredChunk[]>
deps += {
  rewrite?: (q, history) => Promise<string>,       // fallback câu gốc trong impl
  searchBm25?: (nb, query, topK) => {id,score}[],  // ĐỒNG BỘ (node:sqlite sync)
  getVectorsByIds?: (ids) => Promise<Map<string, number[]>>,
}
```

Luồng:

1. `q2 = rewrite ? await rewrite(question, history) : question` (impl rewrite tự fallback câu gốc).
2. `vec = embed(q2)`; song song: `vHits = search(vec, nb, TOPK)`, `kHits = searchBm25?(nb, q2, TOPK) ?? []`
   (searchBm25 ném → bắt → []; vector-only).
3. `fused = reciprocalRankFusion([vHits.ids, kHits.ids])`. Rỗng → `[]` (grounded "không tìm thấy").
4. Lọc ngưỡng: chunk từ vHits giữ `RELEVANCE_MAX_DISTANCE` (bm25-only không có distance → giữ, tin BM25).
5. `getVectorsByIds(fused)` → MMR chọn `RETRIEVAL_TOP_K` → thứ tự cuối.
6. `getChunksByIds` → `ScoredChunk[]` **giữ locator** (Constitution II).

**Bất biến**: mỗi ScoredChunk.chunk có locator gốc; không tạo nội dung. Hybrid rỗng → [].

## Test contract

- fusion: RRF hợp 2 list (id ở đầu cả 2 → top; id 1 list → thấp hơn); MMR loại gần-trùng (2 vector ~song
  song → chỉ 1), trả ≤ n, cand thiếu vector giữ theo order.
- retrieve (DI mock): hợp nhất đúng; searchBm25 ném → vector-only (không lỗi); rewrite ném → dùng câu gốc;
  fused rỗng → []; ScoredChunk giữ locator.
