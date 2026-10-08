# Contract — công cụ đo (mở rộng 108)

`npm run eval:retrieval` giữ nguyên hành vi 108. Biến môi trường mới:

| Biến                | Mặc định                    | Ý nghĩa                                                                                                                                                                                             |
| ------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EVAL_RERANK`       | —                           | danh sách model cách nhau dấu phẩy (vd `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1,onnx-community/gte-multilingual-reranker-base`) ⇒ chấm điểm mọi (câu, đoạn hợp nhất) một lần/model, quét lưới R7 |
| `EVAL_RERANK_FILE`  | tự chọn theo `process.arch` | tên tệp ONNX riêng (a1: `model_qint8_arm64` / `model_quint8_avx2`)                                                                                                                                  |
| `EVAL_JUDGE`        | —                           | `llm` ⇒ hướng b (một lượt `EVAL_LLM_MODEL` cục bộ mỗi câu); chỉ chạy khi chỉ định                                                                                                                   |
| `EVAL_MODE=current` | —                           | thêm: đo cấu hình rerank trong `RELEVANCE_CALIBRATION.rerank` (nếu khác null) và so với số liệu ghi                                                                                                 |

Báo cáo (`tests/eval/reports/<t>/report.{md,json}`) thêm:

- Bảng theo model: cấu hình × (CR, R@6) dev / hold-out vi / en + CI95 Wilson; đường Pareto khi không cấu hình nào đạt.
- Dòng kết luận: `ĐẠT` (R6: CR hold-out ≥ 0,9, R@6 hold-out ≥ 0,85, Wilson gộp ≥ 0,75, en không tụt) / `ĐẠT SÀN` (R@6 ∈ [0,75; 0,85)) / `KHÔNG ĐẠT`.
- Độ trễ: nạp nguội, p50/p95 chấm/câu, RSS tăng, event loop p99.
- Model không nạp được ⇒ ghi lỗi cho model đó, đo tiếp model khác (không dừng cả lượt).
