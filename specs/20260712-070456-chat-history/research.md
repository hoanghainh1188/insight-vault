# Research — Chat history (027)

6 ambiguity chốt ở clarify. Mục này chốt kỹ thuật + xác nhận điểm chạm 013.

## R1 — chat-repo (THUẦN/DI, như studio-repo 021)

- **Decision**: `createChatRepo(db, {now?, uuid?})` →
  - `saveTurn(notebookId, userContent, assistant: {content, citations, notFound})` — INSERT 2 hàng (user
    role, assistant role) trong 1 transaction; assistant lưu `citations_json` + `not_found`.
  - `listByNotebook(notebookId)` → `StoredChatMessage[]` ORDER created_at ASC.
  - `clear(notebookId)` → DELETE mọi hàng của notebook.
- **Rationale**: pattern y `studio-repo` (test `:memory:`). Transaction để cặp user+assistant nguyên tử.

## R2 — Persist trong rag-service (best-effort, sau answer)

- **Decision**: thêm dep `saveTurn` vào `RagServiceDeps`. `ask` refactor: tách tính answer → `result:
RagAnswer`, rồi `try { await deps.saveTurn(notebookId, question, result); } catch { /* không phá answer,
không log content */ }` → `return result`. Các return sớm (grounded-notFound không gọi model) VẪN lưu (là
  lượt hoàn tất). `deps.chat` ném → ask ném TRƯỚC persist → không lưu (đúng A2).
- **Rationale**: 1 nơi persist, không đổi giao diện `rag:ask`. Best-effort: DB lỗi không làm mất câu trả lời
  người dùng đang xem.
- **Xác nhận**: `ask` hiện có 4 return (rag-service.ts:32,53,63,66,73) → gom về 1 `result` + persist + return.

## R3 — StoredChatMessage (shared type)

- **Decision**: `StoredChatMessage { role: "user"|"assistant"; content: string; citations: Citation[];
notFound: boolean; createdAt: number }`. `chat:history` trả `StoredChatMessage[]`. Renderer map sang
  `ChatMessage` (useChat) khi hiển thị (role/content/citations/notFound khớp sẵn).
- **Rationale**: khớp `useChat.ChatMessage` (role/content/citations?/notFound?) → nạp lại 1-1.

## R4 — useChat nạp lịch sử

- **Decision**: effect đổi-notebook hiện `setMessages([])` → thay bằng nạp `chat:history(notebookId)` →
  `setMessages(mapped)`. `send` giữ nguyên (main tự persist). Thêm `clearHistory()` gọi `chat:clear` →
  `setMessages([])`. History gửi rag:ask vẫn build từ `messages` (đã nạp) như cũ.
- **Rationale**: điểm chạm nhỏ; multi-turn tự hưởng lịch sử đã nạp.

## R5 — Migration #4

- **Decision**: `chat_message(id TEXT PK, notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE
CASCADE, role TEXT CHECK(role IN ('user','assistant')), content TEXT NOT NULL, citations_json TEXT NOT
NULL DEFAULT '[]', not_found INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)` + index
  `(notebook_id, created_at)`. user_version 3→4.
- **Rationale**: FK cascade (FR-007). `citations_json`/`not_found` chỉ ý nghĩa với assistant (user để mặc
  định []/0).

## Tổng kết

Không NEEDS CLARIFICATION. Migration #4. Không dependency. Điểm chạm 013: rag-service (dep + persist) +
useChat (nạp/xoá). chat-repo thuần test kỹ (crux = cascade + khứ hồi citations).
