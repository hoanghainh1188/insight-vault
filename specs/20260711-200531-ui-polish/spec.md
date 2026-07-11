# Feature Specification: UI Polish v1 (nền design-system + đối chiếu prototype)

**Feature Branch**: `023-ui-polish`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: Đánh bóng giao diện renderer để khớp wireframe gốc (prototype 5 màn) và dựng nền
design-system. Thuần thị giác/UX — không đổi logic. Gồm: (A) token citation vàng + gom màu/motion, (B) sửa
lệch cấu trúc NavRail/composer/bubble, (C) a11y + empty/skeleton.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Chip trích dẫn có màu semantic riêng (Priority: P1)

Người dùng đọc câu trả lời AI (Chat) hoặc bản tổng hợp (Studio) và thấy chip `[n]`. Hiện chip dùng cùng màu
xanh với các nút khác nên khó nhận ra đâu là trích dẫn. Sau feature này, chip `[n]` và đoạn highlight trong
Trình xem nguồn dùng **một bảng màu vàng riêng biệt**, nhất quán khắp Chat · Studio · Xem nguồn — người dùng
lập tức nhận ra "đây là điểm neo kiểm chứng được".

**Why this priority**: "Kiểm chứng được" là 1 trong 3 điểm khác biệt bất biến của sản phẩm; tín hiệu thị
giác của trích dẫn phải rõ và nhất quán. Chi phí thấp (token), tác động cao.

**Independent Test**: Mở Chat có câu trả lời kèm chip + Studio có card kèm chip + Xem nguồn highlight → cả
ba dùng cùng bảng màu vàng, phân biệt rõ với nút thường; hành vi bấm chip không đổi (vẫn mở đúng nguồn).

**Acceptance Scenarios**:

1. **Given** một câu trả lời AI có chip `[n]`, **When** người dùng nhìn cột Chat, **Then** chip hiển thị
   bằng bảng màu trích dẫn riêng (không trùng màu nút hành động chính).
2. **Given** một card Studio có chip `[n]`, **When** hiển thị, **Then** chip dùng cùng bảng màu trích dẫn
   như Chat.
3. **Given** Trình xem nguồn mở tại một trích dẫn, **When** đoạn được tô nổi bật, **Then** highlight dùng
   cùng hệ màu trích dẫn.
4. **Given** bất kỳ chip `[n]` nào, **When** bấm, **Then** vẫn mở đúng nguồn/đoạn như trước (hành vi không
   đổi).

---

### User Story 2 - Giao diện khớp wireframe gốc (Priority: P1)

Người dùng dùng các màn chính thấy bố cục sát với thiết kế gốc: thanh điều hướng dọc gọn bằng biểu tượng,
ô soạn câu hỏi có đủ ngữ cảnh (mô hình đang dùng, chế độ, nút gửi), hội thoại đọc dễ với nhãn người nói rõ.

**Why this priority**: Bố cục hiện lệch nhiều so với wireframe gốc, ảnh hưởng ấn tượng chuyên nghiệp và khả
năng dùng của màn dùng nhiều nhất (Workspace).

**Independent Test**: Đối chiếu trực quan từng màn với wireframe: thanh điều hướng dạng rail biểu tượng +
mục Cài đặt ở đáy; ô soạn có chỉ báo mô hình + chế độ + nút gửi; hội thoại có nhãn người nói.

**Acceptance Scenarios**:

1. **Given** ứng dụng mở, **When** nhìn thanh điều hướng, **Then** là rail dọc gọn bằng biểu tượng, mục Cài
   đặt nằm ở đáy, mỗi mục có nhãn trợ năng.
2. **Given** cột Chat, **When** nhìn ô soạn câu hỏi, **Then** thấy chỉ báo mô hình đang dùng, bộ chọn chế
   độ dạng gạt liền khối, và nút gửi bằng biểu tượng.
3. **Given** một lượt hội thoại, **When** hiển thị, **Then** mỗi tin có nhãn người nói ("InsightVault" /
   "Bạn"), tin của AI dễ đọc (không lẫn kiểu bong bóng).
4. **Given** mọi thay đổi trên, **When** người dùng thao tác hỏi đáp/điều hướng, **Then** chức năng hoạt
   động y như trước (không đổi hành vi).

---

### User Story 3 - Trạng thái rỗng, tải, và trợ năng bàn phím (Priority: P2)

