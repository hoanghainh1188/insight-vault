# Feature Specification: Nạp Hình ảnh — OCR + highlight vùng bbox (Pha 2c)

**Feature Branch**: `053-image`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Xây tính năng nạp Hình ảnh làm nguồn cho InsightVault, khép lại Pha 2…"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Nạp ảnh và hỏi đáp có trích dẫn (Priority: P1)

Người dùng thêm một ảnh có chữ (scan tài liệu, screenshot, ảnh chụp trang sách) vào notebook qua modal
"Thêm nguồn". Ứng dụng tự nhận dạng chữ (OCR) thành văn bản, lập chỉ mục để **hỏi đáp và nhận câu trả lời
có chip `[n]`** trỏ về đúng ảnh — như mọi loại nguồn khác.

**Why this priority**: Giá trị cốt lõi của 2c — biến ảnh (vốn không tìm kiếm/hỏi đáp được) thành tri thức
truy vấn được, giữ "Kiểm chứng được". Nhiều tài liệu quan trọng chỉ tồn tại dạng ảnh scan.

**Independent Test**: Nạp 1 ảnh có chữ → chờ xử lý → hỏi 1 câu liên quan nội dung → nhận câu trả lời kèm
chip `[n]` trỏ vào ảnh.

**Acceptance Scenarios**:

1. **Given** một ảnh có chữ, **When** người dùng nạp qua modal Thêm nguồn, **Then** hệ thống nhận dạng chữ,
   lập chỉ mục và nguồn chuyển sẵn sàng; tiến độ hiển thị bước nhận dạng chữ.
2. **Given** một ảnh đã nhận dạng chữ, **When** người dùng hỏi câu liên quan, **Then** câu trả lời chứa
   chip `[n]` trỏ về nguồn ảnh đó.

---

### User Story 2 - Xem lại đúng vùng chữ được trích dẫn trên ảnh (Priority: P1)

Người dùng bấm chip `[n]` trỏ vào một nguồn ảnh → Trình xem nguồn mở, hiển thị ảnh và **vẽ khung nổi bật
đúng vùng chữ** (bbox) của đoạn được trích dẫn trên ảnh.

**Why this priority**: Đây là "Kiểm chứng được" cho ảnh — chỉ đúng chỗ trên ảnh mà câu trả lời dẫn, không
chỉ mở ảnh chung chung. Ngang P1 với US1 vì là điểm khác biệt cốt lõi.

**Independent Test**: Bấm chip `[n]` của nguồn ảnh → ảnh hiện + khung overlay bao đúng vùng chữ tương ứng
đoạn trích dẫn (khớp vị trí kể cả khi ảnh co giãn theo khung hiển thị).

**Acceptance Scenarios**:

1. **Given** một nguồn ảnh đã nhận dạng chữ và chip `[n]` trỏ vào đoạn của nó, **When** người dùng bấm
   `[n]`, **Then** Trình xem nguồn mở ảnh và vẽ khung bao đúng vùng chữ của đoạn (khớp vị trí ở mọi kích
   thước hiển thị).
2. **Given** người dùng mở nguồn ảnh trực tiếp (không qua chip), **When** ảnh hiển thị, **Then** không vẽ
   khung nào (chỉ xem ảnh).
3. **Given** file ảnh gốc đã bị xoá/di chuyển, **When** người dùng mở nguồn, **Then** hệ thống báo lỗi
   thân thiện và transcript + chip `[n]` vẫn hoạt động.

---

### User Story 3 - Ảnh không có chữ vẫn nạp được (Priority: P2)

Người dùng nạp ảnh không chứa chữ (ảnh phong cảnh, biểu đồ thuần hình) — hệ thống vẫn nhận nguồn, hiển thị
ảnh xem được, và báo nhẹ rằng không phát hiện chữ để lập chỉ mục.

**Why this priority**: Xử lý biên; tránh chặn người dùng. Ít cấp thiết hơn luồng có chữ.

**Independent Test**: Nạp 1 ảnh không chữ → nạp thành công (sẵn sàng), mở nguồn xem được ảnh, có thông báo
"không phát hiện chữ".

**Acceptance Scenarios**:

