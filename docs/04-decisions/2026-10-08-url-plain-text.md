# Văn bản thuần cho nguồn trang web (150)

- Ngày: 2026-10-08
- Feature liên quan: `150-url-plain-text` (issue #150) — sửa lỗi nhỏ, không qua Spec Kit (như #142).
- Câu hỏi gốc: nạp URL (Readability + turndown) lưu nguyên cú pháp Markdown — liên kết `[chữ]` + `(https://… "title")`,
  dấu chú thích `[\[11\]]` trỏ `#cite_note-…`, ảnh `![]` bọc trong liên kết tới `…/File:…`, liên kết `[edit]` trỏ
  `index.php?…action=edit…`, escape `\[`,
  nhấn mạnh `_pho_`. Trình xem nguồn hiện thô; cùng nhiễu đó đi vào chunk → embedding và BM25.
- Người quyết định: Hải (2026-10-08) — yêu cầu "chỉ giữ chữ của liên kết, bỏ ảnh và dấu chú thích, giữ offset trích
  dẫn nhất quán".

## Quyết định

1. **Đổi ngay ở bước parse** (`parsers/url-text.ts` — `articleHtmlToText`, hàm thuần có unit test): HTML bài viết
   (đầu ra Readability) → văn bản thuần, TRƯỚC `cleanText` + chunk. Locator `{charStart,charEnd}` vì vậy được tính
   trên văn bản mới — văn bản chính tắc (Constitution II) — nên chip `[n]` → trình xem → tô sáng vẫn đúng mà
   **không** cần ánh xạ offset nào. Không hậu xử lý chuỗi Markdown bằng regex (ngoặc lồng nhau, URL có `()`).
2. Quy tắc turndown (rule thêm sau cùng thắng):
   - liên kết `a` → chỉ giữ chữ (bỏ `href`, `title`), kể cả liên kết đỏ `action=edit&redlink=1` (là nội dung);
   - bỏ `img`/`picture`/`svg`/`script`/`style`/`noscript` (ảnh bọc trong liên kết ⇒ không còn gì); giữ `figcaption`;
   - bỏ liên kết nội trang `#…` có chữ là dấu chú thích: `[7]`, `[a]`, `[note 1]`, `↑`, `^`, `1`–`999`, `a`–`z`
     (thân bài và liên kết quay lại trong danh sách tham khảo); nội dung tài liệu tham khảo vẫn giữ;
   - bỏ liên kết "sửa mục" MediaWiki (`action=edit` + `section=`) và vỏ `[edit]` / `[edit | edit source]` — nhận
     diện theo URL + chữ vì Readability đã xoá class `mw-editsection`;
   - không escape Markdown, bỏ dấu nhấn mạnh (`em/i/strong/b` → chữ); giữ tiêu đề `##` (atx), đoạn, danh sách `-`.
3. Không bump phiên bản embedding/FTS, không migration: chỉ nguồn URL nạp **sau** bản này dùng văn bản mới.

## Số đo (https://en.wikipedia.org/wiki/Pho, 2026-10-08)

- Văn bản lưu: 91 843 → 43 863 byte (−52%); còn lại 0 chỗ `](`, `![`, `cite_note`, `http`, `[edit]`, `↑`.
- Chuyển đổi ~40 ms cho bài ~690 KB HTML.

## Hạn chế đã biết — nguồn URL đã nạp trước bản này

- Giữ nguyên văn bản cũ (còn cú pháp liên kết). Chunk/locator của chúng vẫn tự nhất quán ⇒ trích dẫn cũ vẫn mở và
  tô sáng đúng; chỉ là còn nhiễu trong trình xem/truy xuất.
- "Xử lý lại" (112) **chỉ áp dụng PDF** (`reprocessNotPdf`) và dò trùng URL theo URL chuẩn hoá (`urlContentHash`) ⇒
  muốn có văn bản sạch: **xoá nguồn rồi thêm lại URL** (tải lại trang — có egress, badge "đang gửi"; nội dung trang có
  thể đã đổi). Trích dẫn trong lịch sử chat trỏ nguồn đã xoá sẽ không mở được nữa.
- Follow-up (nếu cần): cho "Xử lý lại" nhận nguồn URL (tải lại + hoán đổi nguyên tử như 112, trích dẫn cũ ⇒
  `citationValid` = false), kèm phiên bản trích xuất cho URL để gợi ý thụ động.
