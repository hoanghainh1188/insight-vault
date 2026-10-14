# Trích PDF: hộp thông tin và tiêu đề cột bảng — cổng khả thi không đạt (206)

- Ngày: 2026-10-14
- Feature: `206-pdf-infobox-table-header` (issue #206, thuộc #187). Spec/plan/tasks: `specs/20261014-221336-pdf-infobox-table-header/`.
- Trạng thái: **Đề xuất** — chờ chủ dự án chấp nhận (Hải).
- Phạm vi: chỉ tài liệu + số đo. **Không đổi mã**: `src/` giữ nguyên, `PDF_EXTRACTION_VERSION` giữ 3.

## Bối cảnh

#187 kết luận "giới hạn đã biết" và chỉ ra q-162 (bảng nhà ga) và q-185 (hộp thông tin) bị bộ chấm từ chối nhầm vì văn bản trích bị trộn. #206 đề xuất sửa ở tầng trích PDF. Khảo sát toạ độ thật của `tuyen-2a-ha-noi.pdf` xác nhận hai lỗi bố cục có thật và sửa được về kỹ thuật:

- Trang 2: cột thân bài (rộng 24,7% trang, ngay dưới ngưỡng "cột dày" 25%) không được tách khỏi hộp ⇒ gộp thành bảng 3 cột sai.
- Trang 5: tiêu đề 8 dòng canh giữa ô nằm trên hàng dữ liệu đầu và không vào bảng.

## Cổng khả thi (trước khi viết mã)

Chấm bằng bộ chấm hiện hành văn bản viết tay "lý tưởng" cho đoạn đáp án (số liệu đầy đủ ở `research.md`, mục "Kết quả cổng khả thi"):

| Câu   | Hiện tại | Trích hoàn hảo (tốt nhất đo được)                           | Ngưỡng |
| ----- | -------- | ----------------------------------------------------------- | ------ |
| q-162 | 0,133    | 0,465 (tiêu đề sạch + hàng Láng); 0,300 với 4 hàng          | 0,6    |
| q-185 | 0,177    | 0,064 (hàng sạch); 0,007 (hộp sạch); 0,108 (câu văn thường) | 0,6    |

## Quyết định

1. **Không viết mã trích** cho #206 ở thời điểm này: sửa trích hoàn hảo cũng không đưa câu nào vượt `minScore` 0,6, nên không cứu được câu nào trên đường app và sẽ tốn công + rủi ro hồi quy (đổi văn bản của mọi PDF) mà không đổi kết quả.
2. q-185 là giới hạn ngữ nghĩa của model chấm (không nối "điện khí hóa" với "ray thứ ba 750V DC" ngay cả khi là một câu văn), không phải lỗi bố cục. Cùng kết luận với #187: cross-encoder chấm "liên quan", không chấm "trả lời được".
3. q-162 cải thiện đáng kể khi có tiêu đề sạch (0,13 → 0,47) nhưng chưa đủ; hạ `minScore` bị cấm bởi FR-003 của #187 (sẽ làm lọt q-176 / q-179).
4. Giữ nguyên spec / plan / tasks như hồ sơ: nếu sau này có tín hiệu "trả lời được" (#207) hoặc model chấm thay thế làm q-162 nhạy với tiêu đề, kế hoạch sẵn sàng chạy lại từ T004.
5. Hạ ưu tiên #206. Bằng chứng #205 (tầng trả lời từ chối đúng 216/216) cho thấy #207 cũng không gấp; hai câu q-162 / q-185 là hai câu có đáp án bị từ chối nhầm trên đường truy xuất, và chưa có phương án nào cứu được.

## Còn mở

- Hướng khác chưa thử, ngoài phạm vi #206: để tầng trả lời (LLM) quyết định khi bộ chấm điểm thấp nhưng ứng viên đứng đầu về vector / BM25 (thuộc #207); hoặc bỏ bộ chấm cho đoạn dạng bảng. Cần đo riêng, ghi vào #207.
- Hàng 02/03 của bảng nhà ga đang bị gộp sai (R5 trong plan) — không ảnh hưởng q-162, chỉ cần xử lý nếu #206 được mở lại.
