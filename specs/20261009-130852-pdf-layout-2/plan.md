# Implementation Plan: Bố cục PDF đợt 2 — lưới bảng, trang xoay, bảng số căn phải, gạch nối

**Branch**: `147-pdf-layout` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/20261009-130852-pdf-layout-2/spec.md`; quyết định `docs/04-decisions/2026-10-09-pdf-layout-2-clarify.md`; intake `docs/intake/147-pdf-layout.md`;
kế thừa 112 (`docs/04-decisions/2026-10-07-pdf-layout.md`, `src/main/services/ingestion/pdf-layout/`).

## Summary

Bốn đợt, mỗi đợt một PR, cùng spec:

1. **(e) Lưới bảng** (renderer, không đổi phiên bản): hàm thuần dùng chung `parsePdfTables(text, pageBreaks)` nhận diện khối bảng Markdown của 112 (cổng chặt) và trả
   vị trí ký tự của từng ô; `buildSegments` mở rộng thành cây `plain | table(rows → cells → segments)` để tô sáng theo ký tự trong ô; `SourceTable` render
   `<table>` có ngữ nghĩa; công tắc "Dạng lưới / Dạng văn bản".
2. **(c) Trang xoay** (adapter): `parsePdf` dùng `page.getViewport({ scale: 1 })` (đã chuẩn hoá `/Rotate` + CropBox) để đưa toạ độ item sang hệ hiển thị
   (hàm thuần `toDisplayItem(item, viewport)`), `PageGeometry` theo viewport; `pdf-layout/` không đổi API. **Tăng `PDF_EXTRACTION_VERSION` 2 → 3** + gợi ý
   "Xử lý lại" theo phiên bản.
3. **(b) Bảng số căn phải** (`tables.ts`): đường phụ `detectRightAlignedTable(region)` chạy khi đường căn trái từ chối; cột theo mép phải / dấu thập phân;
   ngưỡng chống nhận nhầm; dùng lại `renderTable`.
4. **(a) Gạch nối** (`paragraphs.ts`): `decideHyphen(prev, next, lexicon)` thuần — luật "chắc" giữ gạch (bằng chứng tài liệu, chữ hoa / số, tiếng Việt, gạch
   treo), còn lại hành vi cũ; `Lexicon` từ tiền quét (chỉ khi có ngắt dòng bằng gạch).

Dự phòng theo hạng mục (`try/catch` cục bộ ⇒ kết quả cũ). Văn bản trích thay đổi luôn TRƯỚC `cleanText` / chunker ⇒ locator chính xác (Constitution II).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Electron 43, React 18; pdf.js (pdfjs-dist) như 112.

**Primary Dependencies**: có sẵn (không thêm).

**Storage**: không migration (`source.extraction_version` đủ chứa 3). Không lưu cấu trúc bảng.

**Testing**: vitest unit — `pdf-tables` (parse + offset → ô, test thuộc tính), `highlight` (cây bảng), `SourceTable` jsdom (vai trò table / columnheader, tô ô, căn
phải số, công tắc), `pdf-adapter` (viewport 0 / 90 / 180 / 270, CropBox lệch gốc), `pdf-layout-tables` (đường phụ: dương / âm, bảng căn trái không đổi),
`pdf-layout-paragraphs` (cây quyết định gạch nối, tiếng Việt, tập cặp từ gắn nhãn), `ingestion-pdf-blocks` (version 3), `pdf-parse-perf` (mẫu mở rộng ≤ 2×),
FTS ("long-term" ⇄ "long term"); fixture `tests/fixtures/pdf/make-pdf.ts` (mở rộng `rotate` 180 / 270 + nội dung vẽ ngược hướng) + `samples.ts` mẫu mới;
e2e `source-viewer` (lưới + tô sáng + công tắc, 900 px), `source-reprocess` (câu gợi ý theo phiên bản).

**Target Platform**: macOS arm64 + Windows x64.

**Project Type**: desktop-app (Electron main / renderer).

**Performance Goals**: trích PDF ≤ 2× cách cũ (SC-005); `LAYOUT_BUDGET_MS = 5000`, `MAX_LAYOUT_ITEMS_PER_PAGE` giữ nguyên; lưới: parse bảng O(n) theo độ dài văn bản.

**Constraints**: `cleanText(text) === text`; `chunk.text === T.slice(charStart, charEnd)`; không egress; không log nội dung; React text node (không `innerHTML`).

**Scale/Scope**: PDF ≤ vài trăm trang; bảng ≤ ~20 cột.

Không còn NEEDS CLARIFICATION (R1–R8 ở research.md).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                     | Đánh giá                                                                                                                                                            | Sau Phase 1 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| I. Local-first                 | Không kết nối mới; xử lý hoàn toàn cục bộ.                                                                                                                          | ✅          |
| II. Verifiable Citations       | Đổi văn bản trích chỉ TRƯỚC `cleanText` / chunker; lưới chỉ dựa vào văn bản + offset đã có; tô sáng theo ký tự trong ô (test thuộc tính).                           | ✅ contract |
| III. Desktop Security Boundary | Không IPC mới; renderer render React node; không đổi preload.                                                                                                       | ✅          |
| IV. Test-First & Coverage      | Mọi heuristic + ánh xạ offset là hàm thuần test trước; fixture tất định; ngưỡng 80% giữ.                                                                            | ✅          |
| V. Phased Delivery             | Bốn đợt / bốn PR trong cùng spec.                                                                                                                                   | ✅          |
| Terminology                    | Append glossary: lưới bảng / ô bảng (`parsePdfTables`, `TableCellRange`), công tắc dạng xem, xoay trang hiển thị, bảng số căn phải, quyết định gạch nối, `Lexicon`. | ✅          |

## Project Structure

```text
specs/20261009-130852-pdf-layout-2/ plan.md · research.md · data-model.md · quickstart.md · contracts/pdf-layout-2.md · tasks.md

