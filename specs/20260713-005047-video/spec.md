# Feature Specification: Nạp nguồn Video — tách audio, bóc băng, player video seek (Pha 2b)

**Feature Branch**: `051-video`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Xây tính năng nạp nguồn Video cho InsightVault (Pha 2b, tiếp nối 045 + 049)…"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Nạp video và hỏi đáp có trích dẫn (Priority: P1)

Người dùng thêm một file video (mp4/mov/webm/mkv) vào notebook qua modal "Thêm nguồn". Ứng dụng tự tách
âm thanh khỏi video, bóc băng thành văn bản có mốc thời gian, lập chỉ mục để người dùng **hỏi đáp và nhận
câu trả lời có trích dẫn `[n]`** trỏ về đúng đoạn trong video — như mọi loại nguồn khác.

**Why this priority**: Giá trị cốt lõi của 2b — biến video (vốn không tìm kiếm/hỏi đáp được) thành tri
thức truy vấn được, giữ đúng "Kiểm chứng được". Không có nó thì video chỉ là file nằm im.

**Independent Test**: Nạp 1 video có tiếng nói → chờ xử lý xong → hỏi 1 câu liên quan nội dung → nhận câu
trả lời kèm chip `[n]` trỏ vào transcript video.

**Acceptance Scenarios**:

1. **Given** một file video có track audio, **When** người dùng nạp qua modal Thêm nguồn, **Then** hệ
   thống tách audio, bóc băng, lập chỉ mục và nguồn chuyển trạng thái sẵn sàng; tiến độ hiển thị các bước
   (tách audio → bóc băng → lập chỉ mục).
2. **Given** một video đã bóc băng, **When** người dùng hỏi câu liên quan, **Then** câu trả lời chứa chip
   `[n]` trỏ về đoạn transcript của video, map đúng nguồn + mốc thời gian.

---

### User Story 2 - Nghe/xem lại đúng đoạn video được trích dẫn (Priority: P1)

Người dùng bấm chip `[n]` trỏ vào một nguồn video → Trình xem nguồn mở, hiển thị **trình phát video**, tự
tua tới đúng mốc thời gian của đoạn được trích dẫn và phát; transcript bên dưới highlight đoạn tương ứng.

**Why this priority**: Hoàn thiện "Kiểm chứng bằng mắt + tai" cho video — xem lại đúng cảnh được dẫn. Ngang
hàng P1 với US1 vì đây là điểm khác biệt so với chỉ-transcript.

**Independent Test**: Bấm chip `[n]` của nguồn video → `<video>` hiện, vị trí phát khớp mốc thời gian đoạn,
transcript highlight đúng.

**Acceptance Scenarios**:

1. **Given** một nguồn video đã bóc băng và chip `[n]` trỏ vào đoạn của nó, **When** người dùng bấm `[n]`,
   **Then** Trình xem nguồn mở với trình phát video, tua tới mốc thời gian của đoạn (sai ≤1s), và phát.
2. **Given** trình phát video đang mở, **When** người dùng bấm chip `[n]` khác cùng nguồn, **Then** vị trí
   phát nhảy tới mốc mới.
3. **Given** file video gốc đã bị xoá/di chuyển, **When** người dùng mở nguồn, **Then** trình phát báo lỗi
   thân thiện và transcript + chip `[n]` vẫn hoạt động.

---

### User Story 3 - Nạp audio bổ sung m4a/aac (Priority: P2)

Người dùng nạp file audio định dạng m4a hoặc aac (trước đây 045 chưa nhận) — hệ thống tách audio bằng cùng
công cụ, bóc băng và xử lý như nguồn audio bình thường (phát bằng trình phát audio đã có).

**Why this priority**: Hoàn thiện tập định dạng audio; tận dụng công cụ tách audio vừa thêm. Ít cấp thiết
hơn video nhưng chi phí thêm nhỏ.

**Independent Test**: Nạp 1 file .m4a có tiếng nói → bóc băng xong → hỏi đáp có chip `[n]`; mở nguồn → trình
phát audio (không phải video).

**Acceptance Scenarios**:

1. **Given** một file .m4a/.aac, **When** người dùng nạp, **Then** hệ thống xử lý như nguồn audio (kind
   audio), bóc băng và phát qua trình phát audio.

---

### Edge Cases

