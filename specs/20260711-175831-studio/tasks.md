# Tasks: Studio (tổng hợp tri thức từ notebook)

**Feature**: `021-studio` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Cách tiếp cận**: Test-First (Constitution IV, ≥80%). Logic thuần/DI (`studio-repo` với `:memory:` SQLite,
`prompt`, `buildContext` budget) unit-test không cần Electron. `[P]` = song song (khác file).

**Nguồn**: [data-model.md](./data-model.md), [contracts/ipc-channels.md](./contracts/ipc-channels.md),
[research.md](./research.md) (R1–R9). 2 ADR `2026-07-11-studio-*`.

**CRUX**: hậu kiểm chip `[n]` (tái dùng 013 — Constitution II) + upsert UNIQUE(notebook,kind) + FK CASCADE.

**Kế thừa (KHÔNG sửa)**: `Citation`/`Locator` (013), `source-repo.listByNotebook`/`listChunks` (011),
`LLMProvider`/`ProviderRegistry`/`RuntimeStatus` (007), `postprocessCitations`/`citationsFromMap` (013),
Source Viewer `openCitation` (019). Điểm chạm 011 = 0; sửa 013 = 1 param additive cho `buildContext`.

---

## Phase 1: Setup

- [x] T001 [P] Cập nhật `vitest.config.ts`: thêm `src/main/services/studio/studio-repo.ts` + `src/main/services/studio/prompt.ts` vào coverage `include`; exclude `src/main/services/studio/studio-service.ts` (assembly quanh LLM I/O).
- [x] T002 [P] Tạo hằng `STUDIO_CONTEXT_BUDGET = 8000` trong `src/main/services/studio/constants.ts` (một nơi duy nhất; kèm chú thích < context window model local).

---

## Phase 2: Foundational (migration + types + kênh + budget — CHẶN mọi US)

- [x] T003 [P] Test budget param: `tests/unit/studio-context-budget.test.ts` — `buildContext(scored)` giữ hành vi cũ (6000); `buildContext(scored, 8000)` nhận thêm chunk khi tổng > 6000 & ≤ 8000; luôn giữ ≥1 chunk (RED).
- [x] T004 Thêm tham số `budget = CONTEXT_CHAR_BUDGET` cho `buildContext(scored, budget?)` trong `src/main/services/rag/context-builder.ts` (additive, mặc định giữ nguyên rag) → T003 GREEN. KHÔNG đổi caller rag hiện tại.
- [x] T005 [P] Thêm shared types vào `src/shared/ipc/types.ts`: `StudioKind`, `StudioResult{id,notebookId,kind,content,citations:Citation[],createdAt,truncated?}`, `StudioGenerateInput{notebookId,kind}`.
- [x] T006 [P] Test whitelist: `tests/unit/studio-channels-whitelist.test.ts` — `studio:generate` + `studio:list` whitelisted, kênh ngoài bị từ chối, `WHITELISTED_CHANNELS.size` tăng +2, không trùng tên (RED).
- [x] T007 Thêm kênh `studio:generate` + `studio:list` vào `src/shared/ipc/channels.ts` (`CHANNELS`, `ChannelResponse[studioGenerate]=StudioResult`, `[studioList]=StudioResult[]`) → T006 GREEN.
- [x] T008 Thêm migration #3 (user_version 2→3) trong `src/main/db/migrations/` (theo runner 011): tạo bảng `studio_result(id PK, notebook_id FK→notebook ON DELETE CASCADE, kind CHECK(4 loại), content, citations_json, created_at, updated_at, UNIQUE(notebook_id,kind))`. Append-only, idempotent.

**Checkpoint**: DB schema + types + kênh + budget sẵn sàng cho mọi US.

---

## Phase 3: User Story 1 — Tạo bản tổng hợp có trích dẫn (P1) 🎯 MVP

**Goal**: notebook có nguồn ready → bấm nút Tóm tắt → card text + chip `[n]` (hậu kiểm) → bấm chip mở Source
Viewer đúng đoạn; kết quả được lưu (upsert).

**Independent Test**: với notebook ≥1 nguồn ready, `studio:generate{kind:"summary"}` trả `StudioResult` có
≥1 citation trỏ chunk thật; bấm chip mở viewer highlight.

### Tests (RED trước)

