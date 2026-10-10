# Bốn loại Studio mới — quyết định thực thi (178, PR 2)

- Ngày: 2026-10-10
- Feature: `178-studio-enhance-2` (issue #178) — PR 2. Clarify: `2026-10-10-studio-enhance-2-clarify.md` (#2, #4).

## Quyết định

1. `StudioKind` / `STUDIO_KINDS` thêm `studyGuide`, `briefing`, `timeline`, `keyTerms` (thứ tự hiển thị = thứ tự Tab: 4 loại cũ rồi
   4 loại mới). CHECK DB đã mở ở migration v11 (PR 1) — không migration mới.
2. Mỗi loại thêm đúng một dòng "Task: …" trong `task()`; khung `common()` (mọi câu có `[n]`, không bịa, phủ cân bằng nguồn) không đổi.
   Dòng thời gian: nhãn mục sự kiện không rõ ngày theo ngôn ngữ đầu ra (`UNDATED_LABEL`: "Không rõ thời điểm" / "Undated"); nguồn không
   có ngày ⇒ nói rõ bằng một câu có trích dẫn đoạn đã kiểm (để không xung đột quy tắc `[n]` của `common()`).
3. Bố cục: lưới `repeat(2, minmax(0, 1fr))`, nút `min-width: 0` + `overflow-wrap: break-word` (xuống dòng ở khoảng trắng, chỉ ngắt
   giữa từ khi một từ không vừa). e2e kiểm cột ≤ 262 px ở cửa sổ 900 px, không cuộn ngang, không nút nào cắt chữ (vi + en).

## Giới hạn đã biết

- **Bước map của map-reduce trung lập theo loại**: ghi chú trung gian ("main points… short") có thể bỏ ngày / định nghĩa ⇒ với tài liệu
  dài, Dòng thời gian / Bảng thuật ngữ có thể thiếu mục. Không đổi ở PR 2 (thuật toán map-reduce là ràng buộc giữ nguyên của #178);
  cân nhắc gợi ý theo loại cho bước map ở đợt sau nếu kiểm thủ công cho thấy thiếu nhiều.
