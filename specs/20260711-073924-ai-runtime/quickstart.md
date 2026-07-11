# Quickstart — AI Runtime (validation guide)

Chạy & kiểm chứng feature ai-runtime. Chi tiết entity/contract: `data-model.md`, `contracts/ipc-channels.md`.

## Prerequisites

- Node LTS + npm; đã `npm install`.
- **Ollama** cài + chạy trên máy (macOS/Windows) cho các kịch bản gọi model thật: https://ollama.com
  ```bash
  ollama serve                 # nếu chưa chạy nền
  ollama pull qwen2.5:7b       # 1 chat model
  ollama pull nomic-embed-text # 1 embedding model
  ```
- Không có Ollama vẫn chạy được unit test (dùng fake fetch) và test onboarding "chưa sẵn sàng".

## Setup & run

```bash
npm run dev
npm run lint            # prettier + eslint + tsc
npm test                # Vitest unit + coverage (không cần Ollama)
npm run build
npm run test:e2e        # Playwright _electron (cần bản build + display)
```

## Validation scenarios (map spec)

| #   | Kịch bản                               | Cách kiểm                                           | Kỳ vọng                                           | Ref                |
| --- | -------------------------------------- | --------------------------------------------------- | ------------------------------------------------- | ------------------ |
| V1  | Provider chat/embed/test (Ollama chạy) | Unit (fake fetch) + thủ công với Ollama thật        | chat → text; embed → vector; test → ready         | US1, SC-001        |
| V2  | Swap provider qua registry             | Unit: đăng ký provider giả → gọi qua cùng interface | Không sửa nơi gọi AI                              | US1, SC-006        |
| V3  | Liệt kê model động                     | Mở Cài đặt (Ollama chạy)                            | Danh sách khớp `ollama list`; 0 model hard-code   | US2, SC-003        |
| V4  | Chọn & lưu model                       | Chọn chat+embedding → đóng/mở lại app               | Lựa chọn giữ nguyên                               | US2, SC-002        |
| V5  | Kiểm tra kết nối                       | Bấm "kiểm tra kết nối" (Ollama on/off)              | Trạng thái đúng tại thời điểm bấm                 | US2, FR-007        |
| V6  | Onboarding chưa sẵn sàng               | Tắt Ollama → mở app lần đầu                         | Hướng dẫn + nút "cài sau"; bấm → vào app giới hạn | US3, SC-004        |
| V7  | Renderer isolation + whitelist         | e2e: window.api có 5 hàm ai; gọi kênh ai lạ         | Không gọi Ollama trực tiếp; kênh lạ bị từ chối    | US4, SC-005        |
| V8  | Privacy vẫn local                      | e2e/thủ công khi dùng Ollama                        | Badge "Chạy cục bộ"                               | US4, FR-014        |
| V9  | Ollama tắt giữa phiên                  | Tắt Ollama → listModels/test                        | Trả rỗng/"không kết nối"; app không crash         | Edge cases, FR-015 |

## Done

- Unit ≥ 80% business logic (ollama-client/provider/registry/model-selection/runtime-status).
- e2e whitelist + isolation + privacy xanh.
- Với Ollama thật: chat/embed/list/select hoạt động (kiểm thủ công V1/V3/V4).