Người dùng gặp các trạng thái biên được xử lý gọn gàng: danh sách notebook rỗng/không có kết quả tìm có
thông báo rõ; khi AI đang trả lời có chỉ báo tải dạng khung chờ; và toàn app dùng được bằng bàn phím (viền
focus rõ, đóng hộp thoại bằng Escape).

**Why this priority**: Trạng thái biên + trợ năng nâng chất lượng cảm nhận và đáp ứng yêu cầu a11y; phụ
thuộc phần khung/vỏ nên làm sau P1.

**Independent Test**: Notebook rỗng → hiện thông báo; tìm không ra → hiện "không tìm thấy"; gửi câu hỏi →
khung chờ; Tab qua nav/nút → viền focus rõ; mở hộp thoại → Escape đóng được.

**Acceptance Scenarios**:

1. **Given** chưa có notebook nào (hoặc tìm không ra), **When** xem màn Notebooks, **Then** hiện thông báo
   trạng thái rỗng/không kết quả thay vì lưới trống.
2. **Given** vừa gửi câu hỏi, **When** đang chờ AI, **Then** hiện chỉ báo tải dạng khung chờ (skeleton).
3. **Given** dùng bàn phím, **When** Tab tới mục điều hướng/nút, **Then** có viền focus rõ ràng.
4. **Given** một hộp thoại đang mở (Thêm nguồn / Notebook), **When** nhấn Escape, **Then** hộp thoại đóng;
   hộp thoại có thuộc tính trợ năng phù hợp và bẫy focus.

---

### Edge Cases

- **Người dùng bật reduced-motion**: chuyển động phải tôn trọng thiết lập giảm chuyển động của hệ điều hành.
- **Nội dung dài/ngắn**: nhãn người nói, chip, khung chờ không vỡ bố cục ở nội dung rất ngắn/rất dài.
- **Không có mô hình đang chọn**: chỉ báo mô hình ở ô soạn hiển thị trạng thái "chưa chọn" hợp lý, không
  trống rỗng khó hiểu.
- **Tương phản màu**: bảng màu trích dẫn vàng phải đạt ngưỡng tương phản chữ/nền tối thiểu.
- **Không hồi quy**: mọi luồng chức năng hiện có (hỏi đáp, mở nguồn, tạo Studio, CRUD notebook, nạp nguồn)
  vẫn chạy đúng sau thay đổi giao diện.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hệ thống MUST định nghĩa một bảng màu trích dẫn riêng (khác màu nhấn chính) dùng chung, và áp
  cho chip `[n]` ở cả Chat và Studio cùng đoạn highlight ở Trình xem nguồn.
- **FR-002**: Việc đổi màu/kiểu chip MUST KHÔNG thay đổi hành vi bấm chip (vẫn mở đúng nguồn/đoạn).
- **FR-003**: Hệ thống MUST hợp nhất các giá trị màu lặp thành biến thiết kế dùng chung (không còn màu lặp
  rải rác), và định nghĩa biến thời lượng/nhịp chuyển động dùng chung.
- **FR-004**: Thanh điều hướng MUST là rail dọc gọn bằng biểu tượng, mục Cài đặt đặt ở đáy, mỗi mục có nhãn
  trợ năng (điều hướng vẫn tới đúng khu vực như trước).
- **FR-005**: Ô soạn câu hỏi ở Chat MUST hiển thị chỉ báo mô hình đang dùng, bộ chọn chế độ dạng gạt liền
  khối, và nút gửi bằng biểu tượng — mà không đổi luồng gửi câu hỏi.
- **FR-006**: Tin hội thoại MUST có nhãn người nói; tin của AI trình bày dễ đọc, chip `[n]` vẫn hoạt động.
- **FR-007**: Màn Notebooks MUST hiển thị trạng thái rỗng khi không có notebook và trạng thái không-kết-quả
  khi tìm kiếm không khớp.
- **FR-008**: Khi đang chờ câu trả lời AI, cột Chat MUST hiển thị chỉ báo tải dạng khung chờ.
- **FR-009**: Các phần tử tương tác (điều hướng, nút) MUST có trạng thái focus bàn phím rõ ràng
  (`:focus-visible`).
- **FR-010**: Hộp thoại MUST đóng được bằng phím Escape, có nút đóng rõ, thuộc tính trợ năng phù hợp
  (`aria-modal`) và giữ focus trong hộp thoại khi mở.
