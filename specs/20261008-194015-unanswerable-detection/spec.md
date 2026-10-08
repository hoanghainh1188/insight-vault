# Feature Specification: Tách câu hỏi không có đáp án ở tầng truy xuất

**Feature Branch**: `109-unanswerable-detection`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Tách câu hỏi không có đáp án trong nguồn ở tầng truy xuất cho hỏi đáp có trích dẫn của InsightVault
(issue #109; nguồn: docs/intake/109-unanswerable-detection.md; 12 quyết định clarify ở
docs/04-decisions/2026-10-08-unanswerable-detection-clarify.md). Tiêu chí: hold-out tiếng Việt từ chối đúng ≥ 90% và Recall@6 ≥ 85%
(sàn 75%, dưới sàn dừng và báo lại)."

## Bối cảnh

Hỏi đáp có trích dẫn của InsightVault lấy ra vài đoạn nguồn liên quan rồi cho model chat trả lời dựa trên các đoạn đó. Khi câu hỏi
**không có đáp án trong nguồn**, ứng dụng phải trả "Không tìm thấy trong nguồn" thay vì bịa. Feature 108 đã thử chặn từ bước chọn
đoạn bằng ngưỡng khoảng cách ngữ nghĩa nhưng thất bại: với model embedding hiện tại, khoảng cách của câu không có đáp án
(~0,10–0,14) chồng lên khoảng cách của đoạn đúng (~0,06–0,16). Quét 392 cấu hình, không cấu hình nào đạt "từ chối đúng ≥ 90%" mà vẫn
giữ "Recall@6 ≥ 75%" (đường đánh đổi trên dev: ≤ 0,10 ⇒ 100% / 41%; ≤ 0,13 ⇒ 50% / 81%; hiện hành ≤ 0,5 ⇒ 0% / 97%).

Vì vậy hôm nay bước chọn đoạn gần như không bao giờ trả rỗng; việc "không bịa" dựa hoàn toàn vào tầng trả lời (lời nhắc + hậu kiểm
"không có `[n]` hợp lệ ⇒ không tìm thấy"). Tầng này **không tất định** và phụ thuộc model chat: đo ở 123 (qwen2.5:7b), từ chối đúng câu
tiếng Việt không có đáp án dao động 5/6–6/6 giữa các lượt; đo ở 108, 4,2% câu có đáp án bị trả "không tìm thấy" vì model quên `[n]`.

Feature này thêm một bước **ở tầng truy xuất**, phân biệt "đoạn này có trả lời được câu hỏi này không" tốt hơn khoảng cách embedding,
để câu không có đáp án bị chặn **trước khi** tới model chat — tất định hơn và độc lập với model chat. Bước mới là **chốt bổ sung**,
không thay thế tầng trả lời 108/123.

## Clarifications

### Session 2026-10-08

Nguồn: `docs/04-decisions/2026-10-08-unanswerable-detection-clarify.md` (người dùng chọn toàn bộ phương án khuyên dùng).

- Q: Thứ tự thử các hướng và quy tắc chọn? → A: Thí nghiệm tuần tự trong công cụ đo trước khi tích hợp: (a) bộ chấm độ liên quan
  (cross-encoder) chạy cục bộ với ≥ 2 model đa ngôn ngữ cỡ nhỏ → (b) model chat cục bộ chấm độ liên quan → (c) đổi model embedding
  chỉ khi (a), (b) không đạt sàn. Nhiều hướng cùng đạt trên hold-out **và** dev ⇒ ưu tiên (1) tất định và không cần Ollama, (2) độ trễ
  ấm thấp nhất, (3) dung lượng tải nhỏ nhất, (4) đơn giản nhất.
- Q: Độ tin cậy thống kê, mở rộng bộ đo? → A: Thêm câu không có đáp án lên ≥ 30 câu tiếng Việt (dev/hold-out ~70/30 ⇒ ≥ 9 câu hold-out)
  và ≥ 10 câu English; chủ dự án duyệt; tăng phiên bản bộ đo và đồng bộ phiên bản bộ đo trong bản ghi hiệu chuẩn. ĐẠT = ≥ 90% từ chối
  đúng trên hold-out **và** cận dưới khoảng tin cậy 95% trên dev + hold-out gộp không thấp hơn mốc chốt ở plan.
