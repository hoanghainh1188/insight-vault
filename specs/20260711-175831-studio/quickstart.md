# Quickstart — Studio (021-studio)

Hướng dẫn kiểm chứng end-to-end tính năng Studio. Chi tiết kiểu/kênh xem `contracts/ipc-channels.md` +
`data-model.md`.

## Prerequisites

- Đã cài dependencies (`npm install`), migration #1/#2 (011) chạy được.
- Ollama local chạy + đã chọn model chat (007) cho luồng thật; e2e dùng `UNREACHABLE_OLLAMA` cho case lỗi.
- Một notebook có ≥1 nguồn đã lập chỉ mục (status `ready`) để tạo Studio.

## Chạy

```bash
npm run dev        # bật app Electron (renderer + main)
npm run test       # unit (vitest) — studio-repo, prompt, budget, whitelist
npm run test:e2e   # e2e (Playwright _electron) — studio.spec.ts
npm run lint && npm run build
```

## Kịch bản kiểm chứng (map tới Success Criteria)

### 1. Tạo bản tổng hợp có trích dẫn (US1 · SC-001, SC-002, SC-003)

1. Mở notebook có nguồn ready → cột Studio hiện 4 nút "Tạo nhanh" (bật).
2. Bấm **Tóm tắt tài liệu** → nút hiện "Đang tạo…"; sau khi xong, một card kết quả hiện text tiếng Việt.
3. **Kỳ vọng**: card có ít nhất một chip `[n]`; bấm chip → Source Viewer (019) mở đúng nguồn + highlight
   đoạn. Không có chip nào trỏ ngoài phạm vi (đã hậu kiểm).
4. Nếu model trả nội dung không chèn `[n]` → card vẫn kèm danh sách nguồn đã dùng (chip từ `citationsFromMap`).

### 2. Bốn loại độc lập + tạo lại ghi đè (US2 · FR-001, FR-008)

1. Bấm lần lượt **Ý chính**, **FAQ**, **Dàn ý** → mỗi loại ra một card riêng đúng phong cách.
2. Bấm lại **Tóm tắt** → chỉ card Tóm tắt được thay bằng bản mới; 3 card kia giữ nguyên.

### 3. Lưu & xem lại (US3 · SC-004, FR-007, FR-009)

1. Tạo vài kết quả → chuyển sang notebook khác rồi quay lại → **các card cũ vẫn hiển thị** (nạp qua
   `studio:list`), chip vẫn bấm mở nguồn được.
2. Khởi động lại app → mở lại notebook → kết quả vẫn còn.
3. Xoá notebook → mọi `studio_result` của nó bị xoá theo (không mồ côi) — kiểm bằng unit cascade
   (`:memory:` migration #1→#3).

### 4. Chặn khi chưa sẵn sàng (edge · SC-006, FR-010, FR-011)

1. Notebook rỗng / chưa có nguồn ready → 4 nút **vô hiệu** + gợi ý "Nạp nguồn để tạo Studio".
2. Model chưa sẵn sàng (tắt Ollama / chưa chọn model) → cột Studio báo trạng thái + nút vô hiệu. Trong e2e
   với `UNREACHABLE_OLLAMA`, nếu kích hoạt tạo → thông báo lỗi thân thiện, **không** sinh nội dung bịa.

### 5. Local-first & an toàn (SC-005 · Constitution I/III)

1. Ở chế độ mặc định, tạo bản tổng hợp → **không** phát sinh lưu lượng ra Internet (chỉ gọi Ollama local).
2. Kiểm render an toàn: nội dung có ký tự như `<b>` hiển thị nguyên văn (không thực thi HTML) — e2e assert
   không `innerHTML`.
3. Log không chứa nội dung tài liệu/kết quả (chỉ id/kind/notebookId/error-label).

## Định nghĩa hoàn thành (Done)

- [ ] Unit xanh: `studio-repo` (upsert ghi đè UNIQUE, listByNotebook, cascade, (de)serialize citations),
      `prompt` (4 kind + có "[n]"/"không bịa"), `buildContext` budget param (rag cũ không đổi), whitelist
      2 kênh. Coverage ≥80% business logic.
- [ ] e2e xanh: 5 nhóm kịch bản trên.
- [ ] `npm run lint && npm run build` xanh.
- [ ] Migration #3 nâng user_version 2→3, chạy idempotent trên DB đã có (011/013).
