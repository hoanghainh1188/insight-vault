# Data model — 108 relevance-calibration

Không thay đổi schema SQLite/LanceDB của ứng dụng. Các thực thể dưới đây là dữ liệu của repo (bộ đánh giá) và hằng số
cấu hình trong code.

## EvalDocument — `tests/eval/corpus/manifest.json` + `tests/eval/corpus/<id>.md`

| Trường        | Kiểu                                         | Ràng buộc                                          |
| ------------- | -------------------------------------------- | -------------------------------------------------- |
| `id`          | string                                       | duy nhất, kebab-case; tên tệp `<id>.md`            |
| `title`       | string                                       | tiêu đề hiển thị (dùng làm `sourceTitle`)          |
| `sourceUrl`   | string                                       | URL gốc                                            |
| `license`     | `"public-domain-vn-law"` \| `"CC BY-SA 4.0"` | bắt buộc                                           |
| `retrievedAt` | string (YYYY-MM-DD)                          | ngày lấy                                           |
| `noise`       | boolean                                      | `true` = tài liệu nhiễu, không câu hỏi nào trỏ tới |

Validation: tệp tồn tại, không rỗng, `id` không trùng; ≥ 8 tài liệu không nhiễu, ≥ 2 tài liệu nhiễu.

## EvalQuestion — `tests/eval/questions.json`

```text
{ "datasetVersion": "1", "reviewed": { "by": string, "date": "YYYY-MM-DD" } | null, "questions": EvalQuestion[] }
```

| Trường   | Kiểu                               | Ràng buộc                                                                                                                     |
| -------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`     | string                             | duy nhất (vd `q-001`)                                                                                                         |
| `text`   | string                             | câu hỏi, ≤ 2000 ký tự (MAX_QUESTION_LEN)                                                                                      |
| `lang`   | `"vi"` \| `"en"`                   | `en` = chỉ tham khảo                                                                                                          |
| `type`   | `"answerable"` \| `"unanswerable"` |                                                                                                                               |
| `split`  | `"dev"` \| `"holdout"`             | ~70/30 trong từng `type` (câu `vi`)                                                                                           |
| `quotes` | string[]                           | `answerable` ⇒ ≥ 1, mỗi trích đoạn ≤ 200 ký tự, PHẢI có nguyên văn trong 1 tài liệu (sau chuẩn hoá R6); `unanswerable` ⇒ rỗng |
| `docIds` | string[]                           | tài liệu chứa đáp án (đối chiếu); `unanswerable` ⇒ rỗng                                                                       |

Quy mô mục tiêu: ~80 `answerable/vi`, ~20 `unanswerable/vi`, ~10 `en` (cả hai loại). `reviewed = null` ⇒ công cụ đo chạy
được nhưng báo "BỘ DỮ LIỆU CHƯA DUYỆT — không dùng để chọn cấu hình" (FR-003).

## RelevanceConfig — `src/main/services/rag/relevance-filter.ts`

| Trường                  | Kiểu                                                              | Ý nghĩa                                                   |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| `maxDistance`           | number                                                            | ngưỡng cosine distance tuyệt đối nhánh vector             |
| `relativeDelta`         | number \| null                                                    | loại hit vector có `distance > best + delta` (null = tắt) |
| `bm25Gate`              | `"none"` \| `"requireVector"` \| `"vectorWithin"` \| `"minScore"` | cách chặn nhánh BM25                                      |
| `bm25VectorMaxDistance` | number \| null                                                    | dùng khi `vectorWithin`                                   |
| `bm25MaxScore`          | number \| null                                                    | dùng khi `minScore` (điểm bm25 FTS5, âm, nhỏ = liên quan) |

Validation (hàm thuần): số hữu hạn ≥ 0; trường phụ bắt buộc đúng theo `bm25Gate`.

## RelevanceCalibration — `src/main/services/rag/relevance-calibration.ts`

| Trường                  | Kiểu                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| `embeddingModelVersion` | string — PHẢI bằng `EMBEDDING_MODEL_VERSION` (test canh giữ, FR-019) |
| `config`                | RelevanceConfig                                                      |
| `calibratedAt`          | string (YYYY-MM-DD)                                                  |
| `datasetVersion`        | string — khớp `questions.json`                                       |
| `metrics`               | `{ dev: EvalMetrics; holdout: EvalMetrics }`                         |

## EvalMetrics / EvalReport — đầu ra công cụ đo (`tests/eval/reports/`, gitignore)

- `EvalMetrics`: `{ n, recallAt1, recallAt3, recallAt6, mrr, correctRejection, falseRejection, ci95: {...} }`.
- `EvalReport`: `{ runAt, embeddingModelVersion, datasetVersion, reviewed, configs: Array<{ config, dev, holdout, en }>,
chosen?, histograms: { answerHit, answerMiss, unanswerable }, avgRetrieveMs, llm?: { notFoundRate, n } }`.
  Xuất cả `report.json` và `report.md` (bảng so sánh).

## RagAnswer (không đổi kiểu)

- Hành vi mới ở chế độ theo nguồn: không có `[n]` hợp lệ ⇒ `{ answer: NOT_FOUND_DISPLAY, citations: [], notFound: true }`.
