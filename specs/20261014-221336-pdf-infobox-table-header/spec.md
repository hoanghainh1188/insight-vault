# Feature Specification: Trích PDF giữ nguyên hộp thông tin và tiêu đề cột bảng

**Feature Branch**: `206-pdf-infobox-table-header`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Issue #206 — Trích bảng / hộp thông tin PDF: tách hộp thông tin (khối 2 cột nhãn / giá trị cạnh thân bài) khỏi thân bài và ghép tiêu đề cột nhiều dòng của bảng thành một dòng tiêu đề, ở bước trích văn bản PDF. Hai câu có đáp án trong PDF Wikipedia Tuyến 2A (q-162 bảng danh sách nhà ga, q-185 hộp thông tin) bị bộ chấm độ liên quan từ chối nhầm vì văn bản trích ra bị trộn; trình bày lại đoạn chỉ ở bước chấm đã thử và không cứu được (ADR 2026-10-14-reranker-near-topic). Tăng phiên bản trích xuất để nguồn PDF cũ xử lý lại; trích dẫn vẫn trỏ đúng; fixture test cả hai dạng; đo lại bộ đánh giá truy xuất nhóm PDF. Liên quan #187, #147, #205."

## User Scenarios & Testing _(mandatory)_

Người dùng cuối là người hỏi đáp trên notebook của mình (nhà nghiên cứu, luật sư, sinh viên…) với tài liệu PDF có bảng và hộp thông tin bên lề (kiểu bài Wikipedia). Người kiểm chứng là chủ dự án, đo bằng bộ đánh giá truy xuất (`datasetVersion` 5, đã duyệt).

### User Story 1 - Hỏi về thông tin nằm trong bảng danh sách vẫn được trả lời có trích dẫn (Priority: P1)

Người dùng nạp bài Wikipedia về Tuyến 2A và hỏi một câu mà đáp án nằm trong bảng danh sách nhà ga (q-162). Hôm nay dòng tiêu đề cột của bảng bị trộn vào một đoạn văn và nhiều dòng dữ liệu thành văn bản rời, nên đoạn chứa đáp án bị chấm độ liên quan rất thấp (0,12) và app trả "Không tìm thấy trong nguồn" dù tài liệu có đáp án. Sau thay đổi, bảng được trích với đúng một dòng tiêu đề cột và các dòng dữ liệu thành dòng bảng, nên câu hỏi được trả lời kèm chip `[n]`.

**Why this priority**: Là lỗi từ chối nhầm câu có đáp án — vi phạm giá trị "kiểm chứng được" theo chiều ngược lại (tài liệu có mà app nói không có).

**Independent Test**: Nạp PDF Tuyến 2A của bộ đánh giá, chạy bộ đánh giá truy xuất theo đường app thật ⇒ q-162 không bị từ chối và đoạn đáp án nằm trong 6 kết quả đầu.

**Acceptance Scenarios**:

1. **Given** PDF có bảng với tiêu đề cột trải nhiều dòng, **When** trích văn bản, **Then** các dòng tiêu đề ghép thành MỘT dòng tiêu đề của bảng và các dòng dữ liệu nằm cùng bảng, không lẫn vào đoạn văn kế bên.
2. **Given** notebook có PDF Tuyến 2A, **When** hỏi câu q-162, **Then** app trả lời kèm trích dẫn thay vì "Không tìm thấy trong nguồn".
3. **Given** bảng đã được ghép tiêu đề, **When** người dùng bấm chip `[n]` trỏ vào bảng, **Then** trình xem mở đúng trang và tô đúng vùng đã trích.

---

### User Story 2 - Hỏi về thông tin trong hộp thông tin (infobox) bên lề được trả lời (Priority: P1)

Bài Wikipedia có hộp thông tin ở cột bên (khổ đường ray, năm khai trương, chiều dài…). Hôm nay chữ trong hộp bị đan xen với thân bài ("| năm 2021, Tuyến 2A chính | Khổ | 1.435 mm …"), đoạn đáp án bị chấm thấp (0,23) và q-185 bị từ chối nhầm. Sau thay đổi, hộp thông tin được tách khỏi thân bài thành một khối riêng gồm các cặp nhãn / giá trị, và thân bài đọc liền mạch.

