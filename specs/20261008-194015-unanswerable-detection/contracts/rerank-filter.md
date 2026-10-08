# Contract — `applyRerank` + bước rerank trong `retrieve()`

Tệp: `src/main/services/rag/rerank-filter.ts` (thuần) · `src/main/services/rag/retrieval.ts` (gọi).

## `validateRerankConfig(cfg: RerankConfig): void`

Ném `Error` khi: `minScore` ∉ [0, 1] hoặc không hữu hạn; `relativeDelta` khác null và ∉ [0, 1]; `timeoutMs` ≤ 0 hoặc không hữu hạn.

## `applyRerank(fused, scores, cfg) → { ids, scoreOf }`

- `best = max(scores[id] for id in fused có điểm)`; không id nào có điểm ⇒ `ids = []`.
- Giữ `id` khi `scores[id] ≥ cfg.minScore` VÀ (`relativeDelta === null` HOẶC `scores[id] ≥ best − relativeDelta`).
- `reorder === false` ⇒ thứ tự như `fused`; `true` ⇒ điểm giảm dần, hoà ⇒ vị trí trong `fused`.
- Tất định; không mutate `fused`/`scores`; `ids ⊆ fused`; `scoreOf` chỉ chứa id trong `ids`.

## Trong `retrieve(question, notebookId, deps, history, cfg, rerankCfg)`

| Điều kiện                                                   | Hành vi                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `rerankCfg` null hoặc `deps.rerank` thiếu                   | như 108 (không đổi)                                                                         |
| `fused` rỗng                                                | `[]` (như 108, không gọi rerank)                                                            |
| `deps.rerank` trả trong `timeoutMs`                         | `applyRerank` → rỗng ⇒ `[]`; không rỗng ⇒ MMR trên `ids` → `ScoredChunk[]` có `rerankScore` |
| `deps.rerank` ném lỗi / quá `timeoutMs` / báo chưa sẵn sàng | fail-open: tiếp tục như 108; gọi `deps.onRerankSkip(reason)`                                |

- Câu truy vấn gửi rerank = câu đã viết lại (nếu có lịch sử) — giống nhánh vector/BM25.
- Văn bản đoạn = `chunk.text` nguyên văn (không dịch/viết lại — Constitution II); tokenizer cắt ở 512 token.
- `chunk`, `locator`, `sourceTitle`, `score` (cosine distance) không đổi nghĩa.
