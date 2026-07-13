# Intake — 051-video (issue #51, Pha 2b)

> Output của `design-intake`. Cầu nối giữa tài liệu thiết kế và `/speckit-specify`.
> Feature CHƯA code — chạy đủ pipeline: specify → clarify → plan → tasks → implement.

## Input sources

- `docs/OVERVIEW.md` — mục 5 Pha 2: "Audio/Video: nạp file, tự bóc băng (transcription) kèm timestamp;
  player nhảy tới timestamp được trích dẫn"; mục 3 & 6: 3 điểm bất biến (Local-first, Kiểm chứng được,
  Offline & tự chủ) + ràng buộc "xây theo pha".
- `docs/03-ui/prototype.html` — modal "Thêm nguồn" (`#addOverlay`, dòng ~442-447): 4 loại nguồn, trong đó
  ô **"Audio/Video" (`type` thứ 3, class hiện KHÔNG có `on` → disabled trong prototype tĩnh)** — cần bật
  nhận file video. Màn "Xem nguồn có highlight" (`#s4`, dòng ~463+) — nơi player video sẽ render.
- `docs/04-decisions/2026-07-13-video-clarify.md` — **quyết định chính của feature này** (nguồn sự thật
  cho scope). 2 quyết định đã chốt:
  1. `ffmpeg-static` BUNDLED theo app (mac arm64 + win x64 qua electron-builder) — không dùng ffmpeg hệ
     thống, không dùng ffmpeg.wasm. GPL license → kèm giấy phép khi phát hành; rủi ro tương lai (tầng trả
     phí) cân nhắc build LGPL sau, ngoài phạm vi 051.
  2. Player **`<video>` + seek**, tái dùng giao thức `iv-media://` của 049 (đổi `<audio>` → `<video>`,
     thêm video MIME).
  - Kiến trúc kế thừa KHÔNG đổi: transcribe pipeline 045 (ffmpeg tách audio → 16kHz mono → decode/
    resample/transcribe/chunk/timeMap → `Locator.tStart/tEnd`); player/seek/onError 049 (`iv-media://`
    Range/206). KHÔNG migration (045 đã bỏ CHECK `source.kind`). CSP không đổi.
  - Giả định/mặc định đã ghi trong ADR (đưa vào spec Assumptions), 2 điểm ADR đánh dấu cần xác nhận ở
    clarify (xem mục Ambiguities).
- `docs/04-decisions/2026-07-12-audio-transcribe-clarify.md` (045) — pipeline transcribe Whisper local
  (`@huggingface/transformers`, `Xenova/whisper-base`), giải mã audio-decode + resample thuần,
  `Locator.tStart/tEnd`, `SourceKind` mở rộng.
- `docs/04-decisions/2026-07-12-audio-player-clarify.md` (049) — giao thức `iv-media://` đăng ký ở main
  (Range/206, least-privilege `stream+supportFetchAPI`, không `corsEnabled`/`bypassCSP`), tham chiếu file
  gốc KHÔNG copy (xoá/di chuyển → 404 + onError, transcript vẫn xem được), player sticky trong Source
  Viewer, CSP `media-src 'self' iv-media:`.
- `.specify/memory/constitution.md` — nguyên tắc I (Local-first/offline: ffmpeg + Whisper local, video
  không rời máy), II (Kiểm chứng được: seek đúng `tStart`), III (ranh giới main/renderer: ffmpeg spawn +
  đọc file CHỈ ở main, path từ DB không từ renderer, không log nội dung), IV (test coverage ≥80% cho hàm
  thuần), V (Xây theo pha: 2b chỉ làm sau khi 2a — 045/049 — đã ổn).

Không có Figma MCP nào được dùng cho feature này — thiết kế video player kế thừa nguyên UI/UX từ prototype
(màn `#s4`) + 049 đã triển khai; không có node Figma riêng cho video.

## Prompt for /speckit-specify

Xây tính năng nạp nguồn **Video** cho InsightVault (Pha 2b, tiếp nối Pha 2a — 045 audio-transcribe và
049 audio-player đã hoàn thành). Người dùng thêm file video (mp4, mov, webm, mkv) vào notebook qua modal
"Thêm nguồn" — bật ô loại nguồn "Audio/Video" hiện đang bị vô hiệu hoá trong wireframe, cho nhận cả video
lẫn các định dạng audio container còn thiếu từ 045 (m4a, aac).

