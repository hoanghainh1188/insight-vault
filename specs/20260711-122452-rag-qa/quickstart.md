# Quickstart — 013-rag-qa (kiểm chứng)

Chứng minh hỏi đáp có trích dẫn hoạt động end-to-end. Chi tiết type xem [data-model.md](./data-model.md),
hợp đồng IPC xem [contracts/ipc-channels.md](./contracts/ipc-channels.md).

## Prerequisites

- Đã có 011-ingestion (chunk + vector + source-repo + vector-store) trong `main`.
- Ollama chạy local + đã chọn **chat model** (vd `qwen2.5:7b`) + **embedding model** (`nomic-embed-text`)
  ở Cài đặt (007). Nếu chưa → cột Chat hiện hướng dẫn + vô hiệu gửi (US4).
- Một notebook có ≥1 nguồn đã "Sẵn sàng" (nạp qua 011).

## Gate lệnh

```bash
npm run lint
npm run test          # unit — coverage ≥80% business logic rag
npm run build
npm run test:e2e      # Playwright _electron
```

## Kịch bản kiểm chứng (map US/SC)

### QS1 — Hỏi có câu trả lời trong nguồn → trích dẫn đúng (US1, SC-001/002)

1. `npm run dev`, mở notebook có nguồn ready, vào cột Chat (chế độ Theo nguồn).
2. Hỏi câu mà tài liệu có chứa câu trả lời.
3. **Mong đợi**: câu trả lời có ≥1 chip `[n]`; dòng "Nguồn:" liệt kê tên nguồn + trang. Kiểm citation:
   mỗi `[n]` trỏ đúng chunk/nguồn/locator có thật (id khớp chunk trong context).

### QS2 — Hỏi ngoài nguồn (grounded) → "không tìm thấy" (US2, SC-003)

1. Chế độ Theo nguồn, hỏi câu hoàn toàn ngoài tài liệu.
2. **Mong đợi**: "Không tìm thấy trong nguồn", không chip, `notFound=true`, citations rỗng — KHÔNG bịa.

### QS3 — Chế độ Mở rộng (US3, SC-004)

1. Bật công tắc Mở rộng, hỏi câu ngoài tài liệu → trả lời từ kiến thức chung, có nhãn "không dựa trên nguồn".
2. Hỏi câu tài liệu có → phần từ nguồn vẫn có `[n]`.

### QS4 — Multi-turn + runtime chưa sẵn sàng (US4, SC-006)

1. Hỏi câu 2 tham chiếu câu 1 trong cùng phiên → câu trả lời hiểu ngữ cảnh.
2. Tắt Ollama (hoặc bỏ chọn model) → cột Chat hiện hướng dẫn + vô hiệu gửi; không gửi request.
3. Notebook chưa có nguồn ready → ô nhập vô hiệu + gợi ý "Nạp nguồn".

### QS5 — Bảo mật/log (SC-005, Constitution III)

- Rà log chi tiết: KHÔNG có câu hỏi / nội dung tài liệu / câu trả lời trong log.
- Renderer bundle KHÔNG import lancedb/sqlite/provider (chỉ ở main).

## Unit test trọng tâm (tất định, không cần Ollama)

- `citation.test.ts` (**CRUX Principle II / SC-002**): `[n]` hợp lệ→map đúng; `[9]` khi k=6→gỡ khỏi answer +
  không vào citations; dedup theo n; grounded notFound→citations rỗng; nhiều chip.
- `context-builder.test.ts`: đánh số [1..k], ngân sách ~6000 ký tự **bỏ nguyên chunk** điểm thấp (không cắt
  giữa), map n→chunk đúng.
- `rag-prompt.test.ts`: 2 template grounded/open đúng chỉ dẫn (grounded cấm bịa + "không tìm thấy"; open
  gắn nhãn ngoài nguồn).
- `question-validation.test.ts`: ≤2000 ký tự; rỗng/vượt→ném.
- `retrieval.test.ts`: mock `vector-store.search` + `provider.embed` + `getChunksByIds` → lọc ngưỡng, đánh
  số; 0 hit / vượt ngưỡng → rỗng.
- `rag-service.test.ts`: mock `chat` → grounded có nguồn / grounded notFound / open / multi-turn (history
  vào messages) / câu hỏi quá dài bị chặn.
- `get-chunks-by-ids.test.ts`: `:memory:` SQLite, trả đúng thứ tự ids.
- `rag-ipc-whitelist.test.ts`: `rag:ask` whitelisted, ngoài danh sách bị từ chối.

## e2e (`tests/e2e/rag-qa.spec.ts`)

- Whitelist: `window.api.ragAsk` tồn tại, không `invoke` chung.
- notebook rỗng → không gửi được (ô vô hiệu).
- (Nếu Ollama sẵn trong e2e: rag:ask trả answer + citations khớp chunk có thật; nếu không, kiểm nhánh
  runtime-chưa-sẵn-sàng như ai-runtime e2e.)