**Why this priority**: Cùng loại lỗi từ chối nhầm như Story 1, ở dạng bố cục khác; hộp thông tin rất phổ biến trong tài liệu dạng bách khoa.

**Independent Test**: Chạy bộ đánh giá ⇒ q-185 không bị từ chối; thân bài của cùng trang không còn chứa mảnh nhãn / giá trị của hộp.

**Acceptance Scenarios**:

1. **Given** trang PDF có hộp thông tin hai cột nhãn / giá trị cạnh thân bài, **When** trích văn bản, **Then** hộp thông tin thành một khối riêng (mỗi dòng một cặp nhãn – giá trị) và thân bài không chứa mảnh của hộp.
2. **Given** notebook có PDF Tuyến 2A, **When** hỏi q-185 (đáp án nằm trong hộp), **Then** app trả lời kèm trích dẫn.
3. **Given** trang không có hộp thông tin (văn bản thường nhiều cột, danh sách, bảng thường), **When** trích văn bản, **Then** kết quả không đổi so với hôm nay.

---

### User Story 3 - Nguồn PDF cũ được xử lý lại và không câu nào tụt (Priority: P2)

Người dùng đã có PDF nạp từ trước. Sau khi cập nhật app, nguồn cũ hiện gợi ý "Xử lý lại" theo cơ chế hiện có; xử lý lại cho văn bản mới mà trích dẫn cũ vẫn xử lý như hôm nay. Chủ dự án chạy lại bộ đánh giá và thấy q-162, q-185 được cứu, mọi câu đang đúng vẫn đúng, nhóm tiếng Anh không dưới mức hiện hành.

**Why this priority**: Bảo vệ chất lượng đã có và cho nguồn cũ đường nâng cấp; phụ thuộc Story 1–2.

**Independent Test**: So báo cáo từng câu trước / sau trên bộ đánh giá v5: không câu nào chuyển từ đúng sang sai; phiên bản trích xuất tăng và nguồn phiên bản cũ hiện gợi ý Xử lý lại.

**Acceptance Scenarios**:

1. **Given** nguồn PDF nạp bằng phiên bản trích xuất cũ, **When** mở danh sách nguồn, **Then** hiện gợi ý Xử lý lại như cơ chế hiện có.
2. **Given** bộ đánh giá v5, **When** chạy sau thay đổi, **Then** không câu nào tụt so với trước, Recall@6 và từ chối đúng tiếng Anh không thấp hơn mức hiện hành.

### Edge Cases

