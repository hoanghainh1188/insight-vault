# Implementation Plan: Giữ bố cục khi trích xuất văn bản từ PDF

**Branch**: `112-pdf-layout` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20261007-180934-pdf-layout/spec.md`; quyết định:
`docs/04-decisions/2026-10-07-pdf-layout-clarify.md`; intake: `docs/intake/112-pdf-layout.md`.

## Summary

`parsePdf` hiện nối mọi `TextItem.str` của trang bằng dấu cách. Kế hoạch: (A) adapter mỏng chuyển item pdf.js →
`LayoutItem` (toạ độ, kích thước, xoay) và hàm thuần `layoutPage` dựng dòng → vùng/cột (XY-cut) → đoạn (khoảng cách
dọc, gạch nối) → bảng (căn cột ≥ 2×3, xuất Markdown ở dạng cố định của `cleanText`), trả `blocks` cho chunker; trang
lỗi/quá nhiều item ⇒ cách cũ. (B) chunker tôn trọng `blocks` (không cắt bảng ngắn, bảng dài cắt theo hàng); migration
#9 `source.extraction_version`; `pipeline.reprocess` chạy trên hàng đợi tuần tự, dựng chunk + vector mới trong RAM rồi
hoán đổi nguyên tử (vector mới → transaction SQLite → xoá vector cũ), dữ liệu cũ dùng được tới khi xong; kênh IPC
`source:reprocess`/`source:reprocessCancel` (chỉ nhận `sourceId`, kiểm vault lock / tệp mất / hash khác). (C) trích dẫn
cũ nhận diện bằng `chunkId` không còn thuộc nguồn: `source:getContent` trả `citationValid`, viewer không highlight + ghi
chú. Viewer giữ văn bản `pre-wrap`.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Electron 43, Node 24 (dev/CI)

**Primary Dependencies**: có sẵn — `pdfjs-dist` 6 (legacy build, `getTextContent`, `getViewport`), `node:sqlite`, LanceDB,
React 18 + TanStack Query. KHÔNG thêm dependency runtime. Fixture PDF sinh bằng trình sinh tối giản tự viết (dự phòng:
`pdf-lib` devDependency — research R13).

**Storage**: SQLite migration #9 (`source.extraction_version INTEGER NOT NULL DEFAULT 1`); chunk/FTS/LanceDB không đổi
schema (LanceDB thêm thao tác `deleteByIds`).

**Testing**: vitest (unit, node env) — hàm thuần `pdf-layout`, chunker `blocks`, migration, pipeline reprocess (DI giả),
`parsePdf` tích hợp trên PDF tự sinh; Playwright E2E cho kênh mới whitelist + luồng "Xử lý lại" cơ bản.

**Target Platform**: macOS arm64 + Windows x64 (không đổi).

**Project Type**: desktop-app (Electron main/preload/renderer).

**Performance Goals**: SC-006 — `parsePdf` cách mới ≤ 2× cách cũ; `layoutPage` O(n log n)/trang; giới hạn
`MAX_LAYOUT_ITEMS_PER_PAGE = 5000`.

**Constraints**: offline (không egress mới); Constitution II (locator trên văn bản chính tắc, chunk không vắt trang,
`chunk.text === T.slice`); xử lý ở main; không log nội dung; giới hạn PDF 50 MB và hàng đợi tuần tự giữ nguyên.

**Scale/Scope**: PDF tới 50 MB / hàng trăm trang; mỗi lần xử lý lại một nguồn (không hàng loạt).

Không còn NEEDS CLARIFICATION (research R1–R14).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                         | Đánh giá                                                                                                                                                                                                 | Sau Phase 1 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| I. Local-first & No Default Egress | Chỉ dùng dữ liệu pdf.js cục bộ; không mạng; fixture sinh offline.                                                                                                                                        | ✅          |
| II. Verifiable Citations           | Locator vẫn tính một lần trên văn bản chính tắc (gồm bảng); chunk không vắt trang; xử lý lại sinh chunk id mới ⇒ chip cũ KHÔNG highlight sai (R12). Hoán đổi nguyên tử ⇒ không có lúc nguồn mất dữ liệu. | ✅          |
| III. Desktop Security Boundary     | 2 kênh mới whitelist ở preload, chỉ nhận `sourceId`; kiểm vault lock; hash tệp như relink 101; không log nội dung.                                                                                       | ✅          |
| IV. Test-First & Coverage          | `layoutPage` + chunker `blocks` + quy tắc reprocess là hàm thuần/DI, test trước; adapter pdf.js I/O phủ bởi test tích hợp; ≥ 80%.                                                                        | ✅          |
| V. Phased Delivery                 | Cải thiện lõi Pha 1 (nạp nguồn/trích dẫn).                                                                                                                                                               | ✅          |
| Terminology                        | Thuật ngữ mới (lớp chữ, dựng dòng, thứ tự đọc, bảng Markdown, xử lý lại, phiên bản trích xuất, trích dẫn cũ) append glossary.                                                                            | ✅          |
| ADR-governed                       | ADR mới cho thuật toán bố cục + xử lý lại; cập nhật ADR ingestion/source-viewer tham chiếu.                                                                                                              | ✅          |

Không vi phạm ⇒ không cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/20261007-180934-pdf-layout/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/{pdf-layout.md, ipc-reprocess.md}
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/main/services/ingestion/
├── pdf-layout/                    # MỚI — hàm thuần
│   ├── types.ts                   # LayoutItem, PageGeometry, LayoutResult, hằng ngưỡng
│   ├── lines.ts                   # gom item → dòng
│   ├── columns.ts                 # XY-cut → vùng/cột, thứ tự đọc
│   ├── paragraphs.ts              # đoạn + gạch nối
│   ├── tables.ts                  # nhận diện bảng + render Markdown
│   └── layout-page.ts             # layoutPage (ghép + dự phòng)
├── parsers/pdf.ts                 # SỬA — adapter item→LayoutItem, gọi layoutPage, trả pages + blocks
├── chunker.ts                     # SỬA — PageText.blocks tuỳ chọn; tôn trọng bảng
├── pipeline.ts                    # SỬA — extraction_version khi nạp PDF; reprocess() nguyên tử; cancel
├── source-repo.ts                 # SỬA — extractionVersion; replaceChunks(id, drafts, ids, meta) trong 1 transaction
└── vector-store.ts                # SỬA — deleteByIds
src/main/services/source-viewer/   # SỬA — getSourceContent nhận chunkId ⇒ citationValid
src/main/db/migrations.ts          # SỬA — migration #9
src/main/ipc/register.ts           # SỬA — source:reprocess, source:reprocessCancel (+ kiểm tệp/hash qua relink helpers)
src/shared/ipc/{channels,types}.ts # SỬA — kênh mới, Source.extractionVersion, PDF_EXTRACTION_VERSION, progress.reprocess, citationValid
src/preload/                       # SỬA — whitelist 2 kênh mới
src/renderer/features/sources/     # SỬA — SourceItem: gợi ý + "Xử lý lại" + xác nhận + tiến độ/huỷ; useReprocess hook
src/renderer/features/source-viewer/ # SỬA — citationValid=false ⇒ không highlight + ghi chú

tests/fixtures/pdf/make-pdf.ts     # MỚI — trình sinh PDF tối giản (Helvetica + LiberationSans nhúng)
tests/unit/pdf-layout-*.test.ts    # MỚI — lines/columns/paragraphs/tables/layout-page
tests/unit/pdf-parse-layout.test.ts # MỚI — parsePdf trên PDF tự sinh (+ đo thời gian SC-006)
tests/unit/chunker.test.ts         # SỬA — blocks
tests/unit/{migrations,source-repo,pipeline,source-content,ipc-whitelist}*.test.ts # SỬA/MỚI
tests/e2e/                         # SỬA — whitelist kênh mới; nút Xử lý lại (gợi ý + xác nhận)
docs/04-decisions/2026-10-xx-pdf-layout.md  # MỚI — ADR thuật toán + xử lý lại (+ INDEX)
docs/00-glossary.md                # append
```

