# Feature Specification: Notebooks (quản lý notebook)

**Feature Branch**: `009-notebooks`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Quản lý notebook (CRUD + màu + tìm kiếm) — màn S1. Feature đầu dùng SQLite
metadata (better-sqlite3 ở main, DB trong data dir), migration runner nền cho 004. Renderer qua kênh
notebook:* whitelisted, không chạm SQLite. 9 quyết định đã chốt (docs/04-decisions/2026-07-11-notebooks-clarify.md)."

## Clarifications

### Session 2026-07-11

- Q: A1 — Bảng màu? → A: **Palette cố định ~8 màu**; cột `color` = hex validate theo palette ở boundary.
- Q: A2 — Giới hạn tên? → A: non-empty sau trim, **1–100 ký tự**, cho trùng tên, cho unicode/emoji; vượt → từ chối lỗi thân thiện.
- Q: A3 — Xoá? → A: **Xác nhận dialog + hard delete**; chưa soft-delete; schema để 004 dùng FK `ON DELETE CASCADE`.
- Q: A4 — "N nguồn" khi chưa có source? → A: hiển thị **"0 nguồn"** (trung thực).
- Q: A5 — Tìm kiếm? → A: **client-side** (lọc từ `notebook:list`, không phân biệt hoa/thường); không kênh search riêng.
- Q: A6 — IPC? → A: **5 kênh** `notebook:` list/create/rename/delete/setColor.
- Q: A7 — Migration? → A: runner tự viết + `PRAGMA user_version` (ADR `2026-07-11-sqlite-migrations.md`).
- Q: A8 — UI tạo/sửa? → A: **Modal** (tên + chọn màu palette).
- Q: A9 — "Sửa <thời gian>"? → A: util relative-time tiếng Việt tự viết.

Đầy đủ: `docs/04-decisions/2026-07-11-notebooks-clarify.md`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Xem & tìm notebook (Priority: P1)

Là người dùng, khi mở ứng dụng tôi thấy màn Notebooks: một lưới các notebook đã tạo (mỗi thẻ có dải màu,
tên, dòng "N nguồn · Sửa <thời gian>"), và một ô tìm kiếm để lọc nhanh theo tên.

**Why this priority**: Đây là màn đầu tiên và điểm vào chính của app; không liệt kê/tìm được notebook thì
mọi thao tác khác vô nghĩa. Cũng là nơi kiểm chứng dữ liệu SQLite được đọc đúng.

**Independent Test**: Với vài notebook đã có trong DB, mở app → lưới hiển thị đúng số thẻ + đúng tên/màu;
gõ vào ô tìm kiếm → danh sách lọc theo tên (không phân biệt hoa/thường).

**Acceptance Scenarios**:

1. **Given** đã có 3 notebook trong DB, **When** mở màn Notebooks, **Then** thấy 3 thẻ với đúng tên + dải
   màu + dòng "0 nguồn · Sửa <thời gian tương đối>".
2. **Given** đang ở màn Notebooks, **When** gõ một chuỗi vào ô tìm kiếm, **Then** chỉ các notebook có tên
   khớp (không phân biệt hoa/thường) còn hiển thị.
3. **Given** chưa có notebook nào, **When** mở màn Notebooks, **Then** thấy trạng thái rỗng + thẻ "Tạo notebook mới".

---

### User Story 2 - Tạo notebook mới (Priority: P1)

Là người dùng, tôi tạo notebook mới bằng cách bấm "Notebook mới" (hoặc thẻ "Tạo notebook mới") → mở modal
nhập **tên** + chọn **màu** từ bảng màu cố định → lưu; notebook mới xuất hiện ngay trong lưới và được lưu bền.

**Why this priority**: Không tạo được notebook thì không có gì để quản lý; đây là hành động khởi tạo dữ liệu SQLite đầu tiên.

**Independent Test**: Bấm tạo → nhập tên hợp lệ + chọn màu → lưu → thẻ mới xuất hiện; đóng/mở lại app → thẻ vẫn còn.

**Acceptance Scenarios**:

1. **Given** modal tạo notebook mở, **When** nhập tên hợp lệ + chọn màu + xác nhận, **Then** notebook được
   lưu vào SQLite và xuất hiện ngay trong lưới.
2. **Given** modal tạo notebook, **When** để tên rỗng (hoặc chỉ khoảng trắng), **Then** không tạo được, hiện lỗi thân thiện.
3. **Given** modal tạo notebook, **When** nhập tên > 100 ký tự, **Then** bị từ chối với lỗi thân thiện.
4. **Given** vừa tạo notebook, **When** đóng và mở lại ứng dụng, **Then** notebook vẫn còn (lưu bền).

