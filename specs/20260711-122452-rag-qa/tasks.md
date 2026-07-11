# Tasks: Hỏi đáp theo nguồn (RAG Q&A)

**Feature**: `013-rag-qa` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Cách tiếp cận**: Test-First (Constitution IV, ≥80%). Service thuần nhận DI (mock provider/vector-store/
source-repo, `:memory:` SQLite) → unit-test không cần Electron/Ollama. `[P]` = song song (khác file).

**Nguồn**: [data-model.md](./data-model.md), [contracts/ipc-channels.md](./contracts/ipc-channels.md),
[research.md](./research.md) (R1–R6), 2 ADR `2026-07-11-rag-*`.

**CRUX**: `citation.ts` (hậu kiểm chip [n] — Constitution II / SC-002) là hạng mục test kỹ nhất.

---

## Phase 1: Setup

- [X] T001 [P] Cập nhật `vitest.config.ts`: thêm `src/main/services/rag/**/*.ts` + `src/renderer/features/rag-qa/citation-format.ts` vào coverage `include`. GIỮ `rag-service.ts` TRONG ngưỡng (nó được test kỹ T017/T023/T027/T029 — bài học pipeline.ts ở 011); chỉ `vector-store.ts` adapter native là exclude (đã có).
- [X] T002 [P] Xác nhận (research R1) LanceDB `search().where().limit().toArray()` trả `_distance` — đã verify; ghi hằng số `RETRIEVAL_TOP_K/RELEVANCE_MAX_DISTANCE/CONTEXT_CHAR_BUDGET/MAX_QUESTION_LEN/MAX_HISTORY_TURNS` sẽ đặt trong `src/main/services/rag/` (data-model).

---

## Phase 2: Foundational (types + kênh + mở rộng 011 — CHẶN mọi US)

- [X] T003 Thêm shared types vào `src/shared/ipc/types.ts`: `RagMode`, `RagTurn`, `RagAskInput`, `Citation`, `RagAnswer` (theo data-model).
- [X] T004 [P] Test whitelist: `tests/unit/rag-ipc-whitelist.test.ts` — `rag:ask` whitelisted, ngoài danh sách bị từ chối, tổng ≥22, không trùng (RED).
- [X] T005 Thêm kênh `rag:ask` vào `src/shared/ipc/channels.ts` (`CHANNELS`, `WHITELISTED_CHANNELS`, `ChannelResponse[ragAsk]=RagAnswer`) → T004 GREEN.
- [X] T006 [P] Test `getChunksByIds`: `tests/unit/get-chunks-by-ids.test.ts` — `:memory:` SQLite, trả đúng chunk theo thứ tự ids, id không tồn tại bị bỏ (RED).
- [X] T007 MỞ RỘNG `src/main/services/ingestion/source-repo.ts`: `getChunksByIds(ids: string[]): Chunk[]` (WHERE id IN parameterized, map lại theo thứ tự ids) → T006 GREEN.
- [X] T008 MỞ RỘNG `src/main/services/ingestion/vector-store.ts`: thêm `VectorSearchHit` + `search(vector, notebookId, topK)` vào interface + impl LanceDB (bảng chưa có → `[]`; escape notebookId); cập nhật mock trong test 011 nếu VectorStore interface đổi (thêm search vào fake ở ingestion-pipeline.test.ts).

**Checkpoint**: types + kênh + 2 mở rộng 011 sẵn sàng.

---

## Phase 3: User Story 1 — Trả lời có trích dẫn kiểm chứng được (P1) 🎯 MVP

**Goal**: hỏi (grounded) → retrieval → context → chat → chip [n] hậu kiểm → answer + citations đúng chunk.

**Independent Test**: hỏi câu có trong tài liệu → ≥1 chip [n] map đúng chunk/nguồn/locator; chip ngoài phạm vi bị gỡ.

### Tests (RED trước) — CRUX ở T009

- [X] T009 [P] [US1] `tests/unit/citation.test.ts` — hậu kiểm: `[n]` hợp lệ→Citation đúng {n,chunkId,sourceId,sourceTitle,locator}; `[9]` khi k=6→GỠ khỏi answer + không vào citations; dedup theo n; nhiều chip; answer không chip→citations rỗng (SC-002, Principle II).
- [X] T010 [P] [US1] `tests/unit/context-builder.test.ts` — đánh số [1..k], ngân sách ~6000 ký tự **bỏ NGUYÊN chunk** điểm thấp (không cắt giữa), map n→RetrievedChunk đúng, render nhãn "[n] (Nguồn: .., trang ..)".
- [X] T011 [P] [US1] `tests/unit/retrieval.test.ts` — mock embed+search+getChunksByIds: lọc score>ngưỡng, đánh số theo thứ tự score; 0 hit / vượt ngưỡng → rỗng.

