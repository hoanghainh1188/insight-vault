# Research — App Shell (Phase 0)

Mọi "unknown" của feature nền đã được chốt qua ADR `docs/04-decisions/2026-07-10-tech-stack.md` và clarify
`docs/04-decisions/2026-07-10-app-shell-clarify.md`. Phần dưới ghi lại quyết định + lý do + phương án loại bỏ.

## R1. Khung dự án Electron: electron-vite
- **Decision**: `electron-vite` với 3 target build (main / preload / renderer).
- **Rationale**: HMR nhanh cho renderer, cấu hình sẵn ranh giới 3 tiến trình, khớp ADR D1; ít boilerplate hơn tự ghép Vite + Electron thủ công.
- **Alternatives**: Electron Forge + Vite plugin (nặng cấu hình hơn cho nhu cầu hiện tại); tự ghép (tốn công, dễ sai security default).

## R2. Ranh giới bảo mật renderer
- **Decision**: `BrowserWindow` với `webPreferences: { sandbox:true, contextIsolation:true, nodeIntegration:false }`; preload dùng `contextBridge.exposeInMainWorld` chỉ expose các hàm gọi đúng **5 kênh whitelisted**.
- **Rationale**: Constitution III + ADR D5; ngăn renderer chạm Node/FS kể cả khi có nội dung web độc hại.
- **Alternatives**: `nodeIntegration:true` (bị cấm bởi constitution); expose `ipcRenderer` thô (mở toàn bộ kênh — vi phạm whitelist).
- **Guard bổ sung**: main chỉ `ipcMain.handle` đúng 5 tên kênh; không có handler catch-all. Preload không cho renderer truyền tên kênh tuỳ ý (mỗi kênh là 1 hàm riêng, không phải `invoke(channel, ...)` chung).

## R3. Router — HashRouter
- **Decision**: `react-router-dom` `createHashRouter` với route `/notebooks`, `/workspace`, `/settings` (+ trạng thái onboarding overlay).
- **Rationale**: Clarify A2 — route phản ánh khu vực, deep-link được sau; hash hợp với `file://` renderer của Electron (không cần server history API). Khớp rule "URL-as-state".
- **Alternatives**: state Zustand thuần (không deep-link được — A2 loại); BrowserRouter (cần server/base URL, rắc rối với `file://`).

## R4. Titlebar — frame OS mặc định + header in-app
- **Decision**: `BrowserWindow` **không** `frame:false` (dùng khung native OS). Tên app + privacy badge nằm ở một **header in-app** (component `AppHeader`) ngay dưới khung native.
- **Rationale**: Clarify A3 — tránh tự dựng nút minimize/maximize/close khác nhau macOS/Windows → ít bug v1.
- **Alternatives**: `frame:false` + custom traffic-light như prototype (đẹp/đồng nhất nhưng tốn công + rủi ro trên Windows — hoãn sang pha sau).

## R5. Onboarding flag — OS settings store
- **Decision**: `electron-store` lưu `onboardingComplete: boolean` ở kho cấu hình OS (ngoài data dir). Đọc lúc khởi động; thiếu/không đọc được ⇒ coi là lần đầu.
- **Rationale**: Clarify A5 (người dùng chọn OS settings store). Không phụ thuộc DB (chưa có ở feature nền).
- **Alternatives**: file `app-state.json` trong data dir (khuyến nghị ban đầu, bị loại); DB (chưa tồn tại ở 001).
- **Hệ quả ghi nhận**: khi làm feature "đổi thư mục dữ liệu", state onboarding **không** đi cùng data dir — cần lưu ý (đã ghi ở file decision).

## R6. Local data dir
- **Decision**: dùng `app.getPath('userData')` (Electron chuẩn hoá theo OS) + `fs.mkdir(recursive)` đảm bảo tồn tại lúc app `ready`. Lỗi tạo → hiện dialog lỗi thân thiện, thoát an toàn.
- **Rationale**: đáp ứng FR-011/FR-012; `userData` map đúng `~/Library/Application Support/InsightVault` (macOS) và `%APPDATA%/InsightVault` (Windows) — sát yêu cầu OVERVIEW; do main độc quyền (ADR D5).
- **Alternatives**: tự ghép path theo `os.homedir()` (dễ sai chuẩn OS, không nên).

## R7. No network egress + CSP
- **Decision**: không thêm mã gọi mạng nào ở app-shell; đặt CSP nghiêm ở renderer (`default-src 'self'`; không cho phép nguồn ngoài); **self-host font** (prototype dùng Google Fonts — sẽ bundle cục bộ, không preconnect CDN).
- **Rationale**: Constitution I + SC-003 (offline) + SC-002 (badge khớp thực tế). Nếu để font CDN, app sẽ gọi mạng → vi phạm local-first ngay ở vỏ.
- **Alternatives**: giữ link Google Fonts như prototype (vi phạm no-egress — loại; prototype chỉ là wireframe).

## R8. Testing stack
- **Decision**: Vitest (unit, coverage v8) cho logic main (privacy-state, onboarding, data-dir, ipc whitelist guard) và logic renderer thuần; Playwright `_electron` cho 1 e2e smoke (mở app → shell + badge hiển thị; thử truy cập Node từ renderer → thất bại).
- **Rationale**: Vitest khớp Vite/electron-vite, coverage đạt ngưỡng Constitution IV; Playwright `_electron` là cách chuẩn e2e Electron.
- **Alternatives**: Jest (chậm hơn với ESM/Vite); Spectron (deprecated).

## Không còn NEEDS CLARIFICATION.