---

### User Story 3 - Đổi tên, đổi màu, xoá notebook (Priority: P1)

Là người dùng, tôi đổi tên / đổi màu một notebook đã có (qua modal), và xoá notebook (có xác nhận); mọi
thay đổi lưu bền ngay.

**Why this priority**: Quản lý vòng đời notebook là phần còn lại của CRUD; xoá phải an toàn (xác nhận) và
dọn sạch dữ liệu để chuẩn bị cho ràng buộc khoá ngoại ở 004.

**Independent Test**: Đổi tên → thẻ cập nhật + giữ sau khi mở lại; đổi màu → dải màu đổi; xoá → xác nhận →
thẻ biến mất + không còn trong DB.

**Acceptance Scenarios**:

1. **Given** một notebook đã có, **When** đổi tên qua modal + lưu, **Then** tên mới hiển thị + lưu bền; `updated_at` cập nhật.
2. **Given** một notebook đã có, **When** đổi màu sang màu khác trong palette, **Then** dải màu thẻ đổi + lưu bền.
3. **Given** một notebook đã có, **When** chọn xoá, **Then** hiện dialog xác nhận; xác nhận → notebook bị
   xoá hẳn khỏi lưới và SQLite; huỷ → không đổi gì.

---

### User Story 4 - Cô lập truy cập DB (main-only) (Priority: P1)

Là người dùng coi trọng riêng tư, mọi truy cập SQLite phải nằm ở tiến trình chính; giao diện (renderer)
không tự đọc/ghi DB mà chỉ yêu cầu qua các kênh IPC được whitelisted; tên notebook không bị ghi log.

**Why this priority**: Ràng buộc bất biến (Constitution I & III, ADR D5). Đây là feature đầu chạm DB — nếu
renderer chạm DB trực tiếp thì phá ranh giới bảo mật cho mọi feature dữ liệu sau.

**Independent Test**: Renderer không có cách đọc/ghi SQLite trực tiếp; mọi CRUD đi qua đúng 5 kênh
`notebook:*` whitelisted; gọi kênh `notebook:*` ngoài danh sách bị từ chối.

**Acceptance Scenarios**:

1. **Given** app đang chạy, **When** renderer cố truy cập filesystem/DB trực tiếp, **Then** không thực hiện được.
2. **Given** whitelist IPC, **When** renderer gọi kênh `notebook:*` không thuộc 5 kênh đã định, **Then** bị từ chối, không side effect.
3. **Given** thao tác notebook, **When** kiểm log, **Then** không có tên notebook (nội dung người dùng) trong log.

---

### Edge Cases

