# audio-player clarify (049, Pha 2a-player)

- Ngày: 2026-07-12
- Feature: `049-audio-player` (issue #49)
- Nguồn: thảo luận tiếp Pha 2 (2026-07-12) sau khi 045 (2a-core) merge; người dùng chốt "theo gợi ý của bạn".
- Tiếp nối: [2026-07-12-audio-transcribe-clarify.md](./2026-07-12-audio-transcribe-clarify.md) mục 6 (2a-player).

## Quyết định (đã thảo luận)

**1. Phát audio qua giao thức tùy biến `iv-media://` đăng ký ở MAIN.** Renderer sandbox
(`sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`) KHÔNG đọc FS (Constitution III). Main
`protocol.registerSchemesAsPrivileged([{scheme:"iv-media", privileges:{stream:true, supportFetchAPI:true}}])`
(top-level, trước `whenReady`) + `protocol.handle("iv-media", createMediaHandler(sourceRepo))` (trong
`whenReady`). Renderer chỉ đặt `<audio src="iv-media://source/<sourceId>">`. Handler tra `sourceId` → DB
(`getById`, chỉ `kind=audio`) → `getOrigin` (path từ cột DB, câu SQL parameterized — KHÔNG nối path từ
renderer) → stream file, hỗ trợ **Range** (206) cho seek. Least-privilege: chỉ bật `stream`+`supportFetchAPI`,
KHÔNG `corsEnabled`/`bypassCSP`.

**2. THAM CHIẾU FILE GỐC — KHÔNG copy audio vào data-dir ở v1 (trade-off đã chốt).**

- _Lý do:_ file audio lớn (giới hạn 200MB/nguồn); copy = tốn gấp đôi dung lượng + phức tạp vòng đời (xoá
  nguồn phải xoá bản copy). v1 ưu tiên đơn giản.
- _Hệ quả (rủi ro đã biết):_ nếu người dùng **xoá/di chuyển file gốc** sau khi nạp, sẽ **không phát lại
  được** (handler trả 404). Bản **bóc băng (transcript) vẫn xem được** và chip `[n]` vẫn trỏ đúng đoạn
  transcript — nên tính "Kiểm chứng được" (Constitution II) ở mức transcript KHÔNG mất; chỉ mất khả năng
  nghe lại nguồn gốc.
- _Giảm nhẹ:_ khi 404, player hiện thông báo "Không phát được file âm thanh gốc (có thể đã bị xoá/di
  chuyển). Bản bóc băng bên dưới vẫn xem được." (`onError` trên `<audio>`), không im lặng.
- _Follow-up (ngoài phạm vi 049):_ cân nhắc (a) cảnh báo lúc nạp nguồn audio rằng phát dựa vào vị trí file
  gốc; (b) tùy chọn copy-vào-data-dir cho người cần lưu trữ độc lập. Chưa làm ở v1.

**3. Player trong Source Viewer (không cửa sổ riêng).** Khi `content.kind==="audio"`: render `<audio controls>`
dính đầu vùng cuộn (sticky) + transcript bên dưới như 045. Mở chip `[n]` audio → seek `currentTime` tới
`locator.tStart` (giây, 045 đã lưu) + tự phát (autoplay bị chặn thì bỏ qua). Chờ `loadedmetadata` nếu chưa
sẵn (đổi nguồn); listener `once` + cleanup khi đổi `tStart`/`sourceId`.

**4. CSP tối thiểu.** Thêm `media-src 'self' iv-media:` (thẻ `<audio>` nằm dưới `media-src`). KHÔNG thêm vào
`connect-src` (renderer không `fetch("iv-media://")` ở đâu — đã grep xác nhận). `iv-media://` do main phục vụ
nội bộ, KHÔNG phải network egress thật → badge "Chạy cục bộ" giữ đúng (Constitution I).

## Phạm vi

- **Trong 049:** giao thức `iv-media://` (Range/seek) · player + seek theo trích dẫn trong Source Viewer ·
  onError khi file gốc mất · CSP · test (hàm thuần `media-range.ts` + integration `createMediaHandler`).
- **Ngoài 049:** copy audio vào data-dir · cảnh báo lúc nạp · scope handler theo `notebookId` đang mở
  (app single-user local nên chưa cần — xem note security review) · 2b Video (ffmpeg) · 2c Ảnh (OCR/vision).
