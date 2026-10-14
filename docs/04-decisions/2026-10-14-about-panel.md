# Hộp "Giới thiệu" mặc định của hệ điều hành: thêm thông tin (213)

- Ngày: 2026-10-14
- Feature: `213-about-dialog` (issue #213). Trạng thái: **Đã chấp nhận** (chủ dự án chốt phạm vi 2026-10-14).
- Phạm vi: chỉ cấu hình lại hộp Giới thiệu MẶC ĐỊNH của hệ điều hành bằng `app.setAboutPanelOptions` — KHÔNG làm hộp thoại riêng trong app.

## Quyết định

1. **Dùng hộp mặc định** (`role: "about"`), nạp nội dung qua `setAboutPanelOptions` (tên, phiên bản, kiến trúc, bản quyền, icon, và `credits` — macOS + Windows): cam kết riêng tư/local-first, giấy phép + tác giả, bản dựng (Electron/Chromium/Node, đóng gói hay phát triển), model AI đang dùng (tên + phiên bản), thư viện mã nguồn mở (tên + phiên bản + giấy phép).
2. **Song ngữ vi/en**, dựng lại cùng menu khi đổi ngôn ngữ giao diện (`applyAppMenu`).
3. **Windows chưa có mục Giới thiệu** ⇒ thêm menu **Trợ giúp** với `role: "about"`.
4. **Danh sách thư viện sinh từ package.json của chính các gói** (đọc `dependencies` + `node_modules/<gói>/package.json`, kể cả trong asar) — không gõ tay, không cần bước build; test đối chiếu với `dependencies`.
5. Không đường dẫn người dùng, không IPC mới, không mạng.

## Đánh đổi (so với hộp thoại riêng trong app, đã làm thử rồi bỏ — tag `backup/213-in-app-dialog`)

- Không có nút "Sao chép thông tin"; không có trạng thái "đã tải / chưa tải" của model (hộp mặc định tĩnh); không lọc thư viện.
- Đổi lại: không IPC mới, không UI mới, ít mã hơn nhiều, giao diện đúng chuẩn từng hệ điều hành.

## Ghi chú giấy phép

`ffmpeg-static` khai báo `GPL-3.0-or-later` (nhị phân ffmpeg đóng kèm) — sẽ hiện thật trong danh sách. Chủ dự án nên cân nhắc trước khi phát hành.
