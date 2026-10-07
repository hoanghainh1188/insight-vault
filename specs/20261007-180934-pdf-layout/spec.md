# Feature Specification: Giữ bố cục khi trích xuất văn bản từ PDF

**Feature Branch**: `112-pdf-layout`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Giữ bố cục khi trích xuất văn bản từ PDF có lớp chữ của InsightVault (issue #112; nguồn:
`docs/intake/112-pdf-layout.md`; MỌI quyết định đã chốt ở `docs/04-decisions/2026-10-07-pdf-layout-clarify.md` — dùng
nguyên, không hỏi lại)… (A) dựng dòng / thứ tự đọc / bảng Markdown; (B) PDF mới dùng cách mới, PDF cũ giữ nguyên +
'Xử lý lại' chủ động; (C) chip trích dẫn cũ sau khi xử lý lại không tô sáng + ghi chú."

## Clarifications

### Session 2026-10-07

Mọi câu hỏi đã chốt ở `docs/04-decisions/2026-10-07-pdf-layout-clarify.md` (15 câu, người dùng đồng ý toàn bộ đề xuất
trước bước specify) cùng 3 quyết định trong issue #112. Tóm tắt để spec tự đủ nghĩa:

- Q: Phạm vi? → A: PDF có lớp chữ: dựng dòng, thứ tự đọc nhiều cột, giữ bảng. PDF quét (cần OCR) ngoài phạm vi.
- Q: Bảng biểu diễn thế nào? → A: Bảng Markdown trong văn bản trích xuất; ô cách dấu `|` đúng 1 dấu cách, có hàng
  phân cách, `|` trong ô được thoát, ô rỗng để trống, ô nhiều dòng nối bằng dấu cách.
- Q: PDF đã nạp trước đây? → A: Giữ nguyên; cách mới cho PDF thêm mới + hành động "Xử lý lại" do người dùng bấm; không
  tự chạy nền.
- Q: Trích dẫn cũ sau khi xử lý lại? → A: Hỏi xác nhận trước; sau đó chip cũ vẫn mở được nguồn nhưng không tô sáng và
  hiện ghi chú "vị trí trích dẫn cũ không còn chính xác"; không xoá hội thoại/Studio.
- Q: Nhận diện bảng? → A: Theo căn cột, tối thiểu 2 cột × 3 hàng; không chắc ⇒ văn bản thường.
- Q: Dòng/đoạn? → A: Dòng cùng đoạn nối bằng dấu cách; khoảng cách dọc > ~1,5 lần chiều cao dòng ⇒ tách đoạn; nối từ
  bị ngắt bằng gạch nối cuối dòng; không nhận diện tiêu đề.
- Q: Đầu/chân trang, số trang? → A: Giữ nguyên; chú thích cuối trang đặt cuối trang.
- Q: Chia đoạn và bảng? → A: Bảng ngắn hơn một đoạn không bị cắt ngang; bảng dài cắt theo ranh giới hàng.
- Q: Trình xem nguồn? → A: Giữ dạng văn bản (bảng hiện `| a | b |`); hiển thị bảng dạng lưới để feature sau.
- Q: Xử lý lại lỗi giữa chừng? → A: Giữ dữ liệu cũ tới khi bản mới xong; lỗi ⇒ nguồn vẫn dùng bản cũ + báo lỗi.
- Q: Phân biệt PDF cũ/mới? → A: Lưu phiên bản trích xuất mỗi nguồn; PDF cũ có gợi ý thụ động "Xử lý lại để giữ bố cục".
- Q: Hiệu năng? → A: Tiến độ theo trang, cho huỷ, thời gian ≤ 2 lần cách cũ; trang quá nhiều mẩu chữ ⇒ cách cũ.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Nạp PDF hai cột, đọc và trích dẫn đúng thứ tự (Priority: P1)

Một nhà nghiên cứu nạp một bài báo khoa học trình bày hai cột. Khi hỏi đáp hoặc xem nguồn, nội dung phải đọc hết cột
trái rồi mới sang cột phải, có xuống dòng và tách đoạn như bản gốc — không còn chữ hai cột đan xen vào nhau.

