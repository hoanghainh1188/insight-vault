# Intake — 049-audio-player (issue #49)

> **Lưu ý đặc biệt:** Feature này **đã được implement** (code đã viết, review sạch, gate xanh) TRƯỚC
> khi có artifact Spec Kit. File intake này được tạo **hồi tố (retroactive)** để chuẩn hoá `spec.md` /
> `plan.md` / `tasks.md` khớp đúng code hiện có — KHÔNG phải để đề xuất hướng mới. Prompt cho
> `/speckit-specify` bên dưới mô tả **chính xác hành vi code đã có**, không suy diễn thêm phạm vi.

## Input sources

- `docs/OVERVIEW.md` — mục 5 "Pha 2": "Audio/Video: nạp file, tự bóc băng kèm timestamp; player nhảy
  tới timestamp được trích dẫn." · mục 6 ràng buộc bất biến 1–3 (local-first, key an toàn, trích dẫn
  map đúng vị trí) · mục 6.5 "Bảo mật desktop đúng chuẩn (cách ly renderer, không lộ Node cho web
  content)".
- `docs/03-ui/prototype.html` — màn S4 "Xem nguồn có highlight" (`data-s="s4"`, dòng ~205 CSS
  `.vsource`/dòng ~297 tab, dòng ~462 khối `S4 SOURCE VIEWER`). Player audio (049) gắn thêm vào đúng
  màn này (sticky trên vùng cuộn transcript), không phải màn/route mới.
- `docs/04-decisions/2026-07-12-audio-player-clarify.md` — **quyết định chính, nguồn sự thật cho
  scope 049**, 4 điểm (giao thức `iv-media://` ở main, tham chiếu file gốc không copy, player trong
  Source Viewer + seek tStart, CSP `media-src` tối thiểu).
- `docs/04-decisions/2026-07-12-audio-transcribe-clarify.md` — feature tiền đề `045-audio-transcribe`
  (2a-core), mục 6 "Scope chia đôi 2a" định nghĩa ranh giới 2a-core (045) vs 2a-player (049).
- `.specify/memory/constitution.md` — nguyên tắc I (Local-first/no egress ngoài ý muốn), II (Kiểm
  chứng được — trích dẫn map đúng vị trí gốc), III (ranh giới bảo mật renderer/main), IV (test ≥80%).
- Code đã implement (đọc để mô tả đúng, không phải để đề xuất):
  - `src/main/services/source-viewer/media-serve.ts` — `createMediaHandler(sourceRepo)`: handler cho
    `protocol.handle("iv-media", ...)`. Parse `sourceId` từ URL `iv-media://source/<id>` → tra
    `sourceRepo.getById(id)` (404 nếu không có hoặc `kind !== "audio"`) → `sourceRepo.getOrigin(id)`
    lấy path từ DB (không nhận path từ renderer) → 404 nếu path rỗng hoặc file không tồn tại → stream
    qua `createReadStream`, hỗ trợ header `Range` → trả 206 Partial Content với
    `Content-Range`/`Accept-Ranges`/`Content-Length`, hoặc 200 full nếu không có Range.
  - `src/main/services/source-viewer/media-range.ts` — hàm thuần: `extOf(path)` (đuôi file thường
    hoá), `mimeForAudioExt(ext)` (map mp3/wav/flac/ogg → MIME, mặc định `audio/mpeg`),
    `parseRange(header, size)` (parse `bytes=start-end`/`start-`/`-N` → `{start,end}` đã kẹp biên,
    `null` nếu không hợp lệ).
  - `src/main/index.ts` — `protocol.registerSchemesAsPrivileged([{scheme:"iv-media",
privileges:{stream:true, supportFetchAPI:true}}])` gọi **top-level trước `whenReady`** (bắt buộc
    theo Electron); `protocol.handle("iv-media", createMediaHandler(ingestion.sourceRepo))` gọi
    trong `whenReady` (cần `sourceRepo` đã khởi tạo). Không bật `corsEnabled`/`bypassCSP`
    (least-privilege).
  - `electron.vite.config.ts` — CSP thêm `media-src 'self' iv-media:` ở cả DEV và PROD; KHÔNG thêm
    vào `connect-src` (renderer không `fetch("iv-media://")`, chỉ gán `<audio src>`).
  - `src/renderer/features/source-viewer/SourceViewer.tsx` — khi `content.kind === "audio"`: render
    `<audio controls preload="metadata" src="iv-media://source/<sourceId>">` (test id
    `viewer-audio-player`), sticky phía trên vùng cuộn transcript. Effect seek: khi `citation.locator
.tStart` (giây, do 045 lưu mỗi chunk audio) thay đổi hoặc đổi `sourceId`, set
    `audio.currentTime = tStart` rồi gọi `play()` (autoplay bị trình duyệt chặn thì bỏ qua lỗi, im
    lặng — người dùng tự bấm play); nếu audio element chưa `readyState` sẵn sàng, chờ sự kiện
    `loadedmetadata` một lần (`once`) rồi mới seek, cleanup listener khi `tStart`/`sourceId` đổi.
    `onError` trên `<audio>` → set `audioError=true` → hiện thông báo (test id
    `viewer-audio-error`): "Không phát được file âm thanh gốc (có thể đã bị xoá hoặc di chuyển). Bản
    bóc băng bên dưới vẫn xem được." — transcript (từ 045) vẫn hiển thị và highlight bình thường bên
    dưới. Đổi `sourceId` → reset `audioError=false` (thử phát lại nguồn mới).
