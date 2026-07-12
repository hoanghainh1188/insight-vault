# Feature Specification: Audio player + seek tới trích dẫn (2a-player)

**Feature Branch**: `049-audio-player`

**Created**: 2026-07-13

**Status**: Draft (hồi tố — feature đã implement, spec mô tả đúng hành vi hiện có)

**Input**: User description: "Bổ sung khả năng phát lại audio và tua (seek) tới đúng đoạn trích dẫn vào Trình xem nguồn (Source Viewer) của InsightVault, cho các nguồn audio đã được bóc băng ở feature 045-audio-transcribe. …"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Nghe lại đúng đoạn nguồn audio được trích dẫn (Priority: P1)

Người dùng đang đọc câu trả lời (Chat) hoặc bản tổng hợp (Studio) có chip trích dẫn `[n]` trỏ vào một
nguồn audio đã bóc băng. Họ bấm `[n]` để **kiểm chứng bằng tai**: Trình xem nguồn mở đúng nguồn đó, một
trình phát audio hiện ra và **tự tua tới đúng mốc thời gian** của đoạn được trích dẫn rồi phát, đồng thời
bản bóc băng bên dưới cuộn tới và tô nổi đoạn tương ứng.

**Why this priority**: Đây là lý do tồn tại của feature — hiện thực hoá nguyên tắc "Kiểm chứng được" ở
mức âm thanh cho nguồn audio. Không có nó, trích dẫn audio chỉ kiểm chứng được qua văn bản (045); nghe
lại đúng giây được dẫn là giá trị cốt lõi của 2a-player.

**Independent Test**: Mở một nguồn audio đã bóc băng qua một chip `[n]`; xác nhận trình phát xuất hiện,
vị trí phát nhảy tới mốc thời gian của đoạn đó, và bản bóc băng highlight đúng đoạn. Kiểm được độc lập
với các user story còn lại.

**Acceptance Scenarios**:

1. **Given** một nguồn `kind=audio` đã bóc băng xong và câu trả lời có chip `[n]` trỏ vào đoạn của nguồn
   đó, **When** người dùng bấm chip `[n]`, **Then** Trình xem nguồn mở đúng nguồn, trình phát audio hiện
   phía trên bản bóc băng, vị trí phát được đặt tới mốc thời gian (giây) đã lưu cho đoạn đó, và trình
   phát bắt đầu phát.
2. **Given** trình phát đang mở cho một nguồn audio, **When** người dùng bấm một chip `[n]` khác cùng
   nguồn nhưng trỏ đoạn khác, **Then** vị trí phát nhảy tới mốc thời gian mới tương ứng.
3. **Given** trình duyệt/hệ điều hành chặn tự phát, **When** trích dẫn audio được mở, **Then** vị trí
   phát vẫn được đặt đúng mốc, không hiện lỗi, người dùng tự bấm nút phát.

---

### User Story 2 - Nghe toàn bộ một nguồn audio (Priority: P2)

Người dùng mở một nguồn audio trực tiếp từ danh sách Nguồn (không qua trích dẫn) để nghe từ đầu và đối
chiếu với bản bóc băng.

**Why this priority**: Bổ trợ cho US1 — nghe tuần tự toàn bộ nguồn. Có giá trị nhưng ít cấp thiết hơn
việc nhảy đúng đoạn trích dẫn.

**Independent Test**: Bấm tên một nguồn audio ở cột Nguồn; xác nhận trình phát hiện và phát được từ đầu
khi bấm play, không áp mốc tua nào.

**Acceptance Scenarios**:

1. **Given** một nguồn `kind=audio`, **When** người dùng mở trực tiếp từ cột Nguồn, **Then** trình phát
   hiển thị ở đầu bản bóc băng, không đặt mốc tua, phát từ đầu khi người dùng bấm play.
2. **Given** một nguồn không phải audio (pdf/docx/txt/md/url), **When** người dùng mở, **Then** KHÔNG
   hiện trình phát audio (giữ nguyên hành vi Trình xem nguồn cũ).

---

### User Story 3 - File gốc không còn: vẫn dùng được bản bóc băng (Priority: P3)

Người dùng đã nạp một nguồn audio, sau đó **xoá hoặc di chuyển** file gốc trên đĩa. Khi mở lại nguồn,
họ được báo rõ vì sao không nghe được, nhưng vẫn đọc/kiểm chứng được bằng bản bóc băng.

**Why this priority**: Xử lý lỗi cho trade-off "tham chiếu file gốc, không copy". Bảo toàn nguyên tắc
"Kiểm chứng được" ở mức văn bản kể cả khi mất file gốc.