- **Video KHÔNG có track audio** (vd screen-record câm) → **vẫn nạp thành công**, transcript rỗng (không
  chip `[n]`), video vẫn phát/xem được; hệ thống báo nhẹ "không có audio để bóc băng". Không chặn người dùng.
- **File gốc bị xoá/di chuyển sau khi nạp** → phát trả về không tìm thấy → trình phát báo lỗi; transcript
  không bị ảnh hưởng.
- **Video rất lớn / rất dài** → có giới hạn kích thước; xử lý (tách + bóc băng) có thể lâu, tiến độ phản ánh
  từng bước; không treo UI.
- **Định dạng không hỗ trợ** → từ chối với thông báo rõ định dạng được nhận.
- **Tua tới mốc vượt/bằng độ dài** → hành vi trình phát tiêu chuẩn (kẹp), không sập.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hệ thống MUST cho phép nạp file video định dạng mp4, mov, webm, mkv qua modal Thêm nguồn (bật
  ô loại nguồn "Audio/Video" hiện đang vô hiệu).
- **FR-002**: Khi nạp video, hệ thống MUST tự tách track audio và bóc băng thành văn bản có mốc thời gian,
  rồi lập chỉ mục để hỏi đáp — tái dùng quy trình bóc băng đã có cho audio (045).
- **FR-003**: Hệ thống MUST gắn nguồn video là loại `video` và nguồn m4a/aac là loại `audio`.
- **FR-004**: Hệ thống MUST hiển thị tiến độ xử lý video theo bước rõ ràng, gồm bước **tách audio** trước
  bước **bóc băng** và **lập chỉ mục**.
- **FR-005**: Câu trả lời hỏi đáp MUST hỗ trợ chip `[n]` trỏ về đoạn transcript của video, map đúng nguồn +
  mốc thời gian (như các loại nguồn khác).
- **FR-006**: Khi mở một nguồn `video` trong Trình xem nguồn, hệ thống MUST hiển thị **trình phát video**
  (play/pause, thanh tua, âm lượng) phía trên transcript.
- **FR-007**: Khi bấm chip `[n]` trỏ vào nguồn video, hệ thống MUST mở đúng nguồn, tua trình phát tới mốc
  thời gian của đoạn và bắt đầu phát; autoplay bị chặn thì bỏ qua im lặng.
- **FR-008**: Hệ thống MUST phát lại **file video/audio gốc** người dùng đã nạp, tham chiếu tại vị trí gốc
  trên đĩa; MUST NOT sao chép vào thư mục dữ liệu ứng dụng.
- **FR-009**: Khi file gốc không còn, hệ thống MUST hiển thị thông báo lỗi thân thiện tại trình phát và
  MUST vẫn cho xem transcript + dùng chip `[n]` + highlight.
- **FR-010**: Khi nạp video, modal Thêm nguồn MUST hiển thị ghi chú nhắc "video phát từ vị trí file gốc;
  xoá/di chuyển sẽ không phát lại được".
- **FR-011**: Video KHÔNG có track audio MUST vẫn nạp thành công (transcript rỗng, không chip `[n]`), video
  vẫn phát/xem được; hệ thống MUST báo nhẹ trạng thái "không có audio để bóc băng" mà không chặn.
- **FR-012**: Việc tách audio + đọc/stream file gốc MUST chạy hoàn toàn cục bộ (không gửi dữ liệu ra ngoài);
  chỉ báo riêng tư "Chạy cục bộ" MUST không đổi.
- **FR-013**: Renderer MUST NOT đọc trực tiếp hệ thống file hay chạy công cụ tách audio; các thao tác này
  MUST ở tiến trình chính, tra file theo ID nguồn (không nhận đường dẫn/tham số shell từ renderer).
- **FR-014**: Hệ thống MUST giới hạn kích thước 1 nguồn video ở **1GB** (audio, gồm m4a/aac, giữ 200MB).
- **FR-015**: Ứng dụng MUST hoạt động **không cần Internet** cho toàn bộ luồng video (công cụ tách audio +
  bóc băng có sẵn cục bộ, không tải về khi dùng ngoài lần tải model bóc băng của 045).
- **FR-016**: Hệ thống MUST NOT ghi log nội dung/đường dẫn file người dùng.

### Key Entities _(include if feature involves data)_

