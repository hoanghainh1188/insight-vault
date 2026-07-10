---
description: "Task list — App Shell (001-app-shell)"
---

# Tasks: App Shell (vỏ ứng dụng desktop)

**Input**: Design documents from `specs/20260710-232839-app-shell/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-channels.md, quickstart.md
**Tests**: BẮT BUỘC (Constitution IV — TDD, coverage ≥ 80% business logic). Task test viết trước (RED) rồi impl (GREEN).

## Format: `[ID] [P?] [Story?] Description (file path)`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong).
- **[Story]**: US1–US4 map user story trong spec.md. Setup/Foundational/Polish không gắn story.

## Path Conventions (desktop 3 tiến trình — theo plan.md)

`src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`, `tests/unit/`, `tests/e2e/` ở repo root.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Scaffold electron-vite (3 target main/preload/renderer): `electron.vite.config.ts`, `package.json` với scripts `dev`/`build`/`lint`/`test`/`test:e2e`, `tsconfig.json` + `tsconfig.node.json` (strict) ở repo root
- [x] T002 [P] Cài dependencies: `electron`, `electron-vite`, `react`, `react-dom`, `react-router-dom`, `zustand`, `electron-store`, `@tanstack/react-query`; dev: `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `eslint`, `prettier`, `typescript`
- [x] T003 [P] Cấu hình ESLint (`eslint.config.mjs` flat, typescript-eslint) + Prettier + tsconfig strict; `.claude/hooks/format.sh` chạy prettier --write + eslint --fix on-save; lint gate = prettier --check + eslint + tsc
- [x] T004 [P] Trích design tokens từ `docs/03-ui/prototype.html` (`:root`) vào `src/renderer/shared/tokens.css`; **self-host font** (bundle Inter/JetBrains Mono cục bộ, KHÔNG link Google Fonts CDN — R7)

**Checkpoint**: `npm run dev` mở được cửa sổ Electron trắng.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Phải xong trước mọi user story.**

- [x] T005 Định nghĩa hợp đồng IPC dùng chung: tên 5 kênh trong `src/shared/ipc/channels.ts` + types `PrivacyState`/`OnboardingState`/`AppInfo`/`DataDirInfo` trong `src/shared/ipc/types.ts` (theo contracts/ipc-channels.md + data-model.md)
- [x] T006 Tạo `BrowserWindow` trong `src/main/index.ts` với `webPreferences: { sandbox:true, contextIsolation:true, nodeIntegration:false }`, dùng **frame OS mặc định** (R4); load renderer
- [x] T007 Khung `src/preload/index.ts` dùng `contextBridge.exposeInMainWorld('api', …)` theo mẫu **mỗi kênh một hàm riêng** (không expose `invoke(channel)` chung — R2)
- [x] T008 Đặt CSP `default-src 'self'` trong `src/renderer/index.html` (chặn nguồn ngoài — R7)
- [x] T009 [P] Unit test data-dir service `tests/unit/data-dir.test.ts`: đảm bảo tồn tại → `ready:true`; lỗi tạo → không `ready:true` (RED) — FR-011/012
- [x] T010 Impl `src/main/services/app-shell/data-dir.ts`: `app.getPath('userData')` + `mkdir(recursive)`, trả `DataDirInfo`; lỗi → luồng dialog thân thiện (GREEN)
- [x] T011 Wire đảm bảo data dir lúc app `ready` trong `src/main/index.ts`
- [x] T012 Đăng ký `app:getDataDir` trong `src/main/ipc/register.ts` + expose `getDataDir()` ở preload
- [x] T013 Khung `src/main/ipc/register.ts`: **chỉ** `ipcMain.handle` các kênh whitelisted, KHÔNG handler catch-all (nền cho US2)
- [x] T014 Mount React + `createHashRouter` trong `src/renderer/main.tsx` + `src/renderer/app/App.tsx` (layout: slot header + slot nav + `<Outlet/>`) + `src/renderer/app/routes.tsx` (route rỗng)

**Checkpoint**: app mở, shell khung rỗng render, data dir được tạo, chưa có nội dung story.

---

