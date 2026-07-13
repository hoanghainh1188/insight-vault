# Contract — FTS5 keyword store + fold (055)

## fts-fold.ts (THUẦN)

```
foldVietnamese(s: string): string
```

- `s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase()`.
- Bỏ MỌI dấu thanh + dấu vowel (ơ/ư horn) + `đ→d`. Khớp có/không dấu (kể cả đ).

```
buildFtsMatch(query: string): string
```

- `foldVietnamese(query)` → tách token (chữ+số, bỏ ký tự đặc biệt) → mỗi token bọc `"..."` (escape `"`→
  `""`) → nối `OR`. Rỗng → `""` (caller bỏ BM25).
- Chống FTS injection: token trong string-literal FTS5 → vô hiệu toán tử `AND/OR/NEAR/*/(/:`.

## keyword-store.ts (I/O — SQLite)

```
createKeywordStore(db): { searchBm25(notebookId, query, topK): { id: string; score: number }[] }
```

- `match = buildFtsMatch(query)`; rỗng → `[]`.
- SQL: `SELECT c.id, bm25(chunk_fts) AS score FROM chunk_fts JOIN chunk c ON c.rowid = chunk_fts.rowid JOIN
source s ON s.id = c.source_id WHERE chunk_fts MATCH ? AND s.notebook_id = ? ORDER BY score LIMIT ?`
  (bm25 nhỏ = liên quan hơn → ORDER tăng).
- Bảng `chunk_fts` chưa tồn tại (DB cũ trước migrate) / lỗi → ném (retrieve bắt → vector-only).

## Migration #7

- `CREATE VIRTUAL TABLE chunk_fts USING fts5(text, tokenize='unicode61')`.
- **Trigger đồng bộ XOÁ**: `CREATE TRIGGER chunk_fts_ad AFTER DELETE ON chunk BEGIN DELETE FROM chunk_fts
WHERE rowid = OLD.rowid; END` — fire cả khi xoá trực tiếp LẪN cascade FK (source/notebook → chunk). Đã
  verify thực nghiệm trigger fire khi FK cascade (foreign_keys ON).
- Backfill: `SELECT rowid, text FROM chunk` → JS `foldVietnamese` → `INSERT INTO chunk_fts(rowid, text)`.

## Đồng bộ (source-repo)

- `insertChunks`: sau khi INSERT chunk, lấy `rowid` (lastInsertRowid) → `INSERT INTO chunk_fts(rowid, text)
VALUES(?, fold(text))` (INSERT làm TAY vì cần fold JS — trigger không fold được).
- **XOÁ do TRIGGER** (không đồng bộ tay): `deleteChunks(sourceId)` chỉ `DELETE FROM chunk` → trigger tự dọn
  chunk_fts; cũng bao `delete(source)` + cascade notebook. Đơn giản + an toàn hơn đồng bộ tay.

## Test

- foldVietnamese: hợp đồng→hop dong; Điều→dieu; giữ số/chữ thường.
- buildFtsMatch: token OR, escape `"`, ký tự đặc biệt không phá; rỗng→"".
- searchBm25 (SQLite in-memory thật + FTS + backfill): khớp có/không dấu (đ), lọc đúng notebook, xếp bm25.
- migration #7: bảng tồn tại + backfill đếm đúng + đồng bộ insert/delete.
