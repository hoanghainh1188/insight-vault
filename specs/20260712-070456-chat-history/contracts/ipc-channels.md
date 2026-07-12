# IPC Contract — Chat history (027)

THÊM 2 kênh invoke whitelisted. `rag:ask` GIỮ chữ ký (persist là side-effect nội bộ main). `register.ts`
`safeHandle` (không catch-all), KHÔNG log content.

## Kênh mới

| Hằng (CHANNELS) | Tên chuỗi      | Request          | Response              |
| --------------- | -------------- | ---------------- | --------------------- |
| `chatHistory`   | `chat:history` | `{ notebookId }` | `StoredChatMessage[]` |
| `chatClear`     | `chat:clear`   | `{ notebookId }` | `{ cleared: true }`   |

### `chat:history`

- Main: `chatRepo.listByNotebook(notebookId)` → `StoredChatMessage[]` (ORDER created_at ASC; parse
  citations_json). KHÔNG gọi LLM.

### `chat:clear`

- Main: `chatRepo.clear(notebookId)` → `{ cleared: true }`.

### `rag:ask` (không đổi contract)

- Sau khi sinh answer: main persist cặp (user question, assistant answer) qua `chatRepo.saveTurn`
  (best-effort try/catch). Answer lỗi (chat throw) → ask throw TRƯỚC persist → không lưu.

## channels.ts / preload

```ts
CHANNELS: { ..., chatHistory: "chat:history", chatClear: "chat:clear" }
ChannelResponse: { [chatHistory]: StoredChatMessage[]; [chatClear]: { cleared: true } }
// preload:
chatHistory: (notebookId) => invoke(CHANNELS.chatHistory, { notebookId }),
chatClear: (notebookId) => invoke(CHANNELS.chatClear, { notebookId }),
```

Whitelist test: `isWhitelisted("chat:history")` + `isWhitelisted("chat:clear")` === true; size +2.

## Bảo mật (Constitution III)

- Đọc/ghi `chat_message` CHỈ ở main; renderer qua 2 kênh whitelisted. `rag:ask` persist nội bộ.
- KHÔNG log content/citations/nội dung hội thoại (register + rag-service + chat-repo). Vector thô không ra
  renderer.