**Why this priority**: Đây là lỗi phổ biến nhất của "PDF chỉ lấy chữ"; chữ đan xen làm hỏng nghĩa của đoạn trích, làm
truy xuất và câu trả lời sai — ảnh hưởng trực tiếp tới khác biệt "kiểm chứng được".

**Independent Test**: Nạp một PDF mẫu hai cột; mở trình xem nguồn và kiểm văn bản từng trang theo đúng thứ tự cột, có
ngắt đoạn; hỏi một câu có đáp án ở cột phải ⇒ chip `[n]` mở đúng trang và tô sáng đúng đoạn liền mạch.

**Acceptance Scenarios**:

1. **Given** một PDF hai cột vừa nạp, **When** mở trình xem nguồn, **Then** văn bản mỗi trang đi hết cột trái rồi cột
   phải, các dòng của một đoạn được nối thành câu liền, giữa các đoạn có dòng trống.
2. **Given** PDF đó, **When** hỏi đáp và bấm chip `[n]`, **Then** trình xem nguồn mở đúng trang và tô sáng đúng đoạn
   được trích, đoạn không chứa chữ của cột bên kia.
3. **Given** một từ bị ngắt bằng gạch nối ở cuối dòng, **When** trích xuất, **Then** từ được nối liền lại.
4. **Given** một trang một cột thông thường, **When** trích xuất, **Then** nội dung đúng thứ tự từ trên xuống, có tách
   đoạn.

---

### User Story 2 - Bảng trong PDF giữ hàng và ô (Priority: P1)

Một kỹ sư nạp báo cáo có bảng số liệu. Bảng phải được giữ thành hàng và ô (dạng bảng Markdown) để mô hình trả lời đọc
đúng giá trị theo hàng/cột và người dùng kiểm chứng được trong trình xem nguồn.

**Why this priority**: Bảng bị dẹt thành một dòng chữ liền là nguyên nhân chính của câu trả lời sai về số liệu.

**Independent Test**: Nạp PDF mẫu có bảng có viền và bảng không viền; trình xem nguồn hiện bảng dạng `| ô | ô |` với
hàng phân cách; hỏi một giá trị trong bảng ⇒ câu trả lời đúng và chip `[n]` tô sáng đúng vùng bảng.

**Acceptance Scenarios**:

1. **Given** một PDF có bảng ≥ 2 cột × 3 hàng căn thẳng cột, **When** trích xuất, **Then** bảng xuất hiện dạng bảng
   Markdown: mỗi hàng một dòng, ô cách dấu `|` đúng một dấu cách, có hàng phân cách sau hàng đầu.
2. **Given** ô chứa ký tự `|`, ô rỗng, hoặc ô có chữ xuống dòng, **When** trích xuất, **Then** `|` được thoát, ô rỗng để
   trống, chữ nhiều dòng trong ô được nối bằng dấu cách.
3. **Given** một vùng chữ chỉ tình cờ thẳng hàng (vd mục lục có dấu chấm dẫn, danh sách), **When** không đủ chắc chắn
   là bảng, **Then** vùng đó giữ là văn bản dòng thường.
4. **Given** một bảng ngắn hơn độ dài một đoạn chia, **When** chia đoạn, **Then** bảng nằm trọn trong một đoạn; bảng
   dài hơn được cắt tại ranh giới giữa hai hàng.

---

### User Story 3 - Xử lý lại PDF đã nạp trước đây (Priority: P2)

Người dùng có các PDF nạp trước khi có tính năng này. Họ thấy gợi ý nhỏ "Xử lý lại để giữ bố cục" và chủ động bấm
"Xử lý lại" cho từng nguồn khi muốn, sau khi được báo rõ hệ quả với trích dẫn cũ.

**Why this priority**: Giá trị cho dữ liệu hiện có, nhưng là tuỳ chọn; PDF mới đã được hưởng lợi từ US1/US2.

