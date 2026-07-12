# Feature Specification: Workspace enhancements (Studio nâng cấp + kéo cột + nav)

**Feature Branch**: `025-workspace-enhance`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: Nâng trải nghiệm màn Workspace 3 cột. (A) Studio: tổng hợp toàn bộ nguồn notebook
lớn (tăng ngân sách, giữ chip [n] chính xác — KHÔNG map-reduce) · lọc theo 1 nguồn · Copy/Export/skeleton. (B) Kéo đổi độ rộng cột (nhớ được). (C) Nút
Workspace trên rail nhớ notebook gần nhất.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Tổng hợp bao phủ rộng hơn, giữ trích dẫn chính xác (Priority: P1)

Người dùng có notebook nhiều tài liệu. Trước đây Studio cắt cụt sớm (báo "dựa trên phần đầu tài liệu"). Nay
hệ thống nới **hạn mức ngữ cảnh rộng hơn** để bao phủ nhiều nội dung hơn trong một lượt, **giữ trích dẫn
`[n]` chính xác tới từng đoạn**. Với notebook vẫn vượt hạn mức mới, kết quả tổng hợp phần đầu và có ghi chú
rõ; người dùng có thể **tổng hợp riêng từng nguồn** (US2) để mỗi lần vừa hạn mức và trích dẫn chính xác.

**Why this priority**: Giảm mạnh việc cắt cụt notebook lớn mà KHÔNG hy sinh độ chính xác trích dẫn (ưu tiên
tính kiểm chứng được — trích dẫn tới đúng đoạn). Là giới hạn thực tế lớn nhất của Studio hiện tại.

**Independent Test**: Với notebook vừa hạn mức mới (trước đây bị cắt), tạo một bản tổng hợp → bao phủ trọn
vẹn, chip `[n]` mở đúng đoạn; notebook vẫn vượt → có ghi chú tổng hợp phần đầu.

**Acceptance Scenarios**:

1. **Given** notebook có tổng nội dung trong hạn mức (rộng hơn trước), **When** người dùng tạo một bản tổng
   hợp, **Then** kết quả bao phủ trọn vẹn nội dung và mọi chip `[n]` mở đúng **đoạn** nguồn.
2. **Given** notebook vẫn vượt hạn mức mới, **When** người dùng tạo một bản tổng hợp, **Then** kết quả tổng
   hợp phần đầu kèm ghi chú rõ (không ngầm cắt), chip `[n]` vẫn mở đúng đoạn.
3. **Given** bất kỳ bản tổng hợp nào, **When** hiển thị, **Then** không có nội dung/nguồn bịa — mọi chip
   `[n]` trỏ đúng đoạn nguồn thật.

---

### User Story 2 - Tổng hợp theo một nguồn cụ thể (Priority: P2)

Người dùng muốn tổng hợp riêng một tài liệu thay vì cả notebook. Ở cột Studio, họ chọn một nguồn từ danh
sách "Tất cả nguồn / <tên nguồn>" rồi bấm loại tổng hợp → kết quả chỉ dựa trên nguồn đã chọn.

**Why this priority**: Hữu ích khi notebook có nhiều tài liệu khác chủ đề; phụ thuộc kiến trúc US1.

**Independent Test**: Chọn 1 nguồn cụ thể → tạo tóm tắt → nội dung chỉ phản ánh nguồn đó; đổi về "Tất cả
nguồn" → tổng hợp cả notebook.

**Acceptance Scenarios**:

1. **Given** notebook có ≥2 nguồn sẵn sàng, **When** người dùng chọn 1 nguồn rồi tạo tổng hợp, **Then** kết
   quả chỉ dùng nội dung của nguồn đó.
2. **Given** đang chọn 1 nguồn, **When** người dùng đổi về "Tất cả nguồn" và tạo lại, **Then** kết quả tổng
   hợp toàn notebook.

---

### User Story 3 - Sao chép và xuất kết quả (Priority: P2)

Người dùng muốn dùng kết quả Studio ở nơi khác. Trên card kết quả có nút **Sao chép** (đưa nội dung vào bộ
nhớ tạm) và **Xuất** (lưu ra tệp `.md`). Trong lúc đang tạo, card hiển thị khung chờ (skeleton).

**Why this priority**: Đưa giá trị Studio ra ngoài ứng dụng; độc lập với US1/US2.

**Independent Test**: Bấm Sao chép → nội dung vào clipboard; bấm Xuất → chọn nơi lưu → tệp `.md` được ghi;
trong lúc tạo → thấy skeleton.

**Acceptance Scenarios**:

1. **Given** một card kết quả, **When** bấm **Sao chép**, **Then** nội dung (kèm dấu `[n]`) vào bộ nhớ tạm và
   có phản hồi "đã sao chép".
2. **Given** một card kết quả, **When** bấm **Xuất**, **Then** hệ thống mở hộp thoại chọn nơi lưu và ghi tệp
   `.md` chứa nội dung; huỷ hộp thoại → không ghi gì.
3. **Given** đang tạo một loại, **When** chờ, **Then** card hiển thị khung chờ (skeleton) thay vì trống.

