# Tasks: Trích PDF giữ nguyên hộp thông tin và tiêu đề cột bảng

**Input**: `specs/20261014-221336-pdf-infobox-table-header/` (spec.md, plan.md, research.md, data-model.md, contracts/pdf-layout-delta.md, quickstart.md)

**Quy ước**: TDD bắt buộc (Constitution IV) — mỗi nhóm "Test" viết TRƯỚC, chạy thấy FAIL rồi mới viết mã. Hàm thuần trong `src/main/services/ingestion/pdf-layout/`; mỗi file < 800 dòng (`tables.ts` hiện 420, không nở > 100). Không IPC / model / mạng mới ⇒ không cần security-reviewer. Glossary: chỉ THÊM dòng mới (rule 5).

## Phase 1: Cổng khả thi (bước 0 — DỪNG nếu không đạt)

- [x] T001 Dựng script đo tạm (không commit, đặt ở thư mục scratchpad) nạp bộ chấm hiện hành bằng `loadScorer` (`tests/eval/lib/rerank.ts`, cấu hình `RELEVANCE_CALIBRATION.rerank`, KHÔNG tải model mới — dùng model đã có trong cache eval) và chấm cặp (câu hỏi, đoạn).
- [x] T002 Chấm văn bản LÝ TƯỞNG viết tay: q-162 = hàng tiêu đề đầy đủ ("Ký hiệu | Tên ga Tiếng Việt | Tên ga Tiếng Anh | Tuyến trung chuyển | Tuyến xe buýt | Khoảng cách (km) Ga trước | Khoảng cách (km) Ga Cát Linh | Phường") + dòng Láng; q-185 = bảng hộp "Khổ đường sắt / Điện khí hóa / Tốc độ" sạch. Ghi điểm vào `research.md` (mục "Kết quả cổng").
- [x] T003 Quyết định cổng: cả hai ≥ minScore (0,6) ⇒ làm tiếp tất cả; chỉ một ⇒ giữ story tương ứng, ghi story kia "không áp dụng"; không câu nào ⇒ DỪNG, viết ADR `docs/04-decisions/2026-10-1x-pdf-infobox-table-header.md` kết luận giới hạn đã biết + INDEX, báo chủ dự án.

**Checkpoint**: cổng KHÔNG ĐẠT (2026-10-14, xem research.md) ⇒ DỪNG; T004–T030 đánh dấu `[~]` = không thực hiện (ADR 2026-10-14-pdf-infobox-table-header).

## Phase 2: Nền (chặn mọi story)

- [~] T004 Chụp "ảnh chuẩn" văn bản trích hiện tại: viết `tests/unit/pdf-layout-regression.test.ts` so `layoutPage` trên TẬP fixture hiện có (các hàm `make-pdf-layout`, fixture bảng số / trang xoay / gạch nối / nhiều cột trong `tests/unit/*pdf*`) với snapshot văn bản đã commit — phải XANH trước khi sửa mã (FR-004 / SC-005).
- [~] T005 [P] Thêm hằng số có tên vào `src/main/services/ingestion/pdf-layout/types.ts`: `SIDE_COLUMN_MIN_LINES`, `HEADER_GAP_MAX`, `HEADER_MAX_LINES` (giá trị khởi đầu theo research D1/D3; chốt ở T012/T019).
- [~] T006 [P] Viết helper fixture item `tests/unit/helpers/pdf-layout-items.ts`: dựng `LayoutItem[]` mô phỏng hình học trang 2 (cột thân bài x 43–190 + hộp nhãn x≈206 / giá trị x≈265) và trang 5 (tiêu đề nhiều dòng canh giữa trên 8 cột), dùng số liệu ở research.md nhưng nội dung đã rút gọn.

## Phase 3: User Story 1 — ghép tiêu đề cột bảng (P1) 🎯 MVP

**Goal**: bảng có tiêu đề nhiều dòng phía trên → đúng MỘT hàng tiêu đề; q-162 không bị từ chối.
**Independent Test**: `tests/unit/pdf-layout-table-header.test.ts` xanh + q-162 qua eval.

### Test (viết trước, thấy FAIL)

