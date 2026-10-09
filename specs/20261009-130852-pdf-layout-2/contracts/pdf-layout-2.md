# Contract — bố cục PDF đợt 2

## Bất biến (mọi đợt)

- `cleanText(text) === text` cho văn bản trích PDF; `chunk.text === T.slice(charStart, charEnd)`; mọi đổi văn bản xảy ra trong `parsePdf` / `pdf-layout/`.
- Không IPC mới, không đổi preload, không migration, không egress, không log nội dung.

## Đợt 1 — (e) lưới bảng (renderer)

- `parsePdfTables(text: string, pageBreaks: PageBreak[]): PdfTable[]` — thuần, `src/shared/pdf-tables.ts`; lỗi ⇒ `[]`.
- `buildSegments(text, highlight, pageBreaks, tables?: PdfTable[]): ViewerBlock[]` — không truyền `tables` ⇒ một khối `text` như hành vi cũ (test cũ giữ kỳ vọng).
- `SourceTable` — `<table aria-label="Bảng {i} — trang {p}">`, `<thead><tr><th scope="col">…`, `<tbody>`; ô số `text-align: right`; vùng tràn `role="region"
tabindex=0` có nhãn; `<mark class="hl">` trong ô; testid `viewer-table-{i}`.
- Công tắc: `viewer-view-grid` / `viewer-view-text` (radio / toggle), lưu `sessionStorage` (try/catch), mặc định lưới; chỉ hiện khi nguồn PDF có ≥ 1 bảng.

## Đợt 2 — (c) trang xoay + phiên bản

- `toDisplayItem(item: TextItem, vpTransform: number[]): LayoutItem` — thuần; 0 / 90 / 180 / 270 ⇒ cùng nội dung ⇒ cùng dòng / thứ tự.
- `PDF_EXTRACTION_VERSION = 3`; `reprocessHintKey(v)`; i18n `sources.item.reprocessHintV2` (+ aria) vi / en.

## Đợt 3 — (b) bảng số

- `looksNumeric(s): boolean`, `decimalAnchor(seg): number` — thuần.
- `detectRightAlignedTable(lines, page): Table | null` — đường phụ; bảng căn trái hiện có không đổi kết quả.

## Đợt 4 — (a) gạch nối

- `decideHyphen(prevWord, nextWord, lexicon?): HyphenDecision` — thuần; `buildLexicon(lines: string[]): Lexicon`.
- `appendLine` (paragraphs) và phần tiếp ô (tables) dùng `decideHyphen`.
- Tập cặp từ `tests/fixtures/pdf/hyphen-pairs.ts`: ≥ 95% đúng nhóm "chắc", không kém hành vi cũ; tiếng Việt 0 nối dính.
