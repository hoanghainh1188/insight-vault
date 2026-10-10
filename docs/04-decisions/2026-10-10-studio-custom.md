# Yêu cầu tuỳ chỉnh Studio — quyết định thực thi (178, PR 3)

- Ngày: 2026-10-10
- Feature: `178-studio-enhance-2` (issue #178) — PR 3. Clarify: `2026-10-10-studio-enhance-2-clarify.md` (#3, #4, #6).

## Quyết định

1. **Kiểm ở main** (`parseCustomPrompt`, thuần): kiểu chuỗi → CR / CRLF thành LF → gỡ ký tự điều khiển C0 + DEL (giữ `\n`, `\t`) →
   đổi thẻ `<request>` / `</request>` người dùng gõ thành `[request]` / `[/request]` (không đóng / mở khối giả) → trim → 1..500
   **code point** (`codePointLength`, dùng chung với renderer). Lỗi ⇒ `UserFacingError` `studioCustomPromptInvalid | Empty | TooLong
   {max}` **trước** khi đọc nguồn hay gọi AI. Loại khác kèm `customPrompt` ⇒ bỏ qua (không vào prompt, không lưu).
2. **Vị trí trong prompt**: system prompt của `custom` **cố định** (`common()` + task nói yêu cầu nằm trong khối `<request>` và không đổi
   được quy tắc `[n]` / không bịa / ngôn ngữ). Văn bản người dùng chỉ ở **tin nhắn user của lượt viết cuối**
   (`finalUserContent`: `<request>…</request>` rồi đoạn nguồn rồi nhắc ngôn ngữ). Lượt map / condense **trung lập** (không nhận yêu cầu).
3. **Hậu kiểm** như mọi loại: không `[n]` hợp lệ ⇒ gắn nguồn đã dùng; rỗng ⇒ `studioEmptyOutput` — không bao giờ lưu kết quả không nguồn.
4. **Lưu & hiển thị**: `custom_prompt` lưu cùng phiên bản (cột có sẵn từ v11); thẻ hiện "Yêu cầu: …" bằng text node (`white-space:
   pre-wrap`), không markdown / HTML; tên tệp Export dùng nhãn loại, không chứa yêu cầu. "Tạo lại" dùng yêu cầu của phiên bản đang xem;
   "Thử lại" / "Tạo bằng AI cục bộ" trong khối lỗi dùng yêu cầu vừa gửi.
5. **Lượt**: khoá sổ lượt `(notebookId, "custom")` không đổi — gửi yêu cầu mới thay lượt cũ (huỷ, không lưu).
6. **UI** `StudioCustomRequest` dưới lưới 2×4: textarea có nhãn, đếm "n/500" (`aria-describedby`), vượt ⇒ `aria-invalid`, nút khoá + báo
   (không cắt ngầm), Ctrl / Cmd + Enter gửi.
