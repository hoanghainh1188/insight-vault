# Feature Specification: Bố cục PDF đợt 2 — bảng số căn phải, lưới bảng, trang xoay, gạch nối

**Feature Branch**: `147-pdf-layout`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Bố cục PDF đợt 2 (issue #147; nguồn: docs/intake/147-pdf-layout.md; 27 quyết định clarify ở
docs/04-decisions/2026-10-09-pdf-layout-2-clarify.md)."

## Bối cảnh

Feature 112 đã giúp InsightVault đọc PDF có lớp chữ theo đúng bố cục: thứ tự đọc nhiều cột, đoạn văn, và bảng (lưu dưới dạng văn bản `| a | b |`). ADR của 112
liệt kê các giới hạn còn lại; chủ dự án chọn sửa bốn: **(b)** bảng tài chính có cột số căn phải không được nhận là bảng; **(e)** trình xem nguồn hiện bảng như
các dòng văn bản thay vì lưới; **(c)** trang có thuộc tính xoay (khổ ngang, trang quét bị xoay) mất bố cục; **(a)** từ ghép bị ngắt cuối dòng mất gạch nối
("long-term" thành "longterm", tiếng Việt "hợp-đồng" thành "hợpđồng"). Cam kết bất biến: trích dẫn vẫn kiểm chứng được — mỗi chip `[n]` mở đúng trang và tô
sáng đúng đoạn văn bản.

## Clarifications

### Session 2026-10-09

Nguồn: `docs/04-decisions/2026-10-09-pdf-layout-2-clarify.md` (người dùng chọn toàn bộ phương án khuyên dùng; 4 câu hỏi trực tiếp + 23 đề xuất của intake).

- Q: Nhận diện bảng số căn phải thế nào? → A: Một đường nhận diện phụ chỉ chạy khi cách nhận diện hiện có từ chối; cột số căn theo mép phải hoặc dấu thập
  phân; ngưỡng chặt (≥ 3 hàng dữ liệu, ≥ 2 cột, không phải dãy số trang) để không biến mục lục / danh sách nhãn–giá trị thành bảng; bảng đang nhận được không đổi.
- Q: Lưới bảng lấy dữ liệu từ đâu? → A: Từ chính văn bản bảng đã lưu của PDF (không lưu thêm, không cần xử lý lại) — có ngay với PDF đã nạp; chỉ áp cho PDF.
- Q: Tô sáng trích dẫn trong lưới? → A: Chính xác theo ký tự trong từng ô; ô bị phủ trọn thì tô cả ô.
- Q: Có công tắc xem dạng văn bản? → A: Có — "Dạng lưới / Dạng văn bản" trên thanh trình xem, mặc định lưới, nhớ trong phiên.
- Q: Trợ năng / bố cục lưới? → A: Ngữ nghĩa bảng có hàng tiêu đề và tên đọc "Bảng {i} — trang {p}"; ô số căn phải; bảng rộng cuộn ngang, không thu chữ.
- Q: Trang xoay? → A: Áp xoay trang khi đọc toạ độ để trang xoay cho văn bản như trang thẳng; chữ lộn ngược / góc lẻ vẫn xử lý như "chữ xoay"; chỉ PDF có lớp
  chữ (kể cả lớp chữ ẩn trên trang quét) — OCR ngoài phạm vi.
- Q: Gạch nối cuối dòng? → A: Chỉ giữ gạch khi chắc chắn (có bằng chứng trong chính tài liệu, chữ hoa / số, tiếng Việt…), còn lại giữ hành vi cũ; **tiếng Việt
  giữ gạch và nối liền** ("hợp-đồng"); không dùng từ điển ngoài.
- Q: Phiên bản trích xuất? → A: Tăng một lần (2 → 3) cho (b) + (c) + (a); lưới không tăng.
- Q: Gợi ý "Xử lý lại"? → A: Câu theo phiên bản của nguồn (PDF cũ chưa có bố cục ⇒ "giữ bố cục"; PDF đã có bố cục ⇒ "cải thiện bảng, trang xoay và gạch nối");
  không xử lý lại hàng loạt.
- Q: Đo? → A: Bộ PDF mẫu tự sinh có cả mẫu dương và mẫu âm; tập cặp từ gắn nhãn cho gạch nối; thời gian trích ≤ 2× cách cũ.
- Q: Giao hàng? → A: Một spec, bốn đợt theo thứ tự lưới → trang xoay → bảng số → gạch nối; phiên bản tăng ở đợt trích xuất đầu tiên.
- Q: Lỗi trong một cải tiến? → A: Quay về kết quả cũ cho phần đó (không làm hỏng cả trang); không cờ cấu hình, không UI.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Xem bảng của PDF dạng lưới khi kiểm chứng trích dẫn (Priority: P1)

