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
7. **Sau review (2026-10-10)**:
   - Hardening (security-reviewer): gỡ thêm C1, ký tự định hướng hai chiều, zero-width / BOM; chặn chuỗi thô > 4.256 đơn vị UTF-16
     trước regex; vô hiệu cả thẻ `<request …>` có thuộc tính / tự đóng; `finalUserContent` vô hiệu thẻ `<request>` trong **đoạn
     nguồn** (indirect injection từ tài liệu).
   - B1 (code-reviewer): "Thử lại" / "Tạo bằng AI cục bộ" của `custom` dùng yêu cầu của **lượt vừa lỗi** (ghi ở mọi lượt custom —
     gửi từ ô nhập hoặc "Tạo lại"), xoá khi đổi notebook; nháp ô nhập gắn `key={notebookId}`; Ctrl/Cmd+Enter bỏ qua khi đang gõ IME.
   - Chưa làm (ghi nhận): bộ chọn phiên bản `custom` chưa hiện trích đoạn yêu cầu (thẻ đã hiện sau khi chọn — quyết định sản phẩm);
     `studio:generate` không có `generationId` thì không supersede và `kind` vào sổ lượt trước khi service kiểm — có từ trước #178,
     để hardening chung của IPC Studio.
