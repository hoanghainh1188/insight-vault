# Contract — `selectRelevant` (hàm thuần, `src/main/services/rag/relevance-filter.ts`)

Dùng chung bởi `retrieve()` (ứng dụng) và công cụ đo — một nguồn logic duy nhất.

```text
selectRelevant(input: {
  vHits: { id: string; score: number }[];        // nhánh vector, score = cosine distance (nhỏ = gần)
  kHits: { id: string; score: number }[];        // nhánh BM25, score = bm25() FTS5 (âm, nhỏ = liên quan)
  distanceOf?: (id: string) => number | undefined; // distance câu hỏi↔chunk cho chunk BM25 ngoài top vector (vectorWithin)
}, cfg: RelevanceConfig): {
  vector: { id: string; score: number }[];        // hit vector được giữ (thứ tự giữ nguyên)
  keyword: { id: string; score: number }[];       // hit BM25 được giữ (thứ tự giữ nguyên)
}
```

## Quy tắc

1. `vector` = `vHits` với `score ≤ cfg.maxDistance`; nếu `cfg.relativeDelta !== null` thêm điều kiện
   `score ≤ min(vHits.score) + relativeDelta` (min trên TOÀN BỘ vHits trước lọc).
2. `keyword` theo `cfg.bm25Gate`:
   - `none` → giữ toàn bộ `kHits` (hành vi trước 108 — chỉ dùng làm baseline).
   - `requireVector` → giữ hit có `id` thuộc `vector`.
   - `vectorWithin` → giữ hit có `distanceOf(id) ≤ cfg.bm25VectorMaxDistance` (không có distance ⇒ loại).
   - `minScore` → giữ hit có `score ≤ cfg.bm25MaxScore`.
3. Không thêm/đổi id, không đổi thứ tự trong mỗi nhánh; `vector` và `keyword` rỗng ⇒ `retrieve()` trả `[]` ⇒ chế độ theo
   nguồn trả "Không tìm thấy" (FR-014).
4. `validateRelevanceConfig(cfg)` ném lỗi khi thiếu trường phụ theo `bm25Gate` hoặc số không hữu hạn/âm (trừ
   `bm25MaxScore` được âm).

## Bất biến

- KHÔNG đọc/ghi I/O; KHÔNG đổi chunk/locator (Constitution II).