1. **Given** một ảnh không có chữ, **When** người dùng nạp, **Then** nguồn chuyển sẵn sàng (0 đoạn trích
   dẫn), ảnh vẫn xem được, hệ thống báo nhẹ "không phát hiện chữ trong ảnh".

---

### Edge Cases

- **Ảnh không có chữ** → vẫn nạp thành công, 0 đoạn, ảnh xem được, báo nhẹ.
- **File ảnh gốc bị xoá/di chuyển** → hiển thị lỗi thân thiện; transcript không bị ảnh hưởng.
- **Ảnh rất lớn / độ phân giải cao** → có giới hạn kích thước; nhận dạng có thể lâu, tiến độ phản ánh.
- **Định dạng không hỗ trợ** → từ chối với thông báo rõ định dạng được nhận.
- **Đoạn trích dẫn trải nhiều dòng chữ** → khung bao là vùng hợp của các dòng (một khối chữ nhật).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hệ thống MUST cho phép nạp ảnh định dạng png, jpg/jpeg, webp, bmp, tiff qua modal Thêm nguồn
  (bật ô "Hình ảnh" hiện đang vô hiệu).
- **FR-002**: Khi nạp ảnh, hệ thống MUST tự nhận dạng chữ (OCR, ngôn ngữ Việt + Anh) thành văn bản kèm
  **vị trí vùng chữ** (bbox) theo dòng, rồi lập chỉ mục để hỏi đáp.
- **FR-003**: Hệ thống MUST gắn nguồn ảnh là loại `image`.
- **FR-004**: Câu trả lời hỏi đáp MUST hỗ trợ chip `[n]` trỏ về đoạn của ảnh, map đúng nguồn + vùng chữ.
- **FR-005**: Khi mở một nguồn `image` trong Trình xem nguồn, hệ thống MUST hiển thị ảnh.
- **FR-006**: Khi bấm chip `[n]` trỏ vào nguồn ảnh, hệ thống MUST hiển thị ảnh và **vẽ khung nổi bật đúng
  vùng chữ** của đoạn trích dẫn, khớp vị trí ở mọi kích thước hiển thị (ảnh co giãn).
- **FR-007**: Khi mở nguồn ảnh trực tiếp (không qua chip), hệ thống MUST hiển thị ảnh mà không vẽ khung.
- **FR-008**: Hệ thống MUST hiển thị ảnh từ **file gốc** người dùng đã nạp, tham chiếu tại vị trí gốc;
  MUST NOT sao chép vào thư mục dữ liệu ứng dụng.
- **FR-009**: Khi file gốc không còn, hệ thống MUST hiển thị thông báo lỗi thân thiện và MUST vẫn cho xem
  transcript + dùng chip `[n]`.
- **FR-010**: Ảnh KHÔNG có chữ (không nhận dạng được văn bản) MUST vẫn nạp thành công (0 đoạn), ảnh vẫn
  xem được; hệ thống MUST báo nhẹ "không phát hiện chữ trong ảnh" mà không chặn.
- **FR-011**: Việc nhận dạng chữ + đọc/hiển thị ảnh MUST chạy hoàn toàn cục bộ (không gửi dữ liệu ảnh ra
  ngoài). Dữ liệu ngôn ngữ nhận dạng MAY tải về **một lần** ở lần dùng đầu (hiển thị chỉ báo đang tải);
  sau đó chạy không cần Internet. Chỉ báo riêng tư MUST phản ánh đúng trạng thái.
- **FR-012**: Renderer MUST NOT đọc trực tiếp hệ thống file hay chạy nhận dạng chữ; các thao tác này MUST
  ở tiến trình chính, tra ảnh theo ID nguồn (không nhận đường dẫn từ renderer).
- **FR-013**: Hệ thống MUST giới hạn kích thước 1 nguồn ảnh ở 50MB.
- **FR-014**: Hệ thống MUST NOT ghi log nội dung/đường dẫn ảnh người dùng.
- **FR-015**: Bản đóng gói (macOS + Windows) MUST chạy được luồng OCR mà không cần người dùng cài thêm
  công cụ (thành phần nhận dạng đi kèm app; chỉ dữ liệu ngôn ngữ tải lần đầu như FR-011).

### Key Entities _(include if feature involves data)_

- **Nguồn ảnh (Source, kind=image)**: file ảnh đã nạp; tham chiếu vị trí gốc (ở main); transcript sinh từ
  OCR (rỗng nếu ảnh không chữ).
