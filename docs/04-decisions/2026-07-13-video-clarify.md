# video clarify (051, Pha 2b)

- Ngày: 2026-07-13
- Feature: `051-video` (issue #51)
- Nguồn: thảo luận tiếp Pha 2 sau khi 049 (2a-player) merge; người dùng chốt 2 quyết định pivotal.
- Tiếp nối: [2026-07-12-audio-transcribe-clarify.md](./2026-07-12-audio-transcribe-clarify.md) (045),
  [2026-07-12-audio-player-clarify.md](./2026-07-12-audio-player-clarify.md) (049).

## Quyết định (đã thảo luận)

**1. ffmpeg = `ffmpeg-static` BUNDLED theo app.** Gói binary ffmpeg tiền biên dịch cho từng nền tảng
(mac arm64 + win x64) qua electron-builder. Giữ đúng nguyên tắc **Offline & tự chủ** (chạy ngay, không
bắt người dùng tự cài ffmpeg/PATH).

- _Đánh đổi:_ app to hơn (~30-80MB/nền tảng); `ffmpeg-static` là build **GPL** → v1 community OK nhưng
  **phải kèm giấy phép GPL** khi phát hành. **Rủi ro tương lai (freemium/tầng trả phí):** GPL có thể xung
  đột với phân phối tầng trả phí độc quyền → khi tới đó cân nhắc build **LGPL** (chỉ demux/decode audio là
  đủ, không cần encoder GPL). Research sẽ soi cụ thể.
- _Loại bỏ:_ ffmpeg hệ thống (phá offline/tự chủ, user phải cài) · ffmpeg.wasm (chậm/ngốn RAM với video
  lớn).

**2. Player VIDEO + seek** (không chỉ audio/transcript). Tái dùng giao thức `iv-media://` của 049 →
renderer đặt `<video controls src="iv-media://source/<id>">`; seek tới `locator.tStart` như 049 (đổi
`<audio>`→`<video>`). Giàu nhất, đúng "kiểm chứng bằng mắt+tai".

- _Loại bỏ:_ chỉ-audio (mất hình) · chỉ-transcript (mất khả năng nghe/nhìn lại nguồn).

## Kiến trúc kế thừa (tái dùng, KHÔNG đổi)

- **Transcribe (045):** ffmpeg tách audio → **16kHz mono** → nguyên pipeline Whisper (decode/resample/
  transcribe/chunk/timeMap → `Locator.tStart/tEnd`). Video KHÔNG rời máy (ffmpeg + Whisper đều local ở main).
- **Player (049):** `iv-media://` (Range/206) — chỉ cần **thêm video MIME** (mp4→video/mp4, mov→video/
  quicktime, webm→video/webm, mkv→video/x-matroska); Source Viewer render `<video>` khi `kind=video`;
  seek effect + onError y hệt 049.
- **KHÔNG migration:** 045 (migration #5) đã bỏ CHECK `source.kind` → thêm `kind="video"` không cần schema
  mới.
- **CSP KHÔNG đổi:** `media-src 'self' iv-media:` (049) đã phủ cả `<video>`.

## Giả định / mặc định (đưa vào spec Assumptions; xác nhận/điều chỉnh ở clarify nếu cần)

- **Định dạng video:** mp4, mov, webm, mkv (phổ biến). Container audio hoãn từ 045 (**m4a/aac**) — vì đã có
  ffmpeg, **gộp luôn** vào 2b (ffmpeg tách → transcribe; phát qua `<audio>` như 049). _(Xác nhận ở clarify:
  có làm m4a/aac trong 2b không, mặc định CÓ.)_
- **Tham chiếu file gốc, KHÔNG copy** (như 049): phát video từ vị trí gốc; xoá/di chuyển → 404 + onError,
  transcript vẫn dùng.
- **Tách audio:** ffmpeg xuất **wav 16kHz mono** ra file tạm trong data-dir (xoá sau khi transcribe xong)
  → tái dùng decode/resample/transcribe 045. Chạy ở **main**, spawn ffmpeg bằng **mảng tham số** (KHÔNG
  shell string — chống injection); path video từ DB (không từ renderer). Tiến độ qua `SourceProgressEvent`
  (037): thêm bước "tách audio" trước bước "bóc băng".
- **Giới hạn kích thước video:** đề xuất **1GB/nguồn** (video lớn hơn audio; 045 audio = 200MB). Xác nhận
  ở clarify.
- **Packaging:** binary ffmpeg đưa ngoài asar (`asarUnpack`) + set executable; đường dẫn qua `ffmpeg-static`
  (dev) / `process.resourcesPath` (đóng gói). CI release matrix mac/win phải đóng gói đúng binary.

## Clarify (2026-07-13) — 4 ambiguity đã chốt

Người dùng chốt 4 điểm intake đánh dấu (đưa vào spec Assumptions, KHÔNG còn NEEDS CLARIFICATION):

- **C1 — m4a/aac:** **GỘP vào 2b.** ffmpeg tách audio từ m4a/aac → transcribe; gắn `kind="audio"`, phát
  qua `<audio>` (049). Hoàn thiện tab Audio/Video (m4a/aac vốn hoãn ở 045).
- **C2 — Giới hạn kích thước video:** **1GB/nguồn** (audio giữ 200MB; m4a/aac theo audio = 200MB).
- **C3 — Video KHÔNG có audio track:** **VẪN nạp thành công**, transcript rỗng (không chip `[n]`), video
  vẫn phát/xem được; báo nhẹ "không có audio để bóc băng". KHÔNG chặn người dùng.
- **C4 — Cảnh báo UX "phát dựa vào file gốc":** **CÓ** — thêm ghi chú nhỏ ở modal Thêm nguồn khi chọn
  video ("video phát từ vị trí file gốc; xoá/di chuyển sẽ không phát lại được"). Giải quyết luôn follow-up
  còn treo của 049.

## Phạm vi

- **Trong 051:** nạp video (mp4/mov/webm/mkv) [+ m4a/aac audio], ffmpeg tách audio→16kHz, transcribe (tái
  dùng 045), `kind=video`, bật tab Video ở AddSourceModal, `<video>` player + seek (tái dùng 049), video
  MIME, bundle ffmpeg + packaging, size-limit video.
- **Ngoài 051:** 2c Ảnh (OCR tesseract.js/+vision Ollama); trích khung hình/scene detection; phụ đề
  embedded (SRT/VTT) trong video; build LGPL ffmpeg (cân nhắc khi làm tầng trả phí).
