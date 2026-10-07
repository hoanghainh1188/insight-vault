# Feature Specification: Bảo trì kho vector (gộp phân mảnh + dọn phiên bản cũ), hoãn ANN

**Feature Branch**: `116-vector-maintenance`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Thêm cơ chế bảo trì tự động kho vector (bảng `chunks` ở `<userData>/vectors/`) để dung
lượng và độ trễ truy vấn không xuống cấp theo thời gian, đồng thời hoãn (không làm) index ANN (issue #116; nguồn:
`docs/intake/116-vector-maintenance.md`). Bảo trì ngầm ở nền khi kho 'yên', giữ biên an toàn phiên bản cũ, không đổi
kết quả truy vấn, lỗi được nuốt có kiểm soát và ghi nhật ký; phần lên lịch là hàm thuần; mặc định không UI, không IPC
mới; ADR mới hoãn ANN kèm số liệu."

## Bối cảnh & số liệu đo (issue #116)

- Mỗi lần nạp nguồn, xoá nguồn/notebook, "Xử lý lại" PDF (112) hay tái lập chỉ mục khi đổi model nhúng (059) đều tạo
  thêm **phiên bản** và **phân mảnh (fragment)** mới của bảng vector; vector bị xoá chỉ được đánh dấu, chưa giải phóng.
  App hiện **không bao giờ** gộp hay dọn ⇒ thư mục `vectors/` phình dần, truy vấn chậm dần.
- Đo trên bảng 200k vector bị phân mảnh 360 fragment: tìm kiếm 12,8 ms → **2,5 ms** sau khi gộp (gộp mất ~0,2 s);
  dung lượng đĩa 131 MB → **14,8 MB** sau khi gộp + dọn phiên bản cũ.
- Tìm kiếm chính xác (quét toàn bộ, không index): 2,1 ms @10k, 5,5 ms @50k, 12,8 ms @200k vector (384 chiều, lọc theo
  notebook, top-6). Index xấp xỉ (ANN) chỉ nhanh hơn vài ms nhưng mất độ phủ (Recall 0,34 với IVF_PQ @200k; 0,98 với
  HNSW_SQ); index vô hướng trên `notebook_id` làm **chậm hơn** ⇒ người dùng đã chốt: **giữ tìm kiếm chính xác, hoãn ANN**.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Dung lượng vault không phình mãi sau nhiều lần xoá/xử lý lại (Priority: P1)

Một luật sư dùng InsightVault hằng ngày: nạp hồ sơ, xoá bản cũ, "Xử lý lại" PDF. Sau vài tháng, thư mục dữ liệu của app
không được chiếm dung lượng gấp nhiều lần lượng tài liệu thật đang có; phần vector đã xoá phải được giải phóng tự động mà
người dùng không phải làm gì.

**Why this priority**: Dung lượng phình vô hạn là lỗi tích luỹ âm thầm, ảnh hưởng mọi người dùng lâu năm và làm bản sao
lưu (085) to vô ích; đây là giá trị cốt lõi của feature.

**Independent Test**: Trên một kho tạm, nạp nhiều lô vector rồi xoá phần lớn; đo dung lượng thư mục kho; để app tự bảo
trì (hoặc kích hoạt bộ lên lịch với đồng hồ giả); đo lại ⇒ dung lượng giảm rõ rệt, dữ liệu còn lại nguyên vẹn.

**Acceptance Scenarios**:

1. **Given** kho vector đã có nhiều vector bị xoá và nhiều phiên bản cũ quá biên an toàn, **When** bảo trì chạy xong,
   **Then** dung lượng thư mục kho giảm và các vector đã xoá không còn chiếm chỗ.
2. **Given** bảo trì vừa chạy, **When** tra cứu số vector theo nguồn/notebook và lấy vector theo `id`, **Then** kết
   quả giống hệt trước khi bảo trì (không mất, không đổi, không nhân đôi).
3. **Given** người dùng không thao tác gì liên quan, **When** bảo trì chạy, **Then** không có hộp thoại, thông báo hay
   thay đổi giao diện nào; chỉ có dòng nhật ký.

---

