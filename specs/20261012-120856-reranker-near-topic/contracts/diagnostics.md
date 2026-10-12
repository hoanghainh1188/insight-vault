# Contract — Chẩn đoán bộ chấm trong báo cáo eval (187, PR 1)

Bật bằng `EVAL_DETAILS=1` (cùng cờ của 177). Không đổi số liệu / cổng.

## report.json

- `details.production[].rerankCandidates`: `RerankCandidate[]` (≤ `maxCandidates`, thứ tự RRF) — xem data-model.
- `rerankDiagnosis`: `RerankDiagnosis[]` — mọi câu có `cause ≠ "ok"` + danh sách quan tâm (q-176, q-179, q-162, q-170, q-171).

## report.md — mục mới

```text
## Chẩn đoán bộ chấm (cấu hình đã ghi — chỉ khi EVAL_DETAILS=1)
| Câu | Loại | Tập | Nguyên nhân | Điểm cao nhất | Điểm đoạn đúng | Hạng RRF đoạn đúng | Đáp án trong cửa sổ token |
Tổng theo nguyên nhân: cutOff n · lowScoreInWindow n · rankedOut n · nearTopicHighScore n · notRetrieved n
```

Quy tắc: không in nội dung đoạn (chỉ id, nguồn, điểm). Câu không có trong danh sách quan tâm và `cause = ok` không in.
