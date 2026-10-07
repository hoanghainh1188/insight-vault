# privacy-badge clarify (103)

- Ngày: 2026-10-07
- Feature: `103-privacy-live` (issue #103)
- Nguồn: hạn chế đã biết "badge không đổi theo lượt" (098) + khảo sát phát hiện badge KHÔNG cập nhật khi có egress
  (tải URL/model) và request AI online không được tính là egress.
- Ràng buộc: **Constitution I** — privacy indicator MUST luôn phản ánh đúng trạng thái hiện tại.
- Liên quan: 001 app-shell (badge đọc từ main), 011 FR-019 (egress khi fetch URL), 031 (provider online ⇒ badge
  online), 045/053/059 (badge quanh lần tải model đầu), 098 (lượt AI cục bộ).

## Quyết định (người dùng chốt)

**Badge 3 trạng thái, cập nhật tức thì:**

| mode | Nhãn | Khi nào |
|---|---|---|
| `local` | Chạy cục bộ · dữ liệu không rời máy | không provider online, không egress |
| `online` | AI online đang bật · chỉ gửi khi bạn hỏi | provider online active, KHÔNG có request đang chạy |
| `sending` | Đang gửi dữ liệu ra ngoài… | đang có egress thật (ưu tiên cao nhất) |

- _Loại bỏ:_ giữ 2 trạng thái (không phân biệt "đã bật" với "đang gửi").

## Hệ quả thiết kế (không cần hỏi lại)

- Egress thật = request AI online (`callJson`; `streamLines` tính tới khi đọc hết body hoặc huỷ), tải URL nguồn,
  tải model lần đầu (Whisper/OCR/embedding). Ollama (localhost) KHÔNG phải egress. Mở trình duyệt để báo lỗi (093)
  do trình duyệt thực hiện, không tính.
- Main là nguồn sự thật; mỗi khi `mode` đổi, main ĐẨY sự kiện `privacy:changed` tới mọi cửa sổ (không polling).
- Lượt "Trả lời bằng AI cục bộ" (098) không tạo egress ⇒ badge ở `online` (đã bật) chứ không `sending`.
- `sending` có hiệu ứng nhấp nháy nhẹ (tắt khi người dùng bật giảm chuyển động). Badge không đặt aria-live (đổi
  liên tục khi stream); trạng thái vẫn đọc được khi duyệt.

## Bổ sung sau review (2026-10-07)

- **Nhãn `sending` nói rõ đang làm gì** (cùng 1 trạng thái/hình thức như người dùng đã chốt, chỉ chính xác hơn câu
  chung "Đang gửi dữ liệu ra ngoài…"): *Đang gửi dữ liệu tới AI online…* / *Đang tải trang web…* / *Đang tải mô hình
  (cần Internet lần đầu)…* (ưu tiên ai > url > model). Lý do: tải mô hình KHÔNG gửi dữ liệu người dùng đi.
- **Ollama không phải egress** (`OLLAMA_HOST` chỉ loopback): `streamLines`/`callJson` có cờ `egress:false` cho Ollama
  — trước đó chat cục bộ làm badge báo "đang gửi" (sai sự thật).
- Lần nạp mô hình đầu mỗi phiên vẫn bật `sending/model` kể cả khi mô hình đã có trong cache — chấp nhận BÁO THỪA
  (an toàn hơn báo thiếu); nhãn "cần Internet lần đầu" giải thích.
- `shell.openExternal` (báo lỗi 093) do trình duyệt gửi, không tính — loại trừ có chủ ý.
- Listener đẩy trạng thái lỗi (cửa sổ vừa huỷ) không được làm hỏng luồng nghiệp vụ.
