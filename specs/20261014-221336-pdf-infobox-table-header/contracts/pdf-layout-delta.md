# Contract delta: văn bản trích PDF (so với 112 / 147)

Hợp đồng gốc: `specs/*pdf-layout*/contracts/pdf-layout.md` (112) và các đợt 147. Chỉ ghi phần ĐỔI.

1. **Hộp bên lề**: nếu trang có cột thân bài hẹp canh trái cạnh một vùng khác, thân bài và vùng bên được trích thành HAI vùng theo thứ tự đọc (thân bài trước, vùng bên sau); hộp nhãn / giá trị trong vùng bên là bảng Markdown 2 cột (một cặp một hàng; dòng nối tiếp đã gộp).
2. **Tiêu đề bảng**: bảng có dải tiêu đề nhiều dòng phía trên dữ liệu có đúng MỘT hàng tiêu đề (+ hàng phân cách); tiêu đề phủ nhiều cột ghi dạng "Nhóm · Cột".
3. **Bất biến giữ nguyên**: `cleanText(text) === text`; `blocks` là offset bảng đúng; trang không thuộc hai dạng trên cho văn bản byte-giống-hệt bản 3; lỗi / không chắc ⇒ cách cũ; tất định; trang > `MAX_LAYOUT_ITEMS_PER_PAGE` hoặc hết ngân sách ⇒ `legacyJoin` như cũ.
4. **Phiên bản**: `PDF_EXTRACTION_VERSION` = 4.
