# Quickstart — 059 embed-in-process

Kịch bản kiểm chứng feature chạy đúng đầu-cuối. Chi tiết interface xem [contracts](./contracts/ipc-and-interfaces.md),
thực thể xem [data-model](./data-model.md).

## Điều kiện

- Đã build renderer/main (`npm run build` hoặc `npm run dev`).
- Model embedding tải lần đầu cần mạng (~120MB) → sau đó offline.

## Kịch bản 1 — Embedding không cần Ollama (P1)

1. **Tắt Ollama** hoàn toàn.
2. Tạo notebook mới, nạp 1 PDF/URL có văn bản.
3. **Kỳ vọng**: nguồn xử lý tới "sẵn sàng", số chunk > 0 (nhúng in-process). Lần đầu hiện **badge egress**
   (tải model), sau đó tắt.
4. Hỏi 1 câu có trong nguồn → câu trả lời kèm chip `[n]`.
5. Bấm chip `[n]` → mở đúng nguồn, cuộn tới **đúng đoạn** (locator giữ nguyên — Constitution II).
6. Hỏi câu KHÔNG có trong nguồn → "không tìm thấy trong nguồn" (ngưỡng e5 đã hiệu chỉnh), không bịa.

## Kịch bản 2 — Tái lập chỉ mục dữ liệu cũ ở nền (P2)

1. Có sẵn notebook lập chỉ mục bằng bản cũ (vector 768d).
2. Mở app bản mới → **tiến trình nền** bắt đầu; UI hiện "đang tái lập chỉ mục" + tiến độ.
3. Mở notebook chưa xong → báo "đang tái lập chỉ mục" thay vì trả kết quả sai.
4. **Tắt app giữa chừng**, mở lại → tiến trình **tiếp tục** từ phần dở (không làm lại từ đầu, không trùng).
5. Khi xong → hỏi đáp trả kết quả đúng; khởi động lần sau **không** chạy lại reindex (version đã bump).

## Kịch bản 3 — Gợi ý model theo RAM + health Ollama (P3)

1. Mở **Cài đặt → AI**.
2. **Kỳ vọng**: gợi ý cỡ model khớp RAM máy (vd 16GB → 7–8B) kèm giải thích ngắn.
3. Khi Ollama chưa chạy → hiện trạng thái + hướng dẫn; khi model đang chọn chưa pull → báo rõ. App **không**
   tự tải model.

## Kiểm thử tự động

```bash
npm run lint
npm run test        # unit hàm thuần: e5-prefix, model-version, model-recommend, planReindexBatches,
                    # vector-normalize, ngưỡng relevance; integration DI mock: retrieval locator giữ +
                    # "đang reindex" guard, ingestion embed passage, runReindex resume/idempotent
npm run build
npx playwright test # e2e: chip [n] map đúng sau đổi engine; Cài đặt hiện gợi ý model
```

**Ngưỡng đạt**: lint/test/build xanh; coverage business logic ≥ 80% (loại I/O: embed-model, ollama-health,
reindex-runner, vector-store — theo tiền lệ 045/011).

## Điểm dễ sai (để reviewer soi)

- Tiền tố e5 **query vs passage** dùng đúng chỗ (query ở retrieval, passage ở ingestion/reindex).
- `RELEVANCE_MAX_DISTANCE` phải hạ cho e5 (cosine hẹp) — nếu quên, "không tìm thấy" mất tác dụng.
- Reindex **resume qua LanceDB presence**, KHÔNG state riêng → bump version **chỉ khi toàn bộ xong**.
- Badge egress chỉ khi **tải model lần đầu** — KHÔNG bật lúc nhúng thường (tránh báo egress sai).
- KHÔNG log nội dung chunk/câu hỏi/đường dẫn (Constitution III).
