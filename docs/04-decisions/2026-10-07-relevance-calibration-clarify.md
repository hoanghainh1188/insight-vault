# relevance-calibration clarify (108)

- Ngày: 2026-10-07
- Feature: `108-relevance-calibration` (issue #108)
- Nguồn: intake `docs/intake/108-relevance-calibration.md` (11 ambiguity) — người dùng trả lời dạng hỏi đáp
  trước bước specify (12 câu). Cùng 2 quyết định đã chốt trong issue: bộ dữ liệu TỰ SOẠN từ tài liệu tiếng Việt
  công khai (~8–12 tài liệu, ~80 câu có đáp án + ~20 câu không có đáp án, người dùng duyệt) và ưu tiên KHÔNG BỊA
  (từ chối đúng ≥ 90%, Recall@6 ≥ 85%).
- Liên quan: `2026-07-11-rag-retrieval-strategy.md` (ngưỡng 0.75 — sẽ bị thay), `2026-07-13-rag-enhance-clarify.md`
  (hybrid RRF/MMR), `2026-07-13-embed-in-process-clarify.md` (e5-small, 0.5).

## Quyết định (người dùng chốt)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Lưu tài liệu đánh giá | **Toàn văn** trong `tests/eval/corpus/`, CHỈ nguồn được tái phân phối: văn bản quy phạm pháp luật VN (không thuộc đối tượng bảo hộ quyền tác giả) và Wikipedia tiếng Việt (CC BY-SA, ghi nguồn). Mỗi tệp kèm nguồn + giấy phép. Chạy offline. |
| 2 | Gắn nhãn đoạn đáp án | **Theo trích đoạn nguyên văn (quote)**: kết quả "trúng" nếu chunk chứa trích đoạn; nhiều trích đoạn ⇒ trúng khi gặp BẤT KỲ cái nào. Không lệch khi đổi chunker. |
| 3 | Nơi chạy công cụ đo | **Thủ công** (`npm run eval:retrieval`) **+ job CI bấm tay** (`workflow_dispatch`, cache model, báo cáo làm artifact). KHÔNG chặn PR. |
| 4 | Định nghĩa Recall@6 | Tỉ lệ câu có **≥ 1 đoạn đáp án** trong 6 đoạn cuối cùng đưa cho LLM (sau RRF + MMR + lọc). |
| 5 | Tầng đo "từ chối đúng" | **Tầng truy xuất là chuẩn ĐẠT** (`retrieve()` rỗng ⇒ "Không tìm thấy", tất định). Tuỳ chọn `--with-llm` (Ollama) đo end-to-end — chỉ báo cáo tham khảo. |
| 6 | Sàn Recall khi không đạt cả hai | **Recall@6 ≥ 75%** (vẫn giữ từ chối ≥ 90%). Dưới sàn ⇒ dừng, báo lại để cân nhắc hướng khác (vd reranker). |
| 7 | "Đường bịa" ở `rag-service` | **Siết ở chế độ theo nguồn**: câu trả lời không có [n] hợp lệ nào ⇒ trả "Không tìm thấy trong nguồn" thay vì gắn mọi đoạn ngữ cảnh làm trích dẫn. Chế độ Mở rộng giữ nguyên. |
| 8 | Phạm vi áp dụng | **Chỉ `retrieve()` của hỏi đáp.** Tìm toàn văn (073) + Studio giữ nguyên. Chế độ Mở rộng khi không có đoạn liên quan VẪN gọi LLM. |
| 9 | Loại câu hỏi | Tiêu chí ĐẠT tính trên **câu tiếng Việt độc lập**; thêm **~10 câu tiếng Anh** hỏi tài liệu tiếng Việt chỉ để **báo cáo tham khảo**. Câu nối tiếp (cần LLM viết lại) **ngoài phạm vi**. |
| 10 | Chống quá khớp | **Chia dev 70% / hold-out 30%** (chọn trên dev, xác nhận trên hold-out) **+ tài liệu nhiễu** không liên quan trong notebook đánh giá (mô phỏng notebook lớn). |
| 11 | Đổi model embedding sau này | **Test canh giữ**: ngưỡng lưu kèm phiên bản model đã hiệu chỉnh; đổi `EMBEDDING_MODEL_VERSION` mà không cập nhật bản ghi hiệu chỉnh ⇒ unit test fail, nhắc chạy lại công cụ đo. |
| 12 | Câu "Không tìm thấy" | **Thêm gợi ý ngắn** (chỉ đổi chữ): "Không tìm thấy trong nguồn. Thử hỏi cụ thể hơn, hoặc chuyển sang chế độ Mở rộng nếu chấp nhận nội dung ngoài tài liệu." |
