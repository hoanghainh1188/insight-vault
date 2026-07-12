# Data Model — Chat history (027)

## Bảng mới: `chat_message` (migration #4, user_version 3→4)

| Cột              | Kiểu    | Ràng buộc                                             | Ý nghĩa                             |
| ---------------- | ------- | ----------------------------------------------------- | ----------------------------------- |
| `id`             | TEXT    | PRIMARY KEY                                           | uuid                                |
| `notebook_id`    | TEXT    | NOT NULL, REFERENCES `notebook(id)` ON DELETE CASCADE | Notebook chứa lượt                  |
| `role`           | TEXT    | NOT NULL, CHECK(role IN ('user','assistant'))         | Vai trò                             |
| `content`        | TEXT    | NOT NULL                                              | Nội dung tin                        |
| `citations_json` | TEXT    | NOT NULL DEFAULT '[]'                                 | `Citation[]` (assistant); user = [] |
| `not_found`      | INTEGER | NOT NULL DEFAULT 0                                    | Cờ không-tìm-thấy (assistant)       |
| `created_at`     | INTEGER | NOT NULL                                              | Mốc thời gian (thứ tự hiển thị)     |

Index `(notebook_id, created_at)`. Xoá theo notebook qua FK CASCADE (FR-007).

## Kiểu IPC (shared/ipc/types.ts) — THÊM

```ts
export interface StoredChatMessage {
  role: "user" | "assistant";
  content: string;
  citations: Citation[]; // assistant; user = []
  notFound: boolean;
  createdAt: number;
}
```

`Citation`/`Locator` tái dùng (013). Renderer `ChatMessage` (useChat) map 1-1 (role/content/citations?/
notFound?).

## Kiểu nội bộ main

- `chat-repo`: `saveTurn(notebookId, userContent, {content, citations, notFound})` (2 hàng, 1 transaction) ·
  `listByNotebook(notebookId): StoredChatMessage[]` · `clear(notebookId)`.
- `rag-service` dep `saveTurn(notebookId, question, answer: RagAnswer)`.

## Validation

- `role` ∈ {user, assistant} (CHECK). `citations_json` parse an toàn khi đọc → [] nếu hỏng.
- Persist best-effort (DB lỗi → catch, không phá answer, không log content).

## State (một lượt)

```text
send(question) → rag:ask (main) → answer OK → persist(user+assistant) → renderer append (đã có)
                                 → answer LỖI (chat throw) → KHÔNG persist → renderer hiện error
mở notebook → chat:history → setMessages(nạp lại)
Xoá hội thoại → chat:clear → setMessages([])
```