### User Story 2 - Truy vấn không chậm dần theo thời gian (Priority: P1)

Một nhà nghiên cứu nạp liên tục từng tài liệu nhỏ trong nhiều tuần. Thời gian hỏi đáp (phần tìm đoạn liên quan) không
được tăng dần do bảng bị chia vụn; sau mỗi đợt nạp/xoá, kho tự gộp lại khi rảnh.

**Why this priority**: Độ trễ tìm kiếm tăng ~5 lần khi phân mảnh nặng (2,5 → 12,8 ms); không xử lý thì càng dùng càng
chậm — đi ngược "offline & tự chủ" dài hạn.

**Independent Test**: Tạo bảng có nhiều phân mảnh nhỏ (nhiều lần ghi nhỏ), đo số phân mảnh; chạy bảo trì; số phân mảnh
giảm và kết quả tìm kiếm (top-k cùng điểm) giống hệt trước.

**Acceptance Scenarios**:

1. **Given** bảng có số phân mảnh vượt ngưỡng kích hoạt, **When** kho đã yên đủ lâu, **Then** bảo trì tự chạy và số
   phân mảnh sau bảo trì nhỏ hơn trước.
2. **Given** một câu truy vấn cố định trên một notebook, **When** so kết quả trước và sau bảo trì, **Then** danh sách
   đoạn trả về, thứ tự và điểm tương đồng giống hệt; chip `[n]` vẫn mở đúng nguồn/đoạn.
3. **Given** bộ đo truy xuất của 108, **When** chạy hồi quy ở chế độ hiện hành sau khi có bảo trì, **Then** số liệu
   không đổi so với mốc đã hiệu chuẩn.

---

### User Story 3 - Bảo trì không bao giờ cản trở công việc của người dùng (Priority: P1)

Trong lúc người dùng đang nạp tài liệu, xử lý lại, tái lập chỉ mục, sao lưu hay khôi phục, bảo trì không được chen vào,
không làm treo, không làm hỏng dữ liệu; nếu kho bận thì bảo trì tự hoãn sang lần sau. Ngược lại, sao lưu/khôi phục không
được chụp thư mục kho giữa lúc bảo trì đang ghi.

**Why this priority**: An toàn dữ liệu và không chặn người dùng là điều kiện bắt buộc để chạy ngầm; một bản sao lưu chụp
dở dang có thể không khôi phục được.

**Independent Test**: Với bộ lên lịch dùng đồng hồ giả và trạng thái "bận" giả lập, kiểm mọi tổ hợp bận/yên ⇒ chỉ chạy
khi yên; giả lập sao lưu bắt đầu khi bảo trì đang chạy ⇒ sao lưu chờ bảo trì xong (có trần thời gian) mới chụp.

**Acceptance Scenarios**:

1. **Given** có nguồn đang chờ/đang xử lý/đang xử lý lại, hoặc đang tái lập chỉ mục, hoặc vault đang bị khoá (sao lưu/
   khôi phục), **When** tới thời điểm bảo trì, **Then** bảo trì hoãn (không xếp hàng chặn), ghi lý do hoãn vào nhật ký
   và thử lại ở lần kích hoạt sau.
2. **Given** bảo trì đang chạy, **When** người dùng bắt đầu sao lưu hoặc khôi phục, **Then** thao tác đó chỉ bắt đầu
   chụp/ghi thư mục kho sau khi bảo trì kết thúc (hoặc hết trần thời gian chờ thì báo bận như hiện có), không bao giờ chụp
   giữa chừng.
3. **Given** bảo trì đang chạy, **When** người dùng nạp/xoá nguồn, **Then** thao tác của người dùng vẫn được thực hiện
   đúng; nếu bảo trì xung đột thì bảo trì bị coi là "hoãn", không phải thao tác người dùng thất bại.
4. **Given** bảo trì gặp lỗi bất kỳ, **When** lỗi xảy ra, **Then** nạp, hỏi đáp, sao lưu vẫn hoạt động bình thường;
   lỗi chỉ được ghi nhật ký (không đường dẫn, không nội dung) và lần sau thử lại theo cơ chế chặn lặp lỗi.

---