- **FR-011**: Biểu tượng MUST được nhúng cục bộ (không tải từ nguồn ngoài) để giữ hoạt động offline và ranh
  giới bảo mật.
- **FR-012**: Chuyển động MUST tôn trọng thiết lập giảm chuyển động của hệ điều hành và ưu tiên thuộc tính
  chuyển động mượt (không gây giật bố cục).
- **FR-013**: Thay đổi giao diện MUST KHÔNG sửa logic xử lý (hỏi đáp, tạo Studio, nạp nguồn, CRUD) — mọi
  luồng chức năng hiện có phải giữ nguyên hành vi.
- **FR-014**: Bảng màu trích dẫn MUST đạt ngưỡng tương phản tối thiểu cho chữ trên nền của nó.

### Key Entities _(include if feature involves data)_

- Không có thực thể dữ liệu mới. Feature thuần trình bày; không thêm/đổi lưu trữ, không migration.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% chip trích dẫn (Chat + Studio) và đoạn highlight (Xem nguồn) dùng cùng một bảng màu trích
  dẫn, phân biệt được với nút hành động chính.
- **SC-002**: 0 hồi quy chức năng — toàn bộ kiểm thử tự động end-to-end hiện có (hỏi đáp, mở nguồn, Studio,
  notebook, nạp nguồn) vẫn xanh sau thay đổi.
- **SC-003**: Mọi phần tử tương tác chính (mục điều hướng, nút gửi, nút trong hộp thoại) đến được và thao
  tác được **chỉ bằng bàn phím**, có viền focus nhìn thấy.
- **SC-004**: Mọi hộp thoại đóng được bằng Escape và có thuộc tính trợ năng phù hợp.
- **SC-005**: Không còn giá trị màu lặp cứng trong mã giao diện cho các màu đã đưa vào biến thiết kế (kiểm
  bằng rà mã).
- **SC-006**: Màn Notebooks hiển thị đúng trạng thái rỗng và không-kết-quả (không còn lưới trống khó hiểu).
- **SC-007**: Bảng màu trích dẫn đạt tỉ lệ tương phản ≥ 4.5:1 cho chữ thường.
- **SC-008**: Không phát sinh tải tài nguyên từ nguồn ngoài (biểu tượng nhúng cục bộ) — app vẫn chạy offline.

## Assumptions

- **A1 — Một feature, 3 nhóm**: gộp (A) design-system, (B) cấu trúc, (C) a11y/empty trong 1 feature, chia
  phase nội bộ (tokens → cấu trúc → a11y/empty). Hoãn các mục P2 nặng: chỉ báo % xử lý nguồn, bộ chọn loại
  nguồn 4-thẻ + hàng đợi tiến độ trong hộp thoại Thêm nguồn → đợt UI sau.
- **A2 — Khung cửa sổ**: giữ khung hệ điều hành gốc; không dựng "traffic light" giả (chỉ là mockup trong
  wireframe).
- **A3 — Biểu tượng**: nhúng cục bộ (không thư viện ngoài/CDN) — giữ local-first + ranh giới bảo mật.
- **A4 — Thuần thị giác**: không đổi luồng dữ liệu/logic; kiểm thử = giữ các kịch bản e2e hiện có xanh +
  thêm kiểm tra a11y (viền focus, đóng hộp thoại bằng Escape, thuộc tính trợ năng).
- **A5 — Nhất quán trích dẫn**: đổi bảng màu chip đụng 3 nơi (Chat · Studio · Xem nguồn) là chủ đích; ràng
  buộc là e2e của các nơi đó vẫn xanh.
- **A6 — Ngôn ngữ/UX văn phong**: theo tiếng Việt của wireframe gốc; giữ nguyên nội dung chữ đã có trừ khi
  wireframe quy định khác.

## Out of Scope

- Section Cài đặt "AI online" (thuộc feature online-provider).
- Nút Sao chép/Xuất và khung chờ của Studio (thuộc feature nâng chức năng Studio).
- Trình xem nguồn dạng "trang giấy"/canvas PDF (hoãn có chủ đích từ quyết định trước).
- Chỉ báo % xử lý nguồn và bộ chọn loại nguồn 4-thẻ + hàng đợi (đợt UI sau).
- Bất kỳ thay đổi nào ở tiến trình chính, kênh liên lạc, cơ sở dữ liệu, hay lược đồ (không migration).