Khi nạp video: ở **main process**, dùng **ffmpeg-static** (binary ffmpeg tiền biên dịch, đóng gói kèm
app — KHÔNG dùng ffmpeg cài sẵn trên máy người dùng, KHÔNG dùng ffmpeg.wasm) để tách track audio ra file
wav tạm 16kHz mono trong thư mục dữ liệu ứng dụng, sau đó tái sử dụng **nguyên vẹn** pipeline bóc băng
Whisper đã có từ 045 (decode → resample → transcribe → chunk → gắn timestamp `tStart/tEnd` vào
`Locator`) để tạo transcript có thể hỏi đáp (RAG) với trích dẫn chip `[n]` như các loại nguồn khác. File
wav tạm xoá sau khi transcribe xong. Tiến độ nạp nguồn hiển thị qua `SourceProgressEvent` đã có (037),
thêm bước "tách audio" chạy trước bước "bóc băng".

Nguồn video được gắn `kind="video"` (không cần thay đổi schema DB — migration #5 của 045 đã bỏ ràng buộc
CHECK trên cột `kind`). Nguồn m4a/aac gắn `kind="audio"` như các audio khác của 045.

Ở màn Xem nguồn có highlight (Source Viewer), khi `kind="video"`, hiển thị `<video controls>` (thay vì
`<audio>`) — tái dùng nguyên giao thức tuỳ biến `iv-media://` đã xây ở 049 (đăng ký ở main,
`protocol.handle`, hỗ trợ HTTP Range/206 để seek, tra `sourceId` → DB → path gốc bằng câu SQL
parameterized, KHÔNG đọc path từ renderer). Chỉ cần bổ sung MIME type cho các định dạng video (mp4 →
video/mp4, mov → video/quicktime, webm → video/webm, mkv → video/x-matroska). Bấm chip trích dẫn `[n]`
của nguồn video → seek `<video>.currentTime` tới `locator.tStart`, giữ nguyên logic chờ `loadedmetadata`
và cleanup listener như 049. Video tham chiếu trực tiếp file gốc trên máy người dùng, KHÔNG copy vào thư
mục dữ liệu ứng dụng (như 049 đã chọn cho audio) — nếu file gốc bị xoá/di chuyển, player báo lỗi rõ ràng
qua `onError` ("không phát được video gốc..."), nhưng transcript vẫn xem và trích dẫn được bình thường.

CSP giữ nguyên (`media-src 'self' iv-media:` từ 049 đã phủ cả thẻ `<video>`, không cần thêm directive).
Không có migration schema mới.

Về đóng gói: binary `ffmpeg-static` phải nằm ngoài `asar` (`asarUnpack`), set quyền thực thi, và resolve
đúng đường dẫn cả ở dev (`ffmpeg-static` package) lẫn bản đóng gói (`process.resourcesPath`) cho cả
macOS (arm64) và Windows (x64). Ghi chú: `ffmpeg-static` là build GPL — bản community v1 chấp nhận được
nhưng phải kèm thông báo giấy phép GPL khi phát hành.

Giữ nguyên 3 điểm bất biến của sản phẩm: **Local-first** (video và audio tách ra không rời máy — ffmpeg
và Whisper đều chạy local ở main process), **Kiểm chứng được** (chip `[n]` map đúng về `tStart/tEnd`,
seek chính xác tới đoạn được trích dẫn trong video), **Offline & tự chủ** (không cần cài đặt gì thêm,
ffmpeg đã bundled sẵn, chạy được không cần Internet).

Các giả định mặc định (xem chi tiết và lý do đầy đủ tại
`docs/04-decisions/2026-07-13-video-clarify.md`):

- Định dạng video hỗ trợ: mp4, mov, webm, mkv.
- Container audio m4a/aac gộp luôn vào phạm vi 051 (vì đã có sẵn ffmpeg).
- Giới hạn kích thước file video đề xuất 1GB/nguồn (so với 200MB cho audio ở 045) — **cần xác nhận ở
  clarify**.
- ffmpeg xuất wav tạm ra thư mục dữ liệu ứng dụng, xoá ngay sau khi transcribe xong.
- Spawn ffmpeg bằng mảng tham số (KHÔNG dựng shell string) để chống command injection; đường dẫn video
  luôn lấy từ cột DB, không bao giờ nhận trực tiếp từ renderer.

