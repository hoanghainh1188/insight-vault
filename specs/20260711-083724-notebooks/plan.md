# Implementation Plan: Notebooks (quản lý notebook)

**Branch**: `009-notebooks` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260711-083724-notebooks/spec.md`

## Summary

CRUD notebook (tạo/đổi tên/đổi màu/xoá) + tìm kiếm client-side, màn Notebooks (S1). Feature **đầu tiên
dùng SQLite**: dựng module DB chung (`better-sqlite3` ở main, `PRAGMA foreign_keys ON`) + **migration
runner** (`PRAGMA user_version`, append-only — ADR migration) với migration #1 tạo bảng `notebook`.
Repo CRUD + validate tên/màu ở main; renderer qua **5 kênh IPC `notebook:*` whitelisted**, không chạm DB.
UI: lưới card (stripe màu, tên, "0 nguồn · Sửa <relative-time>"), modal tạo/sửa, palette cố định. Tái
dùng route `/`, `/workspace`, data dir, IPC pattern của `001-app-shell`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict). Main = Node (Electron 43); renderer = React 18.

**Primary Dependencies**: **`node:sqlite`** (built-in Node — `DatabaseSync`, API sync; **KHÔNG thêm
dependency, KHÔNG native rebuild** — chạy sẵn ở Electron 43 main + Node 24 vitest, đã probe). React/
electron-store/react-router (đã có). Không thư viện migration (runner tự viết — ADR). _(Đổi driver từ
better-sqlite3 → node:sqlite, cập nhật ADR D2 2026-07-11.)_

**Storage**: SQLite file `app.getPath('userData')/insightvault.db` (qua `node:sqlite`). Bảng
`notebook(id TEXT PK, name TEXT, color TEXT, created_at INTEGER, updated_at INTEGER)`. `user_version` = schema version.

**Testing**: Vitest — repo/validation/migration/relative-time test với `node:sqlite` **in-memory
(':memory:')**, KHÔNG cần Electron (node:sqlite là built-in → không lệ thuộc ABI). Playwright `_electron`
e2e: CRUD qua IPC + whitelist + renderer isolation (không chạm DB trực tiếp).

**Target Platform**: Desktop macOS + Windows (Electron).

**Project Type**: desktop-app (mở rộng main/preload/renderer/shared của 001).

**Performance Goals**: Thao tác CRUD + list phản hồi tức thì (dataset cá nhân nhỏ); tìm kiếm client-side không trễ.

**Constraints**: SQLite CHỈ ở main (Constitution III); renderer qua IPC whitelisted; không log tên
notebook; validate tên (1–100, trim) + màu (thuộc palette) ở **boundary** trước khi ghi DB (như 007).
`node:sqlite` là experimental (Node phát cảnh báo ExperimentalWarning) nhưng ổn định đủ dùng ở v1;
không cần native rebuild.

**Scale/Scope**: 1 người dùng/máy; vài chục–trăm notebook; 5 kênh IPC; 1 màn + 1 modal.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                                           | Áp dụng                                                                                                                                                             | Trạng thái |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **I. Local-first & No Default Egress**               | Metadata notebook trong SQLite trên máy; không mã gọi mạng.                                                                                                         | ✅ PASS    |
| **II. Verifiable Citations**                         | Chưa liên quan (RAG ở 005).                                                                                                                                         | ➖ N/A     |
| **III. Desktop Security Boundary**                   | SQLite CHỈ ở main (module db + repo); renderer qua 5 kênh `notebook:*` whitelisted (per-function, no catch-all); validate input ở boundary; không log tên notebook. | ✅ PASS    |
| **IV. Test-First & Coverage**                        | TDD; repo/validation/migration/relative-time test với sqlite in-memory → ≥80% không cần Electron.                                                                   | ✅ PASS    |
| **V. Phased Delivery**                               | 009 sau 007, trước 004-ingestion; schema/migration để 004 mở rộng (FK cascade).                                                                                     | ✅ PASS    |
| **Additional (Terminology / ADR-governed / Intake)** | Intake đã chạy; term mới (`notebook color`, `notebook metadata`…) append ở glossary-steward; bám ADR D2 + migration ADR + clarify.                                  | ✅ PASS    |

**Kết luận:** không vi phạm → tiếp Phase 0. (Complexity Tracking để trống.)

## Project Structure

### Documentation (this feature)

```text
specs/20260711-083724-notebooks/
├── plan.md · research.md · data-model.md · quickstart.md
└── contracts/ipc-channels.md   # 5 kênh notebook:*
```

### Source Code (repository root) — mở rộng 001

```text
src/
├── main/
│   ├── db/
│   │   ├── database.ts          # mở node:sqlite DatabaseSync (userData/insightvault.db), PRAGMA foreign_keys ON
│   │   └── migrations.ts        # runner (PRAGMA user_version, append-only) + mảng migration; #1 = bảng notebook
│   ├── ipc/register.ts          # + 5 handler notebook:* (safeHandle, truyền args)
│   └── services/notebooks/
│       ├── notebook-repo.ts     # CRUD (nhận Database tiêm vào): list/create/rename/delete/setColor
│       ├── validation.ts        # validate tên (1–100, trim) + màu (palette) ở boundary
│       └── palette.ts           # palette màu cố định (~8 hex)
├── preload/index.ts             # + expose 5 hàm notebook.* (per-function)
├── renderer/
│   └── features/notebooks/
│       ├── NotebooksGrid.tsx    # lưới + ô tìm kiếm (client-side) + nút/thẻ "Tạo mới"
│       ├── NotebookCard.tsx     # thẻ: stripe màu + tên + "0 nguồn · Sửa <relative-time>"
│       ├── NotebookModal.tsx    # modal tạo/đổi tên/đổi màu (nhập tên + chọn màu palette)
│       ├── DeleteConfirm.tsx    # dialog xác nhận xoá
│       ├── useNotebooks.ts      # hook: list + create/rename/delete/setColor qua window.api.notebook*
│       └── relative-time.ts     # util "Sửa <thời gian>" tiếng Việt (thuần, test được)
└── shared/ipc/
    ├── channels.ts              # + 5 tên kênh notebook:*
    └── types.ts                 # + Notebook, NotebookColor, CreateNotebookInput…

tests/
├── unit/                        # notebook-repo (sqlite :memory:) · validation · migrations · relative-time
└── e2e/                         # notebook-crud · notebook-ipc-whitelist/isolation
```

**Structure Decision**: Module DB chung ở `src/main/db/` (dùng lại bởi 004+). Repo/validation/palette cô
lập ở `src/main/services/notebooks/`; UI ở `src/renderer/features/notebooks/`. IPC mở rộng `src/shared/ipc/`
— **thêm** 5 kênh `notebook:*`, **không đổi** 10 kênh cũ. Repo nhận `DatabaseSync` tiêm vào → unit-test bằng
node:sqlite in-memory không cần Electron.

## Complexity Tracking

> Không có vi phạm Constitution → để trống.
