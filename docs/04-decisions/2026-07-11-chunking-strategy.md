# Chunking strategy — chiến lược phân đoạn & locator (011-ingestion)

- Ngày: 2026-07-11
- Feature liên quan: `011-ingestion` (áp cho mọi feature dùng chunk sau này: `005-rag-qa`, `006-source-viewer`)
- Câu hỏi gốc: ingestion là nơi đầu tiên tạo `chunk`. Cần chốt kích thước/overlap/ranh giới chunk và cách
  gắn `locator` cho từng loại nguồn (đặc biệt docx/URL không có khái niệm "trang") — vì chất lượng chunk
  ảnh hưởng trực tiếp tới retrieval của `005-rag-qa`.
- Người quyết định: hoanghainh1188 (2026-07-11, ủy quyền "chốt khuyến nghị")

## Quyết định

**Đơn vị & kích thước.** Chunk theo **ký tự** (không phụ thuộc tokenizer của model — ổn định giữa các
provider). Mục tiêu **~1000 ký tự/chunk**, **overlap ~150 ký tự** giữa 2 chunk liền kề (giữ ngữ cảnh biên
cho retrieval). Hằng số cấu hình được ở một nơi (`CHUNK_SIZE`, `CHUNK_OVERLAP`).

**Ranh giới cắt (recursive).** Ưu tiên cắt tại ranh giới tự nhiên để không xé giữa câu:
đoạn (`\n\n`) → xuống dòng (`\n`) → câu (`. `/`! `/`? `) → cứng theo ký tự khi một khối vẫn vượt kích thước.

**Ranh giới trang (PDF).** Chunk **KHÔNG vắt qua ranh giới trang**: parse PDF theo từng trang, chunk trong
phạm vi một trang → `locator.page` luôn đơn trị, trích dẫn map chính xác về đúng trang (Constitution II).

**Locator (gắn NGAY lúc tạo chunk — NON-NEGOTIABLE, Constitution II).** Type shared
`Locator = { page: number | null; charStart: number; charEnd: number }`:

- `charStart`/`charEnd`: offset (nửa mở `[start, end)`) vào **toàn văn bản đã làm sạch** của nguồn — một
  luồng ký tự đơn điệu, tính một lần khi chunk, **cấm tái tạo/ước lượng sau**.
- `page`: PDF → số trang 1-based mà chunk thuộc về; docx/txt/md/URL → `null` (không có khái niệm trang).
- Với PDF, offset ký tự vẫn tính theo toàn văn bản ghép các trang (đơn điệu), `page` bổ sung để hiển thị.

**Thứ tự.** Mỗi chunk lưu `ordinal` (0-based, tăng dần theo thứ tự xuất hiện trong nguồn) để tái dựng ngữ
cảnh và hiển thị.

## Lý do

- Ký tự thay vì token: tránh phụ thuộc tokenizer riêng của từng embedding model → locator ổn định, test
  tất định (không cần chạy model để chunk).
- Overlap giữ ngữ cảnh biên, giảm mất thông tin khi câu trả lời nằm vắt qua ranh giới chunk.
- Không vắt trang giữ `page` đơn trị → trích dẫn "trang 48" chính xác, đúng ràng buộc bất biến #3 OVERVIEW.
- Offset half-open `[start, end)` là quy ước chuẩn, dễ tính độ dài = `end - start`, khớp API highlight sau.

## Phương án loại bỏ

- Chunk theo token (tiktoken…): thêm dependency, locator phụ thuộc model → khó tất định, không cần cho MVP.
- Cho chunk vắt nhiều trang: `page` thành mảng/khoảng → phức tạp hoá highlight ở source-viewer, bỏ.
- Chunk theo cấu trúc ngữ nghĩa (heading-aware): để dành tối ưu sau; MVP dùng recursive char splitter.

## Hệ quả

- `data-model.md` của `011-ingestion`: bảng `chunk` có cột `ordinal`, `text`, `locator_json` (hoặc
  `page`/`char_start`/`char_end` tách cột), `source_id` (FK CASCADE).
- `005-rag-qa` dùng lại `Locator` để render chip trích dẫn; `006-source-viewer` dùng `charStart/charEnd`
  (+ `page`) để highlight — KHÔNG tự chunk lại.
