# Quickstart — 011-ingestion (kiểm chứng)

Hướng dẫn chạy + kịch bản chứng minh feature hoạt động end-to-end. Chi tiết schema xem
[data-model.md](./data-model.md), hợp đồng IPC xem [contracts/ipc-channels.md](./contracts/ipc-channels.md).

## Prerequisites

- Đã cài dependency: `pdfjs-dist mammoth @mozilla/readability jsdom turndown @lancedb/lancedb`.
- **Verify native (rủi ro cao)**: sau `npm i`, smoke test `@lancedb/lancedb` mở/add/search chạy được ở
  **cả** vitest (Node 24) **và** Electron main (`npm run dev`). Nếu lỗi ABI → xem research.md R2.
- Ollama chạy local với model embedding (vd `nomic-embed-text`) cho luồng ready đầy đủ; hoặc tắt để kiểm
  nhánh `awaiting_embedding`.
- Fixture: `tests/fixtures/sample.pdf` (2–3 trang), `sample.docx`, `sample.txt`, `sample.md`.

## Gate lệnh (Constitution IV)

```bash
npm run lint
npm run test          # unit (vitest) — coverage ≥80% business logic ingestion
npm run build         # electron-vite build main/preload/renderer
npm run test:e2e      # Playwright _electron (cần build)
```

## Kịch bản kiểm chứng (map tới User Stories / SC)

### QS1 — Nạp PDF → ready (US1, SC-001/002/004)

1. `npm run dev`, tạo/mở một notebook.
2. "Thêm nguồn" → kéo-thả `sample.pdf`.
3. **Mong đợi**: nguồn qua `queued→processing→ready`, thanh tiến độ chạy; cột Nguồn hiện "PDF · N trang";
   card notebook đếm "1 nguồn".
4. Kiểm dữ liệu (dev): mỗi `chunk` có `char_start<char_end`, `page` đơn trị (không vắt trang);
   LanceDB có vector khớp mọi `chunk.id`.
5. Khởi động lại app → nguồn vẫn `ready`, số nguồn không đổi (SC-004).

### QS2 — Nạp URL + privacy (US2, SC-006)

1. "Thêm nguồn" → URL → dán một bài viết công khai `https://…`.
2. **Mong đợi**: trong lúc fetch, chỉ báo riêng tư = "online"; xong → "local"; nguồn `ready`, nhãn "Web".
3. Thử URL `http://localhost` / `http://192.168.0.1` → nguồn `error` "Lỗi tải trang" (chặn SSRF), không fetch.

### QS3 — Lỗi, retry, xoá cascade (US3, SC-003/007)

1. Nạp một tệp > giới hạn (vd PDF 60MB) → nguồn `error` "Tệp quá lớn"; nguồn hợp lệ khác trong hàng đợi vẫn
   `ready` (SC-007).
2. Bấm "Thử lại" trên nguồn lỗi (sau khi thay tệp hợp lệ) → chạy lại → `ready`.
3. Xoá một nguồn `ready` → số nguồn giảm; kiểm SQLite `chunk` của nó = 0 hàng, LanceDB không còn vector
   `source_id` đó (SC-003).
4. Xoá cả notebook → toàn bộ source/chunk/vector của notebook bị dọn (SC-003).

### QS4 — Runtime offline → awaiting_embedding → auto ready (US4, SC-005)

1. Tắt Ollama → nạp `sample.txt` → nguồn dừng ở `awaiting_embedding` (đã có chunk văn bản, chưa vector).
2. Bật Ollama → nguồn **tự động** nhúng tiếp → `ready` mà không thao tác thêm.

### QS5 — Bảo mật/log (SC-008, Constitution III)

- Chạy dev ở chế độ log chi tiết → rà log: KHÔNG có mục nào chứa nội dung tài liệu / tên nguồn nhạy cảm.
- Kiểm renderer bundle KHÔNG import pdfjs/mammoth/jsdom/lancedb (chỉ ở main).

## Unit test trọng tâm (tất định, không cần Electron)

- `chunker.test.ts`: locator half-open trong `[0,len]`, overlap ~150, PDF không vắt trang, mọi chunk có
  locator (SC-002).
- `ssrf-guard.test.ts`: bảng IP loopback/private/link-local + hostname localhost + redirect-to-internal đều
  chặn; public pass.
- `source-repo.test.ts`: `:memory:` SQLite, migration 1→2, cascade xoá source→chunk; dedup theo
  `(notebook_id, content_hash)`.
- `ingestion-pipeline.test.ts`: FIFO tuần tự; provider `test()` fail → `awaiting_embedding`, sẵn sàng → resume;
  retry dọn dữ liệu một phần. Dùng mock vector-store + mock provider + mock fetch + fixture.
- `source-status.test.ts`: nhãn tiếng Việt + ánh xạ `.stat` + aggregate "đã lập chỉ mục / đang xử lý M".
- `source-ipc-whitelist.test.ts`: 6 kênh mới whitelisted, ngoài danh sách bị từ chối.
