# Data Model — Bộ chấm độ liên quan: câu sát chủ đề và đoạn bảng (187)

Mở rộng mô hình 108 / 109 / 177. Chỉ liệt kê phần đổi / mới.

## RerankCandidate (mới, `tests/eval/lib/rerank-diagnose.ts`)

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `chunkId` | string | đoạn ứng viên (thứ tự RRF, đã cắt `maxCandidates`) |
| `source` | string | tiêu đề nguồn |
| `score` | number | điểm bộ chấm (sigmoid 0..1) |
| `hit` | boolean | đoạn chứa trích dẫn đáp án (câu có đáp án) |
| `quoteInWindow` | boolean \| null | trích dẫn còn trong phần đoạn sau khi cắt `maxTokens`; null nếu không phải đoạn đúng |

## QuestionOutcome (mở rộng)

- `rerankCandidates?: RerankCandidate[]` — chỉ khi chạy với bộ chấm và `EVAL_DETAILS=1`.

## RerankDiagnosis (mới)

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `questionId` | string | |
| `type` | answerable / unanswerable | |
| `split` | dev / holdout | |
| `bestScore` | number \| null | điểm cao nhất trong ứng viên |
| `answerScore` | number \| null | điểm cao nhất của đoạn đúng |
| `answerRrfRank` | number \| null | hạng RRF (1-based) của đoạn đúng đầu tiên |
| `quoteInWindow` | boolean \| null | của đoạn đúng tốt nhất |
| `cause` | `cutOff` \| `lowScoreInWindow` \| `nearTopicHighScore` \| `notRetrieved` \| `ok` | phân loại |

Phân loại: câu có đáp án bị từ chối / tụt: `quoteInWindow === false` ⇒ `cutOff`; trong cửa sổ nhưng `answerScore < minScore` ⇒
`lowScoreInWindow`; không có đoạn đúng trong ứng viên ⇒ `notRetrieved`. Câu không đáp án không bị từ chối ⇒ `nearTopicHighScore`. Còn
lại ⇒ `ok`.

## EvalReport (mở rộng)

- `rerankDiagnosis?: RerankDiagnosis[]` (mọi câu có `cause ≠ ok` + danh sách quan tâm), render ở mục "Chẩn đoán bộ chấm".

## questions.json v5

- `EvalQuestion.topicDocId?: string` (MỚI) — chỉ ở câu `unanswerable` sát chủ đề: id tài liệu thật mà câu "giả vờ" hỏi (validate: tồn tại,
  không nhiễu). Câu về PDF giữ thêm `topic: "pdf"` (177) để vào nhóm PDF.

- `datasetVersion` "5", `reviewed: null`; +~20 câu `unanswerable` sát chủ đề (tiếng Việt, `topic: "pdf"` nếu về PDF) + 2–3 câu `answerable` có
  đáp án trong bảng. Không đổi câu hiện có.

## RerankConfig / RELEVANCE_CALIBRATION (PR 2)

- Lưới mở rộng `maxCandidates`, `maxTokens` (`RerankCalibration.maxTokens`). Bản ghi đổi cấu hình + số liệu chỉ ở PR 2; PR 1 chỉ số liệu +
  `datasetVersion` "5".