- Kế thừa (không đổi trong 049): `045-audio-transcribe` (Locator thêm `tStart?/tEnd?` giây, lưu mỗi
  chunk audio khi transcribe), `019-source-viewer` (cơ chế `openCitation`/highlight/overlay Source
  Viewer sẵn có, tái dùng nguyên), `013-rag-qa` (Citation/Locator gốc, chip `[n]`).

## Prompt for /speckit-specify

Bổ sung khả năng **phát lại audio và tua (seek) tới đúng đoạn trích dẫn** vào Trình xem nguồn
(Source Viewer) của InsightVault, cho các nguồn audio đã được bóc băng (transcription) ở feature
`045-audio-transcribe`.

Khi người dùng mở một nguồn có `kind = "audio"` trong Source Viewer (dù mở trực tiếp từ cột Nguồn hay
mở qua bấm chip trích dẫn `[n]` trong câu trả lời chat/Studio), hiển thị một trình phát audio HTML
tiêu chuẩn (có nút play/pause, thanh tua, âm lượng — dùng `<audio controls>` gốc trình duyệt) dính ở
đầu vùng nội dung (sticky phía trên phần bóc băng/transcript đang cuộn), phía dưới vẫn là bản bóc
băng dạng văn bản với đoạn được trích dẫn tô nổi bật (highlight) như hành vi Source Viewer hiện có
(019).

Khi người dùng bấm một chip `[n]` trỏ tới một đoạn trong nguồn audio: Source Viewer mở đúng nguồn đó,
tự động **tua trình phát audio tới đúng mốc thời gian** (`tStart`, tính bằng giây) đã được lưu sẵn
cho đoạn (chunk) đó khi bóc băng (045), và **tự phát** từ mốc đó. Nếu trình duyệt/hệ điều hành chặn
tự phát (autoplay), bỏ qua trong im lặng — người dùng tự bấm nút play; đây không phải lỗi cần báo.
Nếu người dùng mở nguồn audio trực tiếp (không qua trích dẫn), trình phát hiển thị bình thường ở đầu
bài (không có mốc tua nào được áp, phát từ đầu khi người dùng tự bấm play).

