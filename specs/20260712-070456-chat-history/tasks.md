# Tasks: Chat history (lưu lịch sử hội thoại theo notebook)

**Feature**: `027-chat-history` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Cách tiếp cận**: Test-First (Constitution IV, ≥80%). `chat-repo` thuần/DI (`:memory:`) unit-test. `[P]` =
song song (khác file). Chống hồi quy: giữ mọi e2e cũ xanh (SC-005).

**Nguồn**: [research.md](./research.md) (R1–R5), [data-model.md](./data-model.md),
[contracts/ipc-channels.md](./contracts/ipc-channels.md). Clarify `2026-07-12-chat-history-clarify.md`.

**CRUX**: `chat-repo` (saveTurn cặp nguyên tử + FK CASCADE + khứ hồi citations) + persist best-effort trong
rag-service (answer lỗi → không lưu).

---

## Phase 1: Setup

- [X] T001 [P] Cập nhật `vitest.config.ts`: include `src/main/services/rag/chat-repo.ts`.

## Phase 2: Foundational (migration + types + kênh — CHẶN US)

- [X] T002 [P] Shared types `src/shared/ipc/types.ts`: THÊM `StoredChatMessage{role,content,citations,notFound,createdAt}`.
- [X] T003 [P] Test whitelist `tests/unit/chat-channels-whitelist.test.ts` — `chat:history`+`chat:clear` whitelisted; size +2; kênh ngoài bị từ chối (RED).
- [X] T004 Thêm kênh `chat:history`+`chat:clear` vào `src/shared/ipc/channels.ts` (`CHANNELS`+`ChannelResponse`) → T003 GREEN.
- [X] T005 Migration #4 (user_version 3→4) trong `src/main/db/migrations.ts`: bảng `chat_message` (id PK, notebook_id FK→notebook CASCADE, role CHECK(user|assistant), content, citations_json DEFAULT '[]', not_found INTEGER DEFAULT 0, created_at) + index (notebook_id, created_at). Append-only.

**Checkpoint**: schema + types + kênh sẵn sàng.

---

## Phase 3: User Story 1+3 — Lưu & nạp & xoá (P1) 🎯 MVP

**Goal**: persist mỗi lượt → nạp lại khi mở notebook → chip mở đúng đoạn; xoá hội thoại.

**Independent Test**: hỏi ở A → sang B → về A → thấy lại; xoá → rỗng.

### Tests (RED)

- [X] T006 [P] [US1] `tests/unit/chat-repo.test.ts` — DI `:memory:` chạy #1→#4: `saveTurn` ghi 2 hàng (user+assistant, thứ tự created_at); `listByNotebook` khứ hồi `citations`/`notFound` đúng; `clear` xoá hết notebook đó (giữ notebook khác); xoá notebook → CASCADE 0 hàng (RED).

### Implementation

- [X] T007 [US1] Viết `src/main/services/rag/chat-repo.ts`: `createChatRepo(db,deps)` → `saveTurn`/`listByNotebook`/`clear` + (de)serialize citations_json → T006 GREEN.
- [X] T008 [US1] Sửa `src/main/services/rag/rag-service.ts`: thêm dep `saveTurn`; refactor `ask` gom 4 return → 1 `result`, persist best-effort (try/catch, không log) TRƯỚC return; answer lỗi (chat throw) → không tới persist.
- [X] T009 [US1] `src/main/ipc/register.ts`: THÊM safeHandle `chat:history` (chatRepo.listByNotebook) + `chat:clear` (chatRepo.clear). KHÔNG log content.
- [X] T010 [US1] `src/main/index.ts`: khởi tạo `chat-repo` (db) → truyền `saveTurn` vào `createRagService` + truyền chatRepo vào register.
- [X] T011 [US1] `src/preload/index.ts`: THÊM `chatHistory(notebookId)` + `chatClear(notebookId)`.
- [X] T012 [US1] `src/renderer/features/rag-qa/useChat.ts`: effect đổi-notebook nạp `chatHistory` (thay `setMessages([])`); thêm `clearHistory()` gọi `chatClear` → `setMessages([])`.
- [X] T013 [US3] `src/renderer/features/rag-qa/ChatColumn.tsx` + css: nút "Xoá hội thoại" (hiện khi có ≥1 lượt) gọi `clearHistory`.
- [X] T014 [US1] e2e `tests/e2e/chat-history.spec.ts` (tất định): whitelist `chatHistory`/`chatClear`; `chat:clear` trên notebook trả `{cleared:true}`; `chat:history` notebook mới → []. (Persist qua hỏi đáp cần Ollama → unit chat-repo + thủ công.)

**Checkpoint**: hội thoại lưu/nạp/xoá được.

---

## Phase 4: US2 — Multi-turn dùng lịch sử (P2)

- [X] T015 [US2] Xác nhận `useChat.send` build `history` từ `messages` đã nạp (không đổi logic cắt MAX_HISTORY_TURNS ở main). Không cần code mới nếu T012 nạp đúng — chỉ verify + (nếu cần) test.

**Checkpoint**: multi-turn hưởng lịch sử đã nạp.

---

## Phase 5: Chống hồi quy + gate

- [X] T016 Chạy TOÀN BỘ e2e cũ (15 spec) — SC-005 (0 hồi quy). rag-qa multi-turn/citation vẫn đúng.
- [X] T017 [P] Rà `rag-service.ts`/`chat-repo.ts`/`register.ts`: KHÔNG log content/citations (Constitution III/FR-009). `no-egress.spec` xanh (SC-006).
- [X] T018 Chạy `npm run lint` + `npm run test` (coverage ≥80%: chat-repo + whitelist) + `npm run build` xanh; cập nhật `[X]`.

---

## Dependencies & thứ tự

- Setup (T001) → Foundational (T002–T005) CHẶN US.
- US1+3 (T006–T014): repo test → repo → rag-service persist → IPC/preload → useChat/ChatColumn → e2e.
- US2 (T015) verify sau T012. Gate (T016–T018) sau cùng.

## Song song

- Foundational: T002, T003 [P]. US1: T006 (test) [P] với T002.

## MVP

**US1+3 (Phase 1–3)** = MVP: lưu/nạp/xoá hội thoại. US2 chỉ verify.