## Phase 3: User Story 1 — Khung + privacy indicator đúng (Priority: P1) 🎯 MVP

**Goal**: Mở app thấy vỏ hoàn chỉnh + badge phản ánh trạng thái thật; chạy offline.
**Independent test**: máy sạch mở app → header "InsightVault" + badge "Chạy cục bộ"; ngắt mạng vẫn mở.

- [x] T015 [P] [US1] Unit test `tests/unit/privacy-state.test.ts`: `mode:'local'`, `label` suy ra từ mode (RED)
- [x] T016 [P] [US1] E2e smoke `tests/e2e/shell.spec.ts` (Playwright `_electron`): V1 (mở → header + badge, ≤3s) + V2 (offline vẫn mở) (RED)
- [x] T017 [US1] Impl `src/main/services/app-shell/privacy-state.ts` (v1 luôn `'local'`) (GREEN)
- [x] T018 [US1] Impl `src/main/services/app-shell/app-info.ts` (name + `app.getVersion()`)
- [x] T019 [US1] Đăng ký `app:getPrivacyState` + `app:getAppInfo` trong `register.ts` + expose ở preload
- [x] T020 [US1] Impl `src/renderer/features/app-shell/AppHeader.tsx` + `PrivacyBadge.tsx` (đọc `window.api.getPrivacyState`), wire vào `App.tsx`; verify V1/V2 GREEN

**Checkpoint**: US1 độc lập chạy được — MVP tối thiểu (vỏ + privacy đúng).

---

## Phase 4: User Story 2 — Cô lập renderer + whitelist IPC (Priority: P1)

**Goal**: Renderer không chạm Node/FS; chỉ kênh whitelisted gọi được, kênh lạ bị từ chối.
**Independent test**: từ renderer thử `window.require`/`process`/`fs` → thất bại; gọi kênh ngoài whitelist → bị từ chối.

- [x] T021 [P] [US2] Contract test `tests/unit/ipc-whitelist.test.ts`: kênh không thuộc danh sách → không có handler, bị từ chối, không side effect (RED) — FR-010
- [x] T022 [P] [US2] E2e `tests/e2e/security.spec.ts`: V4 (`window.require`/`process`/`fs` không khả dụng) + V5 (gọi kênh lạ không side effect) (RED) — FR-009, SC-004
- [x] T023 [US2] Củng cố cơ chế whitelist trong `src/main/ipc/register.ts` (từ chối/không đăng ký kênh ngoài `channels.ts`) (GREEN)
- [x] T024 [US2] Củng cố `src/preload/index.ts`: mỗi kênh 1 hàm riêng, không có API truyền tên kênh tuỳ ý; verify V4/V5 GREEN
- [x] T025 [US2] Ghi chú tham chiếu `contracts/ipc-channels.md` vào comment `register.ts` + `preload/index.ts`

**Checkpoint**: ranh giới bảo mật kiểm chứng được (Constitution III).

---

## Phase 5: User Story 3 — Điều hướng rail (Priority: P2)

**Goal**: Rail trái 3 mục, bấm chuyển khung placeholder, active/hover, route hash đổi.
**Independent test**: bấm lần lượt 3 mục → nội dung đổi + active đánh dấu; route `/notebooks|/workspace|/settings`.

- [x] T026 [P] [US3] E2e nav `tests/e2e/navigation.spec.ts`: V3 (rail chuyển route + active) (RED)
- [x] T027 [US3] Impl `src/renderer/features/app-shell/NavRail.tsx` (3 mục, active/hover theo tokens prototype)
- [x] T028 [US3] Impl routes `/notebooks` `/workspace` `/settings` + `placeholders/` (Notebooks/Workspace/Settings) trong `src/renderer/features/app-shell/`
- [x] T029 [US3] Wire NavRail vào `App.tsx`, route mặc định `/notebooks` (A6); verify V3 GREEN

**Checkpoint**: điều hướng vỏ hoạt động, khung sẵn cho feature sau lắp màn thật.

---

## Phase 6: User Story 4 — Onboarding lần đầu (Priority: P3)