---

### User Story 4 - Kéo đổi độ rộng cột (Priority: P2)

Người dùng kéo thanh chia giữa các cột để đổi độ rộng cột Nguồn và cột Studio (cột Chat co giãn theo phần
còn lại). Độ rộng được nhớ cho lần mở sau.

**Why this priority**: Cải thiện không gian làm việc theo thói quen từng người; thuần giao diện.

**Independent Test**: Kéo thanh chia → cột rộng/hẹp theo; đóng và mở lại app → độ rộng giữ nguyên.

**Acceptance Scenarios**:

1. **Given** màn Workspace, **When** người dùng kéo thanh chia giữa cột Nguồn và cột Chat, **Then** cột Nguồn
   đổi độ rộng trong giới hạn cho phép, cột Chat co giãn theo.
2. **Given** đã chỉnh độ rộng, **When** người dùng mở lại notebook/khởi động lại app, **Then** độ rộng cột
   được khôi phục.
3. **Given** kéo tới biên, **When** vượt giới hạn nhỏ nhất/lớn nhất, **Then** độ rộng dừng ở giới hạn (cột
   không biến mất).

---

### User Story 5 - Nút Workspace nhớ notebook gần nhất (Priority: P3)

Người dùng bấm mục "Workspace" trên thanh điều hướng: nếu từng mở một notebook, hệ thống mở lại notebook gần
nhất; nếu chưa mở cái nào (hoặc notebook đó đã bị xoá), hiển thị lời nhắc kèm nút "Chọn notebook".

**Why this priority**: Sửa điểm lấn cấn hiện tại (nút Workspace dẫn tới trang trống vô dụng); nhỏ, độc lập.

**Independent Test**: Mở một notebook rồi bấm mục Workspace từ nơi khác → quay lại đúng notebook đó; xoá
notebook đó rồi bấm Workspace → thấy lời nhắc chọn notebook.

**Acceptance Scenarios**:

1. **Given** người dùng đã mở notebook X, **When** bấm mục "Workspace" trên rail, **Then** hệ thống mở
   Workspace của notebook X.
2. **Given** chưa mở notebook nào, **When** bấm "Workspace", **Then** hiển thị lời nhắc + nút "Chọn notebook"
   dẫn về màn Notebooks.
3. **Given** notebook gần nhất đã bị xoá, **When** bấm "Workspace", **Then** hiển thị lời nhắc chọn notebook
   (không lỗi).

---

### Edge Cases

- **Notebook rỗng / chưa có nguồn sẵn sàng**: nút tổng hợp vẫn vô hiệu như hiện tại; dropdown chọn nguồn
  trống hoặc chỉ có "Tất cả nguồn".
- **Chọn 1 nguồn nhưng nguồn đó vẫn vượt hạn mức**: tổng hợp phần đầu nguồn đó + ghi chú cắt cụt (chip `[n]`
  vẫn chính xác).
- **Huỷ hộp thoại Xuất**: không ghi tệp, không lỗi.
- **Clipboard bị chặn**: hiển thị thông báo không sao chép được, không làm treo.
- **Kéo cột trên màn hẹp**: giữ giới hạn min để cả 3 cột vẫn dùng được; không tràn ngang.
- **localStorage bị xoá/hỏng**: quay về độ rộng mặc định + không nhớ notebook (an toàn, không lỗi).
- **Không log nội dung** tài liệu/kết quả kể cả khi xuất tệp hay lỗi.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hệ thống MUST nới hạn mức ngữ cảnh (rộng hơn hiện tại) để bao phủ nhiều nội dung hơn trong một
  lượt tổng hợp, và MUST kèm trích dẫn `[n]` chính xác tới từng đoạn.
- **FR-002**: Khi tổng nội dung vẫn **vượt** hạn mức mới, hệ thống MUST tổng hợp phần đầu và **ghi chú rõ**
  (không ngầm cắt); trích dẫn vẫn chính xác tới đoạn. (KHÔNG dùng tổng-hợp-nhiều-lượt hạ độ chính xác.)
- **FR-003**: Mọi kết quả tổng hợp MUST kèm trích dẫn `[n]` trỏ đúng **đoạn** nguồn thật và MUST KHÔNG bịa
  nội dung/nguồn.
- **FR-004**: Người dùng MUST chọn được phạm vi tổng hợp: toàn bộ nguồn hoặc một nguồn cụ thể trong notebook.
- **FR-005**: Kết quả lưu MUST giữ quy ước một bản mới nhất mỗi loại mỗi notebook (tạo lại ghi đè) — không
  lưu tách theo từng nguồn.
- **FR-006**: Card kết quả MUST có hành động **Sao chép** (đưa nội dung vào bộ nhớ tạm) và **Xuất** (lưu tệp
  `.md`); huỷ thao tác xuất MUST không ghi gì.
- **FR-007**: Trong lúc đang tạo một loại, giao diện MUST hiển thị khung chờ (skeleton).
- **FR-008**: Người dùng MUST kéo được thanh chia để đổi độ rộng cột Nguồn và cột Studio, trong giới hạn
  nhỏ nhất/lớn nhất; cột Chat co giãn theo phần còn lại.