Người dùng bấm chip `[2]` trỏ vào một bảng trong báo cáo PDF. Trình xem nguồn hiện bảng thành lưới có hàng tiêu đề và cột số căn phải; các ô thuộc đoạn được trích
dẫn được tô sáng đúng chỗ. Họ có thể chuyển sang "Dạng văn bản" để xem đúng văn bản đã trích dẫn.

**Why this priority**: Kiểm chứng trích dẫn là cam kết cốt lõi; bảng dạng `| a | b |` khó đọc. Có ngay cho PDF đã nạp, không cần xử lý lại.

**Independent Test**: Mở chip trỏ vào chunk có bảng ⇒ lưới hiển thị; vùng tô sáng khớp đúng ký tự trong các ô; chuyển "Dạng văn bản" thấy văn bản gốc; nguồn không phải
PDF không đổi.

**Acceptance Scenarios**:

1. **Given** PDF đã nạp có bảng, **When** mở trích dẫn trỏ vào bảng, **Then** bảng hiện dạng lưới (hàng tiêu đề, ô số căn phải), vùng tô sáng đúng ô / đoạn ô, cuộn
   tới đúng chỗ, nhãn `[n]` hiển thị.
2. **Given** vùng trích dẫn bắt đầu giữa một ô và kết thúc ở hàng sau, **When** mở, **Then** chỉ phần chữ trong vùng được tô (ô phủ trọn tô cả ô).
3. **Given** đang xem dạng lưới, **When** chọn "Dạng văn bản", **Then** thấy văn bản bảng như trước, cùng vùng tô sáng; lựa chọn được nhớ trong phiên.
4. **Given** bảng rộng hơn cột trình xem, **When** xem, **Then** bảng cuộn ngang được (cả bằng bàn phím), chữ không bị thu nhỏ.

---

### User Story 2 - Trang xoay đọc đúng bố cục (Priority: P1)

Báo cáo có trang khổ ngang (hoặc trang quét có lớp chữ bị xoay). Sau khi nạp (hoặc xử lý lại), văn bản trang đó có dòng, đoạn, cột và bảng như trang thẳng;
hỏi đáp trích dẫn đúng.

**Why this priority**: Sửa một lỗi rõ ràng làm mất nội dung đọc được.

**Independent Test**: Cùng nội dung ở trang thẳng và ở trang xoay 90 / 180 / 270 ⇒ văn bản trích giống hệt.

**Acceptance Scenarios**:

1. **Given** PDF có trang xoay 90°, **When** nạp, **Then** văn bản trang đó giống hệt bản trang thẳng cùng nội dung.
2. **Given** trang xoay có thêm chữ thực sự xoay so với trang (ghi chú bên lề), **When** nạp, **Then** chữ đó vẫn được xử lý riêng như hiện nay.
3. **Given** PDF không có trang xoay, **When** nạp, **Then** kết quả không đổi so với trước.

---

### User Story 3 - Bảng tài chính có cột số căn phải được nhận là bảng (Priority: P2)

Người dùng nạp báo cáo tài chính có bảng số căn phải (dấu phân cách hàng nghìn, số âm trong ngoặc, hàng tổng). Bảng được nhận ra, hiển thị dạng lưới, và câu
hỏi về số liệu được trả lời với trích dẫn trỏ đúng ô.

**Why this priority**: Giá trị cao với người dùng tài liệu tài chính, nhưng cần ngưỡng chống nhận nhầm nên làm sau hai câu chuyện trên.

**Independent Test**: Bộ mẫu dương (bảng số căn phải / căn thập phân) ⇒ 100% thành bảng đúng ô; bộ mẫu âm (mục lục không chấm dẫn, danh sách nhãn–giá trị, đoạn căn
đều, khối chữ ký) ⇒ 0 bảng nhầm; bảng căn trái hiện có không đổi.

**Acceptance Scenarios**:

1. **Given** bảng 4 cột số căn phải có tiêu đề hai dòng và hàng tổng, **When** nạp, **Then** thành bảng đúng hàng / cột / ô.
2. **Given** mục lục không có chấm dẫn (tên mục + số trang căn phải), **When** nạp, **Then** không thành bảng.
3. **Given** bảng căn trái đang được nhận đúng, **When** nạp lại, **Then** kết quả giống hệt trước.

---

### User Story 4 - Từ ghép giữ gạch nối, tiếng Việt không bị dính chữ (Priority: P2)

Văn bản tiếng Anh có "long-" cuối dòng và "term" đầu dòng sau, trong khi tài liệu cũng có "long-term" ở giữa dòng; văn bản tiếng Việt có "hợp-" / "đồng". Sau khi
nạp, "long-term" và "hợp-đồng" giữ gạch; ngắt từ thật ("infor-" / "mation") vẫn được nối liền.

**Why this priority**: Cải thiện chính xác văn bản và tìm kiếm; cần thận trọng nên làm cuối.