# Đợt 1 — (e) lưới bảng
src/shared/pdf-tables.ts                          # MỚI (thuần) — parsePdfTables(text, pageBreaks) ⇒ PdfTable[] (ô có start/end), isNumericCell
src/renderer/features/source-viewer/highlight.ts  # SỬA — buildSegments nhận bảng ⇒ cây plain | table(rows→cells→segments)
src/renderer/features/source-viewer/SourceTable.tsx # MỚI — <table> ngữ nghĩa, tô theo ký tự, căn phải số, cuộn ngang
src/renderer/features/source-viewer/SourceViewer.tsx # SỬA — dùng cây; công tắc Dạng lưới / văn bản (sessionStorage an toàn)
src/renderer/features/source-viewer/source-viewer.css # SỬA — kiểu lưới
src/shared/i18n/domains/viewer.ts                 # SỬA — viewer.table.label, viewer.view.grid / text
# Đợt 2 — (c) trang xoay + phiên bản
src/main/services/ingestion/parsers/pdf.ts        # SỬA — viewport; toDisplayItem thuần (tách file pdf-viewport.ts nếu dài)
src/shared/ipc/types.ts                           # SỬA — PDF_EXTRACTION_VERSION = 3
src/renderer/features/sources/SourceItem.tsx      # SỬA — câu gợi ý theo phiên bản (reprocessHintFor(version) thuần)
src/shared/i18n/domains/sources.ts                # SỬA — reprocessHintV2 (+ aria)
tests/fixtures/pdf/make-pdf.ts, samples.ts        # SỬA — rotate 180/270, nội dung vẽ ngược hướng, CropBox lệch gốc
# Đợt 3 — (b) bảng số
src/main/services/ingestion/pdf-layout/tables.ts  # SỬA — detectRightAlignedTable (đường phụ), cột theo mép phải / thập phân
src/main/services/ingestion/pdf-layout/numeric.ts # MỚI (thuần) — looksNumeric, decimalAnchor
# Đợt 4 — (a) gạch nối
src/main/services/ingestion/pdf-layout/hyphen.ts  # MỚI (thuần) — decideHyphen(prevTail, nextHead, lexicon), buildLexicon
src/main/services/ingestion/pdf-layout/paragraphs.ts # SỬA — dùng decideHyphen; tables.ts phần tiếp ô dùng chung
src/main/services/ingestion/parsers/pdf.ts        # SỬA — tiền quét lexicon khi có ngắt dòng bằng gạch
tests/unit/(pdf-tables, highlight, source-table-ui, pdf-adapter-rotate, pdf-layout-tables-numeric, pdf-layout-hyphen, hyphen-pairs, ingestion-pdf-blocks, pdf-parse-perf, fts-hyphen)
tests/e2e/(source-viewer-grid, source-reprocess)
docs/04-decisions/2026-10-09-pdf-layout-2.md (+ INDEX), docs/00-glossary.md (append)
```

**Structure Decision**: heuristic + ánh xạ là hàm thuần; adapter pdf.js mỏng; renderer tách component trình bày. `pdf-layout/` vẫn không biết `/Rotate`.

## Phase 0 — Research

[research.md](./research.md): R1 parse bảng ở renderer · R2 tô sáng trong lưới · R3 xoay qua viewport · R4 phiên bản + gợi ý · R5 bảng số · R6 gạch nối
· R7 bộ mẫu / đo · R8 dự phòng.

## Phase 1 — Design

[data-model.md](./data-model.md) · [contracts/pdf-layout-2.md](./contracts/pdf-layout-2.md) · [quickstart.md](./quickstart.md)

### Thứ tự thực hiện (theo đợt / PR)

1. **PR1 (e)**: glossary → `parsePdfTables` (TDD + thuộc tính) → `buildSegments` cây (TDD) → `SourceTable` + công tắc (jsdom) → i18n → e2e lưới → ADR phần (e).
2. **PR2 (c)**: fixture xoay → `toDisplayItem` + viewport (TDD; xác nhận thí nghiệm pdf.js) → version 3 + `reprocessHintFor` (TDD) → e2e reprocess → ADR phần (c).
3. **PR3 (b)**: fixture dương / âm → `looksNumeric` / `decimalAnchor` (TDD) → `detectRightAlignedTable` (TDD; bảng căn trái không đổi) → perf → ADR phần (b).
4. **PR4 (a)**: tập cặp từ gắn nhãn → `decideHyphen` / `buildLexicon` (TDD) → tiền quét trong `parsePdf` → FTS test → perf → ADR đầy đủ + test gate.

## Complexity Tracking

Không có vi phạm hiến pháp cần biện minh.