- Xoá notebook đang được lọc trong tìm kiếm → thẻ biến mất khỏi kết quả; không crash.
- Tên chỉ gồm khoảng trắng → coi như rỗng (từ chối). Tên có khoảng trắng đầu/cuối → **trim** trước khi lưu.
- Màu gửi lên không thuộc palette → **từ chối** (validate boundary), không ghi vào DB.
- DB file chưa tồn tại (lần đầu) → migration runner tạo bảng `notebook` (migration #1); không lỗi.
- DB đã ở version mới hơn code (hiếm — hạ cấp app) → không tự hạ schema; báo lỗi rõ, không phá dữ liệu.
- Tìm kiếm không khớp notebook nào → hiện trạng thái rỗng của kết quả tìm kiếm.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Màn Notebooks MUST hiển thị lưới notebook đã tạo; mỗi thẻ gồm dải màu, tên, và dòng meta
  "N nguồn · Sửa <thời gian tương đối>".
- **FR-002**: Ở feature này (chưa có source), số nguồn MUST hiển thị **"0 nguồn"** (không số giả).
- **FR-003**: Người dùng MUST tìm kiếm notebook theo tên (lọc **client-side**, không phân biệt hoa/thường).
- **FR-004**: Người dùng MUST tạo notebook mới qua **modal**: nhập tên + chọn màu từ **palette cố định**; notebook mới xuất hiện ngay + lưu bền.
- **FR-005**: Người dùng MUST đổi tên và đổi màu notebook đã có (qua modal); thay đổi lưu bền + cập nhật `updated_at`.
- **FR-006**: Người dùng MUST xoá notebook, **có dialog xác nhận**; xác nhận → xoá hẳn (hard delete) khỏi SQLite.
- **FR-007**: Tên notebook MUST non-empty sau trim, độ dài **1–100 ký tự**; **cho phép trùng tên**; cho unicode/emoji; vượt giới hạn MUST bị từ chối với lỗi thân thiện.
- **FR-008**: Màu notebook MUST thuộc **palette cố định** (validate ở boundary); giá trị ngoài palette MUST bị từ chối, không ghi DB.
- **FR-009**: Metadata notebook (`id, name, color, created_at, updated_at`) MUST lưu trong **SQLite**, truy
  cập **CHỈ ở main process**; file DB trong thư mục dữ liệu ứng dụng.
- **FR-010**: Ứng dụng MUST có **migration runner** (dùng `PRAGMA user_version`, append-only) khởi tạo/nâng
  cấp schema an toàn; migration #1 tạo bảng `notebook`. Schema MUST cho phép feature sau thêm bảng liên kết
  (FR khoá ngoại `ON DELETE CASCADE`) mà không phá dữ liệu đã có.
- **FR-011**: Renderer MUST NOT truy cập SQLite trực tiếp; mọi CRUD MUST qua **5 kênh IPC whitelisted**:
  `notebook:list`, `notebook:create`, `notebook:rename`, `notebook:delete`, `notebook:setColor` (không đổi 10 kênh app/ai).
- **FR-012**: Ứng dụng MUST NOT ghi log tên notebook (nội dung người dùng — Constitution III).
- **FR-013**: Bấm một thẻ notebook MUST điều hướng sang khu vực Workspace (khung route có từ 001).
- **FR-014**: Xoá notebook MUST dọn sạch metadata của nó trong SQLite (nền cho FK cascade ở 004).

### Key Entities _(include if feature involves data)_

- **Notebook**: `{ id, name, color, created_at, updated_at }` — bản ghi metadata trong SQLite. `name` =
  nội dung người dùng; `color` = hex thuộc palette.
- **Color palette**: tập màu cố định (~8 hex) người dùng chọn cho notebook; nguồn validate cho `color`.
- **Schema version**: số phiên bản schema DB (`PRAGMA user_version`) — cơ sở cho migration append-only.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Người dùng tạo một notebook mới (nhập tên + chọn màu) trong **≤ 15 giây**; thẻ xuất hiện ngay.
- **SC-002**: **100%** notebook đã tạo được giữ đúng (tên + màu) qua các lần đóng/mở lại app.
- **SC-003**: Tìm kiếm theo tên trả kết quả **tức thì** (cảm nhận không trễ) và khớp đúng (không phân biệt hoa/thường).
- **SC-004**: Xoá notebook (sau xác nhận) gỡ nó khỏi lưới + DB ở **100%** trường hợp; huỷ xác nhận **0%** xoá nhầm.
- **SC-005**: **100%** input tên/màu không hợp lệ (rỗng/quá dài/màu ngoài palette) bị từ chối với lỗi thân thiện, không ghi DB.
- **SC-006**: Kiểm thử bảo mật: **100%** nỗ lực truy cập SQLite trực tiếp từ renderer thất bại; **100%** kênh
  `notebook:*` ngoài whitelist bị từ chối; **0** dòng log chứa tên notebook.
- **SC-007**: Nâng cấp schema: mở app với DB rỗng/cũ → migration chạy thành công **100%**, không mất dữ liệu đã có.

## Assumptions

> Chín điểm A1–A9 đã chốt ở `docs/04-decisions/2026-07-11-notebooks-clarify.md`; migration ở ADR
> `docs/04-decisions/2026-07-11-sqlite-migrations.md` (xem Clarifications).

- **A1**: Palette màu cố định ~8 màu (họ màu prototype); `color` lưu hex, validate theo palette.
- **A2**: Tên 1–100 ký tự, trim, cho trùng, cho unicode/emoji.
- **A3**: Xoá = xác nhận + hard delete; chưa `deleted_at`.
- **A4**: "0 nguồn" cho tới khi có source (004).
- **A5**: Tìm kiếm client-side (không kênh search riêng).
- **A6**: 5 kênh `notebook:*`.
- **A7**: Migration runner tự viết + `PRAGMA user_version` (ADR riêng).
- **A8**: Modal cho tạo/đổi tên/đổi màu.
- **A9**: Relative-time tiếng Việt tự viết.
- **A10**: Tận dụng khung màn `/` (Notebooks) + `/workspace` + IPC pattern + data dir đã dựng ở `001-app-shell`.

## Dependencies

- Phụ thuộc `001-app-shell` (đã merge): route `/` + `/workspace`, data dir, IPC contract nền, modal/CSS pattern.
- Ràng buộc kỹ thuật: ADR `2026-07-10-tech-stack.md` (D2/D6), `2026-07-11-notebooks-clarify.md`,
  `2026-07-11-sqlite-migrations.md`; Constitution I, III, IV.
- **Chuẩn bị cho `004-ingestion`**: schema + migration để thêm bảng `source`/`chunk` (FK → notebook, cascade).
