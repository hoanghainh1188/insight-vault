# Implementation Plan: AI Runtime (runtime AI cục bộ)

**Branch**: `007-ai-runtime` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260711-073924-ai-runtime/spec.md`

## Summary

Dựng lớp runtime AI cục bộ: một **ProviderRegistry** + interface `LLMProvider { chat, embed, test }`, v1
chỉ có **OllamaProvider** gọi Ollama HTTP (`http://localhost:11434`) ở **main process**. Renderer thao
tác qua **5 kênh IPC `ai:*` whitelisted**. Màn Cài đặt lắp khu vực "AI cục bộ (Ollama)" (trạng thái +
kiểm tra kết nối + chọn chat/embedding model, lưu bằng electron-store). Onboarding lần đầu kiểm tra Ollama
thật, hướng dẫn nếu thiếu, **bỏ qua được**; `ollamaReady` là sub-state riêng. Ollama local không phải
egress → privacy badge vẫn "Chạy cục bộ". Tái dùng khung Settings/onboarding/privacy của `001-app-shell`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict). Main = Node (Electron 43); renderer = React 18.

**Primary Dependencies**: Không thêm dependency mới. Gọi Ollama bằng **`fetch` global của Node** (Ollama
REST: `GET /api/tags` liệt kê model, `POST /api/chat` chat, `POST /api/embeddings` embed, ping qua
`/api/tags`). `electron-store` (đã có) lưu `ModelSelection`. electron-vite/React/Zustand (đã có).

**Storage**: `electron-store` — key `ai.modelSelection = { chatModel, embeddingModel }`. Không dùng SQLite (A1).

**Testing**: Vitest (unit, coverage ≥ 80% business logic) — mọi service nhận **HTTP client tiêm vào**
(fake fetch) để test không cần Ollama thật. Playwright `_electron` (e2e) — whitelist `ai:*` + renderer
isolation + privacy badge vẫn "local". Test gọi Ollama thật là **thủ công** (quickstart), không trong CI.

**Target Platform**: Desktop macOS + Windows (Electron).

**Project Type**: desktop-app (mở rộng main/preload/renderer/shared của 001).

**Performance Goals**: Kiểm tra kết nối/liệt kê model phản hồi nhanh (< 2s khi Ollama chạy local); UI
không treo khi Ollama không phản hồi (timeout + báo lỗi).

**Constraints**: Ollama gọi CHỈ ở main (Constitution III); renderer không fetch Ollama → **CSP renderer
giữ nguyên** (`connect-src 'self'`), không cần nới cho localhost:11434 vì renderer không gọi mạng.
Ollama local **không** egress (Constitution I) → privacy badge "local". Timeout hợp lý cho HTTP tới Ollama.

**Scale/Scope**: 1 người dùng/máy; vài model; 5 kênh IPC mới; 1 khu vực Settings + onboarding thật.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                                           | Áp dụng                                                                                                                                                             | Trạng thái                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **I. Local-first & No Default Egress**               | Ollama chạy trên máy người dùng (localhost) — **không** phải egress ra bên thứ ba; privacy badge tiếp tục "local" (FR-014). Không có provider online ở feature này. | ✅ PASS                              |
| **II. Verifiable Citations**                         | Chưa liên quan (RAG ở 005). embed() tạo vector là nền cho trích dẫn sau.                                                                                            | ➖ N/A                               |
| **III. Desktop Security Boundary**                   | Ollama HTTP CHỈ ở main; renderer qua 5 kênh `ai:*` whitelisted (per-function preload, no catch-all); không log payload chat/embed (dùng `redact`/`logEvent` đã có). | ✅ PASS (thiết kế bám ranh giới 001) |
| **IV. Test-First & Coverage**                        | TDD; service nhận HTTP client + store tiêm vào → unit test ≥ 80% không cần Ollama.                                                                                  | ✅ PASS                              |
| **V. Phased Delivery**                               | 007 sau 001, trước 004/005; không lấn ingestion/RAG/online provider.                                                                                                | ✅ PASS                              |
| **Additional (Terminology / ADR-governed / Intake)** | Intake đã chạy; term mới (`AI runtime`, `model`, `chat model`…) append ở bước glossary-steward; bám ADR D3 + clarify.                                               | ✅ PASS                              |

**Kết luận:** không vi phạm → tiếp Phase 0. (Complexity Tracking để trống.)

## Project Structure

### Documentation (this feature)

```text
specs/20260711-073924-ai-runtime/
├── plan.md
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── ipc-channels.md  # Hợp đồng 5 kênh ai:* (bổ sung vào whitelist hiện có)
└── tasks.md             # /speckit-tasks (chưa tạo)
```

### Source Code (repository root) — mở rộng 001

```text
src/
├── main/
│   ├── ipc/register.ts              # + đăng ký 5 handler ai:* (giữ safeHandle whitelist)
│   └── services/
│       └── ai-runtime/
│           ├── ollama-client.ts     # HTTP tới Ollama (nhận fetchFn tiêm vào): listModels/chat/embed/ping
│           ├── provider.ts          # interface LLMProvider {chat,embed,test} + types
│           ├── ollama-provider.ts   # OllamaProvider (dùng ollama-client + ModelSelection)
│           ├── registry.ts          # ProviderRegistry (đăng ký/lấy provider active)
│           ├── model-selection.ts   # get/set ModelSelection qua StoreLike (electron-store)
│           └── runtime-status.ts    # compose RuntimeStatus {reachable, ollamaReady, reason}
├── preload/index.ts                 # + expose 5 hàm ai.* (per-function)
├── renderer/
│   └── features/ai-runtime/
│       ├── SettingsAiSection.tsx    # khu vực "AI cục bộ (Ollama)" trong /settings (trạng thái, test, chọn model)
│       ├── ModelSelect.tsx          # danh sách model (radio-select) — chat + embedding
│       ├── RuntimeOnboarding.tsx    # nội dung onboarding thật (kiểm Ollama, hướng dẫn, "cài sau")
│       └── useRuntimeStatus.ts      # hook đọc ai:getRuntimeStatus (check-on-demand)
└── shared/ipc/
    ├── channels.ts                  # + 5 tên kênh ai:* vào CHANNELS/whitelist
    └── types.ts                     # + Model, ModelSelection, RuntimeStatus, ChatRequest/Result…

tests/
├── unit/                            # ollama-client (fake fetch) · provider · registry · model-selection · runtime-status
└── e2e/                             # ai-ipc-whitelist · renderer isolation · privacy-badge-local
```

**Structure Decision**: Cô lập feature ở `src/main/services/ai-runtime/` + `src/renderer/features/ai-runtime/`
(ADR D6). Hợp đồng IPC mở rộng ở `src/shared/ipc/` — **thêm** 5 kênh `ai:*`, **không đổi** 5 kênh app-shell.
Onboarding thật: `RuntimeOnboarding` thay nội dung placeholder trong `OnboardingGate` của 001; `ollamaReady`
đọc từ `ai:getRuntimeStatus`, tách khỏi `OnboardingState.completed`.

## Complexity Tracking

> Không có vi phạm Constitution → để trống.