- [x] T009 [P] [US1] `tests/unit/studio-repo.test.ts` — DI `:memory:` chạy migration #1→#3: `upsert` tạo mới rồi `upsert` cùng `(notebook,kind)` GHI ĐÈ (1 hàng); `listByNotebook` trả đúng; `getByNotebookKind`; (de)serialize `citations_json` khứ hồi giữ nguyên `Citation[]` (kèm locator) (RED).
- [x] T010 [P] [US1] `tests/unit/studio-prompt.test.ts` — `systemPromptFor(kind)` phủ 4 kind, mỗi prompt chứa yêu cầu chèn `[n]` + "chỉ dùng đoạn đánh số"/"không bịa" + tiếng Việt; kind lạ → ném lỗi (RED).

### Implementation (GREEN)

- [x] T011 [US1] Viết `src/main/services/studio/studio-repo.ts`: `createStudioRepo(db)` → `upsert(notebookId,kind,content,citations)→StudioResult` (INSERT … ON CONFLICT(notebook_id,kind) DO UPDATE), `listByNotebook`, `getByNotebookKind`, (de)serialize `citations_json` → T009 GREEN.
- [x] T012 [US1] Viết `src/main/services/studio/prompt.ts`: `systemPromptFor(kind)` — khung chung "[n]/không bịa/tiếng Việt" + phần riêng 4 kind (summary/keyPoints/faq/outline) → T010 GREEN.
- [x] T013 [US1] Viết `src/main/services/studio/studio-service.ts`: `generate({notebookId,kind})` — gom `listByNotebook`(lọc ready)+`listChunks` → `ScoredChunk[]` (sourceTitle, score=0, thứ tự created_at→ordinal); 0 chunk→lỗi thân thiện; `buildContext(scored, STUDIO_CONTEXT_BUDGET)`; kiểm runtime ready; `LLMProvider.chat(systemPromptFor(kind), contextText)`; `postprocessCitations`→0 chip & content≠rỗng→`citationsFromMap`; content rỗng→lỗi; `studio-repo.upsert`; trả `StudioResult{truncated: map.size < tổng chunk}`. `list(notebookId)`. KHÔNG log content.
- [x] T014 [US1] Đăng ký `studio:generate` qua `safeHandle` trong `src/main/ipc/register.ts` (nhận `studioService`); log tối đa `notebookId`/`kind`/error-label, KHÔNG log content/citations.
- [x] T015 [US1] Wire `studio-service` trong `src/main/index.ts` (truyền `db` + `sourceRepo` + `providerRegistry`) và chuyển vào `register`.
- [x] T016 [US1] Thêm `studioGenerate(input)` vào `src/preload/index.ts` (contextBridge whitelisted).
- [x] T017 [P] [US1] Viết `src/renderer/features/studio/useStudio.ts`: state `results` theo kind + `loading[kind]` + `error[kind]`; `generate(kind)` gọi `studioGenerate`; `onCite(citation)` → `viewer.openCitation`.
- [x] T018 [P] [US1] Viết `src/renderer/features/studio/StudioResultCard.tsx`: render `content` dạng text + chip `[n]` (tách theo `[\d+]`, React text node + `<button>` chip, `white-space:pre-wrap`, KHÔNG innerHTML); nút "Tạo lại"; ghi chú "dựa trên phần đầu tài liệu" khi `truncated`.
- [x] T019 [US1] Viết `src/renderer/features/studio/StudioColumn.tsx` + `studio.css`: nút "Tóm tắt tài liệu" (MVP) + trạng thái đang tạo/lỗi; render `StudioResultCard`. Props `notebookId` + `onCite`; readiness (`hasReadySources`/`ollamaReady`) tự fetch trong `useStudio` (giảm prop drilling, mirror ChatColumn/useChat).
- [x] T020 [US1] Wire cột Studio trong `src/renderer/features/sources/Workspace.tsx`: thay placeholder bằng `<StudioColumn/>` (truyền `notebookId`, `onCite=viewer.openCitation`; readiness tự fetch trong `useStudio`).
- [x] T021 [US1] e2e `tests/e2e/studio.spec.ts` (case 1): notebook có nguồn → bấm Tóm tắt → card hiện + ≥1 chip `[n]` → bấm chip mở Source Viewer highlight. Render an toàn (không innerHTML).

**Checkpoint**: US1 độc lập — sinh + hiển thị + trích dẫn + lưu một loại (Tóm tắt) end-to-end. MVP giao được.

---

## Phase 4: User Story 2 — Bốn loại + tạo lại ghi đè (P2)

**Goal**: đủ 4 nút; mỗi loại card riêng; bấm lại cùng loại ghi đè bản cũ (upsert), 3 loại kia giữ nguyên.