### User Story 4 - Quyết định hoãn ANN được ghi lại kèm số liệu và điều kiện xem lại (Priority: P2)

Người bảo trì dự án (và agent sau này) đọc thư mục quyết định và hiểu vì sao app vẫn tìm kiếm chính xác không index, số
liệu nào chứng minh, khi nào cần xem lại — thay cho ghi chú cũ "tạo index IVF_PQ khi vượt 50k vector" chưa có số đo.

**Why this priority**: Không đổi hành vi app nhưng chặn việc ai đó "tối ưu" sai hướng (thêm index làm mất Recall hoặc
làm chậm), giữ nguyên ngưỡng 108 đã hiệu chuẩn trên tìm kiếm chính xác.

**Independent Test**: Đọc ADR mới; kiểm hai tài liệu quyết định cũ đã có ghi chú "đã được thay thế bởi" trỏ tới ADR mới;
INDEX có dòng mới.

**Acceptance Scenarios**:

1. **Given** ADR mới, **When** đọc, **Then** thấy bảng số liệu (quy mô, độ trễ tìm kiếm chính xác, so sánh ANN về độ
   trễ và Recall, kết quả index vô hướng làm chậm, tác động của gộp/dọn) và điều kiện xem lại ANN cụ thể.
2. **Given** `2026-07-11-lancedb-integration.md` và dòng tương ứng ở `2026-07-11-ingestion-clarify.md`, **When** đọc,
   **Then** có ghi chú rõ đoạn "index ANN khi đủ lớn / > 50k" đã được thay bởi ADR mới.

---

### Edge Cases

- Bảng vector **chưa tồn tại** (vault mới, vừa đổi model và bảng bị xoá trước khi tái lập) ⇒ bảo trì là no-op, ghi
  "hoãn" (không tính là lỗi).
- Kho **đã gọn** (ít phân mảnh, không có phiên bản cũ quá biên) ⇒ không chạy (cổng ngưỡng), tránh ghi đĩa vô ích.
- **Ổ đĩa gần đầy**: gộp cần tạm thêm dung lượng cỡ kích thước bảng ⇒ kiểm dung lượng trống trước; thiếu ⇒ hoãn với lý
  do "thiếu dung lượng".
- **Vault cũ đã phình sẵn** (nâng cấp từ bản trước): lần bảo trì đầu có thể lâu ⇒ chạy nền, không chặn cửa sổ, chỉ bắt
  đầu khi kho yên; một lần "bắt kịp" sau khởi động.
- **Tắt app giữa lúc bảo trì**: dữ liệu phải còn nguyên (bảo trì chỉ thay phiên bản khi đã ghi xong); nếu không đủ chắc
  chắn về tính nguyên tử thì khi thoát chờ bảo trì xong với trần thời gian.
- **Truy vấn đang đọc đồng thời**: biên an toàn phiên bản cũ (> 0) bảo đảm truy vấn đang chạy không mất tệp.
- **Lỗi lặp liên tục** (vd đĩa hỏng/quyền ghi): sau K lần lỗi liên tiếp, ngưng thử cho tới lần khởi động sau; không spam
  nhật ký.
- **Tái lập chỉ mục (059) vừa xong** tạo rất nhiều phân mảnh nhỏ ⇒ kích hoạt một lần bảo trì sau khi kết thúc.
- **Xoá notebook lớn** ngay trước khi thoát app ⇒ phần chưa dọn sẽ được thu hồi ở lần bắt kịp sau khởi động.
- **Khôi phục (085) đã xác nhận** (vault khoá vĩnh viễn tới khi khởi động lại) ⇒ không bao giờ chạy bảo trì.

## Requirements _(mandatory)_

### Functional Requirements

**Kích hoạt & lên lịch**

- **FR-001**: Hệ thống MUST tự động bảo trì kho vector ở nền — gộp phân mảnh và dọn phiên bản cũ quá biên an toàn,
  giải phóng dung lượng của vector đã xoá — mà không cần người dùng thao tác.