**Structure Decision**: logic bố cục là thư mục hàm thuần riêng dưới `ingestion/` (cạnh `chunker`/`cleaning`), parser
PDF chỉ còn là adapter I/O. Xử lý lại sống trong `pipeline` để dùng chung hàng đợi tuần tự, `parseAndClean`, embed; IPC ở
`register.ts` cạnh `sourceRetry`/`sourceRelink`.

## Phase 0 — Research

[research.md](./research.md): R1 dữ liệu pdf.js · R2 dòng · R3 cột · R4 đoạn/gạch nối · R5 bảng · R6 Markdown +
`cleanText` · R7 chunker `blocks` · R8 dự phòng/hiệu năng · R9 `extraction_version` · R10 hoán đổi nguyên tử · R11 điều
kiện chặn · R12 trích dẫn cũ bằng `chunkId` · R13 fixture tự sinh · R14 bộ đánh giá 108.

**Lệch so với gợi ý ở input:** đánh dấu trích dẫn cũ bằng "chunkId không còn thuộc nguồn" thay vì so thời điểm (R12) —
tất định, đúng cả với chip trong phiên và Studio, không cần migration cho chat/Studio.

## Phase 1 — Design

- [data-model.md](./data-model.md) — `extraction_version`, `LayoutItem`, `layoutPage` result, `PageText.blocks`,
  progress `reprocess`, `citationValid`, trạng thái xử lý lại.
- [contracts/pdf-layout.md](./contracts/pdf-layout.md) — quy tắc `layoutPage`.
- [contracts/ipc-reprocess.md](./contracts/ipc-reprocess.md) — `source:reprocess`, `source:reprocessCancel`,
  `source:getContent` mở rộng.
- [quickstart.md](./quickstart.md).

### Thứ tự thực hiện gợi ý (cho /speckit-tasks)

1. Trình sinh PDF fixture + hàm thuần `pdf-layout` (test trước) → adapter `parsePdf`.
2. Chunker `blocks` (test trước) → `cleanText` idempotent check.
3. Migration #9 + `Source.extractionVersion` + ghi version khi nạp PDF.
4. `source:getContent` + `citationValid` + viewer ghi chú (độc lập, làm sớm được).
5. `replaceChunks` + `deleteByIds` + `pipeline.reprocess` (test lỗi/huỷ từng bước) → IPC + preload → UI.
6. Hiệu năng SC-006, hồi quy 108, ADR + glossary, gate + E2E.

## Complexity Tracking

Không có vi phạm hiến pháp cần biện minh.