- Q: Ngân sách độ trễ? → A: Đo trước rồi mới chốt. Mốc khởi đầu: tăng ≤ 300 ms mỗi câu ở lần chạy ấm (≤ 20 ứng viên, CPU), nạp nguội
  ≤ vài giây và một lần mỗi phiên; hướng (b) chỉ chấp nhận nếu tổng thêm ≲ vài giây. Báo cáo p50/p95. Không thêm UI trạng thái nếu
  nằm trong ngân sách.
- Q: Mục tiêu cho câu hỏi English? → A: Sàn không tụt so với mốc đo cùng lượt (kể cả câu English hỏi nguồn tiếng Việt); kém hơn ⇒ ghi
  giới hạn đã biết trong ADR và cân nhắc loại hướng đó. Tiêu chí ĐẠT cứng chỉ cho tiếng Việt.
- Q: Tải model mới lần đầu? → A: Như model embedding/bóc băng hiện có: tải một lần vào thư mục dữ liệu, chỉ báo riêng tư "đang gửi —
  tải model" trong lúc tải, không hỏi riêng; tải nền khi notebook đầu tiên có nguồn sẵn sàng (hoặc ngay khi cần — chốt theo số đo);
  không đóng gói sẵn trong bộ cài ở v1; một dòng trạng thái ngắn ở Cài đặt (vi + en).
- Q: Điểm chèn, ngưỡng, ngữ nghĩa điểm? → A: Chấm tập ứng viên hợp nhất sau bước trộn hai nhánh tìm kiếm (≤ ~20 đoạn), giữ ngưỡng
  khoảng cách 0,5 hiện có làm tiền lọc; ngưỡng tuyệt đối + tương đối quét theo quy trình dev/hold-out của 108; điểm mới dùng để lọc và
  xếp lại thứ tự trước bước đa dạng hoá nếu số đo cho thấy lợi; điểm mới là một trường riêng, không đổi nghĩa điểm khoảng cách hiện có.
- Q: Ngưỡng theo ngôn ngữ? → A: Một ngưỡng chung trước; chỉ tách vi/en (khi nhận diện ngôn ngữ câu hỏi chắc chắn) nếu số đo cho thấy
  chênh lệch đáng kể — ghi ADR.
- Q: Hướng (b) với AI online / không có Ollama? → A: Bước chấm luôn chạy cục bộ; không có model chat cục bộ ⇒ bỏ qua bước chấm
  (fail-open, ghi mã sự kiện); không chuyển bước chấm sang nhà cung cấp online ở v1.
- Q: Khi kết luận "không có đáp án"? → A: Như 108: chế độ Theo nguồn ⇒ "Không tìm thấy trong nguồn", không gọi model; chế độ Mở rộng ⇒
  gọi model với ngữ cảnh rỗng, nhãn "ngoài nguồn" như hiện nay. Không đổi câu gợi ý trừ khi từ chối nhầm tăng đáng kể.
- Q: Khi bước mới không chạy được? → A: Fail-open + thời gian chờ: model chưa tải / tải lỗi / offline lần đầu / lỗi suy luận / quá giờ ⇒
  không lọc thêm (giữ hành vi 108), ghi mã sự kiện (không nội dung), không chặn hỏi đáp; trạng thái "chưa sẵn sàng" chỉ hiện ở Cài đặt.
- Q: Giấy phép, dung lượng model? → A: Loại model không cho dùng thương mại; chỉ xét model đã có bản chạy được bằng thư viện suy luận
  cục bộ đang dùng (xác minh, không giả định); ghi giấy phép + dung lượng + RAM đo được vào ADR.