- **FR-002**: Bảo trì MUST được kích hoạt theo tổ hợp: (a) sau thao tác ghi (nạp/xoá/xử lý lại) khi kho đã **yên** một
  khoảng debounce kể từ lần ghi cuối; (b) một lần **bắt kịp** sau khi app khởi động (trễ, không chặn cửa sổ); (c) một lần
  sau khi **tái lập chỉ mục** kết thúc. Không chạy theo từng thao tác ghi.
- **FR-003**: Bảo trì MUST chỉ thực sự chạy khi vượt **ngưỡng kích hoạt** đo được (số phân mảnh và/hoặc lượng thay đổi
  tích luỹ từ lần bảo trì trước); dưới ngưỡng ⇒ bỏ qua, ghi lý do.
- **FR-004**: Hệ thống MUST áp **trần tần suất**: không chạy quá một lần trong một khoảng tối thiểu.
- **FR-005**: Quyết định "có chạy bây giờ không" MUST là một hàm thuần nhận vào: thời điểm ghi cuối, số thao tác ghi
  tích luỹ, số liệu đo của kho, trạng thái bận, kết quả/lần chạy trước, số lần lỗi liên tiếp và thời điểm hiện tại (đồng
  hồ tiêm vào) — kiểm thử được không cần kho thật.

**Phối hợp với thao tác khác**

- **FR-006**: Bảo trì MUST chỉ bắt đầu khi kho yên: không có nguồn đang chờ/đang xử lý/đang xử lý lại, không tái lập
  chỉ mục nền, vault không bị khoá (sao lưu/khôi phục). Điều kiện "bận" MUST dùng chung một định nghĩa với cơ chế khoá
  vault hiện có (không định nghĩa song song dễ lệch).
- **FR-007**: Khi bận, bảo trì MUST hoãn (không xếp hàng, không chặn người dùng) và được thử lại ở lần kích hoạt sau.
- **FR-008**: Tại mọi thời điểm MUST có tối đa **một** lần bảo trì đang chạy (single-flight).
- **FR-009**: Sao lưu và khôi phục MUST NOT chụp/ghi thư mục kho vector khi bảo trì đang chạy; chúng chờ bảo trì kết
  thúc trong một trần thời gian, quá trần thì từ chối như trường hợp "bận" hiện có — không thêm trạng thái chặn mới hiển
  thị cho người dùng.
- **FR-010**: Thao tác ghi của người dùng (nạp/xoá/xử lý lại) bắt đầu trong lúc bảo trì MUST vẫn thành công đúng như
  không có bảo trì; xung đột ghi đồng thời làm bảo trì thất bại MUST được coi là "hoãn", không phải lỗi.

**An toàn dữ liệu**

- **FR-011**: Bảo trì MUST NOT làm mất, thay đổi hay nhân đôi bất kỳ vector hay `id` đoạn nào; kết quả tìm kiếm, đếm
  theo nguồn/notebook và lấy vector theo `id` trước và sau bảo trì MUST giống hệt.
- **FR-012**: Bảo trì MUST giữ các phiên bản cũ trong một **biên an toàn thời gian > 0** (hằng số có tên, truyền tường
  minh, không dựa mặc định thư viện) để truy vấn đang đọc đồng thời không mất tệp; MUST NOT dọn các tệp chưa được xác
  minh là thuộc phiên bản đã commit.
- **FR-013**: Trước khi gộp, hệ thống MUST kiểm dung lượng trống của ổ chứa kho ≥ một hệ số × kích thước kho hiện tại;
  thiếu ⇒ hoãn với lý do "thiếu dung lượng".
- **FR-014**: Tắt app giữa lúc bảo trì MUST NOT làm hỏng kho (lần mở sau đọc được đầy đủ dữ liệu đã commit).
- **FR-015**: Bảo trì MUST NOT tạo bất kỳ index nào (vector hay vô hướng) và MUST NOT đổi schema bảng, model nhúng,
  thuật toán tìm kiếm hay ngưỡng độ liên quan đã hiệu chuẩn (108).

**Lỗi & nhật ký**

- **FR-016**: Mọi lỗi bảo trì MUST bị nuốt ở tầng bảo trì (không ném ra ngoài, không ảnh hưởng nạp/hỏi đáp/sao lưu),
  phân biệt "hoãn" (bận, xung đột, bảng chưa có, dưới ngưỡng, thiếu dung lượng — không tính lỗi) với "lỗi" (tính vào bộ
  đếm lỗi liên tiếp).
