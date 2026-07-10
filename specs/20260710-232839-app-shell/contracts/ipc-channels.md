# Contract — IPC channels (app-shell)

Hợp đồng giao tiếp **renderer ↔ main** cho feature nền. Đây là **whitelist** đầy đủ ở app-shell: đúng
**5 kênh**, không hơn (Constitution III, clarify A4). Feature sau **thêm** kênh mới vào `src/shared/ipc/`
— không sửa nghĩa các kênh này.

## Nguyên tắc contract
- Tên kênh là hằng ở `src/shared/ipc/channels.ts` (single source), main và preload cùng tham chiếu.
- Preload expose **mỗi kênh là một hàm riêng** trên `window.api` (KHÔNG expose `invoke(channel, …)` chung
  → renderer không thể gọi tên kênh tuỳ ý).
- Tất cả là request/response (`ipcRenderer.invoke` ↔ `ipcMain.handle`). Không có kênh push/stream ở app-shell.
- Main **chỉ** `handle` đúng 5 tên dưới đây; không handler catch-all.

## Kênh

### 1. `app:getDataDir`
- **Hướng**: renderer → main
- **Request**: `()` (không tham số)
- **Response**: `DataDirInfo` `{ path: string; ready: boolean }`
- **Behavior**: đảm bảo data dir tồn tại; trả path + ready. Lỗi tạo → main xử lý luồng lỗi (dialog), response `ready:false`.
- **Đáp ứng**: FR-011, FR-012.

### 2. `app:getPrivacyState`
- **Hướng**: renderer → main
- **Request**: `()`
- **Response**: `PrivacyState` `{ mode: 'local' | 'online'; label: string }`
- **Behavior**: trả trạng thái riêng tư thật (v1: luôn `mode:'local'`).
- **Đáp ứng**: FR-002, SC-002.

### 3. `app:getOnboardingState`
- **Hướng**: renderer → main
- **Request**: `()`
- **Response**: `OnboardingState` `{ completed: boolean }`
- **Behavior**: đọc cờ từ OS settings store; lỗi/thiếu ⇒ `{ completed:false }`.
- **Đáp ứng**: FR-008.

### 4. `app:setOnboardingComplete`
- **Hướng**: renderer → main
- **Request**: `()`
- **Response**: `{ completed: true }`
- **Behavior**: ghi `onboardingComplete=true` vào OS settings store (idempotent).
- **Đáp ứng**: FR-008.

### 5. `app:getAppInfo`
- **Hướng**: renderer → main
- **Request**: `()`
- **Response**: `AppInfo` `{ name: string; version: string }`
- **Behavior**: trả tên + version app.
- **Đáp ứng**: FR-001.

## Contract test (định hướng — sẽ hiện thực ở tasks)
- Mỗi kênh: gọi từ renderer (qua preload) → nhận đúng shape response (type-checked).
- **Whitelist guard**: thử gọi một kênh KHÔNG thuộc 5 tên trên → bị từ chối, không có handler, không side effect (US2, SC-004, FR-010).
- **Renderer isolation**: từ renderer, `window.require`/`process`/`fs` không khả dụng (US2, FR-009).
- `getOnboardingState` khi store lỗi → trả `completed:false`, không throw ra renderer.

## `window.api` (hình dạng expose ở preload)
```ts
// chỉ minh hoạ shape — implementation ở tasks
interface Api {
  getDataDir(): Promise<DataDirInfo>
  getPrivacyState(): Promise<PrivacyState>
  getOnboardingState(): Promise<OnboardingState>
  setOnboardingComplete(): Promise<{ completed: true }>
  getAppInfo(): Promise<AppInfo>
}
```
