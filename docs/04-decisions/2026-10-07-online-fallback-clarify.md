# online-fallback clarify (098)

- Ngày: 2026-10-07
- Feature: `098-online-fallback` (issue #98)
- Nguồn: hạn chế đã biết "AI online lỗi KHÔNG auto-fallback" (backlog 2026-07-15); người dùng chốt 2 câu hỏi.
- Liên quan: **ADR 2026-07-12-online-provider-clarify #5** — "Lỗi/timeout/rate-limit: BÁO LỖI RÕ, KHÔNG
  auto-fallback về Ollama" (im lặng đổi provider vi phạm Principle I). Quyết định này **bổ sung, không thay** #5.

## Quyết định (người dùng chốt)

**1. Nút một chạm, KHÔNG tự chuyển.** Khi lượt hỏi/tạo Studio lỗi do provider online (`OnlineProviderError`:
auth / rate-limit / timeout / network / server / unknown), UI hiện lỗi rõ (như 031) KÈM 2 nút:
- **"Trả lời bằng AI cục bộ"** (Studio: "Tạo bằng AI cục bộ") — chạy lại ĐÚNG lượt đó bằng Ollama.
- **"Thử lại"** — chạy lại bằng provider đang bật.

Provider online đang bật **không đổi**; lượt sau vẫn dùng online. Người dùng luôn chủ động chọn ⇒ không vi phạm
#5 / Principle I.

- _Loại bỏ:_ tự chuyển + báo rõ (thay #5 — người dùng muốn giữ quyền chọn); công tắc trong Cài đặt (thêm cấu hình
  cho một tình huống hiếm, mặc định tắt thì ít người biết).

**2. Phạm vi: Chat + Studio** (4 loại tổng hợp).

## Hệ quả thiết kế (không cần hỏi lại)

- Lượt "AI cục bộ" dùng Ollama cho **mọi** lệnh gọi LLM của lượt đó — gồm cả bước viết lại câu hỏi (055) — để
  không có lệnh nào ra ngoài khi người dùng đã chọn cục bộ. Embedding vốn luôn cục bộ (059).
- Câu trả lời / kết quả Studio tạo bằng nút này được gắn nhãn **"AI cục bộ"** trong phiên (minh bạch nguồn trả
  lời). Không thêm migration: nhãn không lưu bền (lịch sử tải lại hiển thị như câu trả lời thường).
- Chỉ lỗi **của provider online** mới hiện nút (lỗi khác — Ollama chưa chạy, đầu vào sai — giữ nguyên thông báo
  cũ). Main gắn thẻ loại lỗi vào thông điệp IPC; renderer tách thẻ ra, không hiện cho người dùng.
- Ollama chưa sẵn sàng khi bấm "AI cục bộ" ⇒ báo lỗi Ollama như bình thường (không vòng lặp nút).