- **FR-017**: Sau lỗi, lần thử lại MUST giãn dần (backoff); sau K lần lỗi liên tiếp MUST ngưng bảo trì cho tới lần khởi
  động sau; một lần thành công đặt lại bộ đếm.
- **FR-018**: Hệ thống MUST ghi nhật ký (theo quy ước nhật ký ứng dụng 088) các sự kiện bắt đầu/xong/bỏ qua-hoãn/lỗi của
  bảo trì với meta CHỈ gồm: nguyên nhân kích hoạt, lý do hoãn, số phân mảnh trước/sau, số phiên bản đã dọn, số byte giải
  phóng, thời lượng, loại lỗi — KHÔNG đường dẫn, KHÔNG nội dung tài liệu, KHÔNG thông điệp lỗi thô.

**Hiển thị & biên bảo mật**

- **FR-019**: Feature MUST NOT thêm giao diện mới hay kênh giao tiếp renderer↔main mới (bảo trì hoàn toàn ngầm, quan sát
  qua nhật ký). Mọi truy cập kho vector vẫn nằm ở main process.
- **FR-020**: Bảo trì MUST chạy hoàn toàn cục bộ: không gọi mạng, không telemetry, không đổi chỉ báo riêng tư.

**Kế thừa, không phá vỡ**

- **FR-021**: Các thao tác kho vector hiện có và hợp đồng của chúng MUST giữ nguyên (chỉ THÊM khả năng bảo trì và đo số
  liệu kho); giao diện hẹp dùng cho tái lập chỉ mục (059) không đổi; hàng đợi nạp tuần tự, khoá vault và trạng thái sao
  lưu giữ ngữ nghĩa hiện có (nếu cần phối hợp thì mở rộng tối thiểu); luồng "Xử lý lại" (112: thêm mới → hoán đổi → xoá
  cũ) và dọn vector mồ côi giữ nguyên.

**Tài liệu quyết định**

- **FR-022**: Feature MUST thêm một ADR mới ghi quyết định giữ tìm kiếm chính xác / hoãn ANN kèm bảng số liệu đo và
  **điều kiện xem lại** dựa trên độ trễ đo được (không theo số vector tuyệt đối), nhắc rằng index vô hướng trên
  notebook đã đo là làm chậm, và mọi phương án ANN tương lai phải đo lại Recall bằng bộ đo 108.
- **FR-023**: ADR mới MUST được đánh dấu là thay thế đoạn "tạo index ANN (IVF_PQ) lazily khi > 50k" của
  `2026-07-11-lancedb-integration.md` và mục tương ứng ở `2026-07-11-ingestion-clarify.md` (thêm ghi chú trỏ tới, không
  xoá lịch sử); thêm dòng vào `docs/04-decisions/INDEX.md`.

### Key Entities

- **Kho vector (vector store)**: bảng duy nhất chứa vector các đoạn của mọi notebook; có nhiều phiên bản và phân mảnh
  tích luỹ theo thao tác ghi.
- **Số liệu kho (store stats)**: số phân mảnh, số phiên bản (nếu đo được), dung lượng thư mục kho, số hàng — dùng cho
  cổng ngưỡng và nhật ký.
- **Trạng thái lên lịch bảo trì (maintenance schedule state)**: thời điểm ghi cuối, số thao tác ghi từ lần bảo trì cuối,
  thời điểm và kết quả lần chạy trước, số lỗi liên tiếp, cờ đang chạy, cờ ngưng tới lần khởi động sau. Chỉ trong bộ nhớ.
- **Quyết định bảo trì (maintenance decision)**: kết quả của hàm lên lịch — chạy ngay / hẹn lại sau X / bỏ qua kèm lý do.
- **Kết quả bảo trì (maintenance outcome)**: xong (kèm số liệu trước/sau) / hoãn (kèm lý do) / lỗi (kèm loại lỗi).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Trên kho thử có nhiều vector đã xoá và nhiều phiên bản cũ, sau một lần bảo trì dung lượng thư mục kho giảm
  ít nhất 50% (mốc đo tham chiếu: 131 MB → 14,8 MB).
