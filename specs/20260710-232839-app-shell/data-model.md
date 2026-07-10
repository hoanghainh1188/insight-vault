# Data Model — App Shell (Phase 1)

Feature nền chưa có DB. Các "entity" ở đây là **kiểu trạng thái/giá trị** trao đổi qua IPC (định nghĩa ở
`src/shared/ipc/types.ts`), không phải bảng lưu trữ. Chúng là contract nền cho renderer.

## PrivacyState
Nguồn sự thật cho privacy indicator badge.

| Field | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `mode` | `'local' \| 'online'` | bắt buộc | v1 **luôn** `'local'` (chưa có provider online). |
| `label` | `string` | bắt buộc | Văn bản hiển thị badge, suy ra từ `mode` (không hard-code rời rạc ở renderer). |

- Nguồn: main `services/app-shell/privacy-state.ts`. Renderer chỉ đọc (getPrivacyState), không tự đặt.
- Bất biến: `mode` phải khớp hành vi mạng thật (FR-002, SC-002). v1: không có mã egress ⇒ `'local'`.

## OnboardingState
Quyết định có hiển thị onboarding khi khởi động.

| Field | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `completed` | `boolean` | bắt buộc | `true` = đã hoàn tất/bỏ qua. Lưu bền ở **OS settings store** (electron-store). |

- Đọc: `getOnboardingState` → `{ completed }`. Ghi: `setOnboardingComplete()` đặt `completed=true`.
- Đọc lỗi/thiếu key ⇒ trả `{ completed:false }` (coi là lần đầu — FR-008, edge case).

## AppInfo
Thông tin tĩnh của app cho header/titlebar.

| Field | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `name` | `string` | bắt buộc | "InsightVault". |
| `version` | `string` | bắt buộc | Lấy từ `app.getVersion()`. |

## DataDirInfo
Kết quả đảm bảo thư mục dữ liệu cục bộ.

| Field | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `path` | `string` | bắt buộc | Đường dẫn data dir chuẩn OS (`app.getPath('userData')`). |
| `ready` | `boolean` | bắt buộc | `true` nếu thư mục tồn tại/tạo được. |

- Nếu không tạo được: main không trả `ready:true` mà kích hoạt luồng lỗi (dialog thân thiện — FR-012),
  không để renderer tự xử FS.

## NavSection (renderer-only)
Không qua IPC — là enum điều hướng nội bộ renderer.

| Giá trị | Route (hash) | Placeholder |
|---|---|---|
| `notebooks` | `/notebooks` | NotebooksPlaceholder (mặc định — A6) |
| `workspace` | `/workspace` | WorkspacePlaceholder |
| `settings` | `/settings` | SettingsPlaceholder |

## Ghi chú nhất quán thuật ngữ
Tên dùng trong code khớp `docs/00-glossary.md`: `privacy indicator` (badge), `local`. Thuật ngữ UI mới
(`nav rail`, `first-run onboarding`, `workspace`, `settings`) sẽ được append vào glossary ở bước
glossary-steward (đúng rule 5 — append trong branch feature).
