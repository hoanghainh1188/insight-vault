# Tasks: Streaming Chat (039)

Tests-first (Constitution IV). `[P]` = song song.

## Phase 1 — Parse thuần + contract

- [ ] T001 [P] `tests/unit/stream-parse.test.ts` (RED) → `online/stream-parse.ts`: `parseOllamaLine` +
      `sseDeltaOpenAI/Anthropic/Gemini` (delta/[DONE]/rác/rỗng).
- [ ] T002 `shared/ipc/{types,channels}.ts` — `RagStreamTokenEvent`, `RagAskStreamInput`; kênh
      `rag:askStream` + `rag:streamToken` (event) + `rag:stop`.

## Phase 2 — Provider stream (main)

- [ ] T003 `online/online-http.ts` — `streamLines(fetchFn,opts,onLine)` đọc body (I/O, exclude).
- [ ] T004 `ollama-client.ts` — `chat(req,opts?)` stream NDJSON khi onToken (signal→abort).
- [ ] T005 [P] `anthropic/gemini/openai-provider.ts` — `chat(req,opts?)` stream SSE khi onToken.
- [ ] T006 `provider.ts` — cập nhật chữ ký `chat(req, opts?)`.

## Phase 3 — rag-service + IPC (main)

- [ ] T007 [US1] `tests/unit/rag-stream.test.ts` (RED) → `rag-service.askStream`: nối onToken, finalize
      citations, abort giữ phần đã nhận, grounded-notfound.
- [ ] T008 [US1] `rag-service.ts` — `askStream` + deps `chatStream`.
- [ ] T009 [US1] `main/index.ts` wire chatStream (getActive().chat opts) + AbortController theo streamId.
- [ ] T010 [US1] `register.ts` — `rag:askStream` (emit token) + `rag:stop` (abort); KHÔNG log.
- [ ] T011 [P] `tests/unit/*ipc*` — whitelist +3 kênh.
- [ ] T012 `preload/index.ts` — ragAskStream/onRagStreamToken/ragStop.

## Phase 4 — Renderer (US1/US2)

- [ ] T013 [US1] `useChat.ts` — send streaming (streamId, placeholder, sub token, finalize; huỷ stream cũ).
- [ ] T014 [US2] `useChat.ts` + `ChatColumn.tsx` — `stop()` + nút Dừng thay Gửi khi stream.
- [ ] T015 [US1] `MessageBubble.tsx` + CSS — render streaming text + con trỏ (reduced-motion), final markdown.

## Phase 5 — Polish

- [ ] T016 e2e `streaming.spec.ts` — whitelist ragAskStream/ragStop; GIỮ e2e cũ xanh.
- [ ] T017 Coverage include (stream-parse, rag-service) ≥80%.
- [ ] T018 Gate: lint + test + build + e2e.

## MVP

US1 (stream + chip cuối) lõi P1; US2 (Dừng) P1; US3 (an toàn) bất biến.
