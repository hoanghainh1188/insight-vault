# Quickstart: kiểm đầu-cuối #206

Điều kiện: Node + `npm ci` xong; Ollama KHÔNG cần.

1. **Cổng khả thi (bước 0)** — chấm văn bản lý tưởng bằng công cụ trong `tests/eval` (lệnh chốt ở T001 của tasks.md); kỳ vọng điểm ≥ 0,6 cho q-162 và q-185, nếu không dừng theo plan.
2. **Hàm thuần**: `npx vitest run tests/unit/pdf-layout-side-box.test.ts tests/unit/pdf-layout-table-header.test.ts tests/unit/pdf-layout-regression.test.ts` — xanh.
3. **Đọc tay văn bản thật**: chạy script dump (như khảo sát trong research.md) cho `tuyen-2a-ha-noi.pdf`; trang 2 có bảng hộp sạch, trang 5 có đúng một hàng tiêu đề; mọi trang khác diff-không-đổi hoặc cải thiện đọc được.
4. **Bộ đánh giá**: `EVAL_DETAILS=1 npm run eval:retrieval` — q-162, q-185 không bị từ chối; so báo cáo từng câu với mốc trước (không câu nào tụt; sàn tiếng Anh giữ).
5. **Trích dẫn**: e2e hiện có (`npx playwright test`) vẫn xanh; thủ công: mở PDF Tuyến 2A, hỏi q-185, bấm chip → trang 2 và vùng tô là hộp.
6. **Nguồn cũ**: mở notebook có PDF nạp bằng bản 0.2.22 ⇒ hiện gợi ý Xử lý lại; xử lý lại xong, hỏi lại các câu bảng.
