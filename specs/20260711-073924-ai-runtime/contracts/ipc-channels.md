# Contract — IPC channels (ai-runtime)

**Thêm 5 kênh `ai:*`** vào whitelist ở `src/shared/ipc/channels.ts`. KHÔNG đổi 5 kênh `app:*` của
`001-app-shell`. Cùng nguyên tắc: mỗi kênh 1 hàm ở preload (no `invoke(channel)` chung); main chỉ
`handle` các kênh whitelisted; kênh ngoài danh sách bị từ chối (Constitution III).

## Kênh

### 1. `ai:listModels`

- renderer → main · **Request**: `()` · **Response**: `Model[]`
- Behavior: gọi Ollama `/api/tags` ở main → map `Model[]`. Ollama không kết nối → trả `[]` (không throw ra renderer). FR-004.

### 2. `ai:testConnection`

- renderer → main · **Request**: `()` · **Response**: `RuntimeStatus`
- Behavior: kiểm tra tại thời điểm gọi (ping + đối chiếu model đã chọn). FR-007. Check-on-demand (A2).

### 3. `ai:getSelectedModels`

- renderer → main · **Request**: `()` · **Response**: `ModelSelection`
- Behavior: đọc từ electron-store; hỏng/thiếu → `{ chatModel:null, embeddingModel:null }`. FR-006.

### 4. `ai:setSelectedModels`

- renderer → main · **Request**: `ModelSelection` `{ chatModel, embeddingModel }` · **Response**: `ModelSelection` (đã lưu)
- Behavior: ghi electron-store (idempotent); lỗi ghi không throw xuyên IPC (nhất quán 001). FR-005/006.

### 5. `ai:getRuntimeStatus`

- renderer → main · **Request**: `()` · **Response**: `RuntimeStatus`
- Behavior: như `testConnection` nhưng dùng cho onboarding/UI đọc trạng thái `ollamaReady`. FR-009/015.

> Ghi chú: chat()/embed() **không** có kênh IPC ở feature này (chưa có chat UI — thuộc `005-rag-qa`).
> Provider dùng nội bộ main + kiểm qua unit test. Feature 004/005 sẽ thêm kênh cho ingestion/chat khi cần.

## `window.api` (bổ sung — hình dạng expose ở preload)

```ts
interface AiApi {
  listModels(): Promise<Model[]>;
  testConnection(): Promise<RuntimeStatus>;
  getSelectedModels(): Promise<ModelSelection>;
  setSelectedModels(sel: ModelSelection): Promise<ModelSelection>;
  getRuntimeStatus(): Promise<RuntimeStatus>;
}
// window.api mở rộng: { ...app 5 hàm cũ, ...ai 5 hàm mới }
```

## Contract test (định hướng)

- Mỗi kênh `ai:*`: gọi từ renderer (qua preload) → nhận đúng shape response (type-checked).
- **Whitelist guard**: kênh `ai:*` KHÔNG thuộc 5 tên trên → bị từ chối, không handler, không side effect
  (SC-005). Tổng whitelist giờ = 5 (`app:*`) + 5 (`ai:*`) = 10.
- **Renderer isolation**: renderer không có cách gọi Ollama HTTP trực tiếp; `window.api` chỉ có hàm whitelisted.
- `ai:listModels` khi Ollama tắt → trả `[]`, không throw ra renderer.
- `ai:setSelectedModels` khi store lỗi → không throw xuyên IPC.
