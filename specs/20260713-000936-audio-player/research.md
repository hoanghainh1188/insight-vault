# Research — 049-audio-player (Phase 0)

Không còn NEEDS CLARIFICATION (mọi quyết định đã chốt ở `docs/04-decisions/2026-07-12-audio-player-
clarify.md`). Mục này ghi lại các quyết định kỹ thuật + lý do + phương án đã cân nhắc.

## D1. Cơ chế phục vụ file audio cho renderer sandbox

- **Decision**: Giao thức tùy biến `iv-media://` đăng ký ở main (`protocol.registerSchemesAsPrivileged`
  top-level trước `whenReady`, `privileges:{stream:true, supportFetchAPI:true}`) + `protocol.handle`
  trong `whenReady`. Renderer chỉ đặt `<audio src="iv-media://source/<sourceId>">`.
- **Rationale**: Renderer chạy `sandbox:true`/`nodeIntegration:false` (Constitution III) → không đọc FS.
  Custom protocol để main phục vụ là cách chuẩn của Electron, không cần lộ path hay Node cho renderer.
  `stream:true` cho phép trả Web `ReadableStream` (streaming, không buộc load hết vào bộ nhớ); Range để
  tua. Least-privilege: KHÔNG bật `corsEnabled`/`bypassCSP`/`allowServiceWorkers`.
- **Alternatives considered**:
  - IPC trả base64/ArrayBuffer toàn file → tốn RAM, không tua được (không Range), không hợp file lớn.
  - `file://` trực tiếp → lộ path FS cho renderer + không kiểm soát được kind/tồn tại; vi phạm III.
  - Copy file vào data dir rồi `app://` → tốn gấp đôi dung lượng + phức tạp vòng đời (xem D2).

## D2. Nguồn file phát: tham chiếu gốc vs copy vào data dir

- **Decision**: **Tham chiếu file gốc** tại `source.origin` (cột DB, ghi lúc ingestion 045); KHÔNG copy
  vào data dir ở v1.
- **Rationale**: File audio có thể lớn tới giới hạn kích thước 1 nguồn (045: 200MB); copy tốn gấp đôi
  dung lượng + phức tạp hoá vòng đời xoá nguồn. Trade-off có chủ đích.
- **Hệ quả (đã chấp nhận)**: xoá/di chuyển file gốc → handler 404 → player báo lỗi thân thiện; transcript
  - chip `[n]` + highlight vẫn hoạt động (Constitution II ở mức văn bản không mất). Follow-up (ngoài
    049): cảnh báo lúc nạp; tùy chọn copy. (ADR mục 2)

## D3. Tua (seek) tới timestamp trích dẫn

- **Decision**: Effect trong `SourceViewer` phụ thuộc `[citation.locator.tStart, target.sourceId]`. Nếu
  `audio.readyState >= 1` (HAVE_METADATA) → set `currentTime = tStart` + `play().catch(bỏ qua)`; nếu
  chưa → `addEventListener("loadedmetadata", seek, {once:true})` + cleanup khi đổi tStart/sourceId.
- **Rationale**: Đổi nguồn → `<audio>` reload → `readyState` về 0 → phải chờ metadata mới seek được.
  `tStart` (giây) đã được 045 lưu mỗi chunk (`Locator.tStart`); 049 chỉ tiêu thụ. Autoplay bị chặn là
  hành vi bình thường của trình duyệt → nuốt lỗi, người dùng tự bấm (không phải lỗi cần báo).
- **Alternatives considered**: seek đồng bộ ngay sau render (fail vì metadata chưa sẵn) → loại.

## D4. HTTP Range / partial content cho tua

- **Decision**: Handler parse header `Range: bytes=start-end` (hàm thuần `parseRange`, hỗ trợ
  `start-end`/`start-`/suffix `-N`, kẹp `[0,size)`, null nếu không hợp lệ). Range hợp lệ → `206` với
  `Content-Range`/`Accept-Ranges`/`Content-Length` + `createReadStream(path,{start,end})`; không Range →
  `200` full. Không tìm thấy nguồn / không phải audio / file mất → `404`.
- **Rationale**: `<audio>` gửi Range để tua tới vị trí bất kỳ mà không tải lại toàn bộ; đây là hợp đồng
  chuẩn HTTP media. `parseRange` là **crux** → test biên kỹ (overflow/negative/malformed).
- **Alternatives considered**: chỉ trả 200 full luôn → tua vẫn chạy nhưng phải buffer lại từ đầu; kém với
  file lớn. Giữ 206.

## D5. CSP cho `<audio src="iv-media://">`

- **Decision**: Thêm `media-src 'self' iv-media:` (DEV + PROD). KHÔNG thêm vào `connect-src`.
- **Rationale**: Phần tử media (`<audio>`) tải tài nguyên dưới chỉ thị `media-src` theo CSP spec.
  `connect-src` chỉ chi phối `fetch()/XHR/WebSocket` — renderer KHÔNG `fetch("iv-media://")` ở đâu (đã
  grep xác nhận), nên nới `connect-src` là thừa → giữ tối thiểu (Constitution I / web security minimal
  CSP). `iv-media://` cục bộ, không phải egress.
- **Alternatives considered**: thêm cả `connect-src iv-media:` (bản nháp ban đầu) → thu hẹp sau khi xác
  nhận không có fetch.

## D6. Định dạng & MIME

- **Decision**: MIME suy từ đuôi file (`mimeForAudioExt`): mp3→audio/mpeg, wav→audio/wav, flac→audio/flac,
  ogg→audio/ogg, mặc định audio/mpeg. Tập định dạng = đúng 045 (wav/mp3/flac/ogg).
- **Rationale**: Nhất quán với những gì 045 nhận bóc băng; m4a/aac cần ffmpeg → 2b.

## D7. Chiến lược test (feature phụ thuộc audio thật)

- **Decision**: Tách 3 tầng — (a) thuần `media-range` (unit, coverage); (b) `media-serve` handler
  (integration, fake `SourceRepo` + temp file, kiểm 404/200/206 thật qua `Request`/`Response`); (c)
  `SourceViewer` audio (component jsdom: render/seek-on-loadedmetadata/onError/non-audio, override
  `currentTime`/`play` để tránh jsdom media flakiness). Luồng phát/seek **end-to-end với audio đã
  transcribe** cần Whisper (nặng CI) → hoãn sang **manual**, nhất quán pattern dự án (source-viewer.spec
  đã hoãn luồng phụ thuộc Ollama sang manual).
- **Rationale**: Đạt coverage ≥80% cho business logic thuần + xác nhận wiring handler mà không phải tải
  model trong CI. `media-serve.ts` exclude khỏi ngưỡng coverage (I/O) nhưng vẫn có integration test.
- **Alternatives considered**: e2e Playwright ingest audio thật → cần Whisper download mỗi CI run, chậm/
  giòn; không tương xứng giá trị.
