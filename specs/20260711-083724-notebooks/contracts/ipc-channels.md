# Contract — IPC channels (notebooks)

**Thêm 5 kênh `notebook:*`** vào whitelist `src/shared/ipc/channels.ts`. KHÔNG đổi 10 kênh `app:*`/`ai:*`.
Cùng nguyên tắc: mỗi kênh 1 hàm ở preload (no `invoke(channel)` chung); main chỉ `handle` kênh whitelisted;
kênh ngoài danh sách bị từ chối (Constitution III). Renderer KHÔNG chạm SQLite. Tìm kiếm **client-side**
(không có kênh search — A5).

## Kênh

### 1. `notebook:list`

- renderer → main · **Request**: `()` · **Response**: `Notebook[]`
- Behavior: đọc toàn bộ notebook từ SQLite (ở main), map sang `Notebook` (`sourceCount = 0`). Sắp theo `updated_at` giảm dần.

### 2. `notebook:create`

- renderer → main · **Request**: `CreateNotebookInput` `{ name, color }` · **Response**: `Notebook`
- Behavior: validate name + color (boundary); tạo bản ghi (`id=uuid`, timestamps); trả notebook mới. Input sai → reject với lỗi thân thiện. FR-004/007/008.

### 3. `notebook:rename`

- renderer → main · **Request**: `RenameNotebookInput` `{ id, name }` · **Response**: `Notebook`
- Behavior: validate name; cập nhật `name` + `updated_at`; trả notebook đã cập nhật. FR-005.

### 4. `notebook:setColor`

- renderer → main · **Request**: `SetColorInput` `{ id, color }` · **Response**: `Notebook`
- Behavior: validate color thuộc palette; cập nhật `color` + `updated_at`. FR-005/008.

### 5. `notebook:delete`

- renderer → main · **Request**: `{ id }` · **Response**: `{ deleted: true }`
- Behavior: hard delete bản ghi (FR-006/014). Xác nhận dialog ở renderer TRƯỚC khi gọi kênh này.

## `window.api` (bổ sung)

```ts
interface NotebookApi {
  notebookList(): Promise<Notebook[]>;
  notebookCreate(input: CreateNotebookInput): Promise<Notebook>;
  notebookRename(input: RenameNotebookInput): Promise<Notebook>;
  notebookSetColor(input: SetColorInput): Promise<Notebook>;
  notebookDelete(id: string): Promise<{ deleted: true }>;
}
// window.api = { ...5 app, ...5 ai, ...5 notebook } = 15 hàm
```

## Contract test (định hướng)

- Mỗi kênh: gọi từ renderer → response đúng shape (type-checked).
- **Whitelist guard**: kênh `notebook:*` ngoài 5 tên → `isWhitelisted=false`, không handler. Tổng whitelist = 15.
- **Renderer isolation**: renderer không có cách đọc/ghi SQLite trực tiếp; `window.api` chỉ có hàm whitelisted.
- `notebook:create` với name rỗng/quá dài, color ngoài palette → reject, không ghi DB.
- Không log tên notebook (không truyền args vào `logEvent`).
