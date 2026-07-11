# Detail design — tài liệu thiết kế GỐC (chi tiết)

Mỗi feature 1 thư mục: `docs/02-detail-design/<slug>/` (`<slug>` khớp branch `NNN-<slug>` — xem
[`01-basic-design/README.md`](../01-basic-design/README.md)). Cùng quy tắc đặt / không-sửa / versioning,
**gồm cả yêu cầu bản export text-extractable** nếu có tài liệu Office/PDF nhị phân.

Đây là nơi chứa phần "thịt" mà `design-intake` đọc kỹ nhất trước khi sinh prompt `/speckit-specify`:

- **Bảng field + validation rule** — kiểu dữ liệu, ràng buộc, giá trị mặc định. Nếu là bảng Excel,
  export ra markdown để không mất cấu trúc khi parse.
- **Business rule + edge case + error state** — các nhánh xử lý, thông báo lỗi, điều kiện biên.

Input càng đủ 2 nhóm này, spec sinh ra càng ít ambiguity phải đưa vào `/speckit-clarify`.

Cùng quy tắc `CHANGELOG.md` như `01-basic-design`: mỗi bản mới ghi 1 mục kèm **Affected issues** (bắt
buộc) — số issue của feature bị ảnh hưởng để biết cái nào phải re-run
(xem [`docs/TEAM-WORKFLOW.md`](../TEAM-WORKFLOW.md) mục 8).