**Independent Test**: Trên tập cặp từ gắn nhãn (Anh + Việt), quyết định đúng ≥ 95% ở nhóm "chắc chắn", không kém hành vi cũ trên toàn tập; tiếng Việt không bị nối dính.

**Acceptance Scenarios**:

1. **Given** "long-" / "term" ở ngắt dòng và "long-term" ở giữa dòng trong cùng tài liệu, **When** nạp, **Then** thành "long-term".
2. **Given** "hợp-" / "đồng" ở ngắt dòng, **When** nạp, **Then** thành "hợp-đồng".
3. **Given** "infor-" / "mation" (ngắt từ thật, không có bằng chứng từ ghép), **When** nạp, **Then** thành "information" như trước.

---

### User Story 5 - PDF cũ được gợi ý xử lý lại đúng nghĩa (Priority: P3)

Sau khi cập nhật, PDF nạp trước đó hiện gợi ý "Xử lý lại" với câu đúng với tình trạng của nó; xử lý lại thì có văn bản mới, trích dẫn cũ vẫn mở nguồn (không tô sáng).

**Why this priority**: Đường nâng cấp cho dữ liệu cũ, đã có khuôn từ 112.

**Independent Test**: PDF chưa có bố cục ⇒ câu "giữ bố cục"; PDF đã có bố cục ⇒ câu "cải thiện bảng, trang xoay và gạch nối"; xử lý lại ⇒ văn bản mới, chip cũ thành
"trích dẫn cũ".

**Acceptance Scenarios**:

1. **Given** PDF nạp ở phiên bản trích xuất trước, **When** mở danh sách nguồn, **Then** thấy gợi ý "Xử lý lại" với câu theo phiên bản của nguồn.
2. **Given** xác nhận xử lý lại, **When** xong, **Then** nguồn ở phiên bản mới; chip cũ mở nguồn nhưng không tô sáng.

---

### Edge Cases

- Đoạn văn thường có dòng trông như `| x | y |` ⇒ không hiển thị thành lưới (chỉ khối đủ điều kiện bảng).
- Bảng vắt qua hai trang ⇒ mỗi trang là một bảng riêng (không nối qua trang).
- Vùng trích dẫn chỉ gồm ký tự khung bảng (`|`, `---`) ⇒ tô phần ô liền kề hợp lý, không tô "khoảng trống".
- Trang xoay 180° (chữ lộn ngược sau khi áp xoay) / góc lẻ ⇒ xử lý như "chữ xoay" (best-effort).
- Tài liệu vừa có "long-term" vừa có "longterm" ⇒ không chắc ⇒ giữ hành vi cũ.
- Lỗi trong một cải tiến ⇒ phần đó quay về kết quả cũ, phần còn lại không bị ảnh hưởng.
- PDF thuần ảnh ⇒ vẫn "không có văn bản" như hiện nay.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Trình xem nguồn MUST hiển thị các bảng của nguồn PDF dạng lưới (hàng tiêu đề, hàng, ô; ô số căn phải) thay cho văn bản `| a | b |`, mặc định.
- **FR-002**: Trong lưới, vùng trích dẫn MUST được tô sáng chính xác theo ký tự trong từng ô (ô phủ trọn tô cả ô); nhãn `[n]` và cuộn tới vùng tô MUST hoạt động
  như trước; trích dẫn cũ không tô sáng vẫn mở đúng nguồn.
- **FR-003**: Người dùng MUST chuyển được giữa "Dạng lưới" và "Dạng văn bản" trên thanh trình xem; lựa chọn được nhớ trong phiên.
- **FR-004**: Lưới MUST có ngữ nghĩa bảng cho trình đọc màn hình (hàng tiêu đề, tên đọc "Bảng {i} — trang {p}"), cuộn ngang được bằng bàn phím khi tràn, không thu
  nhỏ chữ, không tràn khỏi cột trình xem hẹp nhất.
- **FR-005**: Lưới MUST hoạt động với PDF đã nạp trước đó mà không cần xử lý lại, và MUST NOT đổi hiển thị của nguồn không phải PDF.
- **FR-006**: Trang PDF có thuộc tính xoay 90 / 180 / 270 MUST cho văn bản trích giống hệt cùng nội dung ở trang thẳng (khi chữ hiển thị thẳng); chữ thực sự xoay so với
  trang MUST tiếp tục được xử lý riêng như hiện nay; PDF không xoay MUST không đổi.
- **FR-007**: Bảng có cột số căn phải hoặc căn theo dấu thập phân (gồm dấu phân cách hàng nghìn kiểu Việt / Anh, số âm trong ngoặc, phần trăm, tiền tệ, hàng tổng,
  tiêu đề nhiều dòng) MUST được nhận là bảng.
