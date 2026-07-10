# Implementation Plan: App Shell (vỏ ứng dụng desktop)

**Branch**: `001-app-shell` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260710-232839-app-shell/spec.md`

## Summary

Dựng vỏ nền Electron cho InsightVault: cửa sổ desktop với titlebar (tên app + privacy indicator badge
động), rail điều hướng trái (Notebooks/Workspace/Cài đặt) dẫn tới các khung placeholder, và onboarding
lần đầu placeholder. Trọng tâm kỹ thuật là **ranh giới bảo mật** (renderer sandboxed, không chạm Node/FS;
mọi thao tác qua main + preload contextBridge với đúng 5 kênh IPC whitelisted) và **local-first** (không
network egress mặc định; badge phản ánh trạng thái thật). Đây là feature nền — mọi feature sau cắm màn
hình thật và kênh IPC mới vào bộ khung + contract này.

## Technical Context

**Language/Version**: TypeScript 5.x (strict). Electron main = Node runtime; renderer = React 18.

**Primary Dependencies**: Electron (latest LTS-line), electron-vite, React 18 + react-dom, Vite,
`react-router-dom` (hash router), Zustand. `electron-store` cho OS settings store (cờ onboarding).
TanStack Query cài sẵn ở nền nhưng chưa dùng nhiều trong app-shell (không có data fetch nghiệp vụ).

**Storage**:
- **OS settings store** (`electron-store`): cờ `onboardingComplete` (A5). Tách khỏi data dir.
- **Local data dir**: `app.getPath('userData')` chuẩn OS (macOS `~/Library/Application Support/InsightVault`
  ≈ yêu cầu `~/Library/InsightVault`; Windows `%APPDATA%/InsightVault`) — feature này chỉ **đảm bảo tồn
  tại**, chưa tạo schema DB.

**Testing**: Vitest (unit/logic main + renderer, coverage v8 ≥ 80% business logic — Constitution IV);
Playwright `_electron` cho 1 e2e smoke (mở app → thấy shell + badge; kiểm renderer không chạm Node).

**Target Platform**: Desktop macOS + Windows (Electron).

**Project Type**: desktop-app (3 tiến trình main / preload / renderer).

**Performance Goals**: Shell hiển thị đầy đủ ≤ 3s sau khởi chạy (SC-001).

**Constraints**: Offline-capable, **no network egress mặc định** (SC-003, Constitution I); renderer
`sandbox:true` + `contextIsolation:true` + `nodeIntegration:false` (Constitution III); CSP chặn nguồn
ngoài; không bundle font/asset từ CDN (self-host).

**Scale/Scope**: 1 người dùng/máy; app-shell ~ 3 khung placeholder + 1 onboarding + 1 titlebar/header;
5 kênh IPC.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Áp dụng cho app-shell | Trạng thái |
|---|---|---|
| **I. Local-first & No Default Egress** | App-shell không có mã gọi mạng; CSP chặn nguồn ngoài; badge đọc từ PrivacyState thật (v1 = "local"). Test SC-003 (offline) + SC-002 (badge khớp). | ✅ PASS (thiết kế không có egress) |
| **II. Verifiable Citations** | Không liên quan (chưa có RAG/nguồn ở feature nền). | ➖ N/A |
| **III. Desktop Security Boundary** | Feature này **trực tiếp hiện thực** ranh giới: sandbox/contextIsolation/nodeIntegration:false; preload chỉ expose 5 kênh whitelisted; không secret; không log nội dung. Test US2 (SC-004). | ✅ PASS (là mục tiêu chính) |
| **IV. Test-First & Coverage** | TDD; Vitest coverage ≥ 80% business logic (privacy state, onboarding gate, ipc whitelist guard, data dir init). | ✅ PASS (kế hoạch test-first) |
| **V. Phased Delivery** | Đây là 001, bước đầu chuỗi D8; không lấn feature sau. | ✅ PASS |
| **Additional: Source-of-truth / Terminology / Intake / ADR-governed** | Intake đã chạy; term đối chiếu glossary (nav rail, first-run onboarding… sẽ append ở bước glossary-steward); stack bám ADR. | ✅ PASS |

**Kết luận gate:** không có vi phạm → tiếp Phase 0. (Complexity Tracking để trống.)

## Project Structure

### Documentation (this feature)

```text
specs/20260710-232839-app-shell/
├── plan.md              # File này
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── ipc-channels.md  # Hợp đồng 5 kênh IPC (main↔renderer)
└── tasks.md             # /speckit-tasks (chưa tạo ở bước này)
```

### Source Code (repository root)

```text
electron.vite.config.ts          # cấu hình electron-vite (3 target: main/preload/renderer)
package.json                     # scripts: dev, build, lint, test, test:e2e
tsconfig.json / tsconfig.*.json

src/
├── main/                        # Electron main (Node) — độc quyền FS/settings
│   ├── index.ts                 # tạo BrowserWindow (frame OS mặc định; sandbox/contextIsolation/nodeIntegration:false)
│   ├── ipc/
│   │   └── register.ts          # đăng ký handler CHỈ cho 5 kênh whitelisted
│   └── services/
│       └── app-shell/
│           ├── data-dir.ts      # đảm bảo data dir tồn tại (userData), trả path
│           ├── privacy-state.ts # nguồn sự thật trạng thái riêng tư (v1: 'local')
│           ├── onboarding.ts    # đọc/ghi cờ onboarding qua electron-store (OS settings)
│           └── app-info.ts      # tên + phiên bản app
├── preload/
│   └── index.ts                 # contextBridge expose window.api CHỈ 5 kênh (typed, whitelist)
├── renderer/
│   ├── index.html
│   ├── main.tsx                 # mount React + HashRouter
│   ├── app/
│   │   ├── App.tsx              # layout: header (titlebar in-app) + nav rail + <Outlet/>
│   │   └── routes.tsx           # hash routes: /notebooks /workspace /settings + onboarding
│   ├── features/
│   │   └── app-shell/
│   │       ├── AppHeader.tsx    # tên app + PrivacyBadge
│   │       ├── PrivacyBadge.tsx # đọc privacy state qua window.api.getPrivacyState
│   │       ├── NavRail.tsx      # 3 mục, active/hover
│   │       ├── OnboardingGate.tsx # hiện onboarding lần đầu (đọc getOnboardingState)
│   │       └── placeholders/    # NotebooksPlaceholder / WorkspacePlaceholder / SettingsPlaceholder
│   └── shared/                  # UI kit trích từ prototype
│       ├── tokens.css           # design tokens (màu/space/radius từ prototype :root)
│       └── ...
└── shared/                      # DÙNG CHUNG main↔renderer
    └── ipc/
        ├── channels.ts          # hằng tên 5 kênh (single source) + type map
        └── types.ts             # types: PrivacyState, OnboardingState, AppInfo, DataDirInfo

tests/
├── unit/                        # Vitest: privacy-state, onboarding, data-dir, ipc whitelist guard
└── e2e/                         # Playwright _electron: smoke shell + security boundary
```

**Structure Decision**: Desktop 3-tiến-trình theo ADR D6. Code feature cô lập ở `src/main/services/app-shell/`
+ `src/renderer/features/app-shell/`; **hợp đồng IPC dùng chung** ở `src/shared/ipc/` (channels + types) để
main và renderer tham chiếu **cùng một nguồn** — feature sau thêm kênh mới vào đây, không phá contract nền.

## Complexity Tracking

> Không có vi phạm Constitution → để trống.