### Implementation (GREEN)

- [X] T012 [P] [US1] `src/main/services/rag/citation.ts` — regex `\[(\d+)\]`, validate n∈[1..k] theo map, gỡ chip lỗi khỏi answer, build `Citation[]` dedup → T009 GREEN.
- [X] T013 [P] [US1] `src/main/services/rag/context-builder.ts` — `buildContext(retrieved): BuiltContext` (đánh số + ngân sách + nhãn nguồn) → T010 GREEN.
- [X] T014 [P] [US1] `src/main/services/rag/prompt.ts` — 2 template `groundedSystemPrompt(context)` / `openSystemPrompt(context)` (nội dung theo ADR) — grounded dùng ở US1.
- [X] T015 [US1] `src/main/services/rag/retrieval.ts` — `retrieve(question, notebookId, deps)`: embed → vectorStore.search → lọc ngưỡng → getChunksByIds → RetrievedChunk[] (kèm sourceTitle từ source-repo.getById) → T011 GREEN.
- [X] T016 [US1] `src/main/services/rag/rag-service.ts` — `ask(input, deps)`: validate → retrieve → buildContext → chat (grounded prompt + question) → citation.postprocess → RagAnswer. Grounded + 0 chunk → notFound.
- [X] T017 [P] [US1] `tests/unit/rag-service.test.ts` — mock chat: grounded có nguồn → answer+citations; grounded 0 chunk → notFound=true answer "Không tìm thấy trong nguồn" citations rỗng (RED/GREEN với T016).
- [X] T018 [US1] Đăng ký `rag:ask` ở `src/main/ipc/register.ts` qua `safeHandle` (KHÔNG log payload); nhận ragService từ deps.
- [X] T019 [US1] Wiring `src/main/index.ts`: tạo ragService (inject provider embed+chat qua aiRuntime.registry, vectorStore.search, sourceRepo, isRuntimeReady) truyền vào registerIpc.
- [X] T020 [P] [US1] Preload `src/preload/index.ts`: thêm `ragAsk(input): Promise<RagAnswer>`.
- [X] T021 [US1] Renderer `src/renderer/features/rag-qa/`: `ChatColumn.tsx` + `useChat.ts` (state hội thoại in-memory + gọi ragAsk + **spinner "đang trả lời…" khi chờ — FR-009**) + `MessageBubble.tsx` (render answer, parse [n]→nút .cite, srcnote) + `citation-format.ts`. Sửa `Workspace.tsx` (011) import ChatColumn thay placeholder cột Chat.
- [X] T022 [P] [US1] `tests/unit/citation-format.test.ts` — render danh sách nguồn "[n] Tên · trang" từ Citation[].

**Checkpoint US1**: hỏi đáp grounded có trích dẫn hoạt động (MVP giao được).

---

## Phase 4: User Story 2 — "Không tìm thấy trong nguồn" (P1)

**Goal**: grounded thiếu căn cứ → "Không tìm thấy trong nguồn", không bịa, không chip.

**Independent Test**: hỏi ngoài tài liệu → notFound + citations rỗng; notebook 0 nguồn ready → ô nhập vô hiệu.

- [X] T023 [US2] Bổ sung `rag-service.test.ts`: grounded + retrieval rỗng (0 hit / vượt ngưỡng) → notFound=true, answer chuẩn, citations=[] (đã 1 phần ở T017 — mở rộng ca ngưỡng).
- [X] T024 [US2] `useChat.ts` + `ChatColumn.tsx`: khi notebook không có nguồn `ready` (đọc source:listByNotebook / sourceCount) → vô hiệu ô nhập + gợi ý "Nạp nguồn để bắt đầu hỏi đáp" (FR-010).
- [X] T025 [US2] `MessageBubble.tsx`: hiển thị trạng thái notFound rõ ràng (không render srcnote khi citations rỗng).

**Checkpoint US2**: ranh giới "không bịa" đảm bảo.

---

## Phase 5: User Story 3 — Chế độ Mở rộng (P2)

**Goal**: open mode dùng kiến thức chung, phần ngoài nguồn gắn nhãn; phần từ nguồn vẫn [n].

