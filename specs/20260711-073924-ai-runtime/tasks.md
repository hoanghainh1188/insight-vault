---
description: "Task list — AI Runtime (007-ai-runtime)"
---

# Tasks: AI Runtime (runtime AI cục bộ)

**Input**: Design từ `specs/20260711-073924-ai-runtime/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-channels.md, quickstart.md
**Tests**: BẮT BUỘC (Constitution IV — TDD, coverage ≥ 80% business logic). Service nhận HTTP client/store tiêm vào → test không cần Ollama thật.

## Format: `[ID] [P?] [Story?] Description (file path)`

- **[P]**: song song được (khác file, không phụ thuộc task chưa xong).
- **[Story]**: US1–US4 map user story spec.md.

## Path Conventions (mở rộng 001)

`src/main/services/ai-runtime/`, `src/renderer/features/ai-runtime/`, `src/shared/ipc/`, `tests/unit/`, `tests/e2e/`.

---

## Phase 1: Setup

- [x] T001 [P] Tạo skeleton thư mục `src/main/services/ai-runtime/` và `src/renderer/features/ai-runtime/` (không cần dep mới — dùng `fetch` global + `electron-store` đã có)

**Checkpoint**: thư mục sẵn sàng.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Phải xong trước mọi user story.** (model-selection ở đây vì US1 provider/runtime-status cần — remediation F1.)

- [x] T002 [P] Thêm types vào `src/shared/ipc/types.ts`: `Model`, `ModelSelection`, `RuntimeStatus`, `ChatRequest/ChatResult`, `EmbedRequest/EmbedResult` (theo data-model.md)
- [x] T003 Thêm 5 kênh `ai:*` vào `src/shared/ipc/channels.ts` (`CHANNELS` + `WHITELISTED_CHANNELS` + `ChannelResponse`): `ai:listModels`, `ai:testConnection`, `ai:getSelectedModels`, `ai:setSelectedModels`, `ai:getRuntimeStatus` — không đổi 5 kênh `app:*`
- [x] T004 [P] Unit test `tests/unit/ollama-client.test.ts` (fake fetch): parse `/api/tags` → Model[]; chat; embed; ping; **timeout** (AbortController); Ollama-down → `[]`/không throw (RED)
- [x] T005 Impl `src/main/services/ai-runtime/ollama-client.ts` — nhận `fetchFn` tiêm vào, base `http://localhost:11434` (override env), timeout; listModels/chat/embed/ping (GREEN)
- [x] T006 [P] Định nghĩa interface `LLMProvider { chat, embed, test }` + types trong `src/main/services/ai-runtime/provider.ts`
- [x] T007 [P] Unit test `tests/unit/model-selection.test.ts`: get/set qua fake store; hỏng/thiếu → `{chatModel:null, embeddingModel:null}`; set lỗi không throw (RED) — FR-006
- [x] T008 Impl `src/main/services/ai-runtime/model-selection.ts` (StoreLike, key `ai.modelSelection`) (GREEN) — dùng bởi US1 (provider/runtime-status) và US2

**Checkpoint**: contract IPC + client + interface + model-selection sẵn.

---

## Phase 3: User Story 1 — Provider chung (Priority: P1) 🎯 MVP lõi

**Goal**: app tạo được chat/embedding + tự kiểm tra sẵn sàng qua giao diện provider chung; swap provider được.
**Independent test**: fake client → provider.chat→text, embed→vector, test→ready; đăng ký provider giả vào registry gọi qua cùng interface.

- [x] T009 [P] [US1] Unit test `tests/unit/ollama-provider.test.ts`: chat/embed/test qua fake client + selection; model thiếu → test "chưa sẵn sàng" (RED)
- [x] T010 [P] [US1] Unit test `tests/unit/provider-registry.test.ts`: register/getActive/setActive; provider giả gọi qua cùng interface (SC-006) (RED)
- [x] T011 [P] [US1] Unit test `tests/unit/runtime-status.test.ts`: compose `{reachable, ollamaReady, reason}` (Ollama down / chưa chọn model / model thiếu) (RED)
- [x] T012 [US1] Impl `src/main/services/ai-runtime/ollama-provider.ts` (chat/embed/test dùng ollama-client + model-selection) (GREEN)
- [x] T013 [US1] Impl `src/main/services/ai-runtime/registry.ts` (`ProviderRegistry`) (GREEN)
- [x] T014 [US1] Impl `src/main/services/ai-runtime/runtime-status.ts` (ping + đối chiếu model đã chọn với listModels) (GREEN)

**Checkpoint**: lõi runtime chạy được (kiểm qua unit) — nền cho ingestion/RAG.

---

## Phase 4: User Story 2 — Chọn & lưu mô hình trong Cài đặt (Priority: P1)

**Goal**: màn Cài đặt "AI cục bộ (Ollama)": trạng thái + kiểm tra kết nối + danh sách model động + chọn chat/embedding, lưu bền.
**Independent test**: mở Cài đặt (Ollama chạy) → danh sách khớp; chọn model → mở lại app giữ nguyên.