- **Đoạn + Locator (bbox)**: đơn vị trích dẫn; với ảnh, Locator mang **vùng chữ** (bbox, chuẩn hoá theo
  kích thước ảnh) — dùng để vẽ khung nổi bật.
- **Trích dẫn `[n]`**: liên kết chip → đoạn → nguồn + vùng chữ.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Người dùng nạp được ảnh png/jpg/jpeg/webp/bmp/tiff và, với ảnh có chữ, nhận câu trả lời hỏi
  đáp có chip `[n]` trỏ đúng nguồn — tỷ lệ thành công 100% trên tập ảnh mẫu có chữ rõ.
- **SC-002**: 100% chip `[n]` trỏ nguồn ảnh mở ảnh và vẽ khung bao đúng vùng chữ của đoạn (khung phủ vùng
  chữ tương ứng, khớp vị trí kể cả khi ảnh được co giãn).
- **SC-003**: Ảnh không có chữ vẫn nạp thành công 100% và xem được, kèm thông báo trạng thái rõ ràng.
- **SC-004**: 0 yêu cầu gửi dữ liệu ảnh ra ngoài Internet trong toàn bộ luồng nạp/nhận dạng/hiển thị (đo
  bằng giám sát mạng); chỉ có thể có 1 lần tải dữ liệu ngôn ngữ ở lần đầu, có chỉ báo.
- **SC-005**: Bản đóng gói (macOS arm64 + Windows x64) chạy được luồng OCR không cần người dùng cài thêm
  công cụ nào.

## Assumptions

Quyết định đã chốt ở `docs/04-decisions/2026-07-13-image-clarify.md` (Assumptions, KHÔNG cần làm rõ):

- **Engine nhận dạng chữ = OCR tesseract.js (WASM), chạy ở main**, ngôn ngữ vie+eng; vision (mô tả ảnh
  không chữ) ngoài phạm vi.
- **Dữ liệu ngôn ngữ OCR tải lần đầu** (cache vào data dir, badge egress), sau offline — như model Whisper 045.
- **Highlight vùng bbox mức DÒNG** — chunk nhiều dòng → khung = hợp bbox các dòng; bbox chuẩn hoá 0..1 theo
  kích thước ảnh (đọc WxH từ header ảnh, không decode cả ảnh).
- **`Locator` thêm `bbox?`** `{x,y,w,h}` (0..1), backward-compat như `tStart/tEnd` (045).
- **Hiển thị ảnh + phục vụ file gốc**: tái dùng giao thức media nội bộ của 049/051 (`iv-media://`, tra theo
  ID nguồn, path không từ renderer), thêm loại ảnh; renderer đặt `<img src>`. Tham chiếu file gốc, KHÔNG
  copy vào data dir.
- **Migration #6** thêm 4 cột `bbox_*` (REAL) cho vùng chữ (ADD COLUMN thuần; `kind=image` không cần
  migration vì 045 đã bỏ CHECK); **CSP** chỉ thêm `iv-media:` vào `img-src`.
- **Định dạng**: png/jpg/jpeg/webp/bmp/tiff. **heic + gif động ngoài phạm vi**.
- **Ảnh không chữ**: vẫn nạp ready, 0 đoạn.
- **Đóng gói**: thành phần WASM OCR + worker đi kèm app (đưa ngoài asar + resolve đường dẫn dev/đóng gói).
- **Bảo mật (Constitution III)**: OCR + đọc/hiển thị ảnh CHỈ ở main; renderer sandbox chỉ đặt `<img src>`;
  ảnh tra theo ID nguồn từ DB; không log path/nội dung.

### Ngoài phạm vi (v1)

- Vision Ollama (mô tả ảnh không chữ); heic; layout/table/handwriting detection; tiền xử lý nâng cao
  (deskew/threshold); OCR ngôn ngữ khác vie+eng.

### Dependencies

- `045-audio-transcribe` (đã merge): pattern cache model + badge egress + progress; cơ chế map char↔vị trí
  (timeMap → boxMap).
- `049-audio-player` / `051-video` (đã merge): giao thức `iv-media://`, Source Viewer + onError.
- `037` progress events; `019` Source Viewer; `011` ingestion/source-repo.