File audio phát ra là **file gốc mà người dùng đã nạp vào notebook, được tham chiếu tại đúng vị trí
gốc trên đĩa** — KHÔNG được copy vào thư mục dữ liệu riêng của app (data dir) ở phiên bản này (trade-
off cố ý: file audio có thể lớn tới giới hạn kích thước 1 nguồn hiện có; copy sẽ tốn gấp đôi dung
lượng và phức tạp hoá vòng đời xoá nguồn). Hệ quả đã được chấp nhận: nếu người dùng xoá hoặc di
chuyển file audio gốc sau khi đã nạp vào notebook, ứng dụng **sẽ không phát lại được** file đó nữa.
Trong trường hợp đó, trình phát phải hiển thị rõ một thông báo lỗi thân thiện ngay tại vị trí trình
phát: "Không phát được file âm thanh gốc (có thể đã bị xoá hoặc di chuyển). Bản bóc băng bên dưới vẫn
xem được." — và bản bóc băng văn bản bên dưới vẫn hiển thị đầy đủ, các chip `[n]` trỏ vào bản bóc
băng đó vẫn hoạt động và highlight đúng đoạn (chỉ mất khả năng nghe lại nguồn âm thanh gốc, tính
"kiểm chứng được" ở mức văn bản không bị ảnh hưởng).

Vì renderer của Electron chạy trong sandbox (không có quyền đọc trực tiếp hệ thống file — ràng buộc
bảo mật cố định của dự án), việc đọc và phát file audio gốc phải đi qua **main process**. Ứng dụng
định nghĩa và đăng ký một giao thức tùy biến `iv-media://` do main phục vụ: renderer chỉ đặt thuộc
tính `src` của thẻ `<audio>` thành `iv-media://source/<sourceId>` (sourceId là ID nguồn trong DB,
không phải đường dẫn file); main tra `sourceId` này trong database (chỉ chấp nhận nguồn có
`kind = "audio"`, các loại khác trả về không tìm thấy), lấy đường dẫn file gốc từ cột lưu trong DB
(không bao giờ ghép/nhận đường dẫn trực tiếp từ renderer — chống path traversal), rồi stream nội dung
file về. Giao thức này hỗ trợ HTTP Range request (trả `206 Partial Content` với header
`Content-Range`/`Accept-Ranges`/`Content-Length` phù hợp) để trình phát có thể tua (seek) tới bất kỳ
vị trí nào trong file mà không phải tải lại toàn bộ; khi không có header Range thì trả `200` với toàn
bộ nội dung. Khi không tìm thấy nguồn phù hợp hoặc file gốc không còn tồn tại trên đĩa, trả về
`404`. MIME type được suy ra từ đuôi file (mp3/wav/flac/ogg — các định dạng audio mà 045 đã hỗ trợ
bóc băng), mặc định `audio/mpeg` nếu không nhận diện được đuôi.

Giao thức `iv-media://` chỉ được cấp đặc quyền tối thiểu cần thiết để hoạt động (stream + hỗ trợ Fetch
API) — không bật các đặc quyền rộng hơn như bỏ qua CORS hay bỏ qua CSP. Content Security Policy của
ứng dụng được nới thêm đúng một chỉ thị `media-src` để cho phép thẻ `<audio>` tải nội dung từ
`iv-media:` (giữ nguyên `self`); các chỉ thị khác của CSP (đặc biệt `connect-src`) KHÔNG thay đổi, vì
renderer không chủ động gọi `fetch()` tới giao thức này — chỉ gán qua thuộc tính `src` của phần tử
HTML. Việc phục vụ file qua `iv-media://` là nội bộ trong máy người dùng (main process đọc file cục
bộ và trả cho renderer cùng máy) — đây KHÔNG phải là network egress ra ngoài Internet, nên chỉ báo
riêng tư "Chạy cục bộ" của ứng dụng không bị ảnh hưởng và không cần hiện cảnh báo egress.

### Assumptions (đã chốt qua ADR — không đưa vào NEEDS CLARIFICATION)

- **Giao thức phục vụ media (`iv-media://` ở main, tra DB theo sourceId, hỗ trợ Range/206, least-
  privilege, không copy path từ renderer)** — theo
  `docs/04-decisions/2026-07-12-audio-player-clarify.md` mục 1.