- **FR-008**: Mục lục không chấm dẫn, danh sách nhãn–giá trị, đoạn căn đều hai bên và khối địa chỉ / chữ ký MUST NOT bị nhận là bảng; các bảng đang được nhận MUST
  cho kết quả không đổi.
- **FR-009**: Gạch nối cuối dòng MUST được giữ khi có thể quyết định chắc chắn là từ ghép (bằng chứng trong chính tài liệu, chữ hoa / số, tiếng Việt); ngắt từ thật
  MUST được nối liền; trường hợp không chắc MUST giữ hành vi cũ. Văn bản tiếng Việt MUST giữ gạch và nối liền ("hợp-đồng").
- **FR-010**: Mọi thay đổi văn bản trích (FR-006 – FR-009) MUST xảy ra trước bước làm sạch và chia đoạn, để mỗi đoạn trích dẫn vẫn khớp chính xác văn bản nguồn.
- **FR-011**: Phiên bản trích xuất PDF MUST tăng đúng một lần cho FR-006 – FR-009; PDF nạp mới / xử lý lại MUST ghi phiên bản mới; PDF cũ MUST hiện gợi ý "Xử lý lại"
  với câu theo phiên bản của nguồn; xử lý lại vẫn chủ động, có xác nhận, từng nguồn.
- **FR-012**: Lỗi trong một cải tiến MUST làm phần đó quay về kết quả cũ, không làm hỏng phần còn lại của trang hay tài liệu; không thêm cờ cấu hình hay UI.
- **FR-013**: Thời gian trích một PDF MUST ≤ 2× cách cũ trên bộ mẫu mở rộng (bảng số, trang xoay, gạch nối) — ngân sách hiệu năng của 112.
- **FR-014**: Chuỗi giao diện mới (công tắc, tên đọc bảng, câu gợi ý xử lý lại) MUST có bản tiếng Việt và English.
- **FR-015**: Feature MUST NOT thêm kết nối mạng, thay đổi dữ liệu đã lưu ngoài văn bản trích của nguồn được xử lý lại, hay ghi nội dung tài liệu vào nhật ký.

### Key Entities

- **Bảng trong văn bản nguồn**: vùng văn bản theo quy ước bảng của 112 (hàng tiêu đề, hàng phân cách, các hàng), có vị trí ký tự trong văn bản nguồn — nguồn cho lưới.
- **Ô bảng**: đoạn ký tự của một ô trong văn bản nguồn — đơn vị để tô sáng trích dẫn trong lưới.
- **Phiên bản trích xuất PDF**: số đánh dấu cách đọc PDF đã dùng cho một nguồn; quyết định câu gợi ý "Xử lý lại".
- **Bộ mẫu PDF / tập cặp từ**: dữ liệu kiểm thử tất định (mẫu dương / âm, trang xoay, cặp từ gắn nhãn) dùng để đo.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% bảng trong PDF mẫu hiển thị dạng lưới; 100% chip trỏ vào chunk có bảng tô sáng đúng ô / đoạn ô (test tự động); nguồn không phải PDF không đổi.
- **SC-002**: Trang xoay 90 / 180 / 270 cho văn bản trích giống hệt bản trang thẳng trên 100% mẫu; PDF không xoay không đổi.
- **SC-003**: Bộ mẫu bảng số căn phải / thập phân: 100% thành bảng đúng ô; bộ mẫu âm: 0 bảng nhầm; bảng căn trái hiện có: kết quả không đổi.
- **SC-004**: Tập cặp từ gạch nối: ≥ 95% quyết định đúng ở nhóm "chắc chắn", không kém hành vi cũ trên toàn tập; 0 trường hợp tiếng Việt bị nối dính.
- **SC-005**: Thời gian trích ≤ 2× cách cũ trên bộ mẫu mở rộng.
- **SC-006**: PDF cũ hiện đúng câu gợi ý theo phiên bản; sau xử lý lại, văn bản theo cách mới và chip cũ thành "trích dẫn cũ".
- **SC-007**: Kết quả tìm kiếm từ khoá cho từ ghép có gạch khớp cả dạng có gạch lẫn dạng tách ("long-term" ⇄ "long term") (test tự động).

## Assumptions

- Chỉ PDF có lớp chữ; OCR / PDF thuần ảnh, ô gộp, bảng xoay, trang > 4 cột, chữ bao quanh hình — ngoài phạm vi (giữ "Giới hạn" của 112).
- Lưới chỉ là lớp hiển thị: văn bản đoạn, vector, tìm kiếm và lời nhắc AI vẫn dùng văn bản bảng như cũ.
- Không xử lý lại hàng loạt (giữ quyết định 112); bổ sung PDF vào bộ đánh giá truy xuất là issue riêng.
- Giao thành bốn đợt (lưới → trang xoay → bảng số → gạch nối) trong cùng spec; đợt lưới không đổi phiên bản trích xuất.
