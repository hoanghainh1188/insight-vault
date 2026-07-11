# notebooks — quyết định clarify (9 điểm)

- Ngày: 2026-07-11
- Feature liên quan: `009-notebooks` (issue #9, pha 003 trong lộ trình ADR D8)
- Câu hỏi gốc: 9 ambiguity từ `docs/intake/009-notebooks.md`. Chốt trực tiếp (không qua /speckit-clarify) theo khuyến nghị được người dùng duyệt.
- Người quyết định: hoanghainh1188 (2026-07-11)

## Quyết định

| #   | Câu hỏi                      | Quyết định                                                                                                                                                                                              |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Bảng màu notebook            | **Palette cố định** (~8 màu, họ màu prototype: `#1E6B57`, `#3B6EA5`, `#8A5A9E`, `#B4713C`, + vài màu bổ sung). Cột `color` lưu **hex string**, validate thuộc palette ở boundary (chống giá trị lạ).    |
| A2  | Giới hạn tên                 | Tên bắt buộc non-empty sau trim; **1–100 ký tự**; **cho phép trùng tên**; cho unicode/emoji. Vượt giới hạn → từ chối với lỗi thân thiện.                                                                |
| A3  | Hành vi xoá                  | **Có xác nhận** (dialog) + **hard delete** (xoá hẳn khỏi SQLite). Chưa soft-delete/`deleted_at` ở v1; schema thiết kế để `004-ingestion` dùng FK `ON DELETE CASCADE` dọn source/chunk khi xoá notebook. |
| A4  | "N nguồn" khi chưa có source | Hiển thị **"0 nguồn"** (trung thực — notebook thật sự chưa có nguồn tới 004). Không ẩn, không số giả.                                                                                                   |
| A5  | Tìm kiếm                     | **Client-side** — lọc danh sách đã tải qua `notebook:list` (không phân biệt hoa/thường). Không thêm kênh `notebook:search`.                                                                             |
| A6  | Danh sách IPC                | **5 kênh** `notebook:*`: `list`, `create`, `rename`, `delete`, `setColor`. (search làm client-side.) Renderer không chạm SQLite.                                                                        |
| A7  | Migration/versioning SQLite  | **Runner SQL tự viết + `PRAGMA user_version`** (nhẹ, không lib). Ghi thành ADR riêng `docs/04-decisions/2026-07-11-sqlite-migrations.md` (cấp dự án) để `004` theo.                                     |
| A8  | UI "Tạo notebook mới"        | **Modal** (form: tên + chọn màu từ palette). Dùng chung cho create + rename/đổi màu.                                                                                                                    |
| A9  | Định dạng "Sửa <thời gian>"  | **Util relative-time tiếng Việt tự viết** (vừa xong / X phút trước / X giờ trước / hôm qua / X ngày trước / tuần trước / DD/MM/YYYY khi cũ). Không lib.                                                 |

## Ghi chú

- A3/A7: schema `notebook(id, name, color, created_at, updated_at)` — không có `deleted_at` ở v1; migration runner cho phép 004 thêm bảng `source`/`chunk` (FK → notebook, ON DELETE CASCADE) an toàn.
- A1: validate màu ở boundary (như validate model name ở 007) — chống ghi giá trị lạ vào SQLite.
- Tích hợp vào spec ở `/speckit-specify` (không chạy `/speckit-clarify`).