**Independent Test**: Với một PDF cũ ở trạng thái sẵn sàng, mở menu nguồn ⇒ có "Xử lý lại"; bấm ⇒ hộp xác nhận nêu hệ
quả; đồng ý ⇒ có tiến độ theo trang; xong ⇒ văn bản theo cách mới, gợi ý biến mất.

**Acceptance Scenarios**:

1. **Given** một PDF nạp bằng cách cũ, **When** xem cột Nguồn, **Then** nguồn đó có gợi ý thụ động "Xử lý lại để giữ
   bố cục"; không có gì tự chạy.
2. **Given** PDF đó ở trạng thái sẵn sàng hoặc lỗi, **When** mở menu nguồn, **Then** có hành động "Xử lý lại"; với
   nguồn không phải PDF thì không có.
3. **Given** người dùng bấm "Xử lý lại", **When** hộp xác nhận hiện ra, **Then** nó nêu rõ trích dẫn cũ tới nguồn này sẽ
   không còn được tô sáng chính xác; huỷ ⇒ không đổi gì.
4. **Given** đang xử lý lại, **When** theo dõi, **Then** thấy tiến độ theo trang và có thể huỷ; huỷ ⇒ nguồn giữ dữ liệu
   cũ, vẫn dùng được.
5. **Given** xử lý lại thất bại giữa chừng, **When** kết thúc, **Then** nguồn vẫn sẵn sàng với dữ liệu cũ (hỏi đáp, tìm
   kiếm, xem nguồn vẫn hoạt động) và có thông báo lỗi.
6. **Given** tệp gốc không còn ở vị trí cũ, **When** bấm "Xử lý lại", **Then** người dùng được dẫn sang "Chọn lại tệp
   gốc…"; **Given** tệp gốc đã bị sửa (nội dung khác lúc nạp), **Then** hành động bị chặn kèm lý do.
7. **Given** đang sao lưu/khôi phục kho dữ liệu, hoặc nguồn đang được xử lý, **When** mở menu, **Then** "Xử lý lại"
   bị khoá.

---

### User Story 4 - Trích dẫn cũ không bị tô sáng sai sau khi xử lý lại (Priority: P2)

Sau khi xử lý lại một nguồn, các câu trả lời cũ trong lịch sử hội thoại và kết quả Studio vẫn giữ nguyên; bấm chip
`[n]` cũ trỏ tới nguồn đó vẫn mở được nguồn nhưng không tô sáng một đoạn sai, mà hiện ghi chú rằng vị trí trích dẫn cũ
không còn chính xác.

**Why this priority**: Bảo vệ nguyên tắc "kiểm chứng được" — tô sáng sai chỗ còn tệ hơn không tô sáng.

**Independent Test**: Hỏi đáp trên một PDF cũ để có chip `[n]`; xử lý lại nguồn đó; mở lại hội thoại, bấm chip cũ ⇒
nguồn mở, không có vùng tô sáng, có ghi chú; chip của câu hỏi mới sau xử lý lại vẫn tô sáng đúng.

**Acceptance Scenarios**:

1. **Given** một câu trả lời cũ có chip trỏ tới nguồn đã xử lý lại, **When** bấm chip, **Then** trình xem nguồn mở
   nguồn đó (trang tương ứng nếu còn), không tô sáng, hiện ghi chú "Nguồn đã được xử lý lại — vị trí trích dẫn cũ
   không còn chính xác".
2. **Given** kết quả Studio tạo trước khi xử lý lại, **When** bấm chip trong đó, **Then** hành vi như trên; nội dung
   Studio không bị xoá hay tự tạo lại.
3. **Given** câu hỏi mới sau khi xử lý lại, **When** bấm chip, **Then** tô sáng đúng đoạn như bình thường.
4. **Given** hội thoại không liên quan nguồn đã xử lý lại, **When** bấm chip, **Then** không có thay đổi gì.

---

### Edge Cases

