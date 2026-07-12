# chat-history clarify — chốt 6 ambiguity (027-chat-history)

- Ngày: 2026-07-12
- Feature: `027-chat-history` (issue #27)
- Nguồn: `docs/intake/027-chat-history.md` + yêu cầu người dùng
- Người quyết định: hoanghainh1188 (2026-07-12) — "chốt luôn khuyến nghị".

## Quyết định

**1. Persist ở MAIN (side-effect của rag:ask).** rag-service.ask persist cặp (user, assistant) sau khi sinh
xong, qua dep `saveTurn` (chat-repo mới). Renderer KHÔNG gọi kênh save riêng — chỉ nạp qua `chat:history`.

**2. Lưu cặp SAU khi answer xong.** Answer thành công (kể cả notFound) → lưu cả user + assistant. Answer lỗi
(ném) → KHÔNG lưu gì (tránh câu hỏi mồ côi; người dùng hỏi lại).

**3. 1 dòng lịch sử tuyến tính/notebook.** Không đa phiên (MVP).

**4. Lưu mỗi message:** `role` (user|assistant) · `content` · `citations_json` (assistant) · `not_found`
(assistant) · `created_at`. KHÔNG lưu `mode` (toggle UI, không thuộc lịch sử).

**5. Kênh IPC:** `chat:history {notebookId}` → danh sách message (nạp khi mở) + `chat:clear {notebookId}` →
`{cleared:true}` (nút "Xoá hội thoại"). `rag:ask` GIỮ chữ ký (persist là side-effect nội bộ main).

**6. History → LLM:** `useChat` nạp lịch sử từ DB khi mở notebook → gửi làm `history` cho rag:ask như cũ
(main cắt `MAX_HISTORY_TURNS`). KHÔNG đổi logic cắt.

## Điểm chạm

- Migration #4 (user_version 3→4): bảng `chat_message(id, notebook_id FK→notebook ON DELETE CASCADE, role
CHECK(user|assistant), content, citations_json, not_found INTEGER, created_at)` + index notebook.
- `src/main/services/rag/chat-repo.ts` (MỚI): `saveTurn(notebookId, user, assistant)` · `listByNotebook` ·
  `clear(notebookId)`. THUẦN/DI, test `:memory:`.
- `rag-service.ts`: thêm dep `saveTurn`; ask persist sau khi có answer (không log content).
- `channels/types`: kênh `chat:history` + `chat:clear`; type `ChatHistoryMessage` (hoặc tái dùng RagTurn +
  citations).
- `register.ts` + `index.ts` (wire chat-repo) + `preload` (chatHistory/chatClear).
- `useChat.ts`: nạp lịch sử khi đổi notebook (thay reset [] hiện tại) + nút Xoá hội thoại (ChatColumn).

## Hệ quả

- Migration #4 (đầu tiên sau #3 studio). `security-reviewer` chạy (DB + nội dung hội thoại).
- Ngoài phạm vi: streaming, markdown, đa phiên.