- [x] T015 [P] [US2] Contract test `tests/unit/ai-ipc-whitelist.test.ts`: 5 kênh `ai:*` whitelisted; tổng whitelist = 10; kênh `ai:*` lạ → `isWhitelisted=false` (RED) — FR-013, SC-005
- [x] T016 [US2] Đăng ký handlers `ai:listModels`, `ai:getSelectedModels`, `ai:setSelectedModels`, `ai:testConnection` trong `src/main/ipc/register.ts` + expose ở `src/preload/index.ts` (per-function) (GREEN)
- [x] T017 [US2] Impl `src/renderer/features/ai-runtime/SettingsAiSection.tsx` + `ModelSelect.tsx` (trạng thái "Đã kết nối", nút kiểm tra kết nối, danh sách chat/embedding model, chọn; gợi ý cài `nomic-embed-text` nếu thiếu — FR-010; **nút "Tải thêm mô hình" = link/hướng dẫn tĩnh, KHÔNG auto-pull — FR-011/F2**) theo prototype S5
- [x] T018 [US2] Wire `SettingsAiSection` vào route `/settings` (thay phần "AI cục bộ" của `SettingsPlaceholder`); verify V3/V4/V5 (thủ công với Ollama)

**Checkpoint**: chọn/lưu/kiểm tra model hoạt động.

---

## Phase 5: User Story 3 — Onboarding lần đầu kiểm tra Ollama thật (Priority: P2)

**Goal**: lần đầu kiểm Ollama thật; thiếu → hướng dẫn + "cài sau" (bỏ qua được); `ollamaReady` tách `OnboardingState`.
**Independent test**: Ollama tắt → onboarding hiện hướng dẫn; "cài sau" → vào app giới hạn.

- [x] T019 [US3] Đăng ký handler `ai:getRuntimeStatus` trong `register.ts` + expose ở preload
- [x] T020 [P] [US3] E2e `tests/e2e/ai-onboarding.spec.ts`: (CI không có Ollama → ollamaReady=false) onboarding hiện hướng dẫn + nút "cài sau"; bấm → vào app (RED)
- [x] T021 [US3] Impl `src/renderer/features/ai-runtime/RuntimeOnboarding.tsx` + `useRuntimeStatus.ts` (đọc `ai:getRuntimeStatus`, check-on-demand); wire nội dung thật vào `OnboardingGate` của 001 + nút "cài sau"
- [x] T022 [US3] Đảm bảo `ollamaReady` (qua `ai:getRuntimeStatus`) tách khỏi `OnboardingState.completed`; verify V6 GREEN

**Checkpoint**: onboarding thật, không nhốt người dùng.

---

## Phase 6: User Story 4 — Cô lập gọi Ollama + local-first (Priority: P1)

**Goal**: Ollama chỉ gọi ở main; renderer qua IPC whitelisted; privacy badge vẫn "local".
**Independent test**: window.api chỉ có hàm whitelisted; kênh `ai:*` lạ bị từ chối; badge "Chạy cục bộ".

- [x] T023 [P] [US4] E2e `tests/e2e/ai-security.spec.ts`: `window.api` có 5 hàm `ai` + 5 hàm `app`, không có API gọi Ollama trực tiếp; gọi kênh `ai:*` lạ không side effect; privacy badge vẫn "Chạy cục bộ" (RED) — SC-005, FR-014
- [x] T024 [US4] Củng cố whitelist `ai:*` trong `register.ts` (safeHandle, no catch-all) + preload per-function (không expose invoke chung); verify V7/V8 GREEN

**Checkpoint**: ranh giới bảo mật giữ nguyên với 5 kênh mới.

---

## Phase 7: Polish & Cross-Cutting

- [x] T025 [P] Verify KHÔNG log payload chat/embed: dùng `logEvent`/`redact` (001); unit assert content không lọt vào log (FR-012, Constitution III)
- [x] T026 [P] Chạy `npm test -- --coverage`, đảm bảo ≥ 80% business logic (ollama-client/provider/registry/model-selection/runtime-status); bù test nếu thiếu
- [x] T027 [P] Append thuật ngữ vào `docs/00-glossary.md` (`AI runtime`, `model`, `chat model`, `embedding model`, `connection test`, `ProviderRegistry`) — bước glossary-steward
- [ ] T028 [P] Kiểm chạy trên macOS + Windows (thủ công/CI matrix); ghi kết quả vào `quickstart.md`
- [x] T029 Rà `git diff` sau format; đảm bảo lint/test/build xanh trước test gate

---

## Dependencies

```
Setup (T001)
  └▶ Foundational (T002–T008)   ← chặn mọi story (gồm model-selection — F1)
        ├▶ US1 (T009–T014) [P1] 🎯 lõi provider
        ├▶ US2 (T015–T018) [P1]
        ├▶ US3 (T019–T022) [P2]
        └▶ US4 (T023–T024) [P1]  (whitelist cho kênh do US2/US3 đăng ký)
              └▶ Polish (T025–T029)
```

- US1 dùng model-selection (Foundational) → hết phụ thuộc ngược. US2/US3 đăng ký IPC → US4 khoá whitelist tổng.
- Trong mỗi story: task test [P] chạy trước (RED) → impl (GREEN).

## Parallel opportunities

- Foundational: T004/T006/T007 song song với T002/T003.
- US1: T009/T010/T011 (3 test) song song.
- Các unit test đầu mỗi story [P] song song; impl trong 1 story tuần tự (đụng register.ts/App).

## Implementation strategy

- **MVP lõi = US1** (provider chạy được, kiểm qua unit) → nền cho 004/005.
- Tăng dần: + US2 (chọn model) → + US4 (bảo mật, ưu tiên vì bất biến) → + US3 (onboarding) → Polish.

## Task summary

- **Tổng: 29 task** — Setup 1 · Foundational 7 · US1 6 · US2 4 · US3 4 · US4 2 · Polish 5.
- Test-first: 8 task test (RED) trước impl (Constitution IV).
- Remediation /speckit-analyze: F1 (model-selection → Foundational), F2 (nút "Tải thêm mô hình" = link tĩnh, ghi rõ T017).
