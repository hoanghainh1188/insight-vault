---
description: "Task list — Notebooks (009-notebooks)"
---

# Tasks: Notebooks (quản lý notebook)

**Input**: Design từ `specs/20260711-083724-notebooks/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-channels.md, quickstart.md
**Tests**: BẮT BUỘC (Constitution IV — TDD, coverage ≥ 80% business logic). Repo/validation/migration/relative-time test với `node:sqlite` in-memory (`:memory:`), không cần Electron.

## Format: `[ID] [P?] [Story?] Description (file path)`

- **[P]**: song song được (khác file, không phụ thuộc task chưa xong).
- **[Story]**: US1–US4 map user story spec.md.

## Path Conventions (mở rộng 001)

`src/main/db/`, `src/main/services/notebooks/`, `src/renderer/features/notebooks/`, `src/shared/ipc/`, `tests/unit/`, `tests/e2e/`.

---

## Phase 1: Setup

- [x] T001 [P] Tạo skeleton `src/main/db/`, `src/main/services/notebooks/`, `src/renderer/features/notebooks/` (KHÔNG cần dep mới — `node:sqlite` built-in; đã đổi từ better-sqlite3, ADR D2 cập nhật 2026-07-11)

**Checkpoint**: thư mục sẵn sàng.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Phải xong trước mọi user story.** (DB module + migration + repo là data layer mọi story dùng.)

- [x] T002 [P] Thêm types `src/shared/ipc/types.ts`: `Notebook`, `NotebookColor`, `CreateNotebookInput`, `RenameNotebookInput`, `SetColorInput` (theo data-model.md)
- [x] T003 Thêm 5 kênh `notebook:*` vào `src/shared/ipc/channels.ts` (`CHANNELS` + whitelist + `ChannelResponse`): `notebook:list/create/rename/setColor/delete` — không đổi 10 kênh app/ai
- [x] T004 [P] `src/main/services/notebooks/palette.ts`: `PALETTE` (~8 hex họ prototype) + helper `isPaletteColor`
- [x] T005 [P] Unit test `tests/unit/notebook-validation.test.ts`: validateName (trim, 1–100, rỗng→lỗi, unicode/emoji OK), validateColor (thuộc palette) (RED)
- [x] T006 `src/main/services/notebooks/validation.ts`: `validateName` + `validateColor` (ném lỗi thân thiện khi sai) (GREEN)
- [x] T007 [P] Unit test `tests/unit/notebook-migrations.test.ts` (`:memory:`): migration #1 tạo bảng notebook; `user_version` → 1; chạy lại idempotent; guard hạ cấp (user_version > max → ném) (RED)
- [x] T008 `src/main/db/database.ts` (mở `node:sqlite` DatabaseSync, `PRAGMA foreign_keys=ON` + `journal_mode=WAL`) + `src/main/db/migrations.ts` (runner `PRAGMA user_version`, mảng `MIGRATIONS` append-only, #1 = CREATE TABLE notebook) (GREEN)
- [x] T009 [P] Unit test `tests/unit/notebook-repo.test.ts` (`:memory:` + migration): create→list→rename→setColor→delete; sắp theo updated_at desc; validate tích hợp (tên/màu sai → không ghi) (RED)
- [x] T010 `src/main/services/notebooks/notebook-repo.ts`: `createNotebookRepo(db)` → list/create/rename/setColor/delete (uuid + timestamps epoch ms; dùng validation; map row→Notebook, sourceCount=0) (GREEN)
- [x] T011 Wire DB ở `src/main/index.ts`: mở DB lúc `ready`, chạy migrations, tạo repo, truyền vào `registerIpc`
- [x] T012 Đăng ký 5 handler `notebook:*` trong `src/main/ipc/register.ts` (safeHandle, truyền args, KHÔNG log tên) + expose 5 hàm `notebook*` ở `src/preload/index.ts` (per-function)

**Checkpoint**: data layer + IPC sẵn; renderer gọi được CRUD.

---

## Phase 3: User Story 1 — Xem & tìm notebook (Priority: P1) 🎯 MVP

**Goal**: lưới notebook (card stripe màu + tên + "0 nguồn · Sửa …") + ô tìm kiếm client-side.
**Independent test**: seed vài notebook → lưới đúng; gõ tìm kiếm → lọc theo tên (không phân biệt hoa/thường).

- [x] T013 [P] [US1] Unit test `tests/unit/relative-time.test.ts`: formatRelativeTime(now, then) — vừa xong/phút/giờ/hôm qua/ngày/tuần/`DD/MM/YYYY` (now tiêm vào) (RED)
- [x] T014 [US1] `src/renderer/features/notebooks/relative-time.ts` (util thuần) (GREEN)
- [x] T015 [P] [US1] E2e `tests/e2e/notebook-list.spec.ts`: tạo vài notebook qua UI → lưới hiển thị; gõ tìm kiếm → lọc đúng (RED)
- [x] T016 [US1] `src/renderer/features/notebooks/NotebookCard.tsx` + `NotebooksGrid.tsx` (lưới + ô tìm kiếm client-side + nút/thẻ "Tạo mới"; **bấm card → điều hướng `/workspace` — FR-013/F1**) + `useNotebooks.ts` (list qua `window.api.notebookList`)
- [x] T017 [US1] Wire `NotebooksGrid` vào route `/` (thay `NotebooksPlaceholder`); giữ testid `placeholder-notebooks`; verify V1/V6

**Checkpoint**: xem + tìm notebook chạy được (MVP).

---

## Phase 4: User Story 2 — Tạo notebook mới (Priority: P1)

**Goal**: modal tạo (tên + chọn màu palette) → lưu bền → xuất hiện ngay.
**Independent test**: tạo notebook hợp lệ → thẻ mới; mở lại app vẫn còn; tên rỗng/quá dài → lỗi.

- [x] T018 [P] [US2] E2e `tests/e2e/notebook-create.spec.ts`: mở modal → nhập tên + màu → lưu → thẻ xuất hiện; tên rỗng → lỗi (RED)
- [x] T019 [US2] `src/renderer/features/notebooks/NotebookModal.tsx` (form tạo: input tên + chọn màu từ PALETTE) + `create` trong `useNotebooks` (gọi `notebookCreate`, hiển thị lỗi validate); mở modal từ nút/thẻ "Tạo mới"

**Checkpoint**: tạo notebook lưu bền.

---

## Phase 5: User Story 3 — Đổi tên / đổi màu / xoá (Priority: P1)

**Goal**: đổi tên + đổi màu (modal), xoá (có xác nhận + hard delete), lưu bền ngay.
**Independent test**: đổi tên → cập nhật + giữ; đổi màu → stripe đổi; xoá → xác nhận → biến mất khỏi lưới + DB.

- [x] T020 [P] [US3] E2e `tests/e2e/notebook-edit-delete.spec.ts`: đổi tên/màu qua modal; xoá → dialog xác nhận → biến mất; huỷ → giữ nguyên (RED)
- [x] T021 [US3] `NotebookModal` chế độ sửa (rename + setColor) + `DeleteConfirm.tsx` (dialog xác nhận) + `rename`/`setColor`/`delete` trong `useNotebooks`; nút hành động trên `NotebookCard`

**Checkpoint**: đủ CRUD notebook.

---

## Phase 6: User Story 4 — Cô lập truy cập DB (Priority: P1)

**Goal**: SQLite chỉ ở main; renderer qua 5 kênh whitelisted; không log tên notebook.
**Independent test**: window.api có 5 hàm notebook; renderer không đọc SQLite; kênh notebook lạ bị từ chối.

- [x] T022 [P] [US4] Contract test `tests/unit/notebook-ipc-whitelist.test.ts`: 5 kênh `notebook:*` whitelisted; tổng whitelist = 15; kênh `notebook:*` lạ → `isWhitelisted=false` (RED) — FR-011, SC-006
- [x] T023 [P] [US4] E2e `tests/e2e/notebook-security.spec.ts`: `window.api` có 5 hàm notebook; renderer không có cách chạm SQLite; gọi kênh notebook lạ không side effect (RED)
- [x] T024 [US4] Củng cố whitelist `notebook:*` trong `register.ts` (safeHandle, no catch-all) + preload per-function; đảm bảo handler KHÔNG truyền tên notebook vào `logEvent` (FR-012); verify V7/V8

**Checkpoint**: ranh giới bảo mật giữ nguyên với DB + 5 kênh mới.

---

## Phase 7: Polish & Cross-Cutting

- [x] T025 [P] Chạy `npm test -- --coverage`, đảm bảo ≥ 80% business logic (notebook-repo/validation/migrations/relative-time); bù test nếu thiếu
- [x] T026 [P] Append glossary `docs/00-glossary.md` (`notebook color`, `notebook search`, `notebook metadata`, `color palette`) — bước glossary-steward
- [ ] T027 [P] Kiểm chạy macOS + Windows (thủ công/CI matrix); ghi kết quả `quickstart.md`
- [x] T028 Rà `git diff` sau format; đảm bảo lint/test/build xanh trước test gate

---

## Dependencies

```
Setup (T001)
  └▶ Foundational (T002–T012)   ← chặn mọi story (DB + migration + repo + IPC)
        ├▶ US1 (T013–T017) [P1] 🎯 MVP (list + search)
        ├▶ US2 (T018–T019) [P1] (create)
        ├▶ US3 (T020–T021) [P1] (rename/color/delete)
        └▶ US4 (T022–T024) [P1] (whitelist + isolation)
              └▶ Polish (T025–T028)
```

- Handlers 5 kênh đăng ký ở Foundational (T012) → US1/2/3 chỉ lắp UI + hook + e2e. US4 khoá whitelist + verify.
- Trong mỗi story: task test [P] chạy trước (RED) → impl (GREEN).

## Parallel opportunities

- Foundational: T004/T005/T007/T009 song song với nhau (khác file); impl T006/T008/T010 tuần tự theo dependency (validation→repo, db→migrations→repo).
- US1: T013 (test relative-time) song song T015 (e2e list).
- Các unit/e2e test đầu mỗi story [P] song song.

## Implementation strategy

- **MVP = US1** (xem + tìm notebook) sau khi Foundational xong.
- Tăng dần: + US2 (tạo) → + US3 (sửa/xoá) → + US4 (bảo mật) → Polish.

## Task summary

- **Tổng: 28 task** — Setup 1 · Foundational 11 · US1 5 · US2 2 · US3 2 · US4 3 · Polish 4.
- Test-first: 6 task test (RED) trước impl (Constitution IV).