**Independent Test**: Mở một nguồn audio mà file gốc đã bị xoá; xác nhận có thông báo lỗi thân thiện tại
trình phát và bản bóc băng cùng chip `[n]` vẫn hiển thị, highlight bình thường.

**Acceptance Scenarios**:

1. **Given** một nguồn `kind=audio` mà file gốc đã bị xoá/di chuyển, **When** người dùng mở nguồn,
   **Then** trình phát hiện thông báo "Không phát được file âm thanh gốc (có thể đã bị xoá hoặc di
   chuyển). Bản bóc băng bên dưới vẫn xem được.", và bản bóc băng + highlight + chip `[n]` vẫn hoạt động.

---

### Edge Cases

- **File gốc bị xoá/di chuyển sau khi nạp** → phát trả về "không tìm thấy", trình phát hiện thông báo
  lỗi thân thiện; transcript không bị ảnh hưởng.
- **Tự phát (autoplay) bị chặn** → bỏ qua im lặng, không coi là lỗi; mốc tua vẫn được đặt để người dùng
  tự bấm phát đúng vị trí.
- **Mốc tua vượt/bằng độ dài file** → hành vi trình phát tiêu chuẩn (kẹp về cuối), không sập.
- **Nguồn audio chưa bóc băng xong** (đang xử lý) → không có chip `[n]`/đoạn để tua; mở trực tiếp vẫn
  nghe được toàn bộ nếu file gốc còn.
- **Nguồn không phải audio** → không hiển thị trình phát.
- **Yêu cầu tua nhiều lần trên file lớn** → mỗi lần tua chỉ tải phần cần (partial), không tải lại toàn
  bộ file.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Khi mở một nguồn `kind=audio` trong Trình xem nguồn, hệ thống MUST hiển thị một trình phát
  audio (play/pause, thanh tua, âm lượng) đặt phía trên bản bóc băng.
- **FR-002**: Bản bóc băng và việc tô nổi (highlight) đoạn trích dẫn MUST vẫn hiển thị bên dưới trình
  phát, giữ nguyên hành vi Trình xem nguồn hiện có (019).
- **FR-003**: Khi người dùng bấm chip `[n]` trỏ vào một đoạn của nguồn audio, hệ thống MUST mở đúng
  nguồn, đặt vị trí phát tới mốc thời gian (giây) đã lưu cho đoạn đó, và bắt đầu phát.
- **FR-004**: Nếu việc tự phát bị chặn, hệ thống MUST bỏ qua trong im lặng (không hiển thị lỗi); vị trí
  phát vẫn được đặt đúng mốc để người dùng tự bấm phát.
- **FR-005**: Khi mở nguồn audio trực tiếp (không qua trích dẫn), hệ thống MUST hiển thị trình phát ở
  đầu và phát từ đầu (không áp mốc tua).
- **FR-006**: Hệ thống MUST phát lại **file audio gốc** người dùng đã nạp, tham chiếu tại vị trí gốc
  trên đĩa; hệ thống MUST NOT sao chép file audio vào thư mục dữ liệu riêng của ứng dụng ở phiên bản này.
- **FR-007**: Khi file gốc không còn tồn tại (bị xoá/di chuyển), hệ thống MUST hiển thị thông báo lỗi
  thân thiện tại trình phát và MUST vẫn cho phép xem bản bóc băng, dùng chip `[n]` và highlight bình thường.
- **FR-008**: Việc phát audio MUST hoàn toàn cục bộ (không phát sinh yêu cầu mạng ra ngoài Internet);
  chỉ báo riêng tư "Chạy cục bộ" MUST không đổi và MUST NOT hiện cảnh báo egress khi phát.
- **FR-009**: Renderer MUST NOT đọc trực tiếp hệ thống file; việc đọc/phát file audio MUST đi qua tiến
  trình chính, tra theo **ID nguồn** (không nhận/ghép đường dẫn file từ renderer — chống path traversal).
- **FR-010**: Cơ chế phục vụ file MUST hỗ trợ tua tới vị trí bất kỳ bằng cách chỉ tải phần cần thiết
  (partial content), không phải tải lại toàn bộ file.
- **FR-011**: Chỉ nguồn có `kind=audio` mới được phục vụ để phát; các loại nguồn khác MUST trả về "không
  tìm thấy".
- **FR-012**: Hệ thống MUST hỗ trợ phát các định dạng audio mà feature bóc băng (045) đã nhận: wav, mp3,
  flac, ogg.
- **FR-013**: Hệ thống MUST NOT ghi log nội dung file audio hay đường dẫn file người dùng.

### Key Entities _(include if feature involves data)_

