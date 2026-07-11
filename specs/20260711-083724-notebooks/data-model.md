# Data Model — Notebooks (Phase 1)

Schema SQLite ĐẦU TIÊN của dự án (qua `node:sqlite`). Types dùng chung ở `src/shared/ipc/types.ts`.

## Bảng SQLite: `notebook` (migration #1)

| Cột          | Kiểu SQLite | Ràng buộc   | Ghi chú                                                   |
| ------------ | ----------- | ----------- | --------------------------------------------------------- |
| `id`         | TEXT        | PRIMARY KEY | `crypto.randomUUID()`                                     |
| `name`       | TEXT        | NOT NULL    | Tên notebook (nội dung người dùng) — 1–100 ký tự sau trim |
| `color`      | TEXT        | NOT NULL    | Hex thuộc palette cố định                                 |
| `created_at` | INTEGER     | NOT NULL    | epoch ms                                                  |
| `updated_at` | INTEGER     | NOT NULL    | epoch ms; cập nhật mỗi lần sửa                            |

- `PRAGMA foreign_keys = ON` (nền cho 004: bảng `source` FK `notebook_id → notebook(id) ON DELETE CASCADE`).
- `PRAGMA user_version` = số phiên bản schema (migration runner). Sau migration #1 → `user_version = 1`.

## Types (shared, qua IPC)

| Type                  | Field                                                    | Ghi chú                                                                                  |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Notebook`            | `{ id, name, color, createdAt, updatedAt, sourceCount }` | `sourceCount` = **0** ở feature này (chưa có source — A4); thêm để card render "N nguồn" |
| `NotebookColor`       | `string` (hex trong palette)                             | Validate theo `PALETTE`                                                                  |
| `CreateNotebookInput` | `{ name, color }`                                        | Input tạo                                                                                |
| `RenameNotebookInput` | `{ id, name }`                                           | Input đổi tên                                                                            |
| `SetColorInput`       | `{ id, color }`                                          | Input đổi màu                                                                            |

> Map DB → type: `created_at`→`createdAt`, `updated_at`→`updatedAt` (camelCase ở tầng type). `sourceCount`
> KHÔNG lưu ở bảng `notebook` — v1 luôn 0; 004 sẽ tính từ COUNT bảng `source`.

## Palette (nguồn validate `color`)

Tập cố định ~8 hex (họ màu prototype), khai ở `palette.ts`, VD:
`#1E6B57 #3B6EA5 #8A5A9E #B4713C #2F8A6B #B4453C #6D7A8C #C08A2E` (chốt cụ thể khi impl).

## Validation (boundary)

- **name**: `trim()`; reject nếu rỗng hoặc độ dài > 100. Cho unicode/emoji, cho trùng tên.
- **color**: reject nếu không thuộc `PALETTE`.
- Vi phạm → ném `Error` message thân thiện; IPC trả lỗi cho renderer hiển thị (không ghi DB).

## Schema version / migration

- `Migration = { version: number, up(db): void }`. Mảng `MIGRATIONS` append-only.
- Runner: đọc `user_version`; với mỗi migration `version > user_version` (tăng dần) chạy `up(db)` trong
  transaction; set `user_version = version`. #1: `CREATE TABLE notebook (...)`.

## Ghi chú thuật ngữ

Term mới (`notebook color`, `notebook search`, `notebook metadata`, `color palette`) append glossary ở
bước glossary-steward (rule 5 — trong branch feature).