- PDF quét không có lớp chữ: giữ hành vi hiện tại (báo lỗi trích xuất), không OCR.
- Trang phân tích bố cục bị lỗi, hoặc có quá nhiều mẩu chữ: trang đó dùng cách nối cũ; các trang khác vẫn theo cách mới.
- Trang có 3+ cột, chữ bao quanh hình, chữ xoay, chữ viết từ phải sang trái: làm hết sức có thể; không nhận ra cột ⇒ đọc
  từ trên xuống; chữ xoay/RTL giữ thứ tự gốc. Không làm hỏng việc nạp tài liệu.
- Đầu trang, chân trang, số trang lặp mỗi trang: giữ nguyên trong văn bản; chú thích cuối trang ở cuối trang.
- Bảng kéo dài nhiều trang: mỗi trang là phần bảng riêng (đoạn không vắt trang).
- Văn bản tiếng Việt có dấu dạng tổ hợp: được chuẩn hoá như hiện nay, không vỡ dấu khi dựng dòng.
- Huỷ xử lý lại hoặc đóng ứng dụng giữa chừng: dữ liệu cũ còn nguyên; mở lại app không tự chạy tiếp.
- Nguồn PDF đang lỗi (chưa từng sẵn sàng): "Xử lý lại" hoạt động như thử lại bằng cách mới.
- Các loại nguồn khác (DOCX, TXT, MD, URL, âm thanh, video, ảnh): không đổi gì.

## Requirements _(mandatory)_

### Functional Requirements

**Trích xuất có bố cục (A)**

- **FR-001**: Với PDF có lớp chữ, hệ thống MUST dựng lại các dòng chữ theo vị trí trên trang thay cho việc nối mọi mẩu
  chữ bằng dấu cách.
- **FR-002**: Các dòng thuộc cùng một đoạn MUST được nối bằng dấu cách; khoảng cách dọc giữa hai dòng lớn hơn khoảng 1,5
  lần chiều cao dòng MUST tạo ranh giới đoạn (một dòng trống). Từ bị ngắt bằng gạch nối ở cuối dòng MUST được nối lại.
- **FR-003**: Với trang nhiều cột, văn bản MUST theo thứ tự đọc hết cột này rồi sang cột kế tiếp; khi không nhận ra cột
  MUST đọc từ trên xuống.
- **FR-004**: Vùng chữ được nhận diện là bảng (căn thẳng cột, tối thiểu 2 cột × 3 hàng) MUST được xuất thành bảng
  Markdown theo quy ước: mỗi hàng một dòng; ô cách dấu `|` đúng một dấu cách; không căn lề bằng dấu cách; có hàng phân
  cách sau hàng đầu; ký tự `|` trong ô được thoát; ô rỗng để trống; chữ nhiều dòng trong ô nối bằng dấu cách.
- **FR-005**: Khi không đủ chắc chắn một vùng là bảng, hệ thống MUST giữ vùng đó là văn bản dòng thường.
- **FR-006**: Đầu trang, chân trang, số trang MUST được giữ nguyên trong văn bản; chú thích cuối trang MUST nằm ở cuối
  trang; hệ thống MUST NOT tự xoá nội dung nào của trang.
- **FR-007**: Khi phân tích bố cục của một trang bị lỗi, hoặc trang vượt ngưỡng số mẩu chữ, trang đó MUST dùng cách nối
  cũ; việc nạp tài liệu MUST NOT thất bại vì lý do này.
- **FR-008**: Khi chia đoạn, một bảng ngắn hơn độ dài tối đa của đoạn MUST NOT bị cắt ngang; bảng dài hơn MUST chỉ bị
  cắt tại ranh giới giữa hai hàng. Nội dung mỗi đoạn MUST đúng nguyên văn phần văn bản tương ứng (không chèn lại hàng
  tiêu đề).
- **FR-009**: Bước làm sạch văn bản MUST giữ nguyên cấu trúc bảng Markdown và các ranh giới dòng/đoạn do FR-001..FR-004
  tạo ra, và MUST NOT đổi kết quả của các loại nguồn khác.

**Phạm vi áp dụng & xử lý lại (B)**

