# Quickstart — kiểm chứng 147

```bash
npm run lint && npm test && npx electron-vite build && npx playwright test
```

Thủ công (mỗi đợt):

1. **(e)** Mở một PDF đã nạp có bảng (vd báo cáo có bảng 3 cột) ⇒ hỏi một câu trả lời nằm trong bảng ⇒ bấm chip ⇒ bảng hiện dạng lưới, ô được trích dẫn tô sáng
   đúng, cuộn tới; chuyển "Dạng văn bản" ⇒ thấy `| a | b |` với cùng vùng tô; cửa sổ 900 px không tràn (bảng rộng cuộn ngang được bằng Tab + phím mũi tên).
2. **(c)** Nạp PDF có trang khổ ngang `/Rotate 90` (vd xuất từ Word "Landscape") ⇒ văn bản trang đó có đoạn / cột / bảng bình thường.
3. **(b)** Nạp báo cáo tài chính có bảng số căn phải ⇒ bảng hiện dạng lưới, số căn phải; mục lục không chấm dẫn không thành bảng.
4. **(a)** Nạp tài liệu tiếng Anh có "long-term" ngắt dòng + tài liệu tiếng Việt có "hợp-đồng" ngắt dòng ⇒ giữ gạch; "information" ngắt dòng vẫn liền.
5. PDF nạp từ v0.2.16 trở về trước ⇒ gợi ý "Xử lý lại để cải thiện bảng, trang xoay và gạch nối"; xử lý lại ⇒ chip cũ thành "trích dẫn cũ".
