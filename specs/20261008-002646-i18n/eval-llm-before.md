# Đo lời nhắc TRƯỚC khi đổi (T065)

- Ngày: 2026-10-08 · model: `qwen2.5:7b` (Ollama cục bộ) · lời nhắc: bản tiếng Việt cũ (trước lớp 5)
- Lệnh: `EVAL_MODE=current EVAL_WITH_LLM=1 EVAL_LLM_MODEL=qwen2.5:7b npm run eval:retrieval`
- Bộ câu: datasetVersion 2 (vi hold-out 30 câu + en 31 câu), chế độ Theo nguồn, không lịch sử
- Hồi quy truy xuất 108: ✓ Khớp số liệu ghi trong RELEVANCE_CALIBRATION (hồi quy OK)
- Báo cáo gốc: `tests/eval/reports/20261008-080041/report.md` (không commit — thư mục reports bị gitignore)

| Nhóm | Có đáp án | Có [n] hợp lệ | Trả nhầm "không tìm thấy" | Đúng ngôn ngữ | Không đáp án | Từ chối đúng |
|---|---|---|---|---|---|---|
| vi | 24 | 95.8% | 4.2% | 100.0% (n=22) | 6 | 100.0% |
| en | 22 | 72.7% | 27.3% | 93.8% (n=16) | 9 | 100.0% |

Ghi chú: "Đúng ngôn ngữ" chỉ tính câu trả lời nhận diện chắc chắn được ngôn ngữ (n). Nhóm en: câu hỏi English trên corpus
tiếng Việt (truy xuất xuyên ngôn ngữ) — tỉ lệ trả nhầm "không tìm thấy" cao hơn vi là giới hạn truy xuất có từ trước 123.