**Goal**: Lần đầu hiện onboarding placeholder; hoàn tất → lần sau không hiện.
**Independent test**: xoá cờ ở OS settings store → mở app onboarding hiện; hoàn tất → mở lại không hiện.

- [x] T030 [P] [US4] Unit test `tests/unit/onboarding.test.ts`: đọc/ghi cờ qua electron-store; thiếu/lỗi → `completed:false` (RED) — FR-008
- [x] T031 [P] [US4] E2e `tests/e2e/onboarding.spec.ts`: V6 (first-run hiện; sau hoàn tất không hiện) (RED)
- [x] T032 [US4] Impl `src/main/services/app-shell/onboarding.ts` dùng `electron-store` (OS settings — A5) (GREEN)
- [x] T033 [US4] Đăng ký `app:getOnboardingState` + `app:setOnboardingComplete` trong `register.ts` + expose ở preload
- [x] T034 [US4] Impl `src/renderer/features/app-shell/OnboardingGate.tsx` (hiện onboarding placeholder khi `completed:false`), wire vào `App.tsx`; verify V6 GREEN

**Checkpoint**: đủ 4 user story; vỏ nền hoàn chỉnh.

---

## Phase 7: Polish & Cross-Cutting

- [x] T035 [P] E2e no-egress `tests/e2e/no-egress.spec.ts`: V8 (0 request mạng khi dùng shell; font self-host) — Constitution I
- [x] T036 [P] Chạy `npm run test -- --coverage`, đảm bảo ≥ 80% business logic (privacy-state, onboarding, data-dir, ipc guard); bù test nếu thiếu
- [x] T037 [P] Append thuật ngữ UI mới vào `docs/00-glossary.md` (`nav rail`, `first-run onboarding`, `workspace`, `settings`, ghi chú `privacy indicator badge`) — đã append (glossary-steward review khi mở PR)
- [ ] T038 [P] Kiểm chạy trên **cả macOS và Windows** (FR-013): mở app + smoke shell; ghi kết quả vào `quickstart.md`
- [x] T039 Rà `git diff` sau format; đảm bảo lint/test/build xanh trước test gate
- [x] T040 [P] Thiết lập **logging policy** trong `src/main/` (wrapper log): KHÔNG log payload/nội dung người dùng; unit test guard `tests/unit/logging-policy.test.ts` (RED→GREEN) — FR-014, Constitution III

---

## Dependencies (thứ tự hoàn thành)

```
Setup (T001–T004)
   └─▶ Foundational (T005–T014)   ← chặn mọi user story
          ├─▶ US1 (T015–T020)  [P1] 🎯 MVP
          ├─▶ US2 (T021–T025)  [P1]  (cần T013 whitelist scaffold)
          ├─▶ US3 (T026–T029)  [P2]
          └─▶ US4 (T030–T034)  [P3]
                 └─▶ Polish (T035–T039)
```

- US1–US4 **độc lập** sau khi Foundational xong (khác file, khác service). Có thể làm US1 rồi dừng làm MVP.
- Trong mỗi story: task test [P] chạy trước (RED) → impl (GREEN).

## Parallel opportunities

- Setup: T002/T003/T004 song song.
- Foundational: T009 song song với T005–T008 (khác file).
- Mỗi story: 2 task test đầu ([P]) song song; các impl trong 1 story tuần tự do đụng `register.ts`/`App.tsx`.
- Sau Foundational, 4 story có thể chia cho nhiều người (cô lập file theo feature).

## Implementation strategy

- **MVP = US1** (vỏ + privacy indicator đúng + offline). Giao được ngay sau Phase 3.
- Tăng dần: + US2 (bảo mật) → + US3 (điều hướng) → + US4 (onboarding) → Polish.
- Ưu tiên US2 ngay sau US1 dù là feature nền vì nó là ràng buộc bảo mật bất biến (Constitution III).

## Task summary

- **Tổng: 40 task** — Setup 4 · Foundational 10 · US1 6 · US2 5 · US3 4 · US4 5 · Polish 6.
- Test-first: 9 task test (RED) trước impl (Constitution IV).
- FR-014 (không log nội dung người dùng) phủ bởi T040 (vá sau /speckit-analyze).
