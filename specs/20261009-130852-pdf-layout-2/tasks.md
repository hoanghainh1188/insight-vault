# Tasks: Bố cục PDF đợt 2 (147)

**Input**: `specs/20261009-130852-pdf-layout-2/` (plan, spec, research R1–R8, data-model, contracts/pdf-layout-2.md, quickstart)

> **Sửa sau analyze (2026-10-09):** tên test viewer cũ (T005); dự phòng lưới khi phân tích bảng lỗi (T002, T004 — FR-012).

**Tests**: BẮT BUỘC (Constitution IV — TDD): hàm thuần viết test trước, chạy thấy FAIL rồi mới code.

**Quy ước**: không chạy prettier lên `docs/00-glossary.md`, `docs/04-decisions/INDEX.md` (sửa bằng script). Mỗi đợt = một PR (clarify #25); commit theo task nhóm.
`[P]` = khác tệp, không phụ thuộc.

---

## Phase 1: Setup

- [X] T001 Append glossary bằng script (KHÔNG prettier): lưới bảng / ô bảng (`parsePdfTables`, `PdfTable`, `TableCell`), công tắc dạng xem (Dạng lưới / Dạng văn bản),
      xoay trang hiển thị (`toDisplayItem`, viewport), bảng số căn phải (`detectRightAlignedTable`, `looksNumeric`), quyết định gạch nối (`decideHyphen`, `Lexicon`) —
      `docs/00-glossary.md`.

---

## Phase 2: Đợt 1 (PR1) — User Story 1: Lưới bảng trong Trình xem nguồn (Priority: P1) 🎯 MVP

**Goal**: bảng của PDF hiện dạng lưới, tô sáng theo ký tự trong ô, công tắc dạng xem; không đổi phiên bản trích xuất.

**Independent Test**: PDF đã nạp có bảng ⇒ lưới + tô sáng đúng; "Dạng văn bản" như cũ; nguồn không phải PDF không đổi.

- [X] T002 [US1] Viết test TRƯỚC `tests/unit/pdf-tables.test.ts` cho `parsePdfTables` (`src/shared/pdf-tables.ts`): bảng `renderTable` chuẩn ⇒ ô đúng `{start,end,text}`
      (không gồm `|`, đệm), ô rỗng, `\|` trong ô, nhiều bảng, bảng hai trang (không vắt `pageBreaks`), dòng `| x | y |` lẻ trong đoạn văn ⇒ không phải bảng, số ô lệch ⇒ không,
      thiếu hàng phân cách ⇒ không; đầu vào dị thường (văn bản rất dài, `|` lồng) không ném — trả `[]` (FR-012); `numericColumns`; test thuộc tính `text.slice(c.start, c.end)` khớp `c.text` (trừ thoát). Chạy thấy FAIL; hiện thực ⇒ xanh.
- [X] T003 [US1] Viết test TRƯỚC trong `tests/unit/highlight.test.ts`: `buildSegments(text, hl, pageBreaks, tables)` ⇒ khối `text` / `table`; vùng tô bắt đầu giữa ô, phủ
      nhiều hàng, phủ trọn ô, nằm hẳn ngoài bảng; thuộc tính: hợp ký tự được tô == `text.slice(a,b)` bỏ ký tự khung; 157/159 (trimRange / alignStart) vẫn áp; không truyền
      `tables` ⇒ kết quả như cũ (test cũ giữ kỳ vọng). FAIL ⇒ sửa `src/renderer/features/source-viewer/highlight.ts` ⇒ xanh.
- [X] T004 [US1] Viết test TRƯỚC (jsdom) `tests/unit/source-table-ui.test.ts`: `SourceTable` có vai trò `table`, `columnheader` (hàng đầu), `aria-label` "Bảng 1 — trang 2"
      (vi / en), ô số căn phải, `<mark>` đúng ô + nhãn `[n]` ở đoạn tô đầu; `SourceViewer` với nguồn PDF có bảng ⇒ lưới mặc định, công tắc `viewer-view-text` ⇒ văn bản cũ,
      lựa chọn nhớ trong phiên (sessionStorage, chịu lỗi), nguồn `md` ⇒ không lưới / không công tắc; `parsePdfTables` ném (mock) ⇒ hiển thị văn bản như cũ (FR-012); CSS bảng có `overflow-x: auto` + vùng cuộn `tabindex=0`. FAIL.
- [X] T005 [US1] Hiện thực `src/renderer/features/source-viewer/SourceTable.tsx`, sửa `SourceViewer.tsx` (dùng khối, công tắc), `source-viewer.css`, i18n `viewer.table.label`,
      `viewer.view.grid`, `viewer.view.text` (+ aria) vi / en (`src/shared/i18n/domains/viewer.ts`); T004 xanh; `highlight`, `source-viewer-audio` / `-image` / `-stale` unit cũ xanh.
- [X] T006 [US1] E2E `tests/e2e/source-viewer-grid.spec.ts`: nạp PDF fixture có bảng (`borderlessTable`) + Ollama giả trả câu có `[1]` trỏ chunk bảng ⇒ bấm chip ⇒
      `viewer-table-*` hiển thị, `<mark>` trong ô, nhãn `[n]`; công tắc sang văn bản; ảnh chụp 900 px vi / en không tràn. ADR phần (e) (`docs/04-decisions/2026-10-09-pdf-layout-2.md`,
      thay một phần 112 #6) + INDEX bằng script. **Commit + PR1.**

---

## Phase 3: Đợt 2 (PR2) — User Story 2 + 5: Trang xoay + phiên bản + gợi ý Xử lý lại (Priority: P1 / P3)

- [ ] T007 [US2] Mở rộng `tests/fixtures/pdf/make-pdf.ts`: `rotate: 0 | 90 | 180 | 270`, tuỳ chọn vẽ nội dung theo hướng ngược để hiển thị thẳng, `cropBox` lệch gốc; `samples.ts`
      `rotated90/180/270` (cùng nội dung với `twoColumns` + `borderlessTable`), `cropOffset`; test fixture (`pdf-fixture.test.ts`) đọc được `/Rotate`.
- [ ] T008 [US2] Viết test TRƯỚC `tests/unit/pdf-adapter.test.ts`: `toDisplayItem(item, vpTransform)` 0 / 90 / 180 / 270 (toạ độ hiển thị, `rotated` theo hướng hiển thị),
      ghi chú bên lề vẫn `rotated`; `tests/unit/pdf-parse-layout.test.ts`: `parsePdf` của `rotated90/270` == văn bản trang thẳng, `rotated180` (chữ hiển thị thẳng) == trang
      thẳng, `cropOffset` đúng, PDF không xoay không đổi. FAIL ⇒ sửa `src/main/services/ingestion/parsers/pdf.ts` (viewport, `toDisplayItem` — tách `pdf-viewport.ts` nếu
      dài; dự phòng hệ chưa xoay khi lỗi) ⇒ xanh. Ghi kết quả thí nghiệm pdf.js vào ADR.
- [ ] T009 [US5] Viết test TRƯỚC: `tests/unit/ingestion-pdf-blocks.test.ts` `PDF_EXTRACTION_VERSION === 3`; `tests/unit/reprocess-hint.test.ts` `reprocessHintKey(1|2|3)`;
      `SourceItem` (jsdom, có sẵn `tests/unit/source-reprocess-ui.test.ts`) — v1 ⇒ câu "giữ bố cục", v2 ⇒ câu "cải thiện bảng, trang xoay và gạch nối", v3 ⇒ không gợi ý.
      FAIL ⇒ sửa `src/shared/ipc/types.ts` (3), `reprocessHintKey` (`src/renderer/features/sources/reprocess-hint.ts`), `SourceItem.tsx`, i18n `sources.item.reprocessHintV2`
      (+ aria) vi / en ⇒ xanh; `tests/e2e/source-reprocess.spec.ts` cập nhật câu.
- [ ] T010 ADR phần (c) + phiên bản; perf `pdf-parse-perf` thêm trang xoay vào mẫu 50 trang (≤ 2×). **Commit + PR2.**

---

## Phase 4: Đợt 3 (PR3) — User Story 3: Bảng số căn phải (Priority: P2)

- [ ] T011 [US3] `samples.ts`: `financialTable` (4 cột số căn phải, tiêu đề 2 dòng căn phải / giữa, số âm ngoặc, `1.234,5` và `1,234.5`, hàng tổng), `decimalTable`; mẫu âm
      `tocNoLeader`, `keyValueList`, `justifiedParagraph`, `signatureBlock`.
- [ ] T012 [US3] Viết test TRƯỚC `tests/unit/pdf-layout-numeric.test.ts`: `looksNumeric` (dương / âm: ngày, mã, số trang, chữ), `decimalAnchor`. FAIL ⇒ hiện thực
      `src/main/services/ingestion/pdf-layout/numeric.ts` ⇒ xanh.
- [ ] T013 [US3] Viết test TRƯỚC trong `tests/unit/pdf-layout-tables.test.ts` + `pdf-parse-layout.test.ts`: `financialTable` / `decimalTable` ⇒ bảng Markdown đúng ô; mẫu âm ⇒ 0
      bảng; mọi test bảng căn trái hiện có giữ kỳ vọng; lỗi trong đường phụ (chèn lỗi) ⇒ kết quả như trước đường phụ. FAIL ⇒ hiện thực `detectRightAlignedTable` trong
      `tables.ts` (đường phụ + ngưỡng R5 + try/catch) ⇒ xanh.
- [ ] T014 Perf mẫu thêm bảng số (≤ 2×); ADR phần (b) + số đo. **Commit + PR3.**

---

## Phase 5: Đợt 4 (PR4) — User Story 4: Gạch nối (Priority: P2)

- [ ] T015 [US4] Tập cặp từ gắn nhãn `tests/fixtures/pdf/hyphen-pairs.ts` (≥ 40: ngắt thật, ghép thật có / không bằng chứng, gạch treo, tiếng Việt, U+2010 / U+2011);
      `samples.ts` `hyphenCompounds` (Anh + Việt, có "long-term" giữa dòng).
- [ ] T016 [US4] Viết test TRƯỚC `tests/unit/pdf-layout-hyphen.test.ts` cho `decideHyphen` + `buildLexicon` (`src/main/services/ingestion/pdf-layout/hyphen.ts`): từng luật R6,
      tiếng Việt ⇒ keep, mâu thuẫn bằng chứng ⇒ default, tập cặp từ ⇒ ≥ 95% đúng nhóm "chắc" và không kém hành vi cũ, 0 tiếng Việt nối dính. FAIL ⇒ hiện thực ⇒ xanh.
- [ ] T017 [US4] Sửa `tests/unit/pdf-layout-paragraphs.test.ts` (`hợp-đồng` thay `hợpđồng`; `long-term` khi có lexicon; `hyphenated` giữ) — viết trước, FAIL; sửa `paragraphs.ts`
      (`appendLine` dùng `decideHyphen`), `tables.ts` (phần tiếp ô), `parsers/pdf.ts` (tiền quét lexicon khi có ngắt dòng gạch; dự phòng hành vi cũ) ⇒ xanh;
      `tests/unit/fts-hyphen.test.ts`: chunk "long-term" khớp truy vấn "long term" và "long-term".
- [ ] T018 Perf mẫu thêm gạch nối (≤ 2×, lexicon trượt nếu vượt); ADR đầy đủ (4 phần, số đo, Giới hạn: ô gộp, gạch vắt cột / trang, ngôn ngữ khác, 180°) + INDEX; test gate:
      `npm run lint`, `npm test` (coverage ≥ 80%), `npx electron-vite build`, `npx playwright test`; quickstart thủ công. **Commit + PR4.**

---

## Dependencies

T001 → PR1 (T002 → T003 → T004 → T005 → T006) → PR2 (T007 → T008; T009 ∥ T008; T010) → PR3 (T011 → T012 → T013 → T014) → PR4 (T015 → T016 → T017 → T018).
PR1 độc lập phiên bản; PR2 tăng phiên bản (PR3 / PR4 dùng lại nếu chưa phát hành giữa chừng — R4).

## Implementation Strategy

MVP = PR1 (lưới — có ngay cho PDF đã nạp). Mỗi PR merge riêng; phát hành sau PR4 (hoặc sau PR2 nếu cần, khi đó PR3 / PR4 tăng phiên bản tiếp — ghi ADR).
