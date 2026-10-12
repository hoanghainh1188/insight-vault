# Quickstart — kiểm chứng #187

## PR 1 — chẩn đoán + v5

```bash
npx vitest run tests/unit/eval-rerank-diagnose.test.ts tests/unit/eval-pdf-corpus.test.ts tests/unit/eval-dataset.test.ts tests/unit/relevance-calibration.test.ts
EVAL_DETAILS=1 EVAL_MODE=current EVAL_RERANK=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 EVAL_RERANK_TOPN=12 EVAL_RERANK_MAXLEN=256 npm run eval:retrieval
```

Kỳ vọng: report.md có mục "Chẩn đoán bộ chấm"; q-162 có `cause` + `quoteInWindow` cụ thể; q-176 / q-179 `nearTopicHighScore` kèm điểm;
mọi câu v5 có trích dẫn khớp; số liệu khớp `RELEVANCE_CALIBRATION` (datasetVersion "5"). Chạy lại ⇒ giống hệt.

## PR 2 — thay đổi

```bash
EVAL_MODE=sweep EVAL_RERANK=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 npm run eval:retrieval   # lưới mở rộng (chọn trên dev, v5 đã duyệt)
EVAL_DETAILS=1 EVAL_MODE=current npm run eval:retrieval                                          # xác nhận cấu hình mới
```

Kỳ vọng: từ chối đúng dev vi ≥ 90%; q-162/q-170/q-171 không bị từ chối; gateVerdict ĐẠT; tiếng Anh ≥ 72,7% / 83,3%; p50 ≤ 400 ms,
p95 ≤ 800 ms; so từng câu với mốc: không câu hiện có nào tụt. Không đạt ⇒ ADR giới hạn + issue mới.