- **Nguồn video (Source, kind=video)**: file video đã nạp; mang tham chiếu vị trí file gốc (ở tiến trình
  chính) + trạng thái xử lý; transcript sinh từ audio tách ra.
- **Nguồn audio mở rộng (kind=audio, m4a/aac)**: như nguồn audio 045, thêm 2 định dạng container.
- **Đoạn + Locator (tStart/tEnd)**: mốc thời gian đoạn transcript — dùng để tua trình phát (video/audio).
- **Trích dẫn `[n]`**: liên kết chip → đoạn → nguồn + mốc thời gian.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Người dùng nạp được video mp4/mov/webm/mkv và, với video có tiếng nói, nhận câu trả lời hỏi
  đáp có chip `[n]` trỏ đúng đoạn — tỷ lệ thành công 100% trên tập video mẫu có audio.
- **SC-002**: 100% chip `[n]` trỏ nguồn video mở trình phát video và đặt vị trí phát khớp mốc thời gian đoạn
  (sai ≤ 1 giây).
- **SC-003**: Người dùng tua video tới vị trí bất kỳ không phải tải lại toàn bộ file (phản hồi gần tức thì
  kể cả video lớn tới giới hạn 1GB).
- **SC-004**: Video không có audio track vẫn nạp thành công 100% và phát/xem được, kèm thông báo trạng thái
  rõ ràng.
- **SC-005**: 0 yêu cầu mạng ra ngoài Internet trong toàn bộ luồng nạp/tách/bóc băng/phát video (đo bằng
  giám sát mạng); chỉ báo "Chạy cục bộ" giữ nguyên.
- **SC-006**: Bản đóng gói (macOS arm64 + Windows x64) chạy được luồng video **không cần người dùng cài
  thêm công cụ nào** (công cụ tách audio đi kèm app).

## Assumptions

Các quyết định đã chốt ở `docs/04-decisions/2026-07-13-video-clarify.md` (đưa vào đây làm giả định, KHÔNG
phải điểm cần làm rõ):

- **Công cụ tách audio = ffmpeg-static bundled** (binary tiền biên dịch đi kèm app; KHÔNG dùng ffmpeg hệ
  thống, KHÔNG ffmpeg.wasm). Đóng gói ngoài asar + set executable; resolve path ở dev và bản đóng gói cho
  macOS arm64 + Windows x64. License GPL của ffmpeg-static cần công bố khi phát hành.
- **Player video + seek**: tái dùng giao thức phục vụ media nội bộ của 049 (`iv-media://`, Range/206, tra
  theo ID nguồn, không nhận path từ renderer), chỉ thêm MIME video; renderer đặt `<video src>`.
- **Tái dùng pipeline bóc băng 045**: ffmpeg xuất wav 16kHz mono (file tạm trong data dir, xoá sau khi bóc
  băng) → decode/resample/transcribe/chunk/`Locator.tStart/tEnd` như audio.
- **KHÔNG migration** (045 đã bỏ CHECK cột `kind`); **CSP không đổi** (`media-src` đã phủ `<video>`).
- **Tham chiếu file gốc, KHÔNG copy vào data dir** (như 049).
- **m4a/aac gộp vào feature này** (kind=audio, phát qua trình phát audio 049).
- **Giới hạn**: video 1GB, audio/m4a/aac 200MB.
- **Video không có audio track**: vẫn nạp, transcript rỗng, phát được, báo nhẹ.
- **Ghi chú UX ở modal Thêm nguồn** khi chọn video (phát dựa vào file gốc).
- **Bảo mật (Constitution III)**: ffmpeg spawn bằng mảng tham số (không shell string), path từ DB; đọc/
  stream/tách CHỈ ở main; renderer sandbox chỉ gán `<video src>`; không log path/nội dung.

### Ngoài phạm vi (v1)

- 2c Ảnh (OCR/vision); trích khung hình / scene detection; phụ đề embedded (SRT/VTT); build LGPL ffmpeg
  (cân nhắc khi làm tầng trả phí); phát video ở cửa sổ riêng.

### Dependencies

- `045-audio-transcribe` (đã merge): pipeline bóc băng Whisper + `Locator.tStart/tEnd` + kind=audio.
- `049-audio-player` (đã merge): giao thức `iv-media://`, Source Viewer player + seek + onError.
- `037` progress events; `019` Source Viewer; `011` ingestion/source-repo.