**Independent Test**: open + câu ngoài tài liệu → trả lời có nhãn "không dựa trên nguồn".

- [X] T026 [P] [US3] `tests/unit/rag-prompt.test.ts` — 2 template: grounded (cấm bịa + "không tìm thấy"), open (gắn nhãn phần ngoài nguồn). (RED nếu chưa có nội dung open.)
- [X] T027 [US3] `rag-service.ts`: nhánh `mode==='open'` dùng `openSystemPrompt`; open KHÔNG set notFound (luôn trả lời); citation vẫn hậu kiểm cho phần có [n] → T026 xanh.
- [X] T028 [US3] `ModeToggle.tsx` + `useChat.ts` + `ChatColumn.tsx`: công tắc grounded/open + modehint (mô tả chế độ), truyền `mode` vào ragAsk. `rag-service.test.ts` thêm ca open.

**Checkpoint US3**: 2 chế độ hoạt động.

---

## Phase 6: User Story 4 — Multi-turn + runtime chưa sẵn sàng (P2)

**Goal**: multi-turn trong phiên; runtime chưa sẵn sàng → hướng dẫn + chặn gửi.

**Independent Test**: 2 câu liên tiếp hiểu ngữ cảnh; tắt Ollama → chặn gửi.

- [X] T029 [US4] `rag-service.ts` + test: ghép `history` (~6 lượt gần nhất) vào `ChatMessage[]` gửi cho chat (retrieval vẫn chỉ dùng câu hỏi hiện tại) — `rag-service.test.ts` ca multi-turn (history vào messages).
- [X] T030 [US4] `useChat.ts`: giữ danh sách message in-memory phiên, gửi `history` cắt `MAX_HISTORY_TURNS`; reset khi đổi notebook.
- [X] T031 [US4] `ChatColumn.tsx` + `useChat.ts`: kiểm `RuntimeStatus` (ai:getRuntimeStatus) → chưa sẵn sàng → banner inline (tái dùng ý RuntimeOnboarding) + vô hiệu gửi; câu hỏi >2000 ký tự → chặn + thông báo (FR-011/013).

**Checkpoint US4**: độ bền hội thoại + runtime.

---

## Phase 7: Polish & Cross-Cutting

- [X] T032 [P] `tests/unit/question-validation.test.ts` + `src/main/services/rag/question-validation.ts` — ≤2000 ký tự, rỗng/vượt→ném; rag-service gọi validate đầu tiên.
- [X] T033 [P] Append glossary `docs/00-glossary.md` nếu cần: top-k retrieval, context, system prompt (theo intake — chỉ term thực dùng).
- [X] T034 [P] e2e `tests/e2e/rag-qa.spec.ts` (Playwright `_electron`): `window.api.ragAsk` tồn tại + không invoke chung (whitelist); notebook rỗng → ô nhập vô hiệu; (nếu Ollama sẵn: ragAsk trả answer+citations khớp chunk thật, ngược lại kiểm nhánh runtime chưa sẵn sàng).
- [X] T035 [P] Rà bảo mật: không log câu hỏi/nội dung/answer ở register/rag-service/retrieval (grep); renderer bundle không import lancedb/sqlite/provider (SC-005, Constitution III).
- [X] T036 Test gate: `npm run lint && npm run test && npm run build && npm run test:e2e`; coverage rag ≥80%. Sửa tới xanh.

---

## Dependencies & thứ tự

- **Setup (T001–T002)** → **Foundational (T003–T008)** → US.
- **US1 (T009–T022)** = MVP, chặn US2/US3/US4 (dùng lại retrieval/context/citation/rag-service/ChatColumn).
- **US2 (T023–T025)**, **US3 (T026–T028)**, **US4 (T029–T031)** sau US1 (P1→P1→P2→P2).
- **Polish (T032–T036)** cuối.
- Test RED trước implement GREEN; `[P]` khác file chạy song song.

## Song song mẫu (US1)

`T009,T010,T011` (3 test) ∥; rồi `T012,T013,T014` (citation/context/prompt khác file) ∥; `T015→T016→T017`;
`T020,T022` ∥ với UI.

## MVP scope

**US1 + US2** (Phase 1–4) = hỏi đáp grounded có trích dẫn + "không tìm thấy" — trọn vẹn lời hứa "kiểm chứng
được". US3 (mở rộng) + US4 (multi-turn/runtime) tăng cường.

**Tổng: 36 task** — Setup 2, Foundational 6, US1 14, US2 3, US3 3, US4 3, Polish 5.
