# SQLite migration & versioning strategy (cấp dự án)

- Ngày: 2026-07-11
- Feature liên quan: `_project` (áp cho mọi feature dùng SQLite; khởi từ `009-notebooks`)
- Câu hỏi gốc: notebooks là feature ĐẦU dùng SQLite (ADR D2). Cần chốt chiến lược migration/versioning để
  các feature sau (`004-ingestion` thêm `source`/`chunk`) mở rộng schema an toàn, không phá dữ liệu người dùng.
- Người quyết định: hoanghainh1188 (2026-07-11)

## Quyết định

Dùng **migration runner tự viết, tối giản**, không thêm thư viện migration:

- **Versioning:** dùng `PRAGMA user_version` của SQLite làm số phiên bản schema hiện tại của DB.
- **Migrations:** mảng có thứ tự các bước migration (mỗi bước = một hàm/khối SQL idempotent theo version).
  Lúc mở DB ở main process: đọc `user_version`, chạy tuần tự các migration có index > version hiện tại
  trong **một transaction**, rồi set `user_version` = số migration mới nhất.
- **Vị trí:** `src/main/services/<feature>/…` khai báo migration của mình; một module DB chung
  (`src/main/db/…`) mở connection (`node:sqlite` `DatabaseSync` — xem ADR D2 cập nhật 2026-07-11), bật `PRAGMA foreign_keys = ON`, và chạy toàn bộ
  migration đã đăng ký. File DB đặt trong `app.getPath('userData')` (data dir của 001).
- **Quy ước cho feature sau:** THÊM migration mới ở cuối mảng (append-only), KHÔNG sửa migration đã phát
  hành (dữ liệu người dùng đã áp). Bảng mới liên kết notebook dùng khoá ngoại `ON DELETE CASCADE` để xoá
  notebook dọn sạch dữ liệu liên quan (chuẩn bị cho `004-ingestion`).

## Lý do

- Ứng dụng desktop cá nhân, schema đơn giản → runner tự viết đủ, tránh dependency + magic của lib migration.
- `user_version` là cơ chế versioning gốc của SQLite, không cần bảng phụ.
- Transaction + append-only đảm bảo nâng cấp an toàn, không phá dữ liệu đã có (Constitution I: dữ liệu người dùng trên máy).

## Phương án loại bỏ

- Thư viện migration (vd `umzug`, `node-pg-migrate` biến thể) — thừa cho nhu cầu; thêm bề mặt phụ thuộc.
- Bảng `schema_migrations` tự quản — `user_version` đơn giản hơn cho mô hình tuyến tính này.

## Hệ quả

- `009-notebooks` hiện thực module DB chung + migration #1 (bảng `notebook`).
- `004-ingestion` append migration #2+ (bảng `source`/`chunk`, FK → notebook) theo đúng quy ước ở đây.
