# Data Model — 049-audio-player (Phase 1)

Feature này **không tạo bảng/cột mới** (KHÔNG migration). Nó tiêu thụ các entity sẵn có từ 045/013/011.
Dưới đây là các entity liên quan và trường được dùng.

## Source (bảng `source`) — kế thừa 011/045, KHÔNG đổi

| Trường (DB)   | Kiểu      | Vai trò trong 049                                                                                                                           |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | TEXT (PK) | Khoá tra qua `iv-media://source/<id>`; renderer chỉ gửi ID này, không gửi path.                                                             |
| `kind`        | TEXT      | Handler CHỈ phục vụ khi `kind='audio'`; loại khác → 404.                                                                                    |
| `origin`      | TEXT      | **Đường dẫn file gốc** trên đĩa (ghi lúc ingestion 045). Handler đọc qua `getOrigin(id)`; KHÔNG expose ra renderer, KHÔNG nhận từ renderer. |
| `notebook_id` | TEXT      | Không dùng để lọc trong 049 (app single-user; ngoài phạm vi — xem spec).                                                                    |

**Repo API sẵn có (source-repo)**:

- `getById(id): Source | null` — trả metadata (không có `origin`).
- `getOrigin(id): string | null` — trả path gốc từ cột `origin` (chỉ dùng ở main).

**Validation/quy tắc (049)**:

- `getById(id) == null` → 404.
- `source.kind !== 'audio'` → 404.
- `getOrigin(id)` rỗng HOẶC `!existsSync(path)` → 404 (file gốc mất).

## Chunk + Locator (bảng `chunk`) — kế thừa 045, KHÔNG đổi

| Trường    | Kiểu         | Vai trò trong 049                                                                                         |
| --------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| `t_start` | REAL \| null | **Mốc tua** (giây) của đoạn audio; 049 đọc qua `Citation.locator.tStart` để `audio.currentTime = tStart`. |
| `t_end`   | REAL \| null | Không dùng trực tiếp để tua (chỉ tStart); giữ để hiển thị/tương lai.                                      |

`Locator = { page; charStart; charEnd; tStart?; tEnd? }` (013 + 045). 049 chỉ đọc `tStart`.

## Citation (`[n]`) — kế thừa 013, KHÔNG đổi

`Citation = { n; chunkId; sourceId; sourceTitle; locator }`. Khi `[n]` trỏ nguồn audio, `sourceId` dùng
làm src `iv-media://source/<sourceId>`, `locator.tStart` dùng để tua.

## SourceContent (IPC `source:getContent`) — kế thừa 019/045, KHÔNG đổi

`SourceContent = { kind; title; pageCount; text; pageBreaks }`. 049 dùng `kind === 'audio'` để quyết
định render `<audio>` player; `text` là bản bóc băng hiển thị bên dưới (highlight như 019).

## State (renderer, cục bộ component) — MỚI, không persist

| State        | Kiểu    | Vai trò                                                                                              |
| ------------ | ------- | ---------------------------------------------------------------------------------------------------- |
| `audioError` | boolean | `true` khi `<audio>` phát `error` (404 file gốc) → hiện thông báo; reset `false` khi đổi `sourceId`. |

Không có state persist (localStorage/DB) mới.