- **FR-010**: PDF thêm mới sau feature này MUST được trích xuất theo cách mới; PDF đã nạp trước đó MUST giữ nguyên văn
  bản, đoạn và trích dẫn; hệ thống MUST NOT tự xử lý lại ở nền.
- **FR-011**: Mỗi nguồn MUST lưu phiên bản cách trích xuất đã dùng; nguồn PDF dùng phiên bản cũ MUST hiện gợi ý thụ động
  "Xử lý lại để giữ bố cục".
- **FR-012**: Mỗi nguồn PDF ở trạng thái sẵn sàng hoặc lỗi MUST có hành động "Xử lý lại" trong menu của nguồn; nguồn
  không phải PDF MUST NOT có hành động này. Không có hành động xử lý lại hàng loạt.
- **FR-013**: Trước khi xử lý lại, hệ thống MUST hỏi xác nhận, nêu rõ trích dẫn cũ tới nguồn này sẽ không còn được tô
  sáng chính xác; huỷ ⇒ không thay đổi gì.
- **FR-014**: "Xử lý lại" MUST bị khoá khi đang sao lưu/khôi phục kho dữ liệu hoặc khi nguồn đang trong hàng đợi/đang xử
  lý. Tệp gốc không còn ⇒ MUST dẫn người dùng sang "Chọn lại tệp gốc…"; tệp gốc đã bị sửa (nội dung khác lúc nạp) ⇒
  MUST chặn kèm lý do.
- **FR-015**: Trong khi xử lý lại, dữ liệu cũ của nguồn (văn bản, đoạn, chỉ mục tìm kiếm) MUST tiếp tục dùng được cho
  tới khi bản mới dựng xong hoàn toàn rồi mới thay thế; thất bại hoặc huỷ ⇒ nguồn MUST giữ dữ liệu cũ ở trạng thái sẵn
  sàng và hiện thông báo lỗi (khi thất bại).
- **FR-016**: Xử lý lại MUST hiển thị tiến độ theo trang và MUST cho phép huỷ.

**Trích dẫn cũ (C)**

- **FR-017**: Sau khi một nguồn được xử lý lại, chip `[n]` trong các câu trả lời và kết quả Studio tạo TRƯỚC đó trỏ tới
  nguồn này MUST mở được nguồn nhưng MUST NOT tô sáng, và MUST hiện ghi chú "Nguồn đã được xử lý lại — vị trí trích dẫn
  cũ không còn chính xác". Lịch sử hội thoại và Studio MUST NOT bị xoá hay tự tạo lại.
- **FR-018**: Chip `[n]` của câu trả lời tạo SAU khi xử lý lại, và chip trỏ tới nguồn chưa từng xử lý lại, MUST hoạt động
  như hiện nay (mở đúng trang, tô sáng đúng đoạn).

**Bất biến**

- **FR-019**: Vị trí trích dẫn (trang + khoảng ký tự) MUST được tính một lần trên văn bản chính tắc đã làm sạch (kể cả
  phần bảng); đoạn MUST NOT vắt qua ranh giới trang; trình xem nguồn MUST hiển thị đúng văn bản đó và tô sáng đúng
  đoạn (Constitution II).
- **FR-020**: Trình xem nguồn MUST giữ dạng văn bản (bảng hiển thị nguyên dạng `| a | b |`).
- **FR-021**: Feature MUST NOT thêm kết nối mạng (Constitution I); mọi xử lý ở tiến trình chính; kênh giao tiếp mới cho
  "Xử lý lại" MUST nằm trong danh sách cho phép và chỉ nhận mã nguồn, không nhận đường dẫn tệp (Constitution III);
  MUST NOT ghi nội dung tài liệu vào nhật ký.
- **FR-022**: Logic dựng dòng, thứ tự đọc và bảng MUST có kiểm thử viết trước trên các PDF mẫu tự sinh (1 cột, 2 cột,
  bảng có viền, bảng không viền, tiếng Việt có dấu, trang xoay) — không dùng tài liệu vướng bản quyền (Constitution IV).