- **Nguồn audio (Source, kind=audio)**: đại diện một file audio đã nạp; mang tham chiếu tới vị trí file
  gốc trên đĩa (lưu ở tiến trình chính, không lộ ra renderer) và trạng thái xử lý.
- **Đoạn (Chunk) + Vị trí (Locator)**: đơn vị trích dẫn; với nguồn audio, Locator mang thêm mốc thời
  gian bắt đầu/kết thúc (`tStart`/`tEnd`, giây) đã được 045 lưu sẵn — 049 chỉ tiêu thụ để tua.
- **Trích dẫn (Citation `[n]`)**: liên kết một chip trong câu trả lời tới một đoạn của một nguồn; khi
  trỏ vào nguồn audio, cung cấp mốc `tStart` để tua.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% chip `[n]` trỏ nguồn audio, khi bấm, mở đúng trình phát và đặt vị trí phát khớp mốc
  thời gian của đoạn được trích dẫn (sai lệch ≤ 1 giây so với `tStart` đã lưu).
- **SC-002**: Người dùng tua tới bất kỳ vị trí nào trong file audio mà không phải chờ tải lại toàn bộ
  file (kể cả file lớn gần giới hạn kích thước 1 nguồn), thao tác tua phản hồi gần như tức thì.
- **SC-003**: Từ lúc bấm chip `[n]` audio tới khi trình phát sẵn sàng ở đúng mốc (khi file gốc còn),
  thời gian ≤ 2 giây trên máy cấu hình tầm trung.
- **SC-004**: Khi file gốc không còn, 100% trường hợp người dùng vẫn xem được bản bóc băng + highlight
  và nhận thông báo lý do rõ ràng tại trình phát.
- **SC-005**: 0 yêu cầu mạng ra ngoài Internet phát sinh trong toàn bộ luồng phát/tua audio (đo bằng
  giám sát mạng); chỉ báo "Chạy cục bộ" giữ nguyên.

## Assumptions

Các quyết định dưới đây đã được chốt trong `docs/04-decisions/2026-07-12-audio-player-clarify.md` và
`docs/04-decisions/2026-07-12-audio-transcribe-clarify.md` (mục 6) — đưa vào đây làm giả định, KHÔNG phải
điểm cần làm rõ:

- **Giao thức phục vụ media nội bộ**: file audio được phục vụ cho renderer qua một giao thức tùy biến do
  tiến trình chính đăng ký (`iv-media://`), tra theo ID nguồn trong CSDL, hỗ trợ tải theo dải (Range) để
  tua, cấp đặc quyền tối thiểu; không nhận đường dẫn file từ renderer. (ADR mục 1)
- **Tham chiếu file gốc, không copy vào data dir ở v1**: trade-off có chủ đích (file audio có thể lớn;
  copy tốn gấp đôi dung lượng và phức tạp vòng đời xoá). Hệ quả xoá/di chuyển file → không phát lại được
  → thông báo lỗi, transcript vẫn dùng được. (ADR mục 2)
- **Player nằm trong Trình xem nguồn hiện có** (không cửa sổ/route riêng), dính (sticky) phía trên bản
  bóc băng; tua theo `tStart` của trích dẫn; chờ metadata sẵn sàng trước khi tua; autoplay bị chặn thì
  bỏ qua. (ADR mục 3)
- **Nới CSP tối thiểu**: chỉ thêm một chỉ thị cho phép phần tử audio tải từ giao thức nội bộ; không đụng
  `connect-src`; phục vụ nội bộ KHÔNG tính là network egress. (ADR mục 4)
- **Định dạng audio** = đúng tập 045 (wav/mp3/flac/ogg); m4a/aac ngoài phạm vi (để dành 2b/video).
- **`tStart`/`tEnd` (giây)** đã được 045 lưu sẵn cho mỗi chunk audio; 049 chỉ tiêu thụ để tua, không tạo
  lại timestamp.
- **Kế thừa không đổi**: pipeline bóc băng/chunking/retrieval của 045; cơ chế `openCitation`/highlight/
  overlay của Trình xem nguồn (019); Citation/Locator (013).

### Ngoài phạm vi (v1)

- Sao chép file audio vào data dir; cảnh báo lúc nạp rằng phát dựa vào vị trí file gốc.
- Giới hạn phục vụ theo notebook đang mở (app single-user local — chưa cần).
- 2b Video (tách audio bằng ffmpeg); 2c Ảnh (OCR/vision).

### Dependencies

- Feature `045-audio-transcribe` (đã merge): cung cấp nguồn `kind=audio`, bản bóc băng, và
  `Locator.tStart/tEnd` cho mỗi chunk.
- Feature `019-source-viewer` (đã merge): overlay Trình xem nguồn, `openCitation`, highlight.