- **SC-002**: Trên kho thử có nhiều phân mảnh nhỏ, sau một lần bảo trì số phân mảnh giảm và độ trễ tìm kiếm trở về mức
  của bảng gọn (mốc tham chiếu: 12,8 ms → 2,5 ms @200k).
- **SC-003**: 100% truy vấn kiểm thử cho cùng kết quả (đoạn, thứ tự, điểm) và cùng số đếm trước/sau bảo trì; hồi quy bộ
  đo truy xuất 108 ở chế độ hiện hành báo "hồi quy OK".
- **SC-004**: 0 lần bảo trì bắt đầu trong khi kho bận (kiểm bằng test của hàm lên lịch trên mọi tổ hợp trạng thái bận);
  0 lần sao lưu chụp kho giữa lúc bảo trì.
- **SC-005**: 0 lỗi bảo trì lan ra ngoài làm hỏng nạp/hỏi đáp/sao lưu; sau K lần lỗi liên tiếp không còn lần thử nào cho
  tới khi khởi động lại.
- **SC-006**: Người dùng không thấy bất kỳ thay đổi giao diện nào; mọi dòng nhật ký bảo trì không chứa đường dẫn hay nội
  dung tài liệu.
- **SC-007**: Logic lên lịch/ngưỡng/backoff đạt độ phủ kiểm thử ≥ 80% và được viết test trước.

## Assumptions

Các giá trị dưới đây là **đề xuất khuyên dùng từ intake**, sẽ được xác nhận hoặc thay ở `/speckit-clarify` và ghi vào
`docs/04-decisions/2026-10-07-vector-maintenance-clarify.md`:

- Debounce yên lặng ~60 s sau thao tác ghi cuối; bắt kịp sau khởi động trễ ~30–60 s; trần tần suất ~1 lần/10 phút.
- Biên an toàn phiên bản cũ ~10 phút; không bật dọn tệp chưa xác minh.
- K = 3 lần lỗi liên tiếp thì ngưng tới lần khởi động sau.
- Ngưỡng kích hoạt (số phân mảnh / lượng thay đổi) và hệ số dung lượng trống chốt theo số đo ở bước plan (research).
- Không hiển thị gì cho người dùng ở v1 (không dòng dung lượng vector, không nút "Dọn dẹp ngay").
- Kiểm thử gồm: unit cho hàm lên lịch (đồng hồ tiêm vào), integration với kho thật trên thư mục tạm, và hồi quy bộ đo 108.
- Chữ ký/giá trị mặc định của thao tác gộp-dọn và cách đo số phân mảnh ở thư viện kho vector hiện dùng sẽ được xác minh ở
  bước plan; adapter kho vector vẫn loại khỏi coverage như hiện có.
- Một bảng chung cho toàn app, xoá đồng bộ metadata↔vector, xoá bảng khi đổi model (ADR 011/059) giữ nguyên.

## Out of Scope

- Index ANN (IVF_PQ/HNSW) hay bất kỳ index vector nào; index vô hướng (bitmap/btree) trên `notebook_id`.
- Đổi schema/tách bảng theo notebook; đổi model nhúng hay thuật toán truy xuất.
- Sao lưu tự động (085 pha sau); UI quản lý kho vector ngoài mức tối thiểu clarify chấp nhận.
- Điều tra nguyên nhân index bitmap chậm.

## Constitution Alignment

- **I — Local-first**: bảo trì cục bộ, không egress, không telemetry, không đổi privacy badge (FR-020).
- **II — Kiểm chứng được**: không đổi/mất `chunk.id`, vector, locator; truy vấn và ngưỡng 108 tương đương (FR-011, FR-015).
- **III — Biên bảo mật**: truy cập kho ở main; không kênh IPC mới; nhật ký không nội dung/đường dẫn (FR-018, FR-019).
- **IV — Test-first**: hàm lên lịch thuần có test trước ≥ 80%; integration kho thật; hồi quy eval 108 (FR-005, SC-007).
