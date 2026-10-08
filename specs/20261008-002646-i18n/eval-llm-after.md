# Đo lời nhắc SAU khi đổi (T072)

- Ngày: 2026-10-08 · model: `qwen2.5:7b` (Ollama cục bộ, nhiệt độ mặc định ⇒ có dao động giữa các lượt)
- Lệnh: `EVAL_MODE=current EVAL_WITH_LLM=1 EVAL_LLM_MODEL=qwen2.5:7b npm run eval:retrieval`
- Bộ câu: datasetVersion 2 (vi hold-out 30 câu + en 31 câu), chế độ Theo nguồn, không lịch sử
- Hồi quy truy xuất 108: ✓ "hồi quy OK" ở MỌI lượt (truy xuất không đổi)
- Tiêu chí (research R9): [n] hợp lệ và từ chối đúng không thấp hơn TRƯỚC quá 1 câu/nhóm; đúng ngôn ngữ ≥ 90%.

## TRƯỚC (lời nhắc tiếng Việt cũ) — xem eval-llm-before.md

| Nhóm | Có đáp án | [n] hợp lệ | Trả nhầm "không tìm thấy" | Đúng ngôn ngữ | Không đáp án | Từ chối đúng |
|---|---|---|---|---|---|---|
| vi | 24 | 95.8% | 4.2% | 100.0% (n=22) | 6 | 100.0% |
| en | 22 | 72.7% | 27.3% | 93.8% (n=16) | 9 | 100.0% |

## Các biến thể đã đo (lời nhắc English + chỉ dẫn ngôn ngữ đầu ra)

| Biến thể "không tìm thấy" | Nhóm | [n] hợp lệ | Trả nhầm | Đúng ngôn ngữ | Từ chối đúng | Đạt? |
|---|---|---|---|---|---|---|
| A. Mềm ("say briefly…, without any [n]") — lượt 1 | vi / en | 100% / 72.7% | 0% / 27.3% | 100% (24) / 100% (16) | 83.3% / 100% | ĐẠT (vi −1 câu) |
| A. Mềm — lượt 2 | vi / en | 100% / 72.7% | 0% / 27.3% | 100% (24) / 100% (15) | 83.3% / 100% | ĐẠT (vi −1 câu) |
| B. Câu cố định + "không trả lời bằng sự kiện liên quan" | vi / en | 100% / 63.6% | 0% / 36.4% | 100% (24) / 83.3% (12) | 100% / 100% | KHÔNG (en −2 câu, ngôn ngữ < 90%) |
| C. Câu cố định theo ngôn ngữ (vi/en) | vi / en | 100% / 59.1% | 0% / 40.9% | 100% (24) / 91.7% (12) | 100% / 100% | KHÔNG (en −3 câu) |
| **D. Lai — vi: câu cố định "Không tìm thấy trong nguồn."; en/không rõ: mềm (CHỌN)** | vi / en | **100% / 77.3%** | **0% / 22.7%** | **100% (24) / 93.8% (16)** | **83.3% / 100%** | **ĐẠT** |

## Phân tích

- Câu không đáp án hold-out bị tính "trả lời" ở A/D là **q-098** ("Số điện thoại báo cháy khẩn cấp… là số mấy?"): model nêu
  sự thật CÓ trong nguồn ("số báo cháy được quy định thống nhất trong cả nước") kèm [1] — không bịa nhưng không trả lời
  câu hỏi. Lời nhắc vi của D giống hệt C (C đạt 6/6) ⇒ chênh 1 câu là dao động lấy mẫu.
- Chạy riêng 20 câu không đáp án tiếng Việt × 2 lượt: lời nhắc cũ trả nhầm 4/40 (q-089, q-100); biến thể C 4/40 — cùng
  mức; A 6/40 (+q-098).
- Câu cố định làm câu hỏi English trên nguồn tiếng Việt (truy xuất xuyên ngôn ngữ) bị từ chối nhầm nhiều hơn ⇒ D dùng câu
  cố định CHỈ khi nhận ra chắc chắn câu hỏi tiếng Việt (đúng phương án dự phòng ở clarify #6b: "giữ lời nhắc theo ngôn
  ngữ cho câu hỏi vi").
- Giới hạn: một model tham chiếu, mẫu nhỏ (6/9 câu không đáp án mỗi nhóm), nhiệt độ mặc định ⇒ số liệu dao động ±1 câu.
