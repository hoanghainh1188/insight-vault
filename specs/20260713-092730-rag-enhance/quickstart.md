# Quickstart / Validation — 055-rag-enhance

## Prerequisites

- `npm ci`. 013/027/031 đã merge. (Manual) Ollama + notebook có nhiều nguồn (đa loại sau Pha 2).

## Automated gate

```bash
npm run lint
npm run test          # coverage ≥80%; test mới: fusion (RRF/MMR), fts-fold (foldVietnamese/buildFtsMatch),
                      #   keyword-store (SQLite thật, khớp có/không dấu + đ), retrieval hybrid (DI: fusion,
                      #   fallback vector-only, fallback câu gốc, locator giữ), migration #7 (FTS+backfill+sync)
npm run build
npx playwright test rag-qa security no-egress chat-history   # e2e cũ xanh (không đổi UI/kênh)
```

Không cần `npm run pack` (không thêm binary/model).

## Manual validation (cần Ollama)

1. `npm run dev`, mở notebook nhiều nguồn.
2. **US1 (rewrite/nối tiếp)**: hỏi 1 câu về chủ thể X → hỏi tiếp "còn <đại từ> thì sao?" → câu 2 vẫn đúng
   chủ đề, chip `[n]` đúng.
3. **US2 (keyword)**: hỏi 1 cụm chính xác có trong tài liệu (tên riêng/mã số vd "Điều 47"); thử gõ KHÔNG
   dấu → vẫn ra đoạn chứa cụm đó, trích dẫn đúng.
4. **US3 (đa dạng)**: hỏi câu rộng → ngữ cảnh không bị lấp bởi các đoạn gần-trùng.
5. **Kiểm chứng (bất biến)**: mọi chip `[n]` mở đúng nguồn + đúng vị trí (trang/timestamp/bbox) — không hồi
   quy.
6. **Fallback**: (mô phỏng) tắt/hỏng bước rewrite → câu trả lời vẫn ra (dùng câu gốc). Không tìm thấy →
   "không tìm thấy trong nguồn" như cũ.
7. **Egress**: provider local → 0 request ngoài; provider online → badge phản ánh cả bước rewrite.

## Rollback

Migration #7 chỉ THÊM bảng `chunk_fts` (không đổi bảng cũ) → revert code an toàn (bảng thừa vô hại; hoặc
DROP thủ công). retrieve có fallback vector-only nên gỡ FTS không phá hỏi đáp.
