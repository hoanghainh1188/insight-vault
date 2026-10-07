---
description: "Task list — 112 pdf-layout"
---

# Tasks: Giữ bố cục khi trích xuất văn bản từ PDF

**Input**: `specs/20261007-180934-pdf-layout/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md;
quyết định `docs/04-decisions/2026-10-07-pdf-layout-clarify.md`.

**Tests**: BẮT BUỘC (Constitution IV + yêu cầu người dùng): mọi hàm THUẦN / logic nghiệp vụ viết test trước, chạy thấy
FAIL rồi mới viết code (RED → GREEN; task RED luôn đánh số TRƯỚC task GREEN tương ứng). Adapter I/O pdf.js phủ bằng test
tích hợp trên PDF tự sinh.

**Organization**: theo user story. Thứ tự: fixture → pdf-layout → `parsePdf` → chunker → (US4) `citationValid` + viewer →
(US3) migration #9 → `replaceChunks`/`deleteByIds`/`pipeline.reprocess` → IPC + preload → UI → SC-006 + hồi quy 108 →
ADR + glossary + gate.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup — trình sinh PDF fixture (làm đầu tiên)

**Purpose**: PDF mẫu tự sinh, không vướng bản quyền (research R13, FR-022)

- [X] T001 Tạo `tests/fixtures/pdf/make-pdf.ts`: trình sinh PDF tối giản thuần TS (không dependency) — `makePdf(pages: FixturePage[]): Uint8Array` với `FixturePage { width, height, rotate?: 0|90, texts: {x,y,size,text,font?:"helv"|"vi",angle?:number}[], lines?: {x1,y1,x2,y2}[] }`; viết catalog/pages/content stream (`BT /F1 size Tf x y Td (…) Tj ET`, `m l S` cho đường kẻ), xref + trailer đúng offset
- [X] T002 Thêm font tiếng Việt vào `tests/fixtures/pdf/make-pdf.ts`: nhúng `node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf` (TrueType `FontFile2`) + `/Encoding /Differences` (tên glyph `uniXXXX`, tối đa 255 ký tự) + `ToUnicode` CMap; ghi chú giấy phép SIL OFL (`LICENSE_LIBERATION`) ở đầu tệp — **Thực hiện:** KHÔNG cần nhúng font: Helvetica + `/Differences` + `/ToUnicode` CMap + `/Widths` cố định cho chữ tiếng Việt (NFC lẫn NFD); smoke test T004 xác nhận pdf.js trích đúng chuỗi
- [X] T003 Tạo `tests/fixtures/pdf/samples.ts`: `oneColumn()`, `twoColumns()`, `borderedTable()`, `borderlessTable()`, `tableAcrossPages()` (bảng trải 2 trang), `tocNotTable()` (mục lục dấu chấm dẫn), `bulletList()`, `vietnamese()` (có dấu, dạng tổ hợp), `rotatedPage()`, `hyphenated()`, `manyItems(n)`; mỗi mẫu kèm `expected` (văn bản/bảng kỳ vọng theo trang)
- [X] T004 Smoke test `tests/unit/pdf-fixture.test.ts`: `makePdf` mở được bằng `pdfjs-dist/legacy/build/pdf.mjs`; `getTextContent` trả đúng chuỗi cho mẫu Latin và mẫu tiếng Việt (so sau NFC). Font nhúng không ổn ⇒ chuyển sang `pdf-lib`+`fontkit` (devDependency) và ghi chú cho ADR
- [X] T005 (E2) Tạo snapshot TRƯỚC khi sửa chunker/pipeline: `tests/unit/ingestion-other-kinds-unchanged.test.ts` chạy pipeline (embedder giả, DI như `ingestion-pipeline.test.ts`) trên `tests/fixtures/sample.txt`, `sample.md`, `sample.docx`; ghi snapshot văn bản trang + chunk (text, ordinal, locator) bằng `toMatchSnapshot()` và commit snapshot từ trạng thái `main` (test phải xanh trên code hiện tại)

---

## Phase 2: Foundational — kiểu dữ liệu bố cục

- [X] T006 Tạo `src/main/services/ingestion/pdf-layout/types.ts`: `LayoutItem {text,x,y,w,h,rotated}`, `PageGeometry {width,height}`, `LayoutResult {text, blocks:{start,end}[], fallback}`; hằng `MAX_LAYOUT_ITEMS_PER_PAGE = 5000`, `PARAGRAPH_GAP_RATIO = 1.5`, `LINE_OVERLAP_RATIO = 0.5`, `WORD_GAP_RATIO = 0.15`, `CELL_GAP_RATIO = 1`, `CELL_ALIGN_RATIO = 0.5`, `TABLE_MIN_ROWS = 3`, `TABLE_MIN_COLS = 2`, `COLUMN_GUTTER_MIN = 0.02`, `COLUMN_CROSS_MAX = 0.1`
- [X] T007 Tạo `tests/unit/helpers/layout-items.ts`: builder `LayoutItem[]` tổng hợp (dòng chữ, cột, lưới bảng) dùng chung cho test pdf-layout

**Checkpoint**: fixture + kiểu + snapshot hồi quy sẵn sàng.

---

## Phase 3: User Story 1 — PDF hai cột đọc đúng thứ tự, có dòng/đoạn (P1) 🎯 MVP

**Goal**: FR-001, FR-002, FR-003, FR-006, FR-007, FR-019 (SC-001, SC-003)

**Independent Test**: `parsePdf(makePdf(twoColumns()))` ⇒ hết cột trái rồi cột phải, `\n\n` giữa đoạn; chunk tạo từ đó có `chunk.text === T.slice(...)`.

- [X] T008 [P] [US1] RED — `tests/unit/pdf-layout-lines.test.ts`: gom item chồng lấn dọc ≥ 50% thành một dòng; sắp theo x; đúng một dấu cách khi khe > 0,15·h (không trùng khi item đã có dấu cách); bỏ item rỗng; item `rotated` tách nhóm giữ thứ tự gốc
- [X] T009 [US1] GREEN — `src/main/services/ingestion/pdf-layout/lines.ts`: `buildLines(items) → Line[]`
- [X] T010 [P] [US1] RED — `tests/unit/pdf-layout-columns.test.ts`: 1 cột ⇒ 1 vùng; 2 cột ⇒ trái rồi phải; 3 cột; tiêu đề trải toàn trang ở trên + chân trang ở dưới giữ vị trí; khe < 2% hoặc bị > 10% dòng cắt ngang ⇒ không tách cột
- [X] T011 [US1] GREEN — `src/main/services/ingestion/pdf-layout/columns.ts`: `orderRegions(lines, geometry) → Line[][]` (XY-cut)
- [X] T012 [P] [US1] RED — `tests/unit/pdf-layout-paragraphs.test.ts`: dòng cùng đoạn nối bằng dấu cách; baseline cách > 1,5·h ⇒ `\n\n`; gạch nối cuối dòng + chữ thường đầu dòng sau ⇒ nối liền bỏ gạch; + chữ hoa ⇒ giữ gạch; U+00AD; tiếng Việt có dấu tổ hợp giữ nguyên
- [X] T013 [US1] GREEN — `src/main/services/ingestion/pdf-layout/paragraphs.ts`: `joinParagraphs(region) → string`
- [X] T014 [P] [US1] RED — `tests/unit/pdf-layout-page.test.ts` (không bảng): `layoutPage` ghép lines→regions→paragraphs; đầu/chân trang, số trang KHÔNG bị xoá; item xoay nối cuối trang; `cleanText(text) === text`; mọi ký tự không rỗng của item xuất hiện đúng một lần (trừ gạch nối bị nối/dấu cách); `items.length > MAX_LAYOUT_ITEMS_PER_PAGE` ⇒ `fallback: true` + văn bản nối cũ; hàm con ném ⇒ fallback trang đó
- [X] T015 [US1] GREEN — `src/main/services/ingestion/pdf-layout/layout-page.ts`: `layoutPage(items, geometry): LayoutResult` (`blocks: []` ở bước này), try/catch ⇒ fallback
- [X] T016 [US1] RED — `tests/unit/pdf-parse-layout.test.ts`: `parsePdf` trên `oneColumn()`, `twoColumns()`, `vietnamese()`, `hyphenated()`, `rotatedPage()`, `manyItems(6000)` ⇒ văn bản kỳ vọng; `pageCount` đúng; hợp đồng `ParseResult{pageCount,pages[{page,text}]}` giữ; (C1) `parsePdf(bytes, onProgress)` gọi `onProgress` tăng dần, giá trị cuối = 1
- [X] T017 [US1] GREEN — `src/main/services/ingestion/parsers/pdf.ts`: adapter `TextItem → LayoutItem` (y về gốc trên-trái theo `page.getViewport({scale:1})`, `rotated` khi `transform[1]≠0||transform[2]≠0`, `h` từ `height`/`transform[3]`) → `layoutPage`; tham số `onProgress?: (frac:number)=>void` gọi sau mỗi trang; trả `blocks` theo trang (US2 điền)
- [X] T018 [US1] (C1) `src/main/services/ingestion/ingestion.ts`: `parseFile` truyền `onProgress` vào `parsePdf(bytes, onProgress)`
- [X] T019 [US1] Cập nhật `tests/unit/chunker.test.ts` + `tests/unit/source-content.test.ts`: văn bản có `\n`/`\n\n` từ `layoutPage` ⇒ `chunk.text === T.slice(charStart,charEnd)` và `reconstructText(chunks) === joinPages(pages)` (Constitution II)

**Checkpoint**: PDF mới nạp đúng thứ tự cột, có đoạn — MVP.

---

## Phase 4: User Story 2 — Bảng giữ hàng/ô (P1)

**Goal**: FR-004, FR-005, FR-008, FR-009, FR-023 (SC-002, SC-007)

**Independent Test**: `parsePdf` trên `borderedTable()`/`borderlessTable()` ⇒ bảng Markdown đúng hàng/cột/ô; `tocNotTable()`/`bulletList()` ⇒ không có bảng; chia đoạn không cắt ngang bảng ngắn; snapshot T005 vẫn xanh.

- [ ] T020 [P] [US2] RED — `tests/unit/pdf-layout-tables.test.ts`: ≥ 3 dòng × ≥ 2 ô thẳng hàng (≤ 0,5·h), cùng số cột ≥ 80% dòng ⇒ bảng; 2 dòng ⇒ không; mục lục `\.{4,}` ⇒ không; danh sách đầu dòng ⇒ không; ô nhiều dòng nối dấu cách; render `| a | b |` + `|---|---|` sau hàng đầu; ô rỗng `| |`; `|` ⇒ `\|`; bảng cách văn bản `\n\n`; `cleanText(render(t)) === render(t)`
- [ ] T021 [US2] GREEN — `src/main/services/ingestion/pdf-layout/tables.ts`: `detectTables(region) → Segment[]` + `renderTable(rows: string[][]) → string`
- [ ] T022 [US2] RED — mở rộng `tests/unit/pdf-layout-page.test.ts`: trang có bảng ⇒ `text` chứa bảng Markdown, `blocks` trỏ đúng khoảng ký tự từng bảng
- [ ] T023 [US2] GREEN — `src/main/services/ingestion/pdf-layout/layout-page.ts`: tích hợp `detectTables`, tính `blocks`
- [ ] T024 [US2] RED — `tests/unit/pdf-parse-layout.test.ts`: `borderedTable()`, `borderlessTable()` ⇒ bảng đúng; `tocNotTable()`, `bulletList()` ⇒ 0 bảng; (E1) `tableAcrossPages()` ⇒ mỗi trang một bảng riêng, `blocks` riêng theo trang; `parsePdf` trả `blocks`
- [ ] T025 [US2] (F1) RED — `tests/unit/chunker.test.ts`: `PageText.blocks` — bảng ngắn nằm trọn một chunk; bảng dài chỉ cắt tại `\n` giữa hai hàng; overlap không bắt đầu giữa hàng; `chunk.text === T.slice(...)`; không chunk nào vắt trang với bảng trải 2 trang; KHÔNG có `blocks` ⇒ kết quả y hệt trước
- [ ] T026 [US2] (F1) GREEN — `src/main/services/ingestion/chunker.ts`: `PageText.blocks?`; `splitRanges` tôn trọng bảng (lùi về trước bảng ngắn hoặc tới hết bảng; bảng dài cắt theo hàng; dời điểm bắt đầu sau overlap về đầu hàng)
- [ ] T027 [US2] (D1) RED — `tests/unit/ingestion-pipeline.test.ts`: pipeline truyền `blocks` từ parse sang `chunkPages`; độ dài vùng bảng lệch sau `cleanText` ⇒ bỏ `blocks` của trang đó (chunk vẫn hợp lệ)
- [ ] T028 [US2] (D1) GREEN — `src/main/services/ingestion/pipeline.ts`: truyền + xác minh `blocks`
- [ ] T029 [US2] (E2) Chạy `tests/unit/ingestion-other-kinds-unchanged.test.ts` — snapshot T005 KHÔNG đổi (không cập nhật snapshot)

**Checkpoint**: bảng giữ được; các loại nguồn khác không đổi.

---

## Phase 5: User Story 4 — Trích dẫn cũ không bị tô sáng sai (P2, độc lập — làm trước US3)

**Goal**: FR-017, FR-018, FR-020 (SC-004)

**Independent Test**: `getSourceContent` với `chunkId` không thuộc nguồn ⇒ `citationValid: false`; viewer (chip chat và chip Studio) không highlight + có ghi chú.

- [ ] T030 [P] [US4] RED — `tests/unit/source-content.test.ts`: input string ⇒ như trước, không có `citationValid`; `{sourceId, chunkId}` thuộc nguồn ⇒ `true`; không thuộc ⇒ `false`; input sai kiểu ⇒ ném
- [ ] T031 [US4] GREEN — `getSourceContent` trong `src/main/services/source-viewer/`: nhận `string | {sourceId, chunkId?}`, trả `citationValid`; `src/shared/ipc/types.ts`: `SourceContent.citationValid?`
- [ ] T032 [US4] `src/main/ipc/register.ts` + `src/preload/index.ts`: `source:getContent` chấp nhận dạng object (cùng kênh whitelist); cập nhật `tests/unit/source-getcontent-whitelist.test.ts`
- [ ] T033 [US4] RED — `tests/unit/source-viewer-stale.test.ts` (jsdom): `citationValid === false` ⇒ không highlight, cuộn tới `locator.page` nếu trong phạm vi, ghi chú "Nguồn đã được xử lý lại — vị trí trích dẫn cũ không còn chính xác" (`role="status"`); (L2) chip từ kết quả Studio đi qua `Workspace.openCitation` có cùng hành vi; `citationValid` true/thiếu ⇒ highlight như cũ
- [ ] T034 [US4] GREEN — `src/renderer/features/source-viewer/useSourceViewer.ts` + `SourceViewer.tsx`: `openCitation` gửi `chunkId`; xử lý `citationValid` (giữ `pre-wrap`)

**Checkpoint**: chip cũ an toàn — có thể merge trước US3.

---

## Phase 6: User Story 3 — Xử lý lại PDF đã nạp (P2)

**Goal**: FR-010..FR-016, FR-021 (SC-005, SC-008)

**Independent Test**: PDF cũ (`extraction_version = 1`) có gợi ý; `source:reprocess` ⇒ queued, tiến độ theo trang, xong ⇒ version 2, chunk id mới; lỗi/huỷ ở từng bước ⇒ dữ liệu cũ nguyên vẹn.

### Dữ liệu

- [ ] T035 [P] [US3] RED — `tests/unit/migration-extraction-version.test.ts`: migration #9 thêm `source.extraction_version` NOT NULL DEFAULT 1; nguồn cũ = 1; idempotent; schema-guard vault-backup chấp nhận DB v9
- [ ] T036 [US3] GREEN — `src/main/db/migrations.ts`: migration #9 (ADD COLUMN, append-only)
- [ ] T037 [US3] (D1) RED — `tests/unit/source-repo.test.ts` + `tests/unit/ingestion-pipeline.test.ts`: `Source.extractionVersion` đọc/ghi được; PDF nạp thành công ⇒ `extractionVersion = 2`; loại khác giữ 1
- [ ] T038 [US3] (D1) GREEN — `src/shared/ipc/types.ts` (`Source.extractionVersion`, `PDF_EXTRACTION_VERSION = 2`), `src/main/services/ingestion/source-repo.ts` (map cột + `setExtractionVersion`), `src/main/services/ingestion/pipeline.ts` (ghi 2 khi PDF ready)
- [ ] T039 [P] [US3] RED — `tests/unit/source-repo.test.ts`: `replaceChunks(sourceId, drafts, ids, {extractionVersion, pageCount})` trong MỘT transaction: chunk cũ biến mất, chunk mới đúng id/locator, `chunk_fts` khớp chunk mới, version cập nhật; lỗi giữa chừng ⇒ rollback (chunk + FTS cũ nguyên)
- [ ] T040 [US3] GREEN — `src/main/services/ingestion/source-repo.ts`: `replaceChunks`
- [ ] T041 [P] [US3] `src/main/services/ingestion/vector-store.ts`: `deleteByIds(ids)`; cập nhật interface `VectorStore` + mọi fake trong test

### Quy tắc chặn + pipeline

- [ ] T042 [P] [US3] RED — `tests/unit/reprocess-guard.test.ts`: `checkReprocessable(source, {queued, vaultLocked})` ⇒ lỗi đúng thông điệp contract: không tồn tại / không phải PDF / đang trong hàng đợi / trạng thái khác `ready|error` / vault khoá; hợp lệ ⇒ ok
- [ ] T043 [US3] GREEN — `src/main/services/ingestion/reprocess-guard.ts`: `checkReprocessable`
- [ ] T044 [US3] RED — `tests/unit/ingestion-reprocess.test.ts` (DI giả): thành công ⇒ thứ tự `vectorStore.add(new)` → `replaceChunks` → `deleteByIds(old)`, version 2, trạng thái giữ `ready` suốt quá trình, sự kiện `reprocess: true` + tiến độ parse theo trang; nguồn `error` ⇒ như retry bằng cách mới; LỖI ở parse / embed / `add` / `replaceChunks` ⇒ chunk + vector cũ nguyên, vector mới (nếu đã thêm) bị xoá, nguồn `ready`, lỗi "Xử lý lại thất bại — vẫn dùng bản cũ"; lỗi `deleteByIds` ⇒ vẫn thành công + log sự kiện (không nội dung); HUỶ trước swap ⇒ không đổi gì; `isVaultLocked()` true lúc swap ⇒ huỷ, giữ cũ, báo lỗi; nguồn bị xoá giữa chừng ⇒ không ghi gì; (E1) `resumeInterrupted` sau khi app đóng giữa lần xử lý lại: nguồn `ready` ⇒ vẫn `ready` dữ liệu cũ, không tự chạy tiếp; nguồn `error` đang xử lý lại ⇒ về `error`
- [ ] T045 [US3] GREEN — `src/main/services/ingestion/pipeline.ts`: `reprocess(id)` + `cancelReprocess(id)` trên hàng đợi tuần tự (dùng lại `parseAndClean`, chunk, embed trong RAM); (C2) `PipelineDeps.isVaultLocked: () => boolean`

### IPC + preload

- [ ] T046 [US3] RED — `tests/unit/source-reprocess-whitelist.test.ts`: `source:reprocess`, `source:reprocessCancel` có trong `CHANNELS` + whitelist preload; chỉ gửi `sourceId` (string)
- [ ] T047 [US3] RED — `tests/unit/source-reprocess.test.ts`: handler — vault khoá ⇒ ném `VAULT_LOCKED_MESSAGE`; guard lỗi ⇒ ném; tệp không tồn tại ⇒ `{status:"missing"}`; SHA-256 ≠ `content_hash` ⇒ `{status:"mismatch"}`; hợp lệ ⇒ `{status:"queued"}`; cancel ⇒ `{cancelled}`
- [ ] T048 [US3] GREEN — `src/shared/ipc/channels.ts`, `src/preload/index.ts`, `src/main/ipc/register.ts` (handler dùng `hashFileStreaming`); (C2) `src/main/services/ingestion/ingestion.ts`: `createIngestion(opts)` nhận `isVaultLocked` và chuyển vào `PipelineDeps`; `src/main/index.ts` truyền `() => vaultLock.isLocked()`

### UI

- [ ] T049 [US3] RED — `tests/unit/source-reprocess-ui.test.ts` (jsdom): gợi ý "Xử lý lại để giữ bố cục" khi `kind==="pdf" && extractionVersion < PDF_EXTRACTION_VERSION`; mục "Xử lý lại" chỉ cho PDF `ready`/`error`, khoá khi đang xử lý/vault khoá; hộp xác nhận nêu hệ quả, huỷ ⇒ không gọi IPC; `missing` ⇒ mở luồng relink 101; `mismatch` ⇒ thông báo lý do; tiến độ + nút Huỷ; thông báo lỗi khi thất bại
- [ ] T050 [US3] GREEN — `src/renderer/features/sources/useReprocess.ts` + `SourceItem.tsx` + `sources.css`
- [ ] T051 [US3] E2E `tests/e2e/source-reprocess.spec.ts`: whitelist kênh mới; PDF cũ (seed version 1) hiện gợi ý; "Xử lý lại" ⇒ xác nhận ⇒ xong, gợi ý biến mất (IV_EMBED_FAKE=1)

**Checkpoint**: xử lý lại an toàn, nguyên tử.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T052 Hiệu năng SC-006 — `tests/unit/pdf-parse-perf.test.ts`: PDF tự sinh ~50 trang 2 cột + bảng; đo `parsePdf` mới vs nối cũ (cùng tệp). (L3) Local: tỉ lệ ≤ 2 là điều kiện đạt; khi `process.env.CI` ⇒ chỉ log số đo, trừ khi `PDF_PERF_STRICT=1` thì mới assert
- [ ] T053 Hồi quy 108: `EVAL_MODE=current npm run eval:retrieval` ⇒ "hồi quy OK" (ghi kết quả vào ADR)
- [ ] T054 ADR `docs/04-decisions/2026-10-<dd>-pdf-layout.md` (thuật toán + ngưỡng, `extraction_version`, xử lý lại nguyên tử, trích dẫn cũ bằng `chunkId`, số đo SC-006, fixture/giấy phép font) + append 1 dòng `docs/04-decisions/INDEX.md` (KHÔNG chạy prettier lên INDEX); dòng tham chiếu trong ADR ingestion/source-viewer liên quan
- [ ] T055 [P] (L1) Append `docs/00-glossary.md` (CHỈ thêm dòng, không định dạng lại bảng): lớp chữ, dựng dòng (`layoutPage`), thứ tự đọc, bảng Markdown (`blocks`), xử lý lại (`source:reprocess`), phiên bản trích xuất (`extraction_version` DB / `extractionVersion` TS), trích dẫn cũ (`citationValid`)
- [ ] T056 [P] `vitest.config.ts`: `src/main/services/ingestion/pdf-layout/**`, `reprocess-guard.ts` nằm trong coverage; `parsers/pdf.ts` giữ nhóm I/O nếu đang loại
- [ ] T057 Gate: `npm run lint && npm test && npm run build && npx playwright test` xanh, coverage ≥ 80%; chạy quickstart.md mục 4 trên app (`npm run dev`)

---

## Dependencies & Execution Order

- Setup (fixture + snapshot T005) → Foundational → US1 → US2 (dùng layout-page + adapter US1; T029 kiểm snapshot T005).
- US4 độc lập về mã với US1/US2 — làm sau US2 theo thứ tự yêu cầu.
- US3 cần US1+US2 (cách trích mới) và đi sau US4 (chip cũ an toàn trước khi cho phép xử lý lại).
- Polish sau cùng.

```text
Setup → Foundational → US1 → US2 → US4 → US3 → Polish
```

## Parallel Opportunities

- US1: T008, T010, T012, T014 (RED) song song.
- US2: T020 song song với T025.
- US4: T030 song song với các task dữ liệu US3 nếu tách người.
- US3: T035, T039, T041, T042 song song.
- Polish: T055, T056 song song.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 ⇒ PDF mới đọc đúng thứ tự cột/đoạn.
2. **US2**: bảng + chunker (snapshot các loại khác không đổi).
3. **US4**: chip cũ an toàn.
4. **US3**: xử lý lại nguyên tử + UI.
5. **Polish**: SC-006, hồi quy 108, ADR, glossary, gate.