- Q: Quan hệ với quyết định 055 và canh giữ hiệu chuẩn? → A: ADR mới thay thế một phần 055 (mục "không xếp hạng lại bằng LLM/
  cross-encoder"); bản ghi hiệu chuẩn thêm phần cho bước mới + phiên bản model của bước mới, kèm test canh giữ như với model embedding;
  kiểm tra đánh giá trên CI chỉ báo cáo, không chặn PR.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Câu hỏi không có trong nguồn được báo "Không tìm thấy" nhất quán (Priority: P1)

Người dùng (nhà nghiên cứu, luật sư, nhà báo…) hỏi một câu mà tài liệu trong notebook không trả lời. Ở chế độ Theo nguồn, ứng dụng
trả "Không tìm thấy trong nguồn" kèm gợi ý — và làm vậy **lần nào cũng như nhau**, không phụ thuộc model chat có "nhớ" từ chối hay
không, và không đính kèm đoạn nguồn không liên quan.

**Why this priority**: "Không bịa" là điểm khác biệt cốt lõi của sản phẩm (kiểm chứng được). Hôm nay đây là khâu yếu nhất: tầng
truy xuất không lọc được và tầng trả lời không tất định.

**Independent Test**: Chạy công cụ đo trên nhóm câu không có đáp án của bộ đánh giá (hold-out tiếng Việt): tỉ lệ câu mà bước chọn
đoạn trả rỗng ≥ 90%; trong ứng dụng, các câu đó hiển thị "Không tìm thấy trong nguồn" mà không gọi model chat.

**Acceptance Scenarios**:

1. **Given** notebook có nguồn về phở và Hồ Hoàn Kiếm, chế độ Theo nguồn, bước mới sẵn sàng, **When** hỏi "Giá vé máy bay Hà Nội –
   Paris là bao nhiêu?", **Then** ứng dụng trả "Không tìm thấy trong nguồn" + gợi ý, không có chip `[n]`, và không gọi model chat.
2. **Given** cùng câu hỏi đó hỏi 5 lần liên tiếp, **When** bước mới sẵn sàng, **Then** cả 5 lần đều cho cùng kết quả "không tìm thấy".
3. **Given** chế độ Mở rộng, **When** hỏi câu không có trong nguồn, **Then** model vẫn trả lời với ngữ cảnh rỗng và nhãn "ngoài nguồn"
   như hiện nay.

---

### User Story 2 - Câu có đáp án vẫn được trả lời đầy đủ với trích dẫn (Priority: P1)

Người dùng hỏi câu mà tài liệu có trả lời. Bước mới **không** được làm mất các đoạn chứa đáp án: câu trả lời vẫn có chip `[n]` mở đúng
đoạn nguồn như trước.

**Why this priority**: Chặn được câu không đáp án mà làm mất câu trả lời đúng thì tệ hơn hiện tại (108 cho thấy ngưỡng chặt làm
Recall@6 rơi xuống 41%).

**Independent Test**: Công cụ đo trên nhóm câu có đáp án (hold-out tiếng Việt): Recall@6 ≥ 85% (sàn 75%).

**Acceptance Scenarios**:

1. **Given** notebook có nguồn về phở, **When** hỏi "Phở có nguồn gốc từ đâu?", **Then** câu trả lời có chip `[n]` và bấm chip mở
   đúng đoạn chứa đáp án.
2. **Given** một câu có đáp án nằm ở đoạn mà trước đây xếp hạng thấp, **When** bước mới xếp lại thứ tự (nếu được chọn), **Then** đoạn
   đó vẫn nằm trong các đoạn đưa cho model.

---

### User Story 3 - Chủ dự án chọn hướng bằng số đo (Priority: P1)

Chủ dự án chạy công cụ đo, so sánh các hướng ứng viên (bộ chấm độ liên quan cục bộ, model chat chấm, model embedding khác) trên cùng bộ
đánh giá, xem bảng tỉ lệ từ chối đúng / Recall@6 / độ trễ cho từng hướng và cấu hình, rồi chọn theo quy tắc đã chốt. Kết quả và lý do
chọn được ghi vào ADR; nếu không hướng nào đạt sàn, công cụ đo báo rõ và feature dừng lại thay vì hạ mục tiêu.

**Why this priority**: Không có số đo thì không chọn được hướng — đây là điều kiện để làm US1/US2 đúng.

**Independent Test**: Chạy công cụ đo một lệnh, nhận báo cáo gồm từng hướng/cấu hình với tỉ lệ từ chối đúng, Recall@6 (dev, hold-out,
English), độ trễ p50/p95 ấm và nạp nguội, dung lượng model, và dòng kết luận ĐẠT/KHÔNG ĐẠT.

**Acceptance Scenarios**:

1. **Given** bộ đánh giá đã mở rộng và được duyệt, **When** chạy công cụ đo cho hướng (a), **Then** báo cáo có số liệu cho ≥ 2 model
   và các ngưỡng đã quét, cùng kết luận theo tiêu chí.
2. **Given** không cấu hình nào đạt sàn Recall@6 75% với từ chối đúng ≥ 90%, **When** đo xong (a) và (b), **Then** báo cáo nêu rõ
   KHÔNG ĐẠT và đề xuất bước kế tiếp; không tích hợp gì vào ứng dụng.

---

### User Story 4 - Lần đầu dùng và khi bước mới chưa sẵn sàng, hỏi đáp vẫn chạy (Priority: P2)

Người dùng mới cài, hoặc máy đang offline lần đầu, hoặc model của bước mới chưa tải xong / bị lỗi. Hỏi đáp vẫn hoạt động như hôm nay
(tầng trả lời 108 vẫn chặn bịa). Model của bước mới tự tải nền một lần (chỉ báo riêng tư hiện "đang tải model" trong lúc tải), sau đó
chạy offline. Ở Cài đặt có một dòng ngắn cho biết trạng thái của bước mới.

**Why this priority**: Không được làm hỏng trải nghiệm lõi (offline-first) vì một cải tiến tuỳ chọn.

**Independent Test**: Chạy ứng dụng khi model bước mới chưa có và không có mạng: hỏi đáp trả lời như trước; Cài đặt hiện trạng thái
"chưa sẵn sàng"; khi có mạng, model tải nền, chỉ báo riêng tư chuyển "đang tải model" rồi về "cục bộ", trạng thái chuyển "sẵn sàng".

**Acceptance Scenarios**:

1. **Given** model bước mới chưa tải và máy offline, **When** hỏi câu có đáp án, **Then** câu trả lời như hành vi hiện tại, không lỗi.
2. **Given** model đang tải nền, **When** nhìn chỉ báo riêng tư, **Then** nó hiện trạng thái tải model; xong thì trở về "chạy cục bộ".
3. **Given** bước chấm quá thời gian chờ hoặc lỗi, **When** hỏi, **Then** hỏi đáp vẫn tiếp tục (không lọc thêm) và nhật ký ghi mã sự kiện
   không chứa nội dung câu hỏi/đoạn nguồn.

---

### User Story 5 - Câu hỏi English không tệ đi (Priority: P3)

Người dùng hỏi bằng English trên tài liệu tiếng Việt (hoặc English). Tỉ lệ từ chối đúng và Recall@6 cho nhóm English không thấp hơn mốc
đo cùng lượt trước khi thêm bước mới.

**Why this priority**: Từ 123 ứng dụng có giao diện English; một bước chấm chỉ mạnh tiếng Việt có thể làm câu English bị từ chối nhầm.

**Independent Test**: Công cụ đo báo nhóm English trước/sau; số sau ≥ số trước (hoặc được ghi là giới hạn đã biết trong ADR).

**Acceptance Scenarios**:

1. **Given** câu "Where did pho originate?" trên nguồn tiếng Việt, **When** bước mới sẵn sàng, **Then** vẫn có trả lời kèm `[n]`.

---

### Edge Cases

- Notebook chỉ có một nguồn ngắn: số ứng viên ít hơn ngưỡng tương đối giả định ⇒ quyết định vẫn hợp lệ (không lỗi chia/rỗng sai).
- Câu hỏi rất ngắn / chỉ là tên riêng / mã số: bước mới không được từ chối tràn lan; đo trong bộ đánh giá nếu có mẫu tương ứng.
- Hội thoại có lịch sử (câu hỏi được viết lại): bước chấm dùng câu hỏi đã viết lại như truy xuất hiện nay.
- Đang tái lập chỉ mục (reindex) nguồn: hành vi "đang tái lập chỉ mục" hiện có giữ nguyên, bước mới không chạy.
- Người dùng chỉ dùng AI online, không có Ollama: hướng (a) vẫn chạy (không cần Ollama); hướng (b) bỏ qua (fail-open).
- Đổi model embedding hoặc model của bước mới mà không đo lại: test canh giữ báo lỗi.
- Ổ đĩa đầy / tải model hỏng giữa chừng: không để lại model hỏng được dùng; lần sau tải lại; hỏi đáp fail-open.
- Bộ đánh giá đổi phiên bản mà bản ghi hiệu chuẩn chưa cập nhật: test canh giữ báo lỗi.

## Requirements _(mandatory)_

### Functional Requirements

**Đo và chọn hướng**

- **FR-001**: Bộ đánh giá MUST được mở rộng: ≥ 30 câu không có đáp án tiếng Việt (chia dev/hold-out ~70/30, ≥ 9 câu hold-out) và ≥ 10
  câu English không có đáp án; chủ dự án duyệt trước khi dùng để chọn; phiên bản bộ đo tăng và bản ghi hiệu chuẩn ghi đúng phiên bản.
- **FR-002**: Công cụ đo MUST đo được từng hướng ứng viên trên cùng bộ đánh giá, theo thứ tự (a) → (b) → (c), với (a) gồm ≥ 2 model đa
  ngôn ngữ cỡ nhỏ; mỗi hướng quét ngưỡng tuyệt đối + tương đối, chọn trên dev, xác nhận trên hold-out.
- **FR-003**: Báo cáo đo MUST gồm cho mỗi cấu hình: tỉ lệ từ chối đúng, Recall@6, (dev / hold-out tiếng Việt / English), khoảng tin
  cậy 95%, độ trễ thêm mỗi câu p50/p95 ở lần chạy ấm, thời gian nạp nguội, dung lượng model, và kết luận ĐẠT/KHÔNG ĐẠT theo SC.
- **FR-004**: Khi nhiều hướng cùng đạt, việc chọn MUST theo quy tắc: tất định và không cần Ollama > độ trễ ấm thấp nhất > dung lượng tải
  nhỏ nhất > đơn giản nhất. Hướng (c) chỉ được đo khi (a), (b) không đạt sàn.
- **FR-005**: Nếu không hướng nào đạt đồng thời từ chối đúng ≥ 90% và Recall@6 ≥ 75% trên hold-out tiếng Việt, feature MUST dừng ở bước
  báo cáo (không tích hợp vào ứng dụng, không tự hạ mục tiêu) và ghi kết quả vào ADR.
- **FR-006**: Model ứng viên MUST cho phép dùng thương mại và chạy được cục bộ bằng thư viện suy luận đang dùng; model không thoả bị
  loại khỏi so sánh. Giấy phép, dung lượng, RAM đo được ghi vào ADR.

**Hành vi trong ứng dụng (sau khi chọn được hướng đạt)**

- **FR-007**: Bước mới MUST chạy trên tập đoạn ứng viên của hỏi đáp sau bước trộn hai nhánh tìm kiếm (≤ ~20 đoạn), sau tiền lọc khoảng
  cách hiện có, và trả về các đoạn đạt ngưỡng; nếu không đoạn nào đạt ⇒ tập rỗng.
- **FR-008**: Chế độ Theo nguồn với tập rỗng MUST trả "Không tìm thấy trong nguồn" + gợi ý theo ngôn ngữ giao diện, không gọi model chat
  (giữ hành vi 108). Chế độ Mở rộng với tập rỗng MUST gọi model với ngữ cảnh rỗng và nhãn "ngoài nguồn" như hiện nay.
- **FR-009**: Điểm của bước mới MAY dùng để xếp lại thứ tự đoạn trước bước đa dạng hoá **chỉ khi** số đo cho thấy lợi; điểm này MUST là
  thông tin riêng, không thay đổi ý nghĩa điểm khoảng cách hiện có.
- **FR-010**: Bước mới MUST không đổi nội dung đoạn, vị trí (`locator`) hay ánh xạ chip `[n]` → nguồn; chỉ quyết định đoạn nào được đưa
  vào ngữ cảnh.
- **FR-011**: Ngưỡng MUST là một giá trị chung đã hiệu chuẩn; chỉ tách theo ngôn ngữ câu hỏi (vi/en khi nhận diện chắc chắn) nếu số đo
  cho thấy chênh lệch đáng kể (ghi ADR). Không có tuỳ chọn chỉnh ngưỡng trong Cài đặt.
- **FR-012**: Nếu chọn hướng (b): bước chấm MUST luôn chạy bằng model chat cục bộ; không có model cục bộ ⇒ bỏ qua bước chấm; không gửi
  câu hỏi/đoạn nguồn tới nhà cung cấp online cho mục đích chấm.
- **FR-013**: Khi bước mới không chạy được (model chưa tải, tải lỗi, offline lần đầu, lỗi suy luận, quá thời gian chờ) hỏi đáp MUST tiếp
  tục như hành vi hiện tại (không lọc thêm) và ghi mã sự kiện không chứa nội dung câu hỏi/đoạn nguồn.
- **FR-014**: Câu hỏi đã viết lại (khi có lịch sử hội thoại), hành vi "đang tái lập chỉ mục", các dự phòng hiện có (viết lại lỗi ⇒ câu
  gốc; tìm toàn văn lỗi ⇒ chỉ vector) MUST giữ nguyên. Studio và tìm toàn văn nội dung nguồn MUST không đổi.

**Model, quyền riêng tư, trạng thái**

- **FR-015**: Nếu bước mới cần model mới: model MUST được tải một lần vào thư mục dữ liệu, ở nền (khi notebook đầu tiên có nguồn sẵn sàng
  hoặc ngay khi cần — chốt ở plan theo số đo), không đóng gói trong bộ cài v1; trong lúc tải chỉ báo riêng tư MUST hiện trạng thái "đang
  gửi — tải model"; sau đó chạy offline hoàn toàn. Tải lỗi/không đầy đủ MUST không để lại model hỏng được dùng.
- **FR-016**: Cài đặt MUST hiện một dòng trạng thái ngắn của bước mới (chưa tải / đang tải / sẵn sàng / lỗi) bằng tiếng Việt và English.
- **FR-017**: Mọi xử lý của bước mới MUST chạy ở tiến trình chính; không thêm đường truy cập tệp/mạng cho giao diện; nhật ký chỉ chứa mã
  sự kiện và tên model.
- **FR-018**: Bản ghi hiệu chuẩn MUST lưu cấu hình và số liệu của bước mới cùng phiên bản model của bước mới; đổi model (embedding hoặc
  bước mới) hay phiên bản bộ đo mà không đo lại MUST làm test canh giữ thất bại.
- **FR-019**: Một ADR mới MUST ghi số liệu mọi hướng đã đo, quy tắc chọn, hướng được chọn, giới hạn đã biết (English, độ trễ), giấy phép
  model, và nêu rõ thay thế một phần quyết định 055; append một dòng vào mục lục quyết định.
- **FR-020**: Kiểm tra đánh giá trên CI MUST chỉ báo cáo, không chặn PR.

### Key Entities

- **Câu hỏi đánh giá (EvalQuestion)**: câu hỏi trong bộ đánh giá, có ngôn ngữ (vi/en), nhóm (dev/hold-out), loại (có đáp án / không có
  đáp án) và trích đoạn đáp án; bộ đánh giá có số phiên bản.
- **Hướng ứng viên (candidate approach)**: (a) bộ chấm độ liên quan cục bộ, (b) model chat cục bộ chấm, (c) model embedding khác; mỗi hướng có
  cấu hình (model, ngưỡng tuyệt đối/tương đối, có xếp lại hay không).
- **Kết quả đo (evaluation report)**: theo từng cấu hình — từ chối đúng, Recall@6, khoảng tin cậy, độ trễ p50/p95, nạp nguội, dung lượng,
  kết luận.
- **Bản ghi hiệu chuẩn (relevance calibration record)**: cấu hình đã chọn + số liệu + phiên bản model embedding + phiên bản model bước mới
  - phiên bản bộ đo; được test canh giữ đối chiếu.
- **Điểm rerank (`rerankScore`)**: điểm do bước mới gán cho từng đoạn ứng viên, tách biệt với điểm khoảng cách.
- **Trạng thái bước mới (readiness)**: chưa tải / đang tải / sẵn sàng / lỗi — hiển thị ở Cài đặt.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Trên nhóm hold-out tiếng Việt, ≥ 90% câu không có đáp án bị chặn ở tầng truy xuất (người dùng nhận "Không tìm thấy trong
  nguồn" mà không qua model chat), và cận dưới khoảng tin cậy 95% trên dev + hold-out gộp không thấp hơn mốc chốt ở plan.
- **SC-002**: Trên nhóm hold-out tiếng Việt, Recall@6 của câu có đáp án ≥ 85%; tuyệt đối không dưới 75% (dưới sàn ⇒ không tích hợp).
- **SC-003**: Thời gian chờ thêm mỗi câu hỏi ở lần chạy ấm ≤ 300 ms ở p50 (mốc khởi đầu; giá trị chốt và p95 ghi trong ADR sau khi đo);
  nạp nguội chỉ một lần mỗi phiên và ≤ vài giây.
- **SC-004**: Nhóm câu hỏi English (kể cả hỏi nguồn tiếng Việt) có tỉ lệ từ chối đúng và Recall@6 không thấp hơn mốc đo cùng lượt trước khi
  thêm bước mới (hoặc được ghi là giới hạn đã biết trong ADR).
- **SC-005**: Cùng một câu hỏi không có đáp án hỏi lặp 5 lần cho cùng kết quả ở tầng truy xuất (tất định) khi bước mới sẵn sàng.
- **SC-006**: Khi bước mới không sẵn sàng (chưa tải, offline, lỗi, quá giờ), 100% câu hỏi vẫn được xử lý như hành vi trước feature —
  không lỗi hiển thị cho người dùng.
- **SC-007**: Không có yêu cầu mạng mới trong luồng hỏi đáp; yêu cầu mạng duy nhất phát sinh là tải model một lần, luôn đi kèm chỉ báo
  riêng tư đúng trạng thái.
- **SC-008**: Bộ test hiện có và tiêu chí hồi quy truy xuất của 108 (chế độ đo hiện hành) vẫn đạt; logic mới có coverage ≥ 80%.

## Assumptions

- Bộ đánh giá 108 (sau khi mở rộng) là thước đo đại diện; tiêu chí ĐẠT cứng chỉ tính trên tiếng Việt (108 clarify #9).
- Máy tham chiếu đo độ trễ là máy phát triển macOS hiện dùng cho các số đo 108/123; plan ghi rõ cấu hình máy.
- Model chat tham chiếu cho hướng (b) và phép đo end-to-end là qwen2.5:7b (như 123), chạy cục bộ; không dùng model online/`:cloud`.
- Hạ tầng suy luận cục bộ hiện có (đang chạy model embedding và bóc băng) đủ để chạy một model chấm độ liên quan cỡ nhỏ; xác minh ở plan.
- Tải model một lần theo khuôn embedding/bóc băng được coi là phù hợp Constitution I vì lõi hỏi đáp vẫn chạy offline khi bước mới chưa
  sẵn sàng (fail-open).
- Chủ dự án duyệt các câu hỏi mới của bộ đánh giá trước khi chúng được dùng để chọn cấu hình.
- Giao diện không đổi ngoài dòng trạng thái ở Cài đặt; câu "Không tìm thấy" và gợi ý giữ nguyên (khoá i18n hiện có).
