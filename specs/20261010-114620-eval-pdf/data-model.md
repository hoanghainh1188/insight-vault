# Data Model — Thêm PDF vào bộ đánh giá truy xuất (177)

Mở rộng mô hình của 108 (`specs/20261007-111628-relevance-calibration/data-model.md`). Chỉ liệt kê phần đổi / mới.

## EvalDocument (`tests/eval/corpus/manifest.json`) — mở rộng

| Trường | Kiểu | Bắt buộc | Quy tắc |
|---|---|---|---|
| `id` | string | ✓ | kebab-case, duy nhất (không đổi) |
| `title`, `sourceUrl`, `retrievedAt`, `noise` | — | ✓ | không đổi |
| `license` | `EvalLicense` | ✓ | thêm `"CC0-1.0"` (văn bản tự soạn của fixture) cạnh `"public-domain-vn-law"`, `"CC BY-SA 4.0"` |
| `format` | `"md" \| "pdf"` | — | thiếu ⇒ `"md"` (tương thích 11 tài liệu cũ) |
| `file` | string | — | thiếu ⇒ `<id>.<format>`; chỉ tên tệp (không `/`, `\`, `..`) trong `corpus/` |
| `sha256` | string (64 hex thường) | ✓ khi `format = "pdf"` | khớp bytes tệp; lệch ⇒ lỗi tải dữ liệu |
| `revisionId` | number | — | có sẵn cho Wikipedia (PDF Wikipedia ghi revision đã xuất) |
| `generator` | string | — | PDF fixture: `"tests/eval/lib/pdf-fixture.ts"` (cách tái tạo) |

Quy tắc thêm: `noise: true` không được có `format: "pdf"` (A16 — không tài liệu nhiễu PDF); số tài liệu thật / nhiễu tối thiểu
(`MIN_CORPUS_DOCS` 8, `MIN_NOISE_DOCS` 2) giữ nguyên.

## Dataset (bộ nhớ) — đổi

- `loadDataset(dir): Promise<Dataset>` (trước: đồng bộ).
- `texts: Map<id, string>` — `md`: nội dung tệp; `pdf`: `ParseResult.text` của `parsePdf(bytes)` (cấu hình mặc định).
- `loadErrors` thêm: thiếu tệp, tệp rỗng / văn bản trích rỗng, `sha256` lệch, `file` không hợp lệ.

## EvalQuestion (`questions.json`) — không đổi cấu trúc

- Câu PDF: `lang: "vi"`; `split` 70/30 trong từng loại; `quotes` viết theo văn bản trích (bảng `| ô | ô |`, giữ gạch nối tiếng Việt),
  nằm trọn trong một trang; `docIds` của một câu có đáp án phải **cùng định dạng** (validate).
- Câu không đáp án sát chủ đề PDF: `type: "unanswerable"`, không `quotes` / `docIds` (như cũ) — thêm trường tuỳ chọn
  `topic: "pdf"` để xếp vào nhóm PDF khi báo cáo (không ảnh hưởng chấm).
- `QuestionsFile.datasetVersion`: `"3"` → `"4"`; `reviewed: null`.

## QuestionOutcome (`metrics.ts`) — mở rộng

- Thêm `format: "md" | "pdf" | null` — câu có đáp án: định dạng của `docIds[0]`; câu không đáp án: `"pdf"` nếu `topic === "pdf"`, ngược
  lại `null` (thuộc nhóm tổng, không vào nhóm định dạng).

## FormatGroups (mới, trong kết quả `groupOutcomes`)

```text
{ dev, holdout, en,                       // KHÔNG đổi — cổng 108/109 dùng nhóm này
  byFormat: { md: { dev, holdout }, pdf: { dev, holdout } } }   // chỉ câu vi; mỗi ô là EvalMetrics
```

## PdfWarning (mới)

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `split` | `"dev" \| "holdout"` | tập |
| `pdfRecallAt6` | number | Recall@6 nhóm PDF |
| `pdfUpper95` | number | cận trên Wilson 95% |
| `mdRecallAt6` | number | Recall@6 nhóm Markdown |
| `nPdf` | number | số câu PDF có đáp án |

Phát khi `pdfUpper95 < mdRecallAt6` và `nPdf > 0`. Không làm eval fail.

## EvalReport (`report.ts`) — mở rộng

- `pdfExtractionVersion: number` (= `PDF_EXTRACTION_VERSION` lúc chạy).
- `byFormat` (nhóm trên, theo cấu hình được chọn / hiện hành) + `pdfWarnings: PdfWarning[]`.

## RELEVANCE_CALIBRATION (`src/main/services/rag/relevance-calibration.ts`) — chỉ số liệu

`datasetVersion: "4"`, `calibratedAt`, `metrics.{dev,holdout}`, `rerank.metrics.{dev,holdout,en}` cập nhật từ lượt đo mới. Cấu trúc và cấu
hình **không đổi**. Không thêm `pdfExtractionVersion` (A10).

## Bổ sung sau review (2026-10-12)

- `QuestionOutcome.topSources?: string[]` — tiêu đề nguồn của 6 đoạn đầu (chỉ để đọc báo cáo, không dùng chấm).
- `EvalReport.details?: { relevance?: QuestionOutcome[]; production?: QuestionOutcome[] }` — chỉ khi `EVAL_DETAILS=1`.
- `validateQuestions(..., documents)` — tham số `documents` BẮT BUỘC (Q1). Lỗi trích dẫn nêu cả mã câu lẫn mã tài liệu (FR-004).
- `loadDataset`: `parsePdf` ném ⇒ `loadErrors` "không trích được <file>: <tên lỗi>" (không reject).