- **Tham chiếu file gốc, KHÔNG copy vào data dir ở v1; hệ quả xoá/di chuyển file → 404 → thông báo lỗi
  rõ ràng, transcript vẫn xem được** — theo mục 2 của ADR trên. Đây là trade-off có chủ đích đã được
  chấp nhận, KHÔNG phải một gap cần hỏi lại.
- **Player nằm trong Source Viewer hiện có (không mở cửa sổ/route riêng), sticky phía trên transcript;
  seek theo `citation.locator.tStart`; chờ `loadedmetadata` nếu audio element chưa sẵn sàng; autoplay
  bị chặn thì bỏ qua im lặng** — theo mục 3 của ADR trên.
- **CSP chỉ thêm `media-src`, không đụng `connect-src`; `iv-media://` không tính là network egress** —
  theo mục 4 của ADR trên.
- **Định dạng audio hỗ trợ = đúng tập 045 đã hỗ trợ bóc băng: wav, mp3, flac, ogg** (m4a/aac ngoài
  phạm vi, để dành cho 2b/video-ffmpeg) — theo `docs/04-decisions/2026-07-12-audio-transcribe-clarify.md`
  mục 2 và mục "Ngoài phạm vi (2a-core)".
- **`Locator.tStart`/`tEnd` (giây) đã được lưu sẵn cho mỗi chunk audio bởi 045** — 049 chỉ tiêu thụ
  giá trị này để seek, không tạo/tính lại timestamp.
- **Phạm vi 049 (2a-player) so với 045 (2a-core):** 045 đã xong phần transcript-only (chip `[n]` mở
  transcript trong Source Viewer, highlight theo char offset, không có player). 049 CHỈ bổ sung phần
  player + giao thức media + seek + CSP; không đổi lại pipeline bóc băng, chunking, hay retrieval.

## Ambiguities to raise in /speckit-clarify

Không còn ambiguity — toàn bộ quyết định thiết kế của feature này đã được chốt ở
`docs/04-decisions/2026-07-12-audio-player-clarify.md` (4 điểm: giao thức `iv-media://`, trade-off
tham chiếu-không-copy file gốc, vị trí player + cơ chế seek, phạm vi CSP) và kế thừa
`docs/04-decisions/2026-07-12-audio-transcribe-clarify.md` mục 6 (ranh giới 2a-core/2a-player). Cả
hai đã có trong `docs/04-decisions/INDEX.md`. Vì feature đã được implement đúng theo các quyết định
này (đối chiếu code ở mục Input sources phía trên khớp 100% với nội dung ADR), `/speckit-clarify` khi
chạy trên spec sinh ra từ intake này dự kiến sẽ không tìm thấy điểm mơ hồ mới cần hỏi thêm.

## Thuật ngữ mới (append vào glossary)

Không có thuật ngữ nghiệp vụ mới. Các thuật ngữ liên quan (`timestamp (tStart/tEnd)`, `transcription`)
đã có sẵn trong `docs/00-glossary.md` (dòng bổ sung bởi feature 045). `iv-media://` là tên giao thức
kỹ thuật nội bộ (không phải thuật ngữ nghiệp vụ khách hàng), không cần vào glossary nghiệp vụ — có thể
ghi chú trong code/ADR như hiện tại là đủ.

## Suggested constitution amendments

Không đề xuất sửa constitution. Feature này là một **áp dụng cụ thể** của các nguyên tắc đã có (I
Local-first/no egress, II Kiểm chứng được, III ranh giới bảo mật main/renderer), không phát sinh
nguyên tắc chung mới. Ghi chú tham khảo cho tương lai (không phải amendment ngay bây giờ): nếu sau
này có thêm nhiều giao thức tùy biến kiểu `iv-media://` (ví dụ cho video ở Pha 2b, ảnh ở Pha 2c), có
thể cân nhắc đúc kết thành 1 rule chung "mọi truy cập file nhị phân lớn phục vụ renderer phải qua
protocol handler ở main với least-privilege + tra cứu DB, không nhận path trực tiếp từ renderer" —
nhưng để dành tới khi có ≥2-3 trường hợp cụ thể thay vì khái quát hoá sớm từ 1 feature.
