# Research — Notebooks (Phase 0)

Unknown chốt qua ADR D2 (cập nhật 2026-07-11), ADR migration `2026-07-11-sqlite-migrations.md`, clarify
`2026-07-11-notebooks-clarify.md`. Ghi lại quyết định + lý do + phương án loại bỏ.

## R1. Driver SQLite: `node:sqlite` (đổi từ better-sqlite3)

- **Decision**: dùng **`node:sqlite`** built-in của Node (`DatabaseSync`) làm driver SQLite ở main.
- **Rationale**: đã **probe xác nhận** chạy ở CẢ Electron 43 main lẫn Node 24 (vitest) không cần flag →
  **không native module, không rebuild ABI theo Electron** (bỏ hẳn friction của better-sqlite3). API sync
  giống better-sqlite3 (prepare/run/get/all, exec, transaction). Cập nhật ADR D2 (quy tắc ADR-governed stack).
- **Alternatives**: `better-sqlite3` (native — cần khớp ABI Electron; unit test node vs app electron xung
  đột ABI, phải rebuild qua lại — loại). `sql.js`/wasm (chậm, thừa). Bảng phụ `schema_migrations` (dùng `user_version` gọn hơn).
- **Lưu ý**: `node:sqlite` là experimental → Node phát `ExperimentalWarning`. Chấp nhận ở v1 (ổn định đủ);
  đóng gói production (electron-builder) dùng chính Node của Electron nên không cần thêm gì.

## R2. Mở DB + PRAGMA

- **Decision**: `database.ts` mở `new DatabaseSync(path)`; bật `PRAGMA foreign_keys = ON` (cho FK cascade
  ở 004) + `PRAGMA journal_mode = WAL` (bền + đọc/ghi tốt). Path = `app.getPath('userData')/insightvault.db`.
- **Rationale**: FK ON là bắt buộc để 004 cascade; WAL an toàn cho desktop.

## R3. Migration runner (ADR migration)

- **Decision**: mảng migration có thứ tự; đọc `PRAGMA user_version`; chạy migration index > version trong
  1 transaction; set `user_version`. Migration #1 = tạo bảng `notebook`. Append-only.
- **Rationale**: ADR `2026-07-11-sqlite-migrations.md`. 004 append migration #2 (source/chunk, FK→notebook cascade).
- **Down-grade guard**: nếu `user_version` > số migration mới nhất (app cũ mở DB mới) → không tự hạ; ném lỗi rõ (edge case spec).

## R4. Repo DI (test không cần Electron)

- **Decision**: `notebook-repo.ts` nhận `DatabaseSync` tiêm vào (factory `createNotebookRepo(db)`); unit
  test tạo `new DatabaseSync(':memory:')` + chạy migration → test SQL/CRUD thật.
- **Rationale**: node:sqlite in-memory chạy dưới vitest (node) → coverage business logic ≥80% (Constitution IV).

## R5. Validation ở boundary

- **Decision**: `validation.ts` — `validateName` (trim, 1–100, non-empty) + `validateColor` (thuộc palette).
  Repo gọi validate trước khi ghi; IPC handler cũng qua repo. Sai → ném lỗi có message thân thiện (renderer hiển thị).
- **Rationale**: input renderer→main→DB (như 007 ModelSelection); chống ghi giá trị lạ. FR-007/008.

## R6. ID + timestamps

- **Decision**: `id` = `crypto.randomUUID()` (có ở cả 2 runtime). `created_at`/`updated_at` = epoch ms (INTEGER).
- **Rationale**: UUID tránh đụng; epoch ms đơn giản, relative-time tính từ đó.

## R7. Tìm kiếm client-side (A5)

- **Decision**: `notebook:list` trả toàn bộ; renderer lọc theo tên (`toLowerCase().includes`). Không kênh search.
- **Rationale**: dataset cá nhân nhỏ; đơn giản, tức thì (SC-003).

## R8. Relative-time tiếng Việt (A9)

- **Decision**: util thuần `formatRelativeTime(nowMs, thenMs)`: vừa xong / X phút trước / X giờ trước /
  hôm qua / X ngày trước / tuần trước / `DD/MM/YYYY` khi > ~4 tuần. Nhận `now` tiêm vào → test tất định.
- **Rationale**: không thêm lib; test được (Constitution IV).

## Không còn NEEDS CLARIFICATION.
