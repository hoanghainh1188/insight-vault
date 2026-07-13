# Data Model — 055-rag-enhance (Phase 1)

## chunk_fts (FTS5 own-storage) — MỚI (migration #7)

`CREATE VIRTUAL TABLE chunk_fts USING fts5(text, tokenize='unicode61')`

- `rowid` = `chunk.rowid` ngầm (map về `chunk.id` qua JOIN).
- `text` = **fold** của `chunk.text` (bỏ dấu + đ→d + lowercase) — cho khớp không phân biệt dấu.
- **Backfill** (migration): duyệt `chunk` → `INSERT INTO chunk_fts(rowid, text) VALUES(rowid, fold(text))`.
- **Đồng bộ** (source-repo): `insertChunks` → INSERT rowid+fold (tay, cần fold JS). **XOÁ do TRIGGER**
  `chunk_fts_ad AFTER DELETE ON chunk` (dọn theo `OLD.rowid`) — bao `deleteChunks`, xoá source, cascade
  notebook (FK). Không đồng bộ tay khi xoá.

## Chunk + Locator — KHÔNG đổi

`retrieve` vẫn trả `ScoredChunk { chunk, sourceTitle, score }` với `chunk.locator` gốc. Hybrid chỉ đổi
**tập/thứ tự** chunk. `chunk.text` gốc GIỮ NGUYÊN (bản fold chỉ ở FTS).

## Rewritten query (runtime, không persist)

Chuỗi dẫn xuất từ câu hỏi + history; dùng cho embed + BM25; KHÔNG lưu, KHÔNG hiển thị.

## Constants (constants.ts) — thêm

| Hằng                                                  | Giá trị | Vai trò                                       |
| ----------------------------------------------------- | ------- | --------------------------------------------- |
| `RRF_K`                                               | 60      | hằng RRF (1/(k+rank))                         |
| `MMR_LAMBDA`                                          | 0.7     | cân bằng liên quan↔đa dạng                    |
| `HYBRID_BRANCH_TOPK`                                  | 10      | top-K mỗi nhánh (vector, bm25) trước hợp nhất |
| (giữ) `RETRIEVAL_TOP_K`=6                             |         | số chunk cuối vào context (MMR chọn)          |
| (giữ) `RELEVANCE_MAX_DISTANCE`, `CONTEXT_CHAR_BUDGET` |         | ngưỡng + ngân sách (013)                      |

## Vector-store — thêm

`getVectorsByIds(ids: string[]): Promise<Map<string, number[]>>` — lấy vector chunk cho MMR.