- Trang có hộp thông tin nhưng cũng có bảng bên cạnh: hai khối tách riêng, không nhập vào nhau.
- Hộp thông tin chỉ một cặp nhãn / giá trị hoặc nhãn trải nhiều dòng: nếu không chắc là hộp, giữ cách trích hiện tại (không đoán sai thành hộp).
- Bảng có tiêu đề nhiều tầng (ô gộp): chỉ ghép khi chắc chắn; không chắc ⇒ giữ cách trích hiện tại.
- PDF quét ảnh (không có lớp chữ), PDF tiếng Anh, trang xoay, bảng số căn phải, văn bản gạch nối cuối dòng: kết quả không đổi so với hôm nay.
- Lỗi khi nhận diện hộp / tiêu đề: trích dự phòng như hôm nay, không làm hỏng nạp tài liệu.
- Tài liệu lớn: thời gian trích không tăng đáng kể.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Khi trang PDF có hộp thông tin hai cột nhãn / giá trị cạnh thân bài, việc trích văn bản MUST tách hộp thành khối riêng (mỗi cặp nhãn – giá trị một dòng) và thân bài MUST không còn chứa mảnh của hộp.
- **FR-002**: Khi bảng có tiêu đề cột trải nhiều dòng, việc trích MUST ghép chúng thành một dòng tiêu đề duy nhất của bảng, và các dòng dữ liệu cùng bảng MUST thuộc bảng đó thay vì thành văn bản rời.
- **FR-003**: Khi không chắc (hộp một cặp, tiêu đề nhiều tầng, bố cục lạ), việc trích MUST giữ cách trích hiện tại; không được tạo hộp / bảng sai.
- **FR-004**: Văn bản trích của các trang KHÔNG có hộp thông tin hoặc bảng nhiều dòng tiêu đề MUST giống hệt hôm nay (không hồi quy cho bảng số, trang xoay, gạch nối, nhiều cột, PDF tiếng Anh).
- **FR-005**: Phiên bản trích xuất PDF MUST tăng, để nguồn PDF cũ hiện gợi ý Xử lý lại và được xử lý lại theo cơ chế hiện có; việc xử lý lại giữ nguyên quy tắc trích dẫn cũ.
- **FR-006**: Trích dẫn MUST vẫn đúng: chip `[n]` mở đúng trang, vùng tô khớp văn bản trích, bảng vẫn hiển thị được ở dạng lưới và dạng văn bản.
- **FR-007**: Việc trích MUST tất định (trích hai lần cho văn bản giống hệt) và nằm trong ngân sách thời gian trích hiện hành của bộ đánh giá.
- **FR-008**: Mọi xử lý MUST chạy cục bộ, không tải model mới, không thêm kết nối mạng.
- **FR-009**: Hàm nhận diện hộp thông tin và ghép tiêu đề MUST có fixture kiểm thử cho cả hai dạng (có và không có) cùng các ca "không chắc".
- **FR-010**: Bộ đánh giá truy xuất nhóm PDF MUST được chạy lại sau thay đổi và số liệu trước / sau MUST được ghi lại (ADR).

### Key Entities

- **Khối hộp thông tin**: tập cặp nhãn – giá trị đọc từ vùng bên lề của trang, thuộc trang nguồn, có vị trí để tô khi trích dẫn.
- **Bảng có tiêu đề ghép**: bảng với đúng một dòng tiêu đề cột (ghép từ nhiều dòng) và các dòng dữ liệu.
- **Phiên bản trích xuất**: số đánh dấu cách trích đã dùng cho nguồn; nguồn thấp hơn phiên bản hiện hành được gợi ý Xử lý lại.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: q-162 và q-185 không còn bị từ chối nhầm, và đoạn chứa đáp án nằm trong 6 kết quả đầu (bộ đánh giá v5, đường app thật).
- **SC-002**: 0 câu chuyển từ đúng sang sai trên toàn bộ bộ đánh giá v5 (so từng câu trước / sau).
- **SC-003**: Recall@6 tiếng Anh ≥ 72,7% và từ chối đúng tiếng Anh ≥ 83,3% (không thấp hơn mức hiện hành).
- **SC-004**: Từ chối đúng tập dev tiếng Việt không thấp hơn mức hiện hành (87,8%) và hold-out không thấp hơn 84,2%.
- **SC-005**: Văn bản trích của các PDF fixture không có hộp / bảng nhiều dòng tiêu đề giống hệt trước thay đổi (100% fixture cũ).
- **SC-006**: Thời gian trích PDF Tuyến 2A (975 KB) không vượt ngân sách của bộ đánh giá (≤ 1000 ms) và hai lần trích cho văn bản giống hệt.

## Assumptions

- Phạm vi là PDF có lớp chữ; PDF quét ảnh (OCR) nằm ngoài phạm vi.
- Bộ đánh giá v5 (206 câu, đã duyệt 2026-10-12) và PDF Tuyến 2A là chuẩn đo; không thêm tài liệu mới trong feature này.
- Cơ chế phiên bản trích xuất và Xử lý lại (112, 147) dùng nguyên, không đổi giao diện.
- Cách chấm độ liên quan (#187) không đổi; feature này chỉ sửa đầu vào của nó (văn bản trích).
- Hai câu q-162 / q-185 có thể vẫn chưa vượt ngưỡng chỉ nhờ trích tốt hơn; nếu vậy kết quả được ghi như số liệu thật và đề xuất bước tiếp, không nới ngưỡng trong feature này.
