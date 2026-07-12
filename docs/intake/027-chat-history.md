# Design intake — 027-chat-history

- Feature: `027-chat-history` (issue #27) — lưu lịch sử hội thoại theo notebook
- Nguồn: yêu cầu người dùng (2026-07-12) + roadmap bước 3 (phần lưu lịch sử; streaming để riêng).
- Kế thừa 013-rag-qa (useChat in-memory + rag:ask), 011 (migration runner + FK cascade).
- Blocked-by: không.

## Bối cảnh

Chat lưu hội thoại IN-MEMORY theo phiên (`useChat`), đóng/đổi notebook là mất. Muốn mở lại notebook thấy
lại đoạn hội thoại cũ. Multi-turn hiện gửi in-memory history cho LLM — sau khi persist, history nạp từ DB.

## Phạm vi

- Migration #4: bảng `chat_message` (notebook_id FK cascade, role, content, citations_json, not_found,
  created_at).
- Lưu mỗi lượt (user + assistant) sau khi rag:ask hoàn tất.
- Nạp lịch sử khi mở notebook → `useChat` hiển thị lại + dùng làm history multi-turn.
- Nút "Xoá hội thoại" của notebook.

## Ambiguities (cho /speckit-clarify)

**#1 Nơi persist — trong main như side-effect của rag:ask (khuyến nghị).** rag-service.ask có sẵn
`notebookId` + question + answer + citations → persist cặp (user, assistant) SAU khi sinh xong (kể cả
notFound). Renderer KHÔNG gọi kênh save riêng — chỉ nạp qua `chat:history` khi mở. → thêm dep `saveTurn` vào
RagServiceDeps + chat-repo mới. Phương án khác: renderer tự gọi chat:save (thêm round-trip, dễ lệch). Chọn
persist ở main.

**#2 Lưu câu hỏi khi nào — user turn lưu NGAY (khuyến nghị).** Persist user message ngay khi gửi (để reload
vẫn thấy câu hỏi dù answer lỗi); assistant persist khi có kết quả. → hoặc đơn giản hơn: lưu cả cặp sau khi
answer xong (nếu lỗi thì không lưu gì). Khuyến nghị: lưu cặp sau khi xong (đơn giản, tránh câu hỏi mồ côi
không answer); answer lỗi → không lưu (người dùng hỏi lại).

**#3 Đa phiên/notebook — KHÔNG (khuyến nghị).** 1 dòng lịch sử tuyến tính/notebook (MVP). Nhiều phiên hội
thoại để sau.

**#4 Lưu gì mỗi message.** role (user|assistant) · content · citations_json (assistant) · not_found
(assistant) · created_at. KHÔNG lưu `mode` (là toggle UI hiện tại, không thuộc lịch sử). Khuyến nghị vậy.

**#5 Kênh IPC.** `chat:history {notebookId}` → `RagTurn[]`/`ChatMessage[]` (nạp) + `chat:clear {notebookId}`
→ `{cleared:true}`. `rag:ask` giữ chữ ký (persist là side-effect nội bộ). Khuyến nghị.

**#6 History gửi LLM.** Sau persist, `useChat` nạp lịch sử → gửi làm `history` cho rag:ask như cũ (main cắt
MAX_HISTORY_TURNS). KHÔNG đổi logic cắt. Khuyến nghị.

## Prompt for /speckit-specify (rút gọn — hoàn chỉnh sau clarify)

> Lưu lịch sử hội thoại Chat theo notebook cho InsightVault (kế thừa 013-rag-qa). Migration #4 bảng
> chat_message (notebook_id FK cascade, role, content, citations_json, not_found, created_at). Persist cặp
> user+assistant SAU khi rag:ask sinh xong (side-effect ở main qua chat-repo; answer lỗi → không lưu). Nạp
> lịch sử khi mở notebook (chat:history) → hiển thị lại + dùng làm history multi-turn. Nút "Xoá hội thoại"
> (chat:clear). 1 dòng lịch sử tuyến tính/notebook. Ràng buộc: Constitution I (SQLite local, không egress),
> II (lưu citations giữ kiểm-chứng-được), III (đọc/ghi DB CHỈ ở main, renderer qua kênh whitelisted, KHÔNG
> log nội dung), IV (test-first). Ngoài phạm vi: streaming, markdown, đa phiên/notebook.
