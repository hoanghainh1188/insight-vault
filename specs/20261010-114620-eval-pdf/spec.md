# Feature Specification: Thêm PDF vào bộ đánh giá truy xuất

**Feature Branch**: `177-eval-pdf`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Mở rộng bộ đánh giá truy xuất của InsightVault (`npm run eval:retrieval`, `tests/eval/`, dev-only) để bộ tài liệu đánh giá có thêm tài liệu PDF, được nạp qua trình trích PDF thật của app; báo cáo có số liệu riêng cho câu hỏi PDF; hiệu chuẩn hiện có không âm thầm lệch (issue #177)." — chi tiết đầy đủ ở `docs/intake/177-eval-pdf.md`.

## Clarifications

### Session 2026-10-10

- Q: Nguồn của PDF tiếng Việt thật? → A: Bản "Tải về dạng PDF" của Wikipedia tiếng Việt cho một bài **chưa có** trong bộ dữ liệu (CC BY-SA 4.0, ghi `revisionId`, ghi công + "thay đổi đã làm: xuất PDF").
- Q: Nguồn chân lý để kiểm trích dẫn đáp án của PDF? → A: Bước kiểm dữ liệu chạy trình trích PDF thật của app (bất đồng bộ) và kiểm trên văn bản vừa trích; cách trích đổi ⇒ kiểm dữ liệu fail, nêu câu hỏi + tài liệu; sửa bằng cập nhật trích dẫn + tăng `datasetVersion`.
- Q: Đo lại `RELEVANCE_CALIBRATION` ở đâu, và nếu cấu hình không còn đạt? → A: Cùng PR — đo lại cấu hình 108 + bộ chấm 109 trên bộ dữ liệu mới, cập nhật số liệu + `datasetVersion` + `calibratedAt`, giữ số liệu v3 trong ADR làm mốc; không còn đạt ⇒ dừng, báo lại, mở issue riêng, không đổi mục tiêu / cấu hình trong PR này.
- Q: Ngưỡng cảnh báo Recall@6 của nhóm PDF? → A: Cảnh báo khi cận trên khoảng tin cậy Wilson 95% của Recall@6 PDF thấp hơn Recall@6 của nhóm Markdown, tính riêng dev và hold-out.
- Q: Giữ tất định trước giới hạn thời gian dựng bố cục của trình trích PDF? → A: Không đổi cấu hình app; PDF đủ nhỏ + unit test trích mỗi PDF hai lần, văn bản giống hệt, thời gian trích ≤ 1000 ms (vượt ⇒ test fail).

### Session 2026-10-12 (sau T022)

- Q: T022 thấy q-121 (en) tụt khỏi top 6 ở cấu hình 108 KHÔNG bộ chấm (2 đoạn PDF chen vào) và 2 câu không đáp án sát chủ đề PDF (q-176, q-179) lọt bộ chấm 109 — xử lý thế nào? → A: "Không tụt" đo trên đường app thật (108 + 109) — ở đó câu cũ không tụt; q-121 ghi vào ADR như quan sát; tiếp tục T023 (chỉ số liệu); mở issue riêng cho q-176 / q-179.

## User Scenarios & Testing _(mandatory)_

Người dùng của feature này là **người phát triển / chủ dự án InsightVault** — người chạy bộ đánh giá truy xuất để quyết định có
chấp nhận một thay đổi về trích xuất, chia đoạn, nhúng hay xếp hạng hay không. Người dùng cuối của app không thấy thay đổi nào.

### User Story 1 - Đo chất lượng truy xuất trên tài liệu PDF (Priority: P1)

Người phát triển vừa sửa cách trích PDF (như 112 giữ bố cục, 147 bảng số / trang xoay / gạch nối) và muốn biết thay đổi đó làm truy
xuất tốt lên hay tệ đi. Họ chạy bộ đánh giá như thường lệ; bộ đánh giá nạp cả tài liệu PDF bằng đúng đường mà app dùng khi người
dùng thêm một nguồn PDF, chạy các câu hỏi trỏ vào PDF qua đúng bước truy xuất của app, rồi báo cáo kết quả của nhóm câu hỏi PDF
tách riêng khỏi nhóm Markdown.

**Why this priority**: Đây là lý do tồn tại của issue — hiện mọi thay đổi trích PDF đều "không đo được" (SC-007 của 112 và 147).
Không có câu chuyện này thì các phần còn lại không có giá trị.

**Independent Test**: Chạy bộ đánh giá trên bộ dữ liệu mới ⇒ báo cáo có mục kết quả cho nhóm câu hỏi PDF (số câu, tỉ lệ tìm thấy
đúng đoạn trong top 1 / 3 / 6, thứ hạng trung bình nghịch đảo) và ghi phiên bản trích xuất PDF đã dùng.

**Acceptance Scenarios**:

1. **Given** bộ dữ liệu có tài liệu PDF và câu hỏi có đáp án nằm trong PDF, **When** người phát triển chạy bộ đánh giá, **Then**
   tài liệu PDF được nạp qua trình trích PDF của app (không phải coi như văn bản thuần) và báo cáo hiện số liệu riêng của nhóm câu
   hỏi PDF.
2. **Given** câu hỏi có đáp án nằm trong một **bảng** của PDF, **When** chạy đánh giá, **Then** câu đó được chấm bằng cùng quy tắc
   như mọi câu khác (đúng nếu đoạn chứa trích dẫn đáp án nằm trong top-k).
3. **Given** chạy bộ đánh giá hai lần liên tiếp trên cùng máy, **When** so hai báo cáo, **Then** văn bản trích từ PDF và số liệu
   nhóm PDF giống hệt nhau.
4. **Given** máy không có mạng (đã có sẵn bộ nhớ đệm mô hình từ lần chạy trước), **When** chạy bộ đánh giá, **Then** việc nạp PDF
   hoàn tất mà không cần tải gì.

---

### User Story 2 - Dữ liệu PDF hợp lệ và có nguồn gốc rõ ràng (Priority: P1)

Chủ dự án duyệt bộ dữ liệu trước khi dùng nó để chọn cấu hình. Họ cần chắc rằng: mỗi tệp PDF có nguồn, giấy phép cho phép phân
phối lại, dung lượng nằm trong ngân sách; mỗi câu hỏi PDF có trích dẫn đáp án tồn tại **nguyên văn trong văn bản mà PDF thực sự cho
ra khi được nạp**; câu không có đáp án thực sự không có đáp án trong mọi tài liệu.

**Why this priority**: Nhãn sai thì số liệu vô nghĩa; giấy phép sai thì không được commit. Đi cùng P1 với câu chuyện 1.

**Independent Test**: Chạy bước kiểm dữ liệu (không cần mô hình) ⇒ mọi trích dẫn PDF khớp văn bản trích xuất; sửa một chữ trong
trích dẫn ⇒ kiểm dữ liệu báo lỗi chỉ rõ câu hỏi và tài liệu.

**Acceptance Scenarios**:

1. **Given** một trích dẫn đáp án không có nguyên văn trong văn bản trích từ PDF, **When** kiểm dữ liệu, **Then** bộ đánh giá dừng
   với thông báo nêu mã câu hỏi và mã tài liệu.
2. **Given** manifest khai báo tài liệu PDF, **When** kiểm dữ liệu, **Then** tài liệu có định dạng, tệp, nguồn, giấy phép, ngày lấy
   và dấu vân tay nội dung; thiếu trường hoặc tệp không khớp dấu vân tay ⇒ lỗi.
3. **Given** bộ dữ liệu vừa đổi, **When** mở manifest, **Then** phiên bản bộ dữ liệu đã tăng và trạng thái "đã duyệt" đã bị xoá —
   bộ dữ liệu không được dùng để chọn cấu hình cho tới khi chủ dự án duyệt lại.

---

### User Story 3 - Hiệu chuẩn hiện có không âm thầm lệch, có số liệu trước / sau (Priority: P2)

Thêm tài liệu và câu hỏi làm đổi mọi con số nền đã ghi (bản ghi hiệu chuẩn mức liên quan của 108 / bộ chấm 109). Chủ dự án cần thấy
số liệu **trước / sau** trên các tập hiện có, chắc rằng các tập hiện có không bị tụt, và nếu cấu hình hiện hành không còn đạt thì
được báo rõ thay vì bị hạ mục tiêu ngầm.

**Why this priority**: Bảo vệ các quyết định đã chốt ở 108 / 109; nhưng chỉ có ý nghĩa sau khi câu chuyện 1–2 xong.

**Independent Test**: So báo cáo của bộ dữ liệu cũ với bộ dữ liệu mới trên đúng tập câu hỏi cũ ⇒ không tụt; test canh giữ bản ghi
hiệu chuẩn xanh với số liệu mới.

**Acceptance Scenarios**:

1. **Given** bộ dữ liệu mới, **When** đo lại cấu hình hiện hành, **Then** bản ghi hiệu chuẩn được cập nhật số liệu và phiên bản bộ
   dữ liệu, và test canh giữ đi qua.
2. **Given** cấu hình hiện hành không còn đạt mục tiêu trên bộ dữ liệu mới, **When** đo lại, **Then** công việc dừng và báo lại;
   mục tiêu và cấu hình không bị đổi trong issue này.
3. **Given** PR của feature, **When** người duyệt đọc mô tả, **Then** có bảng số liệu trước / sau cho các tập hiện có và cho nhóm PDF.

---

### Edge Cases

- PDF có trang quét (không có lớp chữ) ⇒ không đủ điều kiện vào bộ dữ liệu (PDF quét / OCR ngoài phạm vi).
- Cách trích PDF của app đổi sau này (phiên bản trích xuất tăng) ⇒ trích dẫn PDF có thể ngừng khớp; bộ đánh giá báo lỗi dữ liệu rõ
  ràng (là tín hiệu hồi quy mong muốn), không chấm sai âm thầm.
- Trích xuất chạm giới hạn thời gian dựng bố cục trên máy chậm ⇒ văn bản trích có thể khác; bộ đánh giá phải tránh hoặc phát hiện
  tình huống này để kết quả vẫn tất định.
- Nội dung PDF trùng với một tài liệu Markdown đã có ⇒ đáp án xuất hiện hai lần, làm nhiễu câu hỏi cũ; không được để xảy ra ngầm.
- Trích dẫn nằm đúng chỗ ngắt dòng có gạch nối, hoặc trong ô bảng ⇒ phải viết theo dạng văn bản đã trích (giữ gạch nối tiếng Việt,
  bảng dạng `| ô | ô |`).
- Tệp PDF bị thay mà không tăng phiên bản bộ dữ liệu ⇒ kiểm dấu vân tay phát hiện.
- Metadata PDF (tác giả, đường dẫn máy) chứa thông tin cá nhân ⇒ phải được loại trước khi commit.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Bộ đánh giá MUST nạp tài liệu PDF bằng đúng trình trích PDF mà app dùng cho nguồn PDF, rồi chia đoạn, nhúng, lập chỉ mục
  và truy xuất bằng đúng quy trình của app như với tài liệu Markdown.
- **FR-002**: Việc nạp PDF MUST chạy hoàn toàn cục bộ (không truy cập mạng ngoài bộ nhớ đệm mô hình đã có), không đọc / ghi dữ liệu
  người dùng, và cho cùng văn bản trích xuất ở mọi lần chạy. Bộ đánh giá MUST dùng nguyên cấu hình trích PDF của app (không nới giới hạn thời gian dựng bố
  cục); một unit test MUST trích mỗi PDF hai lần, xác nhận văn bản giống hệt và thời gian trích ≤ 1000 ms.
- **FR-003**: Manifest MUST cho phép mỗi tài liệu khai báo định dạng (Markdown hoặc PDF) và tệp, cùng nguồn, giấy phép, ngày lấy, dấu
  vân tay nội dung; giấy phép MUST thuộc danh sách cho phép phân phối lại, mở rộng cho tài liệu PDF được chọn.
- **FR-004**: Bước kiểm dữ liệu MUST xác nhận mọi trích dẫn đáp án (≤ 200 ký tự) có nguyên văn trong văn bản mà tài liệu thực sự cho ra
  khi được nạp — với PDF, bước kiểm MUST chạy chính trình trích PDF của app (không dùng bản chụp) và kiểm trên văn bản vừa trích; sai ⇒
  dừng với thông báo nêu câu hỏi và tài liệu. Khi cách trích PDF đổi làm trích dẫn ngừng khớp, cách xử lý là cập nhật trích dẫn và tăng
  phiên bản bộ dữ liệu (đây là tín hiệu hồi quy mong muốn).
- **FR-005**: Bộ dữ liệu MUST có câu hỏi có đáp án trỏ vào PDF, gồm câu có đáp án trong **bảng (số căn phải)**, trong **từ ghép có gạch
  nối** và trên **trang khổ ngang**, cùng câu không có đáp án sát chủ đề PDF; tuân quy tắc nhãn hiện hành.
- **FR-006**: Câu hỏi PDF MUST được chia vào tập dev / hold-out theo cùng quy tắc ~70/30 trong từng loại như câu hiện có (cả dev và hold-out); báo cáo nêu rõ cỡ mẫu nhỏ của hold-out PDF.
- **FR-007**: Khi bộ dữ liệu đổi, phiên bản bộ dữ liệu MUST tăng và trạng thái "đã duyệt" MUST bị xoá cho tới khi chủ dự án duyệt lại.
- **FR-008**: Báo cáo MUST ghi phiên bản trích xuất PDF đã dùng và hiện số liệu riêng của nhóm câu hỏi PDF (số câu, Recall@1 / 3 / 6,
  MRR, khoảng tin cậy); nhóm PDF chỉ để **tham khảo** (không vào cổng ĐẠT 108–109), nhưng báo cáo MUST **cảnh báo** khi Recall@6 của nhóm PDF thấp hơn nhóm Markdown có ý nghĩa thống kê — tức **cận trên khoảng tin cậy Wilson 95%** của Recall@6 nhóm PDF thấp hơn Recall@6 của nhóm Markdown, tính
  riêng cho dev và hold-out; cảnh báo không làm bộ đánh giá fail.
- **FR-009**: Trong **cùng PR**, bản ghi hiệu chuẩn MUST được đo lại (cấu hình 108 + bộ chấm 109) trên bộ dữ liệu mới và ghi lại số liệu,
  phiên bản bộ dữ liệu và thời điểm hiệu chuẩn; số liệu của bộ dữ liệu cũ (v3) MUST được giữ trong ADR làm mốc trước / sau; test canh giữ
  MUST tiếp tục đúng. Nếu cấu hình hiện hành không còn đạt mục tiêu thì MUST dừng, báo lại và mở issue riêng — không đổi mục tiêu hay
  cấu hình trong PR này.
  _Ghi chú 2026-10-12: trên v4, từ chối đúng dev của bộ chấm đã ghi 85,7% < 90% (q-176, q-179 sát chủ đề PDF) — chủ dự án chốt tiếp tục
  (`gateVerdict` vẫn ĐẠT; câu cũ không tụt trên đường app), theo dõi ở #187; xem Clarifications 2026-10-12._
- **FR-010**: Recall@6 và MRR của các câu hỏi hiện có MUST không giảm so với trước khi thêm PDF, **đo trên cấu hình như app đang chạy
  (cấu hình 108 + bộ chấm 109 đã ghi)**; thay đổi ở cấu hình 108 không bộ chấm được ghi vào ADR như quan sát. PR MUST kèm số liệu trước
  / sau.
- **FR-011**: Bộ dữ liệu MUST thêm **2 PDF**: 1 PDF **sinh từ fixture của dự án** (chủ động chứa bảng số căn phải, trang khổ ngang, từ ghép có gạch nối) và 1 **PDF thật tiếng Việt** là bản "Tải về dạng PDF" của Wikipedia tiếng Việt cho một bài chưa có trong bộ dữ liệu (CC BY-SA 4.0, có lớp chữ, ghi `revisionId`, ghi công + "thay đổi đã làm: xuất PDF", metadata cá nhân đã dọn); tổng dung lượng thêm vào repo ≤ ~1 MB.
- **FR-012**: Tài liệu bộ đánh giá MUST được cập nhật: cách dùng, nguồn / giấy phép / ghi công / thay đổi đã làm, cách xác minh tệp;
  ADR mới + dòng mục lục quyết định ghi hoàn thành mục "PDF vào eval" của 112 #13 và 147 #20; thuật ngữ mới vào glossary.
- **FR-013**: Mã chạy của app (trích PDF, phiên bản trích xuất, chia đoạn, truy xuất, xếp hạng lại) MUST không đổi; tài liệu đánh giá
  MUST không được đóng gói vào bản cài; không thêm phụ thuộc; quy trình CI đánh giá vẫn chỉ chạy bấm tay, không chặn PR.
- **FR-014**: Mọi logic mới của bộ đánh giá MUST có unit test viết trước, đạt độ phủ ≥ 80% phần logic; bộ test hiện có tiếp tục xanh.

### Key Entities

- **Tài liệu đánh giá (corpus document)**: một tệp trong bộ dữ liệu — mã, định dạng (Markdown / PDF), tệp, nguồn, giấy phép, ngày lấy,
  dấu vân tay, vai trò (thật / nhiễu).
- **Văn bản trích xuất của PDF**: văn bản app tạo ra từ PDF (đoạn nối bằng dấu cách, bảng dạng Markdown, tiếng Việt giữ gạch nối) —
  là "nguồn chân lý" để kiểm trích dẫn đáp án.
- **Câu hỏi đánh giá**: câu, ngôn ngữ, tập (dev / hold-out), có / không có đáp án, trích dẫn đáp án, tài liệu đích.
- **Nhóm số liệu PDF**: tập con câu hỏi có tài liệu đích là PDF, với các chỉ số truy xuất và khoảng tin cậy.
- **Bản ghi hiệu chuẩn**: số liệu đã đo của cấu hình mức liên quan + bộ chấm theo phiên bản bộ dữ liệu.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Mỗi lần chạy bộ đánh giá, báo cáo có một mục kết quả riêng cho câu hỏi PDF (≥ 1 chỉ số tìm thấy đúng đoạn và thứ hạng),
  ghi rõ phiên bản trích xuất PDF đã dùng.
- **SC-002**: 100% trích dẫn đáp án của câu hỏi PDF khớp nguyên văn văn bản trích xuất; bước kiểm dữ liệu hoàn tất không cần mô hình
  và không cần mạng.
- **SC-003**: Hai lần chạy liên tiếp trên cùng máy cho văn bản trích PDF và số liệu nhóm PDF giống hệt nhau; trích mỗi PDF mất ≤ 1 giây
  (dư ≥ 5 lần so với giới hạn dựng bố cục của app).
- **SC-004**: Trên các câu hỏi hiện có, đo theo cấu hình như app đang chạy (108 + 109), Recall@6 và MRR sau khi thêm PDF không thấp
  hơn trước.
- **SC-005**: Dung lượng thêm vào repo nằm trong ngân sách đã chốt; mọi tệp PDF có nguồn và giấy phép cho phép phân phối lại.
- **SC-006**: Bản cài của app không thay đổi kích thước vì tài liệu đánh giá; bộ test của dự án vẫn xanh với độ phủ ≥ 80% phần logic mới.

## Assumptions

- Người dùng của feature là người phát triển / chủ dự án; không có thay đổi giao diện app.
- Quy ước văn bản trích PDF là quy ước đã chốt ở 112 / 147 (đoạn nối bằng dấu cách, bảng Markdown, tiếng Việt giữ gạch nối); feature
  này chỉ đo, không đổi trích xuất.
- PDF quét / cần OCR nằm ngoài phạm vi; mọi PDF đều có lớp chữ.
- Chốt ở specify (2026-10-10): 2 PDF (1 fixture + 1 thật, ≤ ~1 MB); câu PDF chia dev / hold-out 70/30; nhóm PDF tham khảo + cảnh báo (ngưỡng: cận trên Wilson 95% của PDF < Markdown).
- Tiêu chí ĐẠT hiện hành (tính trên câu tiếng Việt; câu tiếng Anh chỉ tham khảo) và các mục tiêu `TARGET_*` giữ nguyên.
- Mặc định cho các điểm còn lại (ghi ở `docs/04-decisions/2026-10-10-eval-pdf-clarify.md`, chủ dự án có thể đổi trước `/speckit-plan`):
  - PDF fixture có đủ: bảng số căn phải, một trang khổ ngang, từ ghép có gạch nối ở cuối dòng (tiếng Việt và tiếng Anh), một trang hai
    cột, một đáp án nằm sát cuối trang; mỗi đặc trưng có ít nhất một câu hỏi có đáp án nằm đúng chỗ đặc trưng đó.
  - Không PDF nào trùng nội dung với tài liệu Markdown đã có (không "song sinh").
  - Phiên bản trích xuất PDF chỉ được **ghi** vào báo cáo; không thêm canh giữ vào bản ghi hiệu chuẩn.
  - Có một unit test nhanh (không cần mô hình, không mạng) trong bộ test thường lệ: kiểm mọi trích dẫn PDF + tất định + thời gian.
  - Bộ sinh PDF fixture chỉ được **thêm** khả năng (dàn dòng, phân trang), không đổi hành vi hiện có; nội dung fixture là văn bản tự soạn
    (giấy phép "tự soạn / CC0"); tệp PDF được commit kèm cách tái tạo và dấu vân tay.
  - Không đo "đúng trang" trong issue này (để issue sau).
  - Danh sách giấy phép thêm "tự soạn / CC0"; manifest thêm định dạng, tệp, dấu vân tay.
  - Không thêm tài liệu nhiễu dạng PDF; hai PDF là tài liệu thật; ngưỡng số tài liệu tối thiểu giữ nguyên.
  - Câu hỏi PDF chỉ bằng tiếng Việt.
  - ADR clarify + ADR thực thi + dòng mục lục quyết định; thuật ngữ mới append vào glossary.
- Bộ nhớ đệm mô hình nhúng / bộ chấm đã có từ lần chạy đầu như hiện nay.
