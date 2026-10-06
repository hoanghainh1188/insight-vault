# crash-report clarify (093)

- Ngày: 2026-10-06
- Feature: `093-crash-report` (issue #93)
- Nguồn: backlog cải tiến 2026-07-15 (mục TRUNG BÌNH "crash reporting opt-in"); người dùng chốt 2 câu hỏi.
- Tiếp nối: 088 app-log (`main.log` JSON lines đã qua `redact` + che thư mục nhà; `renderer.error`,
  `runtime.uncaught`, `renderer.gone`, `childProcess.gone`; nút Mở thư mục nhật ký).
- Ràng buộc: **Constitution I** (Local-first & No Default Egress, NON-NEGOTIABLE) — không telemetry gửi nội
  dung người dùng ra ngoài nếu không được yêu cầu tường minh; privacy indicator phải đúng thực tế.

## Quyết định (người dùng chốt)

**1. Kênh gửi = GitHub issue soạn sẵn, người dùng tự gửi.**

- App soạn báo cáo văn bản đã làm sạch: phiên bản app/Electron, HĐH + kiến trúc, các sự kiện lỗi gần đây đọc
  từ `main.log` (meta đã redact ở lúc ghi; khi soạn báo cáo lọc lại lần nữa), tóm tắt crash native.
- Người dùng **xem trước và sửa được** toàn bộ nội dung → bấm "Mở GitHub để gửi" ⇒ main mở trình duyệt mặc
  định tới trang tạo issue của repo với tiêu đề + nội dung điền sẵn. Người dùng bấm Submit trên GitHub.
- App **không tự kết nối mạng** để gửi ⇒ không đổi privacy indicator (dữ liệu đi qua trình duyệt do người dùng
  chủ động). URL đích **cố định ở main**; renderer chỉ gửi nội dung (có giới hạn độ dài).
- Có thêm "Sao chép" để dán vào email/kênh khác.
- _Loại bỏ:_ Sentry/dịch vụ bên thứ ba gửi tự động (dữ liệu ở bên thứ ba, cần tài khoản/DSN, ngược tinh thần
  local-first); "chỉ lưu cục bộ, không có luồng gửi" (tốn công người dùng nhất).

**2. Crash native = Electron `crashReporter` chỉ lưu cục bộ (`uploadToServer: false`).**

- Minidump chứa bộ nhớ tiến trình ⇒ có thể chứa nội dung tài liệu đang mở ⇒ **không bao giờ tự rời máy, không
  đính kèm vào báo cáo**. Báo cáo chỉ nêu số crash native + thời điểm gần nhất. Nhà phát triển cần dump thì
  người dùng tự gửi (thư mục nhật ký).
- _Loại bỏ:_ không bắt crash native (mất dấu vết khi tiến trình chết hẳn).

## Hệ quả thiết kế (đề xuất, không cần hỏi lại)

- "Opt-in" = **mỗi lần gửi đều do người dùng bấm**; không có cài đặt "tự gửi".
- Phát hiện phiên trước kết thúc bất thường bằng tệp đánh dấu phiên trong thư mục nhật ký (tạo lúc khởi động,
  xoá khi thoát sạch) ⇒ lần mở sau hiện thông báo nhẹ "Lần trước InsightVault đóng bất thường" (Xem & gửi /
  Bỏ qua). Không chặn thao tác.
- Giới hạn độ dài nội dung theo giới hạn URL của GitHub; vượt thì cắt bớt các dòng cũ + ghi chú.
