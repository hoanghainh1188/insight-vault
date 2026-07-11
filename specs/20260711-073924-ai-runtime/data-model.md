# Data Model — AI Runtime (Phase 1)

Kiểu trao đổi qua IPC + kiểu nội bộ main (định nghĩa ở `src/shared/ipc/types.ts` cho phần qua IPC).
Không có bảng DB (electron-store cho ModelSelection; RAG/metadata ở feature sau).

## Model

| Field       | Kiểu                                 | Ghi chú                                                |
| ----------- | ------------------------------------ | ------------------------------------------------------ |
| `name`      | `string`                             | Tên model Ollama (vd `qwen2.5:7b`, `nomic-embed-text`) |
| `sizeBytes` | `number \| null`                     | Kích thước nếu Ollama trả về                           |
| `kind`      | `'chat' \| 'embedding' \| 'unknown'` | Suy đoán từ tên/metadata; UI lọc theo kind             |

- Nguồn: `GET /api/tags` của Ollama → map sang `Model[]`. Không hard-code (FR-004, SC-003).

## ModelSelection

| Field            | Kiểu             | Ràng buộc                                     |
| ---------------- | ---------------- | --------------------------------------------- |
| `chatModel`      | `string \| null` | Tên chat model đã chọn; null = chưa chọn      |
| `embeddingModel` | `string \| null` | Tên embedding model đã chọn; null = chưa chọn |

- Lưu bền: `electron-store` key `ai.modelSelection` (A1). Đọc lỗi/hỏng → `{ chatModel:null, embeddingModel:null }` (edge case).

## RuntimeStatus

| Field         | Kiểu             | Ghi chú                                                                      |
| ------------- | ---------------- | ---------------------------------------------------------------------------- |
| `reachable`   | `boolean`        | Ping Ollama (`/api/tags`) thành công trong timeout                           |
| `ollamaReady` | `boolean`        | `reachable` AND chatModel & embeddingModel đã chọn + tồn tại trong danh sách |
| `reason`      | `string \| null` | Lý do khi chưa sẵn sàng (không kết nối / chưa chọn model / model thiếu)      |

- Nguồn sự thật cho onboarding (US3) và Cài đặt (US2). Tách khỏi `OnboardingState` của app-shell (A4/A5).

## LLMProvider (interface — nội bộ main, không qua IPC)

```
LLMProvider {
  id: string
  chat(req: ChatRequest): Promise<ChatResult>
  embed(req: EmbedRequest): Promise<EmbedResult>
  test(): Promise<RuntimeStatus>
}
```

| Kiểu           | Field                                            | Ghi chú                                   |
| -------------- | ------------------------------------------------ | ----------------------------------------- |
| `ChatRequest`  | `{ messages: {role,content}[], model?: string }` | model mặc định = selection.chatModel      |
| `ChatResult`   | `{ content: string }`                            | Nội dung trả lời                          |
| `EmbedRequest` | `{ text: string, model?: string }`               | model mặc định = selection.embeddingModel |
| `EmbedResult`  | `{ vector: number[] }`                           | Vector embedding                          |

- `ChatRequest.messages` / `text` là **nội dung người dùng** → KHÔNG log payload (Constitution III, `redact`).
- Provider chat/embed **không** expose thẳng qua IPC ở feature này (chưa có chat UI — 005); registry dùng
  nội bộ + test qua unit. IPC feature này chỉ gồm list/test/selection/status (xem contracts).

## ProviderRegistry (nội bộ main)

| Thao tác             | Ghi chú                                  |
| -------------------- | ---------------------------------------- |
| `register(provider)` | Đăng ký provider                         |
| `getActive()`        | Lấy provider đang hoạt động (v1: Ollama) |
| `setActive(id)`      | Chuyển provider active (nền cho 008)     |

## Ghi chú thuật ngữ

Term mới (`AI runtime`, `model`, `chat model`, `embedding model`, `connection test`, `ProviderRegistry`)
sẽ append `docs/00-glossary.md` ở bước glossary-steward (rule 5 — trong branch feature).