- **FR-023**: Các loại nguồn DOCX, TXT, MD, URL, âm thanh, video, ảnh MUST NOT thay đổi hành vi.

### Key Entities _(include if feature involves data)_

- **Nguồn (source)**: thêm thuộc tính **phiên bản trích xuất** (cách trích đã dùng để tạo văn bản và đoạn hiện tại);
  quyết định có hiện gợi ý "Xử lý lại" không.
- **Văn bản chính tắc của trang**: văn bản đã dựng dòng/cột/bảng và làm sạch; là cơ sở duy nhất để tính vị trí trích
  dẫn.
- **Bảng (trong văn bản)**: vùng các hàng/ô được biểu diễn dạng bảng Markdown trong văn bản chính tắc.
- **Lần xử lý lại**: hành động do người dùng khởi tạo trên một nguồn; có tiến độ theo trang, có thể huỷ, kết thúc bằng
  thay thế dữ liệu (thành công) hoặc giữ dữ liệu cũ (lỗi/huỷ).
- **Trích dẫn cũ (stale citation)**: trích dẫn đã lưu trỏ tới nguồn đã được xử lý lại sau thời điểm trích dẫn được tạo.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Trên PDF mẫu hai cột, 100% đoạn văn được trích ra không chứa chữ của cột kia; thứ tự đoạn khớp thứ tự đọc
  của bản gốc.
- **SC-002**: Trên PDF mẫu có bảng (có viền và không viền, ≥ 2 cột × 3 hàng), 100% bảng mẫu được xuất thành bảng
  Markdown đúng số hàng, số cột và giá trị ô; trên mẫu "không phải bảng" (mục lục, danh sách), 0 vùng bị nhận nhầm là
  bảng.
- **SC-003**: 100% chip `[n]` trên PDF nạp bằng cách mới mở đúng trang và tô sáng đúng đoạn được trích.
- **SC-004**: Sau khi xử lý lại, 0 chip cũ trỏ tới nguồn đó bị tô sáng sai chỗ; 100% vẫn mở được nguồn kèm ghi chú.
- **SC-005**: Xử lý lại thất bại hoặc bị huỷ ⇒ 100% trường hợp nguồn vẫn hỏi đáp, tìm kiếm và xem được bằng dữ liệu cũ.
- **SC-006**: Thời gian trích xuất một PDF bằng cách mới không vượt quá 2 lần cách cũ trên cùng tệp.
- **SC-007**: Kết quả bộ đánh giá truy xuất hiện có (108) không giảm sau feature (bộ đánh giá không chứa PDF nên số liệu
  phải giữ nguyên), và các loại nguồn khác cho kết quả trích xuất y hệt trước feature.
- **SC-008**: Ứng dụng đóng gói không có thêm kết nối mạng nào do feature này.

## Assumptions

- "Đủ chắc chắn là bảng" được đo bằng mức thẳng hàng của các cột chữ trên ≥ 3 hàng liên tiếp; ngưỡng cụ thể chốt ở bước
  lập kế hoạch và kiểm bằng PDF mẫu.
- Ngưỡng "quá nhiều mẩu chữ" một trang chốt ở bước lập kế hoạch sao cho trang thông thường không chạm ngưỡng.
- Độ dài tối đa của đoạn chia giữ như hiện nay.
- Gợi ý "Xử lý lại để giữ bố cục" là chữ/huy hiệu nhỏ trong cột Nguồn, không chặn thao tác khác.
- Ghi chú trích dẫn cũ dựa vào việc so thời điểm tạo trích dẫn với thời điểm nguồn được xử lý lại (hoặc thông tin tương
  đương); chi tiết lưu trữ chốt ở bước lập kế hoạch.
- Bộ đánh giá 108 chỉ chứa tài liệu Markdown nên chạy lại để xác nhận không hồi quy; bổ sung PDF vào bộ đánh giá để sau.
- Người dùng mục tiêu là một người trên một máy (không có xử lý lại đồng thời từ nhiều thiết bị).
