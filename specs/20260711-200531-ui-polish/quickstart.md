# Quickstart — UI Polish v1 (023-ui-polish)

Kiểm chứng UI + a11y + chống hồi quy. Chi tiết token xem `data-model.md`, hợp đồng UI xem
`contracts/ui-contract.md`.

## Chạy

```bash
npm run dev        # xem trực quan các màn
npm run test       # unit (useModalA11y focus-trap/escape nếu tách; helper nếu có)
npm run test:e2e   # e2e — ui-polish.spec.ts + GIỮ mọi spec cũ xanh
npm run lint && npm run build
```

## Kịch bản kiểm chứng (map Success Criteria)

### 1. Citation vàng nhất quán (US1 · SC-001, SC-007)

- Mở Chat có câu trả lời + Studio có card + Xem nguồn highlight → chip `[n]` và highlight đều **vàng**
  (`--cite*`), phân biệt rõ với nút xanh (`--accent`). Bấm chip → vẫn mở đúng nguồn/đoạn (SC-002).
- Kiểm tương phản `--cite` trên `--cite-bg` ≥ 4.5:1.

### 2. Khớp wireframe (US2)

- NavRail: rail icon-only, Settings đáy, mỗi mục có tooltip/aria-label.
- Composer: chỉ báo model "Local · <model>", mode segmented, nút gửi icon.
- Bubble: nhãn "InsightVault"/"Bạn"; tin AI không nền bubble.
- Gửi 1 câu hỏi → luồng hỏi đáp chạy y như trước (không đổi hành vi).

### 3. A11y + trạng thái (US3 · SC-003, SC-004, SC-006)

- Notebooks rỗng → empty state; tìm không khớp → no-result.
- Gửi câu hỏi → skeleton khi chờ.
- Chỉ dùng bàn phím: Tab tới nav/nút → viền focus rõ; mở modal Thêm nguồn/Notebook → **Escape đóng**;
  Tab không rời modal (focus trap); modal có `aria-modal`.

### 4. Local-first & không hồi quy (SC-002, SC-005, SC-008)

- `no-egress.spec` xanh (icon inline, 0 request ngoài).
- Rà mã: không còn màu hardcode cho các màu đã token hoá.
- Toàn bộ e2e cũ (rag-qa/source-viewer/studio/notebook/ingestion/security…) xanh.

### 5. Reduced-motion (edge)

- Bật giảm chuyển động OS → transition/skeleton giảm/tắt, không giật layout.

## Định nghĩa hoàn thành (Done)

- [ ] Unit xanh (hook a11y nếu tách). e2e: `ui-polish.spec` + toàn bộ spec cũ xanh (SC-002).
- [ ] `npm run lint && npm run build` xanh.
- [ ] Rà: 0 màu hardcode cho token đã gom (SC-005); 0 network egress (SC-008).
- [ ] Đối chiếu trực quan 5 màn với `prototype.html` đạt.
