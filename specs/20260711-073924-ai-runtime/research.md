# Research — AI Runtime (Phase 0)

Unknown đã chốt qua ADR `2026-07-10-tech-stack.md` (D3) + clarify `2026-07-11-ai-runtime-clarify.md`.
Ghi lại quyết định + lý do + phương án loại bỏ.

## R1. Gọi Ollama: `fetch` global, không SDK

- **Decision**: Dùng `fetch` global của Node (Electron 43) gọi Ollama REST: `GET /api/tags` (list models),
  `POST /api/chat` (chat), `POST /api/embeddings` (embed), ping = `/api/tags`.
- **Rationale**: Ollama có REST API đơn giản, ổn định; tránh thêm dependency (`ollama` npm SDK) → nhẹ,
  ít bề mặt bảo mật. `fetch` sẵn có ở Node 18+.
- **Alternatives**: `ollama` SDK (thừa cho nhu cầu; thêm dep); `axios` (không cần).

## R2. Testability: tiêm HTTP client + store

- **Decision**: `ollama-client.ts` nhận `fetchFn` (mặc định global fetch) qua tham số; `model-selection.ts`
  nhận `StoreLike` (như `onboarding.ts` của 001). Provider/registry/runtime-status nhận client/store tiêm vào.
- **Rationale**: Unit test chạy dưới Vitest **không cần Ollama thật** (fake fetch trả JSON mẫu / lỗi) →
  đạt coverage ≥ 80% business logic (Constitution IV). Nhất quán pattern DI của 001.
- **Alternatives**: mock global fetch bằng `vi.stubGlobal` (kém tường minh hơn tiêm tham số).

## R3. Provider abstraction

- **Decision**: interface `LLMProvider { chat(req), embed(req), test() }` + `ProviderRegistry` giữ provider
  active (v1: OllamaProvider). Nơi gọi AI (feature sau) chỉ lấy provider từ registry.
- **Rationale**: ADR D3 — cho phép cắm provider online (008) qua cùng interface, không sửa nơi gọi (SC-006).
- **Alternatives**: gọi thẳng Ollama ở nơi cần (phá abstraction, khó thêm online sau).

## R4. Lưu lựa chọn model: electron-store

- **Decision**: `electron-store` key `ai.modelSelection = { chatModel, embeddingModel }` (A1).
- **Rationale**: Không tạo phụ thuộc schema SQLite trước `004-ingestion`; nhất quán với cờ onboarding của 001.
- **Alternatives**: SQLite settings table (bị loại A1 — sớm & thừa).

## R5. Renderer CSP giữ nguyên

- **Decision**: KHÔNG nới CSP renderer cho `localhost:11434`. Renderer không fetch Ollama; main process fetch
  (không chịu CSP renderer).
- **Rationale**: Constitution III — mọi HTTP tới Ollama ở main. Giữ CSP prod chặt (`connect-src 'self'`).
- **Alternatives**: renderer gọi Ollama trực tiếp (vi phạm III — loại).

## R6. RuntimeStatus + check-on-demand

- **Decision**: `runtime-status.ts` compose `{ reachable, ollamaReady, reason? }`: reachable = ping OK;
  ollamaReady = reachable AND chatModel+embeddingModel đã chọn tồn tại trong danh sách model. Kiểm khi
  renderer gọi `ai:getRuntimeStatus` / `ai:testConnection` (mở Cài đặt, bấm test) — **không poll** (A2).
- **Rationale**: đơn giản, đủ cho v1; tránh timer/poll phức tạp.
- **Alternatives**: poll định kỳ (A2 loại ở v1).

## R7. Onboarding skippable + ollamaReady tách

- **Decision**: `RuntimeOnboarding` hiển thị khi `!ollamaReady` ở lần đầu; nút "cài sau" cho vào app trạng
  thái giới hạn. `ollamaReady` đọc từ `ai:getRuntimeStatus`, **tách** `OnboardingState.completed` (cờ "đã
  xem màn chào" của 001).
- **Rationale**: A5 — không nhốt người dùng; phân biệt "đã xem chào" vs "Ollama thật sự sẵn sàng".
- **Alternatives**: blocking onboarding (A5 loại); tái dùng chung 1 cờ (mất phân biệt trạng thái).

## R8. Timeout cho HTTP Ollama

- **Decision**: Mọi call Ollama có timeout (AbortController, ~ vài giây); hết giờ → coi như không kết nối,
  báo lý do; UI không treo.
- **Rationale**: Ollama không chạy → fetch treo lâu; timeout giữ UI phản hồi (edge case spec).

## Không còn NEEDS CLARIFICATION.