**Independent Test**: bấm 4 nút → 4 card đúng phong cách; bấm lại 1 nút → chỉ card đó đổi.

- [x] T022 [US2] Mở rộng `StudioColumn.tsx`: đủ 4 nút "Tạo nhanh" (Tóm tắt/Ý chính/FAQ/Dàn ý); `loading`/`error` theo từng kind độc lập; render tối đa 4 card.
- [x] T023 [US2] Xác nhận `useStudio` quản `results`/`loading`/`error` theo map kind (không lẫn giữa loại); bấm "Tạo lại" gọi `generate(kind)` ghi đè state card cùng kind.
- [x] T024 [US2] e2e `studio.spec.ts` (case 2): bấm lần lượt 4 loại → 4 card riêng; bấm lại 1 loại → chỉ card đó đổi, 3 loại kia giữ. (prompt 4 kind đã có ở T012/T010.)

**Checkpoint**: 4 loại độc lập + regenerate ghi đè đúng.

---

## Phase 5: User Story 3 — Lưu & xem lại (P2)

**Goal**: mở lại notebook thấy kết quả cũ (studio:list); xoá notebook xoá theo kết quả (cascade).

**Independent Test**: tạo kết quả → đóng/mở lại notebook → card cũ hiển thị, chip bấm được; xoá notebook →
`studio_result` liên quan biến mất.

- [x] T025 [US3] Đăng ký `studio:list` qua `safeHandle` trong `src/main/ipc/register.ts` (đọc `studio-repo.listByNotebook` → parse citations_json → `StudioResult[]`).
- [x] T026 [US3] Thêm `studioList(notebookId)` vào `src/preload/index.ts`.
- [x] T027 [US3] `useStudio`: khi mở notebook (hoặc đổi `notebookId`) gọi `studioList` nạp `results` đã lưu; card khôi phục kèm chip bấm mở viewer.
- [x] T028 [P] [US3] `tests/unit/studio-repo.test.ts` (bổ sung): xoá notebook (FK CASCADE, `PRAGMA foreign_keys=ON`) → mọi `studio_result` của notebook đó biến mất; `listByNotebook` notebook khác không bị ảnh hưởng.
- [x] T029 [US3] e2e `studio.spec.ts` (case 3): tạo kết quả → chuyển notebook khác rồi quay lại → card cũ vẫn hiển thị + chip mở nguồn.

**Checkpoint**: kết quả bền vững qua đóng/mở + xoá theo notebook.

---

## Phase 6: Polish & Edge (cross-cutting)

- [x] T030 [P] e2e `studio.spec.ts` (case 4): notebook rỗng/chưa có nguồn ready → 4 nút vô hiệu + gợi ý "Nạp nguồn để tạo Studio".
- [x] T031 [P] e2e `studio.spec.ts` (case 5): runtime chưa sẵn sàng (`UNREACHABLE_OLLAMA`) → `studio:generate` trả lỗi thân thiện, KHÔNG sinh nội dung bịa; nút vô hiệu khi `!ollamaReady`.
- [x] T032 [P] Rà `register.ts` + `studio-service.ts`: KHÔNG log `content`/`citations`/nội dung chunk (Constitution III / FR-014); chỉ id/kind/notebookId/error-label.
- [x] T033 Chạy `npm run test` (coverage ≥80% business logic: studio-repo, prompt, budget, whitelist) + `npm run lint` + `npm run build` xanh; cập nhật `[X]` cho task đã xong.

---

## Dependencies & thứ tự

- **Setup (T001–T002)** → **Foundational (T003–T008)** CHẶN mọi US.
- **US1 (T009–T021)** phụ thuộc Foundational; là MVP, độc lập test được.
- **US2 (T022–T024)** phụ thuộc US1 (mở rộng StudioColumn/useStudio; prompt 4 kind đã có).
- **US3 (T025–T029)** phụ thuộc Foundational + US1 (upsert đã lưu); thêm đường đọc lại — độc lập với US2.
- **Polish (T030–T033)** sau khi các US liên quan xong.

## Song song (ví dụ)

- Foundational: T003, T005, T006 [P] (khác file) trước khi T004/T007 khoá GREEN; T008 migration độc lập.
- US1 tests: T009, T010 [P] cùng lúc. UI thuần: T017, T018 [P] trước khi ghép T019/T020.
- Polish: T030, T031, T032 [P].

## MVP

**US1 (Phase 1–3)** = MVP: tạo Tóm tắt có trích dẫn kiểm chứng được, lưu lại. US2/US3 là increment bồi thêm
4 loại + đọc lại bền vững.
