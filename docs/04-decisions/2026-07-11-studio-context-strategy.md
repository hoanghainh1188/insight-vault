# Studio context & citation strategy (021-studio)

- Ngày: 2026-07-11
- Feature: `021-studio` (áp cho feature sau nếu cần tổng hợp toàn notebook)
- Câu hỏi gốc: Studio tổng hợp TOÀN BỘ nguồn notebook (không có câu hỏi/query như rag-qa) → gom context
  thế nào để vừa context window model local + vẫn kiểm chứng được (citation).
- Người quyết định: hoanghainh1188 (2026-07-11)

## Quyết định

### 1. Gom context: ALL-CHUNKS theo ngân sách (1 lượt chat)

- Lấy CHUNK của mọi nguồn trong notebook: `source-repo.listChunksByNotebook(notebookId)` → sắp theo
  `source.created_at` rồi `chunk.ordinal` (thứ tự tự nhiên tài liệu).
- Đưa qua `buildContext` (tái dùng `rag/context-builder.ts`): đánh số `[1..k]`, ghép theo ngân sách
  **`STUDIO_CONTEXT_BUDGET ≈ 8000` ký tự**, BỎ NGUYÊN chunk khi vượt (không cắt giữa → locator không lệch).
- 1 lượt `LLMProvider.chat` với system prompt theo `StudioKind` + context. KHÔNG map-reduce ở MVP.
- **Hạn chế đã biết**: notebook rất lớn (vượt ngân sách) → chỉ tổng hợp phần đầu (theo thứ tự). UI ghi chú
  "dựa trên phần đầu tài liệu" khi số chunk đưa vào < tổng số chunk. Map-reduce để pha sau nếu cần bao phủ.

### 2. Citation `[n]` — tái dùng hậu kiểm rag-qa

- Context đánh số `[1..k]` (bảng `n → chunk`); system prompt yêu cầu chèn `[n]` cho ý lấy từ nguồn.
- Sau chat: `postprocessCitations(raw, map)` (rag/citation.ts) — gỡ `[n]` ngoài `[1..k]`, build `Citation[]`.
- Nếu 0 chip hợp lệ nhưng có nội dung → `citationsFromMap(map)` (gắn các nguồn đã đưa vào context) → kết quả
  vẫn kèm nguồn kiểm chứng được (như rag-qa grounded fallback).
- `Citation` tái dùng nguyên (013): `{n, chunkId, sourceId, sourceTitle, locator}` → bấm chip mở Source
  Viewer (019). Constitution II thoả: chip luôn trỏ chunk THẬT trong context.

### 3. System prompt theo loại (studio/prompt.ts)

- Chung: "Tổng hợp từ các đoạn nguồn đánh số `[n]` dưới đây. Chèn `[n]` cho ý lấy từ nguồn. Chỉ dùng nội
  dung trong các đoạn, không bịa."
- Riêng: summary (đoạn/gạch đầu dòng ngắn gọn); keyPoints (danh sách ý chính, mỗi ý 1 dòng); faq (các cặp
  "Hỏi: … / Đáp: … [n]"); outline (dàn ý thụt cấp).
- Output = TEXT (không structured/markdown-render) — renderer hiển thị text + chip như `MessageBubble`.

### 4. Lưu trữ (migration #3)

```
studio_result(id, notebook_id FK→notebook ON DELETE CASCADE, kind CHECK(summary|keyPoints|faq|outline),
              content TEXT, citations_json TEXT, created_at, updated_at)
UNIQUE(notebook_id, kind)   -- 1 bản mới nhất mỗi loại; regenerate = UPSERT
```

`studio:list(notebookId)` đọc lại khi mở Workspace; `studio:generate` upsert.

## Lý do

- All-chunks 1 lượt: đơn giản, nhanh, citation map trực tiếp về chunk thật (map-reduce làm citation trỏ vào
  tóm tắt trung gian — không phải nguồn thật, lệch Constitution II).
- Tái dùng context-builder/citation (013): không viết lại logic ngân sách + hậu kiểm; nhất quán "kiểm chứng
  được" giữa Chat và Studio.
- Text output (không structured): tránh parse/markdown-render phức tạp + XSS; renderer dùng lại cơ chế chip
  của chat.

## Phương án loại bỏ

- Map-reduce — nhiều lượt LLM (chậm), citation khó map về nguồn thật. Hoãn (pha sau nếu cần notebook lớn).
- Structured FAQ/Outline (JSON đệ quy) — phức tạp parse/render, chưa cần cho MVP. Text đủ.
- Markdown renderer — thêm dependency + rủi ro XSS. Dùng text + chip như chat.

## Hệ quả

- `source-repo.listChunksByNotebook` (mở rộng 011, additive). Migration #3. Service `studio/` +
  `studio:generate`/`studio:list`. Renderer `features/studio/`. Import `buildContext`/citation từ `rag/`.
