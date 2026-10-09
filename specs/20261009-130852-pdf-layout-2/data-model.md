# Data Model — 147

Không đổi DB (không migration). `PDF_EXTRACTION_VERSION` 2 → 3 (hằng, cột `source.extraction_version` có sẵn).

## PdfTable (shared, thuần — renderer dùng)

| Trường           | Kiểu            | Ghi chú                                                 |
| ---------------- | --------------- | ------------------------------------------------------- |
| `start`          | number          | vị trí ký tự đầu khối bảng trong văn bản nguồn          |
| `end`            | number          | vị trí ký tự sau dòng cuối                              |
| `header`         | `TableCell[]`   | hàng đầu (trước hàng phân cách)                         |
| `rows`           | `TableCell[][]` | các hàng dữ liệu                                        |
| `numericColumns` | boolean[]       | cột "trông như số" (≥ 80% ô) — để căn phải khi hiển thị |

`TableCell = { start: number; end: number; text: string }` — `[start, end)` trong văn bản gốc, không gồm `|` và khoảng trắng đệm; `text` đã bỏ thoát `\|`.

## Khối hiển thị (renderer)

`ViewerBlock = { kind: "text"; segments: Segment[] } | { kind: "table"; table: PdfTable; cells: Segment[][][] }` — `cells[row][col]` là segments (plain / highlight)
của ô; hàng 0 = tiêu đề.

## DisplayItem (main, thuần)

`LayoutItem` sau khi áp viewport: `x, y` (hệ hiển thị, gốc trên-trái), `rotated` tính theo hướng hiển thị; `PageGeometry` = kích thước viewport.

## HyphenDecision / Lexicon (main, thuần)

`HyphenDecision = "keep" | "keepSpaced" | "join" | "default"`; `Lexicon = { hyphenated: Set<string>; plain: Set<string> }` (chữ thường, NFC).

## Gợi ý xử lý lại

`reprocessHintKey(extractionVersion) ⇒ "reprocessHint" | "reprocessHintV2" | null`.