## Ambiguities to raise in /speckit-clarify

Đã quét `docs/04-decisions/INDEX.md` — không có quyết định cũ nào phủ các điểm dưới đây (đây là feature
mới, 2 điểm đầu chính ADR 2026-07-13-video-clarify.md đã tự đánh dấu "xác nhận ở clarify"):

1. **Có gộp container audio m4a/aac vào phạm vi 051 không?** ADR đề xuất mặc định **CÓ** (vì đã có sẵn
   ffmpeg cho video, tiện thể xử lý luôn phần m4a/aac mà 045 đã hoãn). Cần xác nhận scope chính thức —
   ảnh hưởng danh sách định dạng nhận trong AddSourceModal và test matrix.
2. **Giới hạn kích thước file video là bao nhiêu?** ADR đề xuất **1GB/nguồn** (so với 200MB audio ở 045,
   vì video thường nặng hơn nhiều). Cần chốt con số chính xác — ảnh hưởng validation lúc nạp nguồn và
   thông báo lỗi khi vượt hạn mức.
3. **Xử lý video KHÔNG có audio track** (video câm/silent): ffmpeg tách audio sẽ ra file rỗng hoặc lỗi.
   ADR chưa đề cập rõ hành vi mong muốn — có nên vẫn cho phép nạp (transcript rỗng, chỉ phát được hình)
   hay báo lỗi ngay từ bước tách audio? Cần quyết định để tránh app crash/treo khi gặp file này.
4. **Có cần cảnh báo lúc nạp nguồn video rằng phát dựa vào vị trí file gốc không (như follow-up "ngoài
   phạm vi 049" đã ghi nhận nhưng chưa làm)?** ADR 051 kế thừa nguyên hành vi "tham chiếu không copy" của
   049 nhưng không nói rõ có đưa follow-up UX cảnh báo này vào 051 luôn hay tiếp tục hoãn. Nêu để
   `/speckit-clarify` xác nhận có nằm trong phạm vi 051 hay không (khả năng cao là hoãn tiếp, nhưng cần
   ghi rõ quyết định thay vì mặc định im lặng).

## Thuật ngữ mới (append vào glossary)

Đối chiếu `docs/00-glossary.md` — các dòng `video`/`transcode`/`demux` liên quan trực tiếp business logic
CHƯA có, cần bổ sung. `ffmpeg` là tên công cụ kỹ thuật cụ thể (không phải khái niệm nghiệp vụ trừu tượng)
nên KHÔNG cần vào glossary, chỉ cần nhắc trong code/comment như hiện trạng ADR đã làm.

| 日本語 | Tiếng Việt                        | English (đề xuất)        | Ghi chú                                                                                                               |
| ------ | --------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| —      | Nguồn video                       | video (SourceKind)       | Mở rộng `SourceKind`; nạp file mp4/mov/webm/mkv — 051                                                                 |
| —      | Tách audio (từ video, qua ffmpeg) | audio extraction / demux | Bước ffmpeg trước bước "bóc băng" trong `SourceProgressEvent` — 051; không nhầm với "bóc băng" (transcription, đã có) |
| —      | Trình phát (video)                | video player             | `<video controls>` trong Source Viewer khi `kind=video`; phục vụ qua `iv-media://` như audio player 049 — 051         |

Ghi chú: KHÔNG đổi/sửa các dòng đã có (`player`, `seek`, `transcription`, `timestamp (tStart/tEnd)`) —
051 chỉ mở rộng phạm vi áp dụng sang `kind=video`, giữ nguyên định nghĩa gốc từ 045/049.

## Suggested constitution amendments

Không đề xuất amendment mới. Các nguyên tắc I (Local-first/offline), II (Kiểm chứng được), III (ranh
giới main/renderer + không log), IV (test ≥80%), V (xây theo pha) hiện có đã đủ bao quát yêu cầu của
051 — feature này là ví dụ áp dụng thêm vào, không phát sinh nguyên tắc chung mới. Riêng điểm "binary
thực thi ngoại lai (ffmpeg) đóng gói kèm app, license GPL cần công bố" là chi tiết vận hành/pháp lý cụ
thể của feature này, phù hợp hơn khi ghi trong tasks.md/README release notes, không cần nâng thành rule
hiến pháp.
