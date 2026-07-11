# Feature Specification: Trình xem nguồn (Source Viewer)

**Feature Branch**: `019-source-viewer`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: bấm chip trích dẫn [n] → mở nguồn, cuộn + highlight đúng đoạn (locator);
overlay panel; tái dựng toàn văn từ chunk; PDF text-highlight; mở nguồn trực tiếp từ cột Nguồn.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Bấm chip trích dẫn → mở nguồn + highlight đúng đoạn (Priority: P1)

Sau khi hỏi đáp, người dùng thấy câu trả lời có chip trích dẫn `[n]`. Bấm vào một chip → mở trình xem
nguồn (panel phủ trên Workspace), hiển thị nội dung nguồn được trích dẫn, **cuộn tới và tô nổi bật (highlight)
đúng đoạn** mà chip đó tham chiếu, kèm nhãn "Trích dẫn [n]" cạnh đoạn. Người dùng đối chiếu câu trả lời với
đúng vị trí gốc trong tài liệu — hoàn thiện lời hứa "kiểm chứng được".

**Why this priority**: Đây là mảnh ghép cuối của vòng "kiểm chứng được" (OVERVIEW ràng buộc bất biến #2/#3):
trích dẫn không chỉ đúng dữ liệu (013) mà người dùng phải **nhìn thấy** đoạn nguồn để tin. Là MVP nhỏ nhất
mang giá trị.

**Independent Test**: Hỏi một câu có câu trả lời trong tài liệu → bấm chip `[n]` → viewer mở, cuộn tới đúng
đoạn, highlight khớp chính xác đoạn văn bản của chunk đó (đối chiếu với locator).

**Acceptance Scenarios**:

1. **Given** câu trả lời có chip `[1]` trỏ tới một chunk của nguồn PDF, **When** người dùng bấm `[1]`,
   **Then** viewer mở, hiển thị nội dung nguồn, cuộn tới đoạn của chunk đó và tô nổi bật đúng khoảng văn bản
   (khớp `charStart..charEnd`), hiển thị số trang.
2. **Given** viewer đang mở với đoạn được highlight, **When** người dùng đọc, **Then** đoạn highlight khớp
   CHÍNH XÁC nội dung chunk được trích dẫn (không lệch ký tự, không ước lượng lại vị trí).
3. **Given** viewer đang mở, **When** người dùng bấm nút đóng/quay lại, **Then** viewer đóng và quay về cột
   Chat với ngữ cảnh hội thoại còn nguyên.

---

### User Story 2 - Xem nguồn không có "trang" (docx/txt/md/URL) + nguồn URL offline (Priority: P1)

Người dùng bấm chip trỏ tới nguồn dạng `.docx`/`.txt`/`.md` hoặc URL đã lưu. Viewer hiển thị toàn văn (một
mạch cuộn tự do, không có khái niệm trang), auto-scroll tới + highlight đúng đoạn. Với nguồn URL, viewer hiển
thị **bản nội dung đã lưu lúc nạp**, hoạt động cả khi không có mạng, tuyệt đối không tải lại từ Internet.

**Why this priority**: Cùng P1 — phần lớn nguồn không phải PDF; đảm bảo kiểm chứng được cho MỌI loại nguồn,
và giữ đúng ràng buộc local-first (không egress).

**Independent Test**: Bấm chip trỏ nguồn `.txt` → viewer cuộn tới + highlight đúng khoảng ký tự. Bấm chip
trỏ nguồn URL khi ngắt mạng → vẫn hiển thị nội dung đã lưu, không lỗi mạng.

**Acceptance Scenarios**:

1. **Given** chip trỏ nguồn `.txt`/`.md`/`.docx` (không có trang), **When** bấm chip, **Then** viewer hiển
   thị toàn văn cuộn tự do, tự cuộn tới đoạn + highlight đúng khoảng ký tự, không hiển thị bộ chuyển trang.
2. **Given** chip trỏ nguồn URL đã nạp và máy đang offline, **When** bấm chip, **Then** viewer hiển thị nội
   dung đã lưu (không tải lại mạng), highlight đúng đoạn.

---

### User Story 3 - Điều hướng nhiều trích dẫn + mở nguồn trực tiếp từ cột Nguồn (Priority: P2)

Một câu trả lời có nhiều chip trỏ các đoạn/nguồn khác nhau. Khi viewer đang mở, bấm một chip khác → viewer
cập nhật tại chỗ sang nguồn/đoạn mới. Ngoài ra, người dùng có thể bấm thẳng một nguồn ở cột "Nguồn" để mở
viewer nguồn đó từ đầu tài liệu (không highlight đoạn nào).

**Why this priority**: Cải thiện luồng đối chiếu nhiều trích dẫn + đường vào viewer thứ hai (khớp wireframe),
nhưng đứng sau khả năng xem một trích dẫn (US1/US2).

**Independent Test**: Câu trả lời có `[1]` `[2]` trỏ 2 nguồn khác nhau → bấm `[1]` rồi `[2]` → viewer đổi
sang đúng nguồn/đoạn thứ hai. Bấm tên một nguồn ở cột Nguồn → viewer mở nguồn đó ở đầu, không highlight.

**Acceptance Scenarios**:

1. **Given** viewer đang mở ở trích dẫn `[1]`, **When** người dùng bấm chip `[2]` (nguồn khác), **Then**
   viewer cập nhật sang nguồn/đoạn của `[2]`, highlight đoạn mới.
2. **Given** cột Nguồn có một nguồn đã "Sẵn sàng", **When** người dùng bấm tên nguồn đó, **Then** viewer mở
   nguồn từ đầu tài liệu, không highlight đoạn nào.

---

### Edge Cases

- **Nguồn/chunk đã bị xoá** sau khi câu trả lời được sinh: bấm chip → viewer báo thân thiện "Nguồn không còn
  tồn tại" + cho đóng, không crash.
- **Nguồn chưa "Sẵn sàng"** (chưa index xong): không có trích dẫn trỏ tới (retrieval chỉ lấy nguồn ready) —
  nhưng nếu mở trực tiếp từ cột Nguồn khi chưa ready → báo nội dung chưa sẵn sàng.
- **Đoạn highlight ở cuối/đầu tài liệu**: cuộn tới đúng, không tràn.
- **Nguồn rất dài** (nhiều nghìn ký tự / nhiều trang): hiển thị + cuộn mượt, không treo.
- **Tài liệu chứa ký tự đặc biệt/emoji**: highlight vẫn khớp đúng khoảng ký tự.

## Requirements _(mandatory)_

### Functional Requirements

**Mở viewer & highlight**

- **FR-001**: Bấm chip trích dẫn `[n]` trong câu trả lời PHẢI mở trình xem nguồn hiển thị nội dung của đúng
  nguồn mà chip tham chiếu.
- **FR-002**: Viewer PHẢI cuộn tới và tô nổi bật (highlight) **chính xác** đoạn văn bản ứng với locator của
  chunk được trích dẫn (`charStart..charEnd`), KHÔNG tái tạo/ước lượng lại vị trí. (Constitution II — NON-NEGOTIABLE)
- **FR-003**: Viewer PHẢI hiển thị: tiêu đề nguồn, chỉ báo "Trích dẫn [n]", và (với nguồn có trang) số trang
  của đoạn + bộ chuyển trang; nhãn "Trích dẫn [n]" đặt cạnh đoạn được highlight.
- **FR-004**: Viewer PHẢI có cách đóng/quay lại cột Chat, giữ nguyên ngữ cảnh hội thoại.

**Nội dung nguồn & loại nguồn**

- **FR-005**: Viewer PHẢI hiển thị được nội dung của mọi loại nguồn đã hỗ trợ: PDF, `.docx`, `.txt`, `.md`,
  và URL đã lưu.
- **FR-006**: Với nguồn dạng URL, viewer PHẢI hiển thị **bản nội dung đã lưu lúc nạp**, hoạt động cả khi
  offline, và TUYỆT ĐỐI KHÔNG tải lại (fetch) từ Internet. (Constitution I)
- **FR-007**: Với nguồn không có khái niệm trang (`.docx`/`.txt`/`.md`/URL), viewer PHẢI hiển thị toàn văn
  cuộn tự do và auto-scroll tới đoạn được highlight; với PDF, PHẢI hiển thị mốc/số trang và cho chuyển trang.

**Điều hướng & đường vào thứ hai**

- **FR-008**: Khi viewer đang mở, bấm một chip trích dẫn khác PHẢI cập nhật viewer sang đúng nguồn/đoạn mới
  (kể cả khi khác nguồn).
- **FR-009**: Người dùng PHẢI mở được viewer trực tiếp từ cột "Nguồn" (bấm tên nguồn) → hiển thị nguồn từ
  đầu tài liệu, không highlight đoạn nào.

**Độ bền & bảo mật**

- **FR-010**: Khi nguồn hoặc chunk được tham chiếu không còn tồn tại, viewer PHẢI hiển thị thông báo thân
  thiện và cho đóng, không crash.
- **FR-011**: Mọi việc đọc nội dung nguồn từ đĩa/CSDL PHẢI diễn ra ở tiến trình nền (main); giao diện chỉ
  nhận dữ liệu để hiển thị qua kênh liên tiến trình được whitelist, không truy cập trực tiếp filesystem/CSDL.
  (Constitution III)
- **FR-012**: Hệ thống KHÔNG được ghi log nội dung tài liệu. Dữ liệu embedding thô KHÔNG được truyền ra giao
  diện. (Constitution III)

### Key Entities _(include if feature involves data)_

- **Nội dung nguồn để hiển thị (Source content)**: toàn văn nguồn đã được khôi phục (từ các đoạn đã lưu),
  kèm loại nguồn, tiêu đề, số trang (nếu có), và danh sách mốc trang (chỉ nguồn có trang). Tạm thời (dựng khi
  mở viewer), không lưu bền riêng.
- **Trích dẫn đang xem (Active citation)**: chip `[n]` người dùng đang mở — gồm nguồn + locator (đoạn cần
  highlight). Có thể rỗng khi mở nguồn trực tiếp từ cột Nguồn.
- **Đoạn highlight (Highlighted span)**: khoảng văn bản `[charStart, charEnd)` được tô nổi bật trong viewer,
  suy trực tiếp từ locator của trích dẫn.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Bấm chip `[n]` mở viewer và highlight đúng đoạn trong ≤ 2 giây với tài liệu thông thường.
- **SC-002**: Đoạn được highlight khớp CHÍNH XÁC nội dung chunk trích dẫn (đối chiếu ký tự) trong 100% trường
  hợp — không lệch, không ước lượng.
- **SC-003**: Viewer hiển thị đúng cho mọi loại nguồn (PDF/docx/txt/md/URL); nguồn URL hiển thị được khi
  offline (không có lời gọi mạng nào).
- **SC-004**: Bấm chip khác khi viewer đang mở luôn cập nhật sang đúng nguồn/đoạn mới.
- **SC-005**: Bấm chip trỏ nguồn đã xoá → thông báo thân thiện, không có sự cố (crash/đơ).
- **SC-006**: Không có mục log nào chứa nội dung tài liệu.

## Assumptions

Các quyết định đã chốt ở `docs/04-decisions/2026-07-11-source-viewer-clarify.md` +
`2026-07-11-source-viewer-strategy.md` (không còn ẩn số):

- **A1 — Toàn văn**: TÁI DỰNG TỪ CHUNK đã lưu (ghép `chunk.text` theo `charStart`, cắt overlap → khôi phục
  văn bản đã-làm-sạch). Local hoàn toàn, offset khớp locator 100%, URL không fetch lại, KHÔNG đụng 011.
- **A2 — PDF**: hiển thị TEXT đã trích + highlight (không render canvas nguyên bản — polish sau).
- **A3 — Vị trí**: OVERLAY/PANEL phủ trên Workspace, đóng để về chat (giữ ngữ cảnh).
- **A4 — IPC**: 1 kênh `source:getContent(sourceId)` → `SourceContent { kind, title, pageCount, text,
pageBreaks }`; highlight dùng trực tiếp `locator.charStart/charEnd` (offset TOÀN CỤC vào `text`);
  `pageBreaks=[{page,offset}]` chỉ PDF, non-PDF rỗng.
- **A5 — Nhiều chip**: viewer state-driven, cập nhật tại chỗ; MVP không nút prev/next.
- **A6 — Constitution III**: trả văn bản nguồn để HIỂN THỊ qua `getContent` whitelisted là hợp lệ (người
  dùng chủ động xem); vector thô KHÔNG gửi renderer; không log nội dung.
- **A7 — Đã xoá**: `getContent` trả null → viewer báo "Nguồn không còn tồn tại".
- **A8 — Non-PDF**: một trang dài cuộn tự do, auto-scroll + highlight, không pager; PDF có mốc trang + pager.
- **A9 — Mở trực tiếp từ cột Nguồn**: trong phạm vi; `SourceItem`/`SourceList` (011) thêm `onOpen(sourceId)`.
- Kế thừa: `Citation`/`Locator` (013), `Source`/`Chunk`/`listChunks`/`getById` (011), `MessageBubble.onCite`
  (013), khuôn IPC whitelisted + `ChannelResponse`.
- Ngoài phạm vi: render canvas PDF + toạ độ bbox (pha sau); chỉnh sửa nguồn; Studio; Audio/Video/Ảnh (Pha 2);
  KHÔNG migration/schema mới; KHÔNG sửa pipeline 011 hay type Citation/Locator (013).
