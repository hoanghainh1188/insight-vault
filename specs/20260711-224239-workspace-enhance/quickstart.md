# Quickstart — Workspace enhancements (025)

Kiểm chứng 3 nhóm + chống hồi quy. Chi tiết: `data-model.md`, `contracts/ipc-channels.md`.

## Chạy

```bash
npm run dev        # xem Workspace
npm run test       # unit — export-name/column-widths/last-notebook/whitelist
npm run test:e2e   # e2e — workspace-enhance.spec + GIỮ mọi spec cũ xanh
npm run lint && npm run build
```

## Kịch bản (map Success Criteria)

### 1. Ngân sách rộng hơn, chip [n] chính xác (US1 · SC-001, SC-002)

- Notebook trước bị cắt (nay trong ngân sách 16000) → tạo tổng hợp → bao phủ trọn vẹn; chip `[n]` mở đúng
  **đoạn** (Source Viewer highlight chính xác). Notebook vượt 16000 → `truncated` + ghi chú "dựa trên phần
  đầu" (như 021). **KHÔNG map-reduce.**

### 2. Lọc theo nguồn (US2 · SC-003)

- Chọn 1 nguồn ở dropdown cột Studio → tạo → nội dung chỉ từ nguồn đó; đổi "Tất cả nguồn" → cả notebook.

### 3. Copy / Export (US3 · SC-004)

- Bấm **Sao chép** → nội dung vào clipboard (phản hồi "đã sao chép"). Bấm **Xuất** → hộp thoại lưu → tệp
  `.md` khớp nội dung; **huỷ** → không ghi. Đang tạo → **skeleton**.
- Unit: `sanitize` tên tệp; e2e: `studio:export` whitelisted; Copy (mock clipboard).

### 4. Kéo đổi độ rộng cột (US4 · SC-005)

- Kéo thanh chia Nguồn|Chat → cột Nguồn đổi rộng (giới hạn min/max), Chat co giãn. Reload app → độ rộng giữ.
- Unit `column-widths`: `clampWidths` min/max; parse localStorage hỏng → default.

### 5. Nav nhớ notebook (US5 · SC-006)

- Mở notebook X → bấm mục Workspace ở nơi khác → về đúng X. Xoá X → bấm Workspace → lời nhắc "Chọn notebook".
- Unit `last-notebook`: get/set; e2e: mở nb→nav workspace→đúng nb.

### 6. Local-first & không hồi quy (SC-007, SC-008)

- `no-egress.spec` xanh (export ghi file local, không mạng). Mọi e2e cũ (rag-qa/source-viewer/studio/
  notebook/ingestion/ui-polish/security) xanh.

## Định nghĩa hoàn thành (Done)

- [ ] Unit xanh: export sanitize · column-widths clamp · last-notebook · whitelist (+studio:export).
      Coverage ≥80% business logic.
- [ ] e2e: workspace-enhance.spec (dropdown/kéo cột+persist/nav/export/Copy) + toàn bộ spec cũ xanh (SC-007).
- [ ] `npm run lint && npm run build` xanh. KHÔNG migration (user_version giữ 3).
