# Research — 051-video (Phase 0)

Không còn NEEDS CLARIFICATION (2 quyết định lớn + 4 clarify đã chốt ở ADR `2026-07-13-video-clarify.md`).
Mục này tập trung **rủi ro kỹ thuật đóng gói ffmpeg** + API + lệnh.

## R1. `ffmpeg-static` — API & lấy đường dẫn binary

- **Decision**: Dùng `ffmpeg-static` (^5.3.0). `require("ffmpeg-static")` (hoặc `import ffmpegStatic from
"ffmpeg-static"`) trả về **đường dẫn tuyệt đối** tới binary ffmpeg (`.../node_modules/ffmpeg-static/
ffmpeg` trên mac/linux, `ffmpeg.exe` trên win). Postinstall tải binary đúng nền tảng **host**.
- **Rationale**: Không cần biên dịch; 1 export string đơn giản; đi kèm app → offline.
- **Alternatives**: `fluent-ffmpeg` (wrapper, thừa cho nhu cầu 1 lệnh extract) · `@ffmpeg-installer/ffmpeg`
  (tương tự) — chọn `ffmpeg-static` cho gọn.

## R2. Đóng gói cross-platform (RỦI RO CHÍNH)

- **Decision**: electron-builder `asarUnpack: node_modules/ffmpeg-static/**` → binary nằm ngoài asar
  (executable phải ngoài asar mới chạy được). Runtime resolve (**ffmpeg-path.ts**):
  - **Dev** (`ELECTRON_RENDERER_URL` set / không đóng gói): dùng path `ffmpeg-static` export nguyên vẹn.
  - **Đóng gói**: path export nằm trong `app.asar` → **thay `app.asar` → `app.asar.unpacked`**:
    `ffmpegStatic.replace("app.asar", "app.asar.unpacked")`. (Chuẩn electron-builder cho asarUnpack.)
- **Cross-platform**: `ffmpeg-static` chỉ tải binary cho **host build**. Nhưng CI release đã là **matrix**
  (mac runner → dmg, win runner → exe — xem roadmap 033/035) → **mỗi runner tự cài ffmpeg-static cho nền
  tảng của nó** → artifact có đúng binary, KHÔNG cần cross-download thủ công. Đây là lý do matrix build là
  bắt buộc (không build 1 nơi cho mọi nền tảng).
- **Rationale**: Mẫu asarUnpack + `.asar.unpacked` là chuẩn phổ biến cho binary native trong Electron
  (dự án đã dùng cho keytar/@lancedb — xem `electron-builder.yml`). Chỉ thêm 1 mục asarUnpack.
- **Verify (bắt buộc ở implement/gate)**: chạy `npm run build` thật → kiểm binary ffmpeg có trong
  `release/.../app.asar.unpacked/node_modules/ffmpeg-static/` và `resolveFfmpegPath()` trỏ đúng + tồn tại.
- **Alternatives**: `extraResources` (copy binary vào resources/, path qua `process.resourcesPath`) — cũng
  được, nhưng asarUnpack đồng nhất với cách dự án đã xử lý native module khác → chọn asarUnpack.

## R3. Lệnh ffmpeg tách audio 16kHz mono

- **Decision**: `ffmpeg -nostdin -i <input> -vn -ac 1 -ar 16000 -f wav -y <tmp.wav>` — spawn bằng **mảng
  tham số** (KHÔNG shell string):
  `spawn(ffmpegPath, ["-nostdin","-i",inPath,"-vn","-ac","1","-ar","16000","-f","wav","-y",outPath])`.
  - `-vn` bỏ video; `-ac 1` mono; `-ar 16000` = 16kHz (đúng input Whisper 045 → có thể bỏ resample, nhưng
    vẫn chạy resampleTo16k như no-op an toàn); `-nostdin` tránh treo; `-y` ghi đè tmp.
- **Rationale**: Xuất thẳng định dạng Whisper cần; mảng tham số chống injection (Constitution III).
- **No-audio detection**: video không có audio stream → ffmpeg exit code ≠ 0 + stderr chứa "does not
  contain any stream"/"Output file #0 does not contain any stream". `extract-audio.ts` bắt exit≠0 (hoặc
  file out rỗng/không tạo) → trả `null` → `parseVideo` coi transcript rỗng (FR-011), KHÔNG ném lỗi chặn.
- **Alternatives**: pipe stdout thay file tạm → phức tạp buffer; chọn file tạm (đơn giản, xoá sau).

## R4. Giấy phép ffmpeg-static (GPL)

- **Decision**: Binary `ffmpeg-static` là **build GPL**. v1 community (miễn phí, mã nguồn mở) → **chấp
  nhận**, nhưng **phải kèm thông báo giấy phép GPL + ffmpeg** trong bản phát hành (thêm mục
  license/attribution).
- **Rủi ro tương lai**: tầng trả phí độc quyền có thể xung đột GPL → khi tới đó cân nhắc **build LGPL**
  (chỉ cần decode/demux, không cần encoder GPL) hoặc ffmpeg tự build LGPL. **Ngoài phạm vi 051** (ghi
  nhận để lại).
- **Rationale**: Không chặn v1; minh bạch giấy phép.

## R5. Tái dùng pipeline 045 & tiến độ

- **Decision**: `parseVideo` = `extractAudio(videoPath) → wavPath` rồi gọi **parseAudio (045)** trên wav
  (decode→resample→transcribe→chunk→timeMap→Locator.tStart/tEnd). Xoá wav tạm ở `finally`. Tiến độ
  (`SourceProgressEvent` 037): thêm bước `extract` (trước `parse`/`embed`). m4a/aac KHÔNG cần extract
  (đã là audio) → route thẳng parseAudio, `kind=audio`.
- **Rationale**: Tối đa hoá tái dùng; không đụng transcribe/chunk/retrieval.

## R6. Player video (tái dùng 049)

- **Decision**: `iv-media://` (049) phục vụ cả video — chỉ thêm **video MIME** ở `media-range.ts`
  (mp4→video/mp4, mov→video/quicktime, webm→video/webm, mkv→video/x-matroska; default giữ audio/mpeg cho
  audio). Source Viewer: `kind==="video"` → `<video controls>` (thay `<audio>`), **cùng** `audioRef`/effect
  seek/onError (đổi kiểu element). CSP `media-src` (049) đã phủ `<video>` → **không đổi CSP**.
- **Rationale**: Tái dùng tối đa; rủi ro thấp.
- **Alternatives**: hàm MIME riêng cho video — gộp vào `mimeForAudioExt` (đổi tên khái niệm thành media)
  gọn hơn; giữ tên export ổn định để không phá test 049.