- [~] T007 [P] [US1] `tests/unit/pdf-layout-table-header.test.ts`: (a) dải tiêu đề 8 dòng canh giữa → một hàng tiêu đề đúng thứ tự; (b) tiêu đề phủ 2 cột → "Khoảng cách (km) · Ga trước" / "· Ga Cát Linh"; (c) không chắc (segment không chồng lấn cột nào / > `HEADER_MAX_LINES` / có đoạn văn ngay trên) ⇒ trả về rỗng, văn bản như cũ; (d) bảng đã có tiêu đề một dòng ⇒ không đổi; (e) tất định (2 lần giống hệt).
- [~] T008 [P] [US1] Mở rộng `tests/unit/ingestion-pdf-blocks.test.ts`: `blocks` của bảng có tiêu đề ghép vẫn đúng offset, `cleanText(text) === text`.

### Hiện thực

- [~] T009 [US1] `src/main/services/ingestion/pdf-layout/table-header.ts` (hàm thuần): `buildHeaderBand(anchors, linesAbove)` theo research D3 → `HeaderBand`.
- [~] T010 [US1] Nối vào `src/main/services/ingestion/pdf-layout/tables.ts`: sau khi có cột dữ liệu, lấy dải tiêu đề phía trên, chèn một hàng tiêu đề + `|---|` vào `renderTable`; lỗi / rỗng ⇒ hành vi cũ (try/catch, `logEvent("pdf.layout.fallback", { feature: "table-header" })` không kèm nội dung).
- [~] T011 [US1] Chạy T004 (ảnh chuẩn phải KHÔNG đổi) + T007/T008 xanh.
- [~] T012 [US1] Dump văn bản thật `tuyen-2a-ha-noi.pdf` (script khảo sát như research.md): trang 5 có đúng một hàng tiêu đề; đọc tay mọi trang khác — diff không đổi hoặc cải thiện; chốt `HEADER_GAP_MAX` / `HEADER_MAX_LINES`.

**Checkpoint**: US1 độc lập — có thể dừng và đo (Phase 5) nếu US2 bị hoãn.

## Phase 4: User Story 2 — tách hộp thông tin (P1)

**Goal**: cột thân bài hẹp + hộp bên lề thành hai vùng; hộp là bảng 2 cột sạch; q-185 không bị từ chối.
**Independent Test**: `tests/unit/pdf-layout-side-box.test.ts` + `pdf-layout-columns.test.ts` xanh + q-185 qua eval.

### Test (viết trước, thấy FAIL)

- [~] T013 [P] [US2] `tests/unit/pdf-layout-columns.test.ts` (bổ sung): cột thân bài hẹp canh trái (≥ `SIDE_COLUMN_MIN_LINES` dòng, mép trái thẳng) cạnh vùng khác ⇒ tách hai vùng, thân bài trước; các ca KHÔNG tách: bảng nhiều ô hẹp, danh sách đánh số, hai cột văn bản thường (đã tách bằng đường cũ — không đổi), cột hẹp < số dòng tối thiểu, mép trái lệch.
- [~] T014 [P] [US2] `tests/unit/pdf-layout-side-box.test.ts`: (a) hộp nhãn / giá trị với nhãn xuống dòng ("Khổ" + "đường sắt", "Điện khí" + "hóa") ⇒ "Khổ đường sắt", "Điện khí hóa"; (b) giá trị xuống dòng nối vào giá trị hàng trước; (c) hộp một cặp / ô gộp ⇒ không phải hộp, giữ cách cũ; (d) thân bài không còn mảnh của hộp; (e) hộp + bảng thường trên cùng trang tách riêng.

### Hiện thực

- [~] T015 [US2] `src/main/services/ingestion/pdf-layout/columns.ts`: nhánh "cột thân bài hẹp" ở `splitAt` (research D1) — KHÔNG đổi `DENSE_COLUMN_RATIO`; nhánh mới chỉ kích hoạt khi thoả điều kiện hẹp; ca khác đi đường cũ y nguyên.
- [~] T016 [US2] `src/main/services/ingestion/pdf-layout/side-box.ts` (hàm thuần): gộp dòng nối tiếp nhãn / giá trị (research D2) → hàng cho `renderTable`.
- [~] T017 [US2] Nối vào `tables.ts` / `layout-page.ts` cho vùng bên; lỗi ⇒ cách cũ + `logEvent("pdf.layout.fallback", { feature: "side-box" })`.
- [~] T018 [US2] T004 (ảnh chuẩn không đổi) + T013/T014 xanh.
- [~] T019 [US2] Dump `tuyen-2a-ha-noi.pdf`: trang 2 có bảng hộp sạch ("| Khổ đường sắt | 1.435 mm … |", "| Điện khí hóa | Ray thứ ba 750V DC |"), thân bài liền mạch; đọc tay cả 12 trang; chốt `SIDE_COLUMN_MIN_LINES`.

