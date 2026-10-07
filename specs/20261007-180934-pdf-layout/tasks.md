---
description: "Task list — 112 pdf-layout"
---

# Tasks: Giữ bố cục khi trích xuất văn bản từ PDF

**Input**: `specs/20261007-180934-pdf-layout/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md;
quyết định `docs/04-decisions/2026-10-07-pdf-layout-clarify.md`.

**Tests**: BẮT BUỘC (Constitution IV + yêu cầu người dùng): mọi hàm THUẦN viết test trước, chạy thấy FAIL rồi mới viết
code (RED → GREEN). Adapter I/O pdf.js phủ bằng test tích hợp trên PDF tự sinh.

**Organization**: theo user story. Thứ tự thực hiện theo yêu cầu: fixture → pdf-layout → adapter `parsePdf` → chunker →
(US4) `citationValid` + viewer → (US3) migration #9 → `replaceChunks`/`deleteByIds`/`pipeline.reprocess` → IPC + preload
→ UI → SC-006 + hồi quy 108 → ADR + glossary + gate.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup — trình sinh PDF fixture (làm đầu tiên)

**Purpose**: PDF mẫu tự sinh, không vướng bản quyền (research R13, FR-022)

- [ ] T001 Tạo `tests/fixtures/pdf/make-pdf.ts`: trình sinh PDF tối giản thuần TS (không dependency) — API `makePdf(pages: FixturePage[]): Uint8Array` với `FixturePage { width, height, rotate?: 0|90, texts: {x,y,size,text,font?:"helv"|"vi",angle?:number}[], lines?: {x1,y1,x2,y2}[] }`; viết catalog/pages/content stream (`BT /F1 size Tf x y Td (…) Tj ET`, `re`/`m l S` cho đường kẻ), xref + trailer đúng offset
- [ ] T002 Thêm font tiếng Việt vào `tests/fixtures/pdf/make-pdf.ts`: nhúng `node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf` (TrueType `FontFile2`) với `/Encoding /Differences` (tên glyph `uniXXXX` cho các ký tự dùng, tối đa 255) + `ToUnicode` CMap; ghi chú giấy phép SIL OFL (`LICENSE_LIBERATION`) trong đầu tệp
- [ ] T003 Tạo `tests/fixtures/pdf/samples.ts`: các mẫu `oneColumn()`, `twoColumns()`, `borderedTable()`, `borderlessTable()`, `tocNotTable()` (mục lục có dấu chấm dẫn), `bulletList()`, `vietnamese()` (có dấu, dạng tổ hợp), `rotatedPage()`, `hyphenated()`, `manyItems(n)`; mỗi mẫu kèm `expected` (văn bản/bảng kỳ vọng)
- [ ] T004 Smoke test `tests/unit/pdf-fixture.test.ts`: `makePdf` mở được bằng `pdfjs-dist/legacy/build/pdf.mjs`, `getTextContent` trả đúng chuỗi cho mẫu Latin và mẫu tiếng Việt (so sau NFC); nếu font nhúng không ổn ⇒ chuyển sang `pdf-lib`+`fontkit` devDependency và ghi chú cho ADR (research R13)

---

## Phase 2: Foundational — kiểu dữ liệu bố cục

- [ ] T005 Tạo `src/main/services/ingestion/pdf-layout/types.ts`: `LayoutItem {text,x,y,w,h,rotated}`, `PageGeometry {width,height}`, `LayoutResult {text, blocks:{start,end}[], fallback}`, hằng `MAX_LAYOUT_ITEMS_PER_PAGE = 5000`, `PARAGRAPH_GAP_RATIO = 1.5`, `LINE_OVERLAP_RATIO = 0.5`, `WORD_GAP_RATIO = 0.15`, `CELL_GAP_RATIO = 1`, `CELL_ALIGN_RATIO = 0.5`, `TABLE_MIN_ROWS = 3`, `TABLE_MIN_COLS = 2`, `COLUMN_GUTTER_MIN = 0.02`, `COLUMN_CROSS_MAX = 0.1`
- [ ] T006 Thêm `tests/unit/helpers/layout-items.ts`: builder tạo `LayoutItem[]` tổng hợp (dòng chữ ở toạ độ, cột, lưới bảng) dùng chung cho các test pdf-layout

**Checkpoint**: fixture + kiểu sẵn sàng.

---

## Phase 3: User Story 1 — PDF hai cột đọc đúng thứ tự, có dòng/đoạn (P1) 🎯 MVP

**Goal**: FR-001, FR-002, FR-003, FR-006, FR-007, FR-019 (SC-001, SC-003)

**Independent Test**: `parsePdf(makePdf(twoColumns()))` ⇒ văn bản đi hết cột trái rồi cột phải, có `\n\n` giữa đoạn; chunk tạo từ đó có `chunk.text === T.slice(...)`.

- [ ] T007 [P] [US1] RED — `tests/unit/pdf-layout-lines.test.ts`: gom item chồng lấn dọc ≥ 50% thành một dòng; sắp theo x; chèn đúng một dấu cách khi khe > 0,15·h (không chèn trùng khi item đã có dấu cách); bỏ item rỗng; item `rotated` tách nhóm riêng giữ thứ tự gốc
- [ ] T008 [US1] GREEN — `src/main/services/ingestion/pdf-layout/lines.ts`: `buildLines(items) → Line[]` (thuần)
- [ ] T009 [P] [US1] RED — `tests/unit/pdf-layout-columns.test.ts`: trang 1 cột ⇒ 1 vùng; 2 cột ⇒ trái rồi phải; 3 cột; tiêu đề trải toàn trang ở trên + chân trang ở dưới giữ vị trí; khe hẹp < 2% hoặc bị > 10% dòng cắt ngang ⇒ không tách cột (đọc trên→xuống)
- [ ] T010 [US1] GREEN — `src/main/services/ingestion/pdf-layout/columns.ts`: `orderRegions(lines, geometry) → Line[][]` (XY-cut, thuần)
- [ ] T011 [P] [US1] RED — `tests/unit/pdf-layout-paragraphs.test.ts`: dòng cùng đoạn nối bằng dấu cách; khoảng baseline > 1,5·h ⇒ `\n\n`; gạch nối cuối dòng + chữ thường đầu dòng sau ⇒ nối liền, bỏ gạch; gạch nối + chữ hoa ⇒ giữ gạch; U+00AD; tiếng Việt có dấu tổ hợp giữ nguyên ký tự
- [ ] T012 [US1] GREEN — `src/main/services/ingestion/pdf-layout/paragraphs.ts`: `joinParagraphs(region: Line[]) → string`
- [ ] T013 [P] [US1] RED — `tests/unit/pdf-layout-page.test.ts` (phần không bảng): `layoutPage` ghép lines→regions→paragraphs; đầu/chân trang và số trang KHÔNG bị xoá; item xoay nối cuối trang; `cleanText(result.text) === result.text`; bất biến "mọi ký tự không rỗng của item xuất hiện đúng một lần" (trừ gạch nối bị nối/dấu cách); `items.length > MAX_LAYOUT_ITEMS_PER_PAGE` ⇒ `fallback: true` + văn bản nối cũ; hàm con ném lỗi ⇒ fallback trang đó
- [ ] T014 [US1] GREEN — `src/main/services/ingestion/pdf-layout/layout-page.ts`: `layoutPage(items, geometry): LayoutResult` (chưa có bảng — `blocks: []`), try/catch ⇒ fallback
- [ ] T015 [US1] RED — `tests/unit/pdf-parse-layout.test.ts`: `parsePdf` trên `oneColumn()`, `twoColumns()`, `vietnamese()`, `hyphenated()`, `rotatedPage()`, `manyItems(6000)` ⇒ văn bản kỳ vọng theo `samples.ts`; `pageCount` đúng; hợp đồng `ParseResult{pageCount, pages[{page,text}]}` giữ nguyên
- [ ] T016 [US1] GREEN — `src/main/services/ingestion/parsers/pdf.ts`: adapter `TextItem → LayoutItem` (y về gốc trên-trái theo `page.getViewport({scale:1})`, `rotated` khi `transform[1]≠0||transform[2]≠0`, `h` từ `height`/`transform[3]`) rồi `layoutPage`; trả thêm `blocks` theo trang (bước US2 điền)
- [ ] T017 [US1] Cập nhật `tests/unit/chunker.test.ts` + `tests/unit/source-content.test.ts`: văn bản có `\n`/`\n\n` từ `layoutPage` ⇒ `chunk.text === T.slice(charStart,charEnd)` và `reconstructText(chunks) === joinPages(pages)` (Constitution II)

**Checkpoint**: PDF mới nạp đúng thứ tự cột, có đoạn — MVP.

---

## Phase 4: User Story 2 — Bảng giữ hàng/ô (P1)

**Goal**: FR-004, FR-005, FR-008, FR-009 (SC-002)

**Independent Test**: `parsePdf(makePdf(borderedTable()))` và `borderlessTable()` ⇒ bảng Markdown đúng hàng/cột/ô; `tocNotTable()`, `bulletList()` ⇒ không có bảng; chia đoạn không cắt ngang bảng ngắn.

- [ ] T018 [P] [US2] RED — `tests/unit/pdf-layout-tables.test.ts`: nhận diện ≥ 3 dòng × ≥ 2 ô thẳng hàng (≤ 0,5·h), cùng số cột ≥ 80% dòng ⇒ bảng; 2 dòng ⇒ không; mục lục `\.{4,}` ⇒ không; danh sách đầu dòng ⇒ không; ô nhiều dòng nối bằng dấu cách; render `| a | b |` + hàng `|---|---|` sau hàng đầu; ô rỗng `| |`; `|` trong ô ⇒ `\|`; bảng cách văn bản `\n\n`; `cleanText(render(t)) === render(t)`
- [ ] T019 [US2] GREEN — `src/main/services/ingestion/pdf-layout/tables.ts`: `detectTables(region: Line[]) → Segment[]` (xen kẽ đoạn văn/bảng) + `renderTable(rows: string[][]) → string`
- [ ] T020 [US2] RED — mở rộng `tests/unit/pdf-layout-page.test.ts`: trang có bảng ⇒ `text` chứa bảng Markdown và `blocks` trỏ đúng khoảng ký tự của từng bảng (`text.slice(b.start,b.end)` bắt đầu bằng `|` và kết thúc hàng cuối)
- [ ] T021 [US2] GREEN — `src/main/services/ingestion/pdf-layout/layout-page.ts`: tích hợp `detectTables` vào từng vùng, tính `blocks`
- [ ] T022 [US2] RED — `tests/unit/pdf-parse-layout.test.ts`: `borderedTable()`, `borderlessTable()` ⇒ bảng đúng; `tocNotTable()`, `bulletList()` ⇒ 0 bảng; `parsePdf` trả `blocks` cho trang có bảng
- [ ] T023 [US2] GREEN — `src/main/services/ingestion/chunker.ts`: `PageText.blocks?` (tuỳ chọn); `splitRanges` khi có blocks: điểm cắt rơi trong bảng ≤ `CHUNK_SIZE` ⇒ lùi về trước bảng (nếu vẫn tiến) hoặc tới hết bảng; bảng dài chỉ cắt tại `\n` giữa hai hàng; điểm bắt đầu sau overlap rơi giữa hàng ⇒ dời về đầu hàng — viết test trước ở T024
- [ ] T024 [US2] RED (chạy trước T023) — `tests/unit/chunker.test.ts`: bảng ngắn nằm trọn một chunk; bảng dài cắt theo hàng; overlap không bắt đầu giữa hàng; `chunk.text === T.slice(...)`; KHÔNG có `blocks` ⇒ kết quả chunk y hệt trước (snapshot so với cài đặt cũ trên các mẫu txt/md hiện có)
- [ ] T025 [US2] `src/main/services/ingestion/pipeline.ts`: truyền `blocks` từ `parseAndClean` sang `chunkPages`; xác minh sau `cleanText` văn bản trang không đổi độ dài vùng bảng (lệch ⇒ bỏ `blocks` trang đó) — test trong `tests/unit/ingestion-pipeline.test.ts`

**Checkpoint**: bảng giữ được, chunker không cắt bảng.

---

## Phase 5: User Story 4 — Trích dẫn cũ không bị tô sáng sai (P2, độc lập — làm trước US3)

**Goal**: FR-017, FR-018 (SC-004)

**Independent Test**: `getSourceContent` với `chunkId` không thuộc nguồn ⇒ `citationValid: false`; viewer không highlight + có ghi chú.

- [ ] T026 [P] [US4] RED — `tests/unit/source-content.test.ts`: input string (cũ) ⇒ như trước, không có `citationValid`; input `{sourceId, chunkId}` thuộc nguồn ⇒ `citationValid: true`; không thuộc ⇒ `false`; validate input sai kiểu ⇒ ném
- [ ] T027 [US4] GREEN — `src/main/services/source-viewer/` (`getSourceContent`): nhận `string | {sourceId, chunkId?}`, trả `citationValid`; `src/shared/ipc/types.ts`: `SourceContent.citationValid?`
- [ ] T028 [US4] `src/main/ipc/register.ts` + `src/preload/index.ts`: `source:getContent` chấp nhận dạng object (vẫn whitelist cùng kênh); cập nhật `tests/unit/source-getcontent-whitelist.test.ts`
- [ ] T029 [US4] `src/renderer/features/source-viewer/useSourceViewer.ts` + `SourceViewer.tsx`: `openCitation` gửi `chunkId`; `citationValid === false` ⇒ không truyền highlight, cuộn tới `locator.page` nếu trong phạm vi, hiện ghi chú "Nguồn đã được xử lý lại — vị trí trích dẫn cũ không còn chính xác" (vùng `role="status"`); test UI trong `tests/unit/source-viewer-stale.test.ts` (jsdom)

**Checkpoint**: chip cũ an toàn — có thể merge trước US3.

---

## Phase 6: User Story 3 — Xử lý lại PDF đã nạp (P2)

**Goal**: FR-010..FR-016, FR-021 (SC-005)

**Independent Test**: PDF cũ (`extraction_version = 1`) có gợi ý; `source:reprocess` ⇒ queued, tiến độ theo trang, xong ⇒ `extraction_version = 2`, chunk id mới; lỗi/huỷ ở từng bước ⇒ dữ liệu cũ nguyên vẹn.

### Dữ liệu

- [ ] T030 [P] [US3] RED — `tests/unit/migration-extraction-version.test.ts`: migration #9 thêm `source.extraction_version` NOT NULL DEFAULT 1; nguồn cũ = 1; idempotent; `vault-backup` schema-guard chấp nhận DB v9 (cập nhật kỳ vọng phiên bản trong test liên quan nếu có)
- [ ] T031 [US3] GREEN — `src/main/db/migrations.ts`: migration #9 (ADD COLUMN, append-only)
- [ ] T032 [US3] `src/shared/ipc/types.ts` + `src/main/services/ingestion/source-repo.ts`: `Source.extractionVersion`, hằng `PDF_EXTRACTION_VERSION = 2` (shared); `setExtractionVersion`; pipeline ghi 2 khi PDF nạp thành công (FR-010) — test `tests/unit/source-repo.test.ts`, `tests/unit/ingestion-pipeline.test.ts`
- [ ] T033 [P] [US3] RED — `tests/unit/source-repo.test.ts`: `replaceChunks(sourceId, drafts, ids, {extractionVersion, pageCount})` trong MỘT transaction: chunk cũ biến mất, chunk mới đúng id/locator, FTS (`chunk_fts`) khớp chunk mới, version cập nhật; lỗi giữa chừng ⇒ rollback toàn bộ (chunk cũ + FTS cũ còn nguyên)
- [ ] T034 [US3] GREEN — `src/main/services/ingestion/source-repo.ts`: `replaceChunks` (+ tách `uuid` sinh trước id)
- [ ] T035 [P] [US3] `src/main/services/ingestion/vector-store.ts`: `deleteByIds(ids)`; interface `VectorStore` + mọi fake trong test cập nhật

### Quy tắc chặn + pipeline

- [ ] T036 [P] [US3] RED — `tests/unit/reprocess-guard.test.ts`: hàm thuần `checkReprocessable(source, {queued, vaultLocked})` ⇒ lỗi đúng thông điệp contract cho: không tồn tại, không phải PDF, đang trong hàng đợi/đang xử lý, trạng thái khác `ready|error`, vault khoá; hợp lệ ⇒ ok
- [ ] T037 [US3] GREEN — `src/main/services/ingestion/reprocess-guard.ts`: `checkReprocessable`
- [ ] T038 [US3] RED — `tests/unit/ingestion-reprocess.test.ts` (DI giả): thành công ⇒ thứ tự `vectorStore.add(new)` → `replaceChunks` → `deleteByIds(old)`, version 2, trạng thái giữ `ready` suốt quá trình, sự kiện `reprocess: true` + tiến độ parse theo trang; nguồn `error` ⇒ như retry bằng cách mới; LỖI ở parse / embed / `vectorStore.add` / `replaceChunks` ⇒ chunk + vector cũ nguyên vẹn, vector mới (nếu đã thêm) bị xoá, nguồn `ready`, sự kiện lỗi "Xử lý lại thất bại — vẫn dùng bản cũ"; lỗi ở `deleteByIds` ⇒ vẫn thành công + log sự kiện (không nội dung); HUỶ trước swap ⇒ không đổi gì; vault khoá lúc swap ⇒ huỷ, giữ cũ, báo lỗi; nguồn bị xoá giữa chừng ⇒ không ghi gì
- [ ] T039 [US3] GREEN — `src/main/services/ingestion/pipeline.ts`: `reprocess(id)` + `cancelReprocess(id)` trên hàng đợi tuần tự (dùng lại `parseAndClean`, chunk, embed trong RAM; dep mới `isVaultLocked`); tiến độ parse theo trang qua `parsePdf` onProgress

### IPC + preload

- [ ] T040 [US3] RED — `tests/unit/source-reprocess-whitelist.test.ts`: `source:reprocess`, `source:reprocessCancel` có trong `CHANNELS` + whitelist preload; renderer chỉ gửi `sourceId` (string)
- [ ] T041 [US3] GREEN — `src/shared/ipc/channels.ts`, `src/preload/index.ts`, `src/main/ipc/register.ts`: handler `source:reprocess` (assertVaultWritable → `checkReprocessable` → tệp tồn tại? không ⇒ `{status:"missing"}` → `hashFileStreaming` ≠ `content_hash` ⇒ `{status:"mismatch"}` → `pipeline.reprocess` ⇒ `{status:"queued"}`), `source:reprocessCancel`; dựng dep `isVaultLocked` trong `src/main/index.ts`; test handler trong `tests/unit/source-reprocess.test.ts`

### UI

- [ ] T042 [US3] `src/renderer/features/sources/useReprocess.ts`: gọi IPC, xử lý `missing` (mở luồng relink 101 qua `useRelink`), `mismatch` (thông báo lý do), lỗi vault khoá; theo dõi `source:progress` có `reprocess`
- [ ] T043 [US3] `src/renderer/features/sources/SourceItem.tsx` + `sources.css`: gợi ý thụ động "Xử lý lại để giữ bố cục" khi `kind==="pdf" && extractionVersion < PDF_EXTRACTION_VERSION`; mục "Xử lý lại" trong menu nguồn PDF (`ready`/`error`), khoá khi đang xử lý / vault khoá; hộp xác nhận nêu hệ quả với trích dẫn cũ; thanh tiến độ theo trang + nút Huỷ; thông báo lỗi khi thất bại — test `tests/unit/source-reprocess-ui.test.ts` (jsdom)
- [ ] T044 [US3] E2E `tests/e2e/source-reprocess.spec.ts`: whitelist kênh mới; PDF cũ (seed version 1) hiện gợi ý; "Xử lý lại" ⇒ hộp xác nhận ⇒ xong, gợi ý biến mất (IV_EMBED_FAKE=1)

**Checkpoint**: xử lý lại an toàn, nguyên tử.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T045 Hiệu năng SC-006 — `tests/unit/pdf-parse-perf.test.ts`: PDF tự sinh ~50 trang 2 cột + bảng; đo `parsePdf` mới vs nối cũ (cùng tệp) ⇒ tỉ lệ ≤ 2 (log số đo; ngưỡng nới trên CI bằng biến môi trường nếu cần)
- [ ] T046 Hồi quy 108: `EVAL_MODE=current npm run eval:retrieval` ⇒ "hồi quy OK" (ghi kết quả vào ADR)
- [ ] T047 ADR `docs/04-decisions/2026-10-<dd>-pdf-layout.md` (thuật toán dòng/cột/đoạn/bảng + ngưỡng, `extraction_version`, xử lý lại nguyên tử, trích dẫn cũ bằng `chunkId`, số đo SC-006, fixture tự sinh/giấy phép font) + append `docs/04-decisions/INDEX.md` (KHÔNG chạy prettier lên INDEX); thêm dòng tham chiếu vào ADR ingestion/source-viewer liên quan
- [ ] T048 [P] Append `docs/00-glossary.md` (CHỈ thêm dòng, không định dạng lại bảng): lớp chữ, dựng dòng, thứ tự đọc, bảng Markdown, xử lý lại, phiên bản trích xuất (`extraction_version`), trích dẫn cũ (`citationValid`)
- [ ] T049 [P] `vitest.config.ts`: đảm bảo `src/main/services/ingestion/pdf-layout/**` + `reprocess-guard.ts` trong coverage; `parsers/pdf.ts` giữ nhóm I/O (đã loại) nếu cần
- [ ] T050 Gate: `npm run lint && npm test && npm run build && npx playwright test` xanh, coverage ≥ 80%; chạy quickstart.md mục 4 trên app (`npm run dev`)

---

## Dependencies & Execution Order

- Setup (fixture) → Foundational (kiểu) → US1 → US2 (dùng layout-page + adapter của US1).
- US4 chỉ cần Foundational của app hiện có — làm sau US2 theo thứ tự yêu cầu, độc lập với US1/US2 về mã.
- US3 cần US1+US2 (cách trích mới) và hưởng lợi US4 (chip cũ an toàn trước khi cho phép xử lý lại).
- Polish sau cùng.

```text
Setup → Foundational → US1 → US2 → US4 → US3 → Polish
```

## Parallel Opportunities

- US1: T007, T009, T011, T013 (RED) song song (khác tệp test).
- US2: T018 song song với T024.
- US4: T026 song song với US3 T030/T033/T035/T036 nếu tách người.
- US3: T030, T033, T035, T036 song song.
- Polish: T048, T049 song song.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 ⇒ PDF mới đọc đúng thứ tự cột/đoạn.
2. **US2**: bảng + chunker ⇒ hết "bảng bị dẹt".
3. **US4**: chip cũ an toàn (không phụ thuộc xử lý lại).
4. **US3**: xử lý lại nguyên tử + UI.
5. **Polish**: SC-006, hồi quy 108, ADR, glossary, gate.