- **FR-009**: Độ rộng cột đã chỉnh MUST được ghi nhớ và khôi phục ở lần mở sau.
- **FR-010**: Mục "Workspace" trên thanh điều hướng MUST mở lại notebook mở gần nhất; nếu không có (hoặc đã
  xoá) MUST hiển thị lời nhắc kèm nút dẫn về màn Notebooks.
- **FR-011**: Việc đọc nội dung nguồn, gọi mô hình, và ghi tệp xuất MUST chỉ diễn ra ở tiến trình chính;
  giao diện chỉ trao đổi qua kênh được cấp phép (whitelisted).
- **FR-012**: Hệ thống MUST KHÔNG BAO GIỜ ghi log nội dung tài liệu hay nội dung kết quả (kể cả khi xuất tệp
  hoặc khi lỗi).

### Key Entities _(include if feature involves data)_

- **Kết quả Studio (StudioResult)** _(tái dùng 021)_: giữ nguyên (cờ `truncated` như 021 cho ghi chú cắt
  cụt); vẫn một bản mới nhất mỗi loại mỗi notebook. Không thêm bảng/lược đồ mới.
- **Độ rộng cột (col widths)**: sở thích bố cục cục bộ (không phải dữ liệu nghiệp vụ) — lưu cục bộ, toàn cục
  cho mọi notebook.
- **Notebook gần nhất (last notebook)**: id notebook mở gần nhất — lưu cục bộ để điều hướng.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Notebook trước đây bị cắt cụt (trong hạn mức mới, rộng hơn) nay được tổng hợp trọn vẹn (không
  còn cờ cắt cụt) — kiểm bằng nội dung ở phần sau tài liệu xuất hiện trong kết quả.
- **SC-002**: 100% chip `[n]` trên kết quả Studio trỏ đúng **đoạn** nguồn thật (mở Source Viewer highlight
  chính xác); 0 trích dẫn/nguồn bịa.
- **SC-003**: Người dùng tổng hợp được theo một nguồn cụ thể bằng một lựa chọn + một cú bấm.
- **SC-004**: Người dùng sao chép và xuất được kết quả ra `.md`; nội dung tệp khớp nội dung hiển thị.
- **SC-005**: Độ rộng cột do người dùng chỉnh được khôi phục đúng sau khi khởi động lại ứng dụng.
- **SC-006**: Từ mục "Workspace" trên rail, người dùng quay lại đúng notebook gần nhất trong một cú bấm (khi
  có); trường hợp không có được dẫn về Notebooks, không lỗi.
- **SC-007**: 0 hồi quy — các luồng hiện có (hỏi đáp, xem nguồn, Studio notebook nhỏ, CRUD notebook, nạp
  nguồn) vẫn hoạt động đúng.
- **SC-008**: Ở chế độ mặc định, mọi thao tác (kể cả xuất tệp) không phát sinh lưu lượng mạng ra ngoài.

## Assumptions

- **A1 — Tăng ngân sách, KHÔNG map-reduce** (người dùng đảo quyết định 2026-07-11): nới
  `STUDIO_CONTEXT_BUDGET` (8000 → ~16000, vẫn dưới context window) để bao phủ rộng hơn trong 1 lượt, giữ chip
  `[n]` chính xác. Notebook vượt hạn mức mới vẫn cắt cụt + ghi chú (như 021). Map-reduce ĐÃ BÁC (ADR
  `2026-07-11-studio-mapreduce-citation.md`).
- **A2 — Lọc theo nguồn**: chỉ đổi ngữ cảnh lần tạo (thêm phạm vi nguồn); không lưu tách theo nguồn.
- **A3 — Xuất tệp**: Sao chép qua bộ nhớ tạm; Xuất `.md` qua hộp thoại lưu ở tiến trình chính (không log).
- **A4 — Độ rộng cột**: lưu cục bộ, một bộ độ rộng dùng chung mọi notebook; có giới hạn min/max (Nguồn
  220–460, Studio 200–420, Chat co giãn).
- **A5 — Notebook gần nhất**: lưu cục bộ ở giao diện; notebook đã xoá → lời nhắc chọn.
- **A6 — Một feature, chia phase**: A (Studio) → B (kéo cột) → C (nav).
- **A7 — Ngôn ngữ**: nội dung sinh bằng tiếng Việt (khớp UI).
- **A8 — Kế thừa, không phá vỡ**: dùng lại dữ liệu/kiểu của 011/013/019/021; KHÔNG lược đồ/migration mới;
  KHÔNG đổi các luồng logic khác (hỏi đáp, xem nguồn, nạp nguồn).

## Out of Scope

- Streaming câu trả lời + lưu lịch sử chat (feature sau).
- Nhà cung cấp AI online (feature sau).
- Lưu kết quả Studio tách theo từng nguồn (mở lược đồ — hoãn).
- Kéo đổi độ rộng cột theo từng notebook (chỉ toàn cục).
- Thay đổi luồng hỏi đáp / xem nguồn / nạp nguồn.