**Checkpoint**: US1 + US2 đủ để đo.

## Phase 5: User Story 3 — phiên bản, xử lý lại, không câu nào tụt (P2)

- [~] T020 [US3] Test trước: chỗ test `reprocess-hint` / `SourceItem` hiện có khẳng định nguồn `extractionVersion = 3` hiện gợi ý Xử lý lại khi `PDF_EXTRACTION_VERSION = 4`.
- [~] T021 [US3] `src/shared/ipc/types.ts`: `PDF_EXTRACTION_VERSION` 3 → 4 + chú thích (206: hộp thông tin + tiêu đề bảng); cập nhật test/e2e đang gắn cứng số 3 (grep).
- [~] T022 [US3] Đo: `EVAL_DETAILS=1 npm run eval:retrieval`; so từng câu với mốc v5 (báo cáo `tests/eval/reports`); kiểm SC-001…SC-006 (q-162, q-185 cứu; 0 câu tụt; sàn tiếng Anh R@6 ≥ 72,7% & từ chối ≥ 83,3%; dev vi ≥ 87,8%, hold-out ≥ 84,2%; trích ≤ 1000 ms; tất định).
- [~] T023 [US3] Quote bộ đo (D5): nếu quote q-185 (hoặc câu PDF khác) không còn khớp, đổi CHỈ chuỗi quote sang văn bản mới (không đổi câu hỏi / loại / split); liệt kê câu + quote cũ → mới trong PR để chủ dự án duyệt; cập nhật `datasetVersion` nếu convention yêu cầu; chạy lại T022.
- [~] T024 [US3] Nếu eval cho thấy q-162 / q-185 vẫn bị từ chối dù trích đúng: KHÔNG nới ngưỡng; ghi số thật vào ADR và đề xuất bước tiếp (ví dụ #207).

## Phase 6: Hoàn thiện & cổng

- [~] T025 [P] ADR `docs/04-decisions/2026-10-1x-pdf-infobox-table-header.md` (quyết định D0–D5, số đo trước / sau, câu đổi quote) + dòng INDEX.md (đọc `docs/04-decisions/INDEX.md` trước, chỉ THÊM dòng).
- [~] T026 [P] Glossary: THÊM thuật ngữ mới nếu có ("hộp thông tin / infobox", "cột thân bài hẹp") vào `docs/00-glossary.md` — chỉ append; sửa dòng cũ ⇒ PR riêng.
- [~] T027 [P] `tests/eval/README.md`: ghi cách tái tạo số đo; cập nhật tasks này + memory dự án.
- [~] T028 Test gate: `npm run lint && npm run test && npm run build && npx playwright test`; coverage ≥ 80% phần mới; `code-reviewer` + `glossary-steward`.
- [~] T029 Kiểm tay (quickstart bước 5–6): mở PDF Tuyến 2A, hỏi q-185, bấm chip → trang 2 + vùng tô là hộp; nguồn PDF cũ hiện gợi ý Xử lý lại.
- [~] T030 Mở PR (Part of #187, Closes #206), thân PR có bảng số đo trước / sau, danh sách quote đổi, và kết quả cổng T002.

## Phụ thuộc & thứ tự

- Phase 1 (cổng) → Phase 2 → {Phase 3 (US1), Phase 4 (US2)} → Phase 5 → Phase 6.
- US1 và US2 độc lập về mã (file khác nhau trừ điểm nối ở `tables.ts` — làm tuần tự để tránh xung đột); T004 chạy lại sau mỗi story.
- Song song được: T005 ∥ T006; T007 ∥ T008; T013 ∥ T014; T025 ∥ T026 ∥ T027.

## Chiến lược

- MVP = Phase 1–3 (US1, đã đo): cứu q-162 nếu cổng cho phép; US2 thêm sau như bước độc lập.
- Mỗi bước lặp: test FAIL → mã → T004 không đổi → dump thật → mới sang bước tiếp.
- Đo độ trễ khi máy rảnh.
