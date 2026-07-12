# Tasks: AI online (031-online-provider)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md). Tests-first (Constitution IV). `[P]` = song song được.

## Phase 1 — Setup

- [x] T001 Cài `keytar` (dependency main): `npm i keytar`.
- [x] T002 `src/shared/ipc/types.ts` — thêm `OnlineProviderId`, `OnlineProviderView`, `OnlineState`,
      `SetProviderKeyInput`, `SetProviderModelInput`.
- [x] T003 `src/shared/ipc/channels.ts` — thêm 6 kênh `ai:getOnlineState`, `ai:setProviderKey`,
      `ai:deleteProviderKey`, `ai:setProviderModel`, `ai:setActiveProvider`, `ai:testProvider`.

## Phase 2 — Foundation (thuần, test-first)

- [x] T004 [P] `tests/unit/online-error.test.ts` (RED) → `online/online-error.ts`: map 401/403/429/timeout/mạng.
- [x] T005 [P] `tests/unit/online-config.test.ts` (RED) → `online/online-config.ts`: validate activeOnlineId
      whitelist + model; normalize hỏng → default.
- [x] T006 [P] `tests/unit/secret-store.test.ts` (RED) → `online/secret-store.ts`: get/set/delete/has qua
      fake KeytarLike; theo provider id.
- [x] T007 [P] `online/presets.ts` — `MODEL_PRESETS` + `PROVIDER_LABELS` (thuần, phủ gián tiếp).
- [x] T008 `online/online-http.ts` — `callJson(fetchFn,{...,timeoutMs=60000})` (I/O, exclude coverage).

## Phase 3 — Providers (US2, test-first)

- [x] T009 [P] [US2] `tests/unit/anthropic-provider.test.ts` (RED) → `online/anthropic-provider.ts`:
      `toAnthropicRequest` (tách system), `parseAnthropicResponse`, `embed()` ném, `chat()` qua fetchFn giả.
- [x] T010 [P] [US2] `tests/unit/gemini-provider.test.ts` (RED) → `online/gemini-provider.ts`:
      `toGeminiRequest` (assistant→model, systemInstruction), `parseGeminiResponse`, embed ném, chat giả.
- [x] T011 [P] [US2] `tests/unit/openai-provider.test.ts` (RED) → `online/openai-provider.ts`:
      `toOpenAIRequest`, `parseOpenAIResponse`, embed ném, chat giả (200/401/429).

## Phase 4 — Assembly + IPC + privacy (US1/US3)

- [x] T012 [US1] `ai-runtime.ts` — đăng ký 3 online provider; expose getOnlineState/setProviderKey/
      deleteProviderKey/setProviderModel/setActiveProvider(exclusive)/testProvider/embed(local).
- [x] T013 [US3] `services/app-shell/privacy-state.ts` — `setOnlineProviderActive`; mode online khi active.
- [x] T014 [P] `tests/unit/privacy-state.test.ts` (RED/mở rộng) — online khi provider active.
- [x] T015 [US1] `src/main/ipc/register.ts` — 6 `safeHandle` + validate boundary (id/key/model); KHÔNG log.
- [x] T016 [P] `tests/unit/ipc-*.test.ts` — whitelist +6 kênh; boundary: setActiveProvider id lạ ném.
- [x] T017 `src/preload/index.ts` — 6 hàm `aiGetOnlineState/...`.
- [x] T018 `src/main/index.ts` — embed wiring → `aiRuntime.embed` (luôn ollama); khôi phục activeOnlineId
      lúc khởi động (set exclusive + privacy).

## Phase 5 — Renderer (US1/US3)

- [x] T019 [US1] `SettingsAiOnlineSection.tsx` — 3 hàng provider (key che, nhập/xoá, dropdown model
      preset+"Khác", toggle active exclusive, test); confirm 1 lần khi bật.
- [x] T020 [US1] `useOnlineProviders.ts` — hook nạp/đổi state.
- [x] T021 [US3] Ghép section vào màn Settings + `PrivacyBadge` refresh sau đổi active + CSS.

## Phase 6 — Polish

- [x] T022 e2e `online-provider.spec.ts` — section 3 hàng · nhập key mock → hasKey · bật → badge online +
      confirm · tắt → local · whitelist 6 kênh. GIỮ e2e cũ xanh.
- [x] T023 Coverage include (online-error/providers/secret-store/online-config/presets/privacy) ≥80%.
- [x] T024 Glossary: append 5 term (AnthropicProvider/GeminiProvider/OpenAIProvider, apiKey, secret storage,
      active provider, network egress).
- [x] T025 Gate: lint + test + build + e2e xanh.

## MVP

US1 (cấu hình) + US2 (dùng) + US3 (riêng tư) là lõi P1. US4 (lỗi) phủ trong provider tests.
