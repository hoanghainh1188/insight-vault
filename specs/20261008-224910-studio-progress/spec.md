# Feature Specification: Hiển thị tiến độ khi tạo kết quả Studio

**Feature Branch**: `146-studio-progress`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Hiển thị tiến độ khi tạo kết quả Studio (issue #146; nguồn: docs/intake/146-studio-progress.md; 11 quyết định clarify ở
docs/04-decisions/2026-10-08-studio-progress-clarify.md)."

## Bối cảnh

Studio tạo tóm tắt tài liệu, ý chính, FAQ và dàn ý cho cả notebook. Với notebook lớn, việc này chạy theo nhiều phần (đọc từng phần để
ghi chú → rút gọn ghi chú nếu còn dài → viết bản cuối) và trên model chạy trên máy có thể mất **nhiều phút**. Trong thời gian đó người dùng
chỉ thấy khung chờ và nhãn "Đang tạo…", không biết đang ở bước nào hay còn chạy không. Việc hiển thị tiến độ đã được chủ động hoãn ở feature 105
(xử lý notebook lớn) và nay được làm. Feature **chỉ quan sát** tiến trình: không đổi cách tổng hợp, trích dẫn `[n]`, ghi chú "đã xử lý theo N phần"
hay dữ liệu đã lưu.

## Clarifications

### Session 2026-10-08

Nguồn: `docs/04-decisions/2026-10-08-studio-progress-clarify.md` (người dùng chọn toàn bộ phương án khuyên dùng).

- Q: Độ mịn tiến độ? → A: Phần i/N + tên pha — pha đọc "Đang đọc phần i/N…" (i = phần đang đọc, báo trước mỗi lượt đọc, N = số phần thực chạy,
  ≤ 12); pha rút gọn chỉ hiện tên pha; pha cuối "Đang viết…"; thử lại trong cùng một phần không báo thêm.
- Q: Thời gian còn lại? → A: Không hiển thị ở v1.
- Q: Nút Huỷ? → A: Tách issue riêng (#149); #146 chỉ làm tiến độ; mỗi lượt tạo có định danh riêng để thêm Huỷ sau.
- Q: Trình bày trên thẻ? → A: Dòng tên pha + thanh tiến độ (xác định ở pha đọc, bất định ở pha khác) trong vùng kết quả của loại đó: thay khung
  chờ khi chưa có kết quả, nằm trên kết quả cũ khi "Tạo lại"; nút giữ nhãn "Đang tạo…"; có tên đọc cho trình đọc màn hình; tôn trọng tuỳ chọn
  giảm chuyển động của hệ điều hành.
- Q: Trình đọc màn hình? → A: Giữ thông báo bắt đầu/xong; thêm khi đổi pha và ở khoảng giữa pha đọc; tối đa ~5–6 câu mỗi lượt; mức lịch sự (không
  ngắt lời); có tên loại (Tóm tắt, FAQ…).
- Q: Tạo một lượt (notebook nhỏ)? → A: Báo pha "viết" không đếm ⇒ "Đang viết…" bất định.
- Q: Nhiều loại chạy cùng lúc? → A: Tiến độ riêng từng loại; ghi giới hạn đã biết (chạy song song có thể chậm hơn).
- Q: Rời notebook rồi quay lại khi đang tạo? → A: Giữ như hiện tại (không phục hồi tiến độ); ghi giới hạn đã biết.
- Q: Cách báo tiến độ từ tiến trình chính? → A: Một kênh thông báo một chiều mới dành riêng cho tiến độ Studio, mỗi sự kiện gồm định danh lượt, notebook,
  loại, pha và (khi có) i, N; định danh lượt do giao diện tạo khi bấm tạo và được tiến trình chính kiểm tra; không có định danh ⇒ không báo; kết quả/lỗi
  vẫn trả về như hiện nay.
- Q: Giới hạn tần suất? → A: Không giới hạn ở tiến trình chính (số sự kiện ít, cách nhau vài giây); giao diện chỉ nhận sự kiện của lượt đang chạy và bỏ sự
  kiện lùi.
- Q: Câu chữ? → A: vi "Đang đọc phần {i}/{n}…", "Đang rút gọn ghi chú…", "Đang viết…"; en "Reading part {i} of {n}…", "Condensing notes…", "Writing…".

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Thấy tiến độ khi tạo Studio cho notebook lớn (Priority: P1)

Người dùng bấm "Tóm tắt tài liệu" trên một notebook lớn. Thay vì khung chờ im lặng nhiều phút, thẻ Studio hiện "Đang đọc phần 1/5…", rồi 2/5… với
thanh tiến độ tăng dần, sau đó "Đang rút gọn ghi chú…" (nếu có) và "Đang viết…", rồi kết quả hiện ra như trước.

**Why this priority**: Đây là lý do của feature — người dùng chờ nhiều phút không biết app còn chạy hay đã treo.

**Independent Test**: Tạo Studio trên notebook lớn (nhiều phần) với model giả có độ trễ: thẻ hiện lần lượt các phần 1..N, pha rút gọn (khi có), pha viết, rồi
kết quả; thanh tiến độ tăng đúng theo i/N.

**Acceptance Scenarios**:

1. **Given** notebook lớn phải chia 5 phần, **When** bấm "Tóm tắt tài liệu", **Then** thẻ hiện "Đang đọc phần 1/5…" … "Đang đọc phần 5/5…", thanh tiến độ
   tăng theo, rồi "Đang viết…", rồi kết quả kèm ghi chú "xử lý theo 5 phần" như hiện nay.
2. **Given** một phần phải thử lại do lỗi tạm, **When** đang đọc phần đó, **Then** số phần không lùi và không nhảy.
3. **Given** ghi chú còn quá dài cần rút gọn, **When** sang pha rút gọn, **Then** thẻ hiện "Đang rút gọn ghi chú…" với thanh bất định.
4. **Given** đã có kết quả cũ, **When** bấm "Tạo lại", **Then** tiến độ hiện phía trên kết quả cũ cho tới khi có kết quả mới.

---

### User Story 2 - Notebook nhỏ chỉ hiện "Đang viết…" (Priority: P1)

Notebook nhỏ được tổng hợp trong một lượt. Thẻ hiện "Đang viết…" với thanh bất định — không hiện "Phần 1/1" giả.

**Why this priority**: Phần lớn notebook nhỏ; trạng thái phải nhất quán và trung thực.

**Independent Test**: Notebook nhỏ ⇒ chỉ thấy "Đang viết…" (không i/N) rồi kết quả.

**Acceptance Scenarios**:

1. **Given** notebook nhỏ, **When** bấm tạo, **Then** thẻ hiện "Đang viết…" bất định, không có số phần.

---

### User Story 3 - Người dùng trình đọc màn hình nghe được mốc tiến độ (Priority: P2)

Người dùng dùng trình đọc màn hình nghe "Tóm tắt tài liệu: đang đọc phần 1/6", "… đang đọc phần 3/6" (khoảng giữa), "… đang viết", và thông báo xong như hiện nay — không
bị đọc dồn từng phần.

**Why this priority**: Khả năng tiếp cận (091) là cam kết hiện có; thanh tiến độ cũng phải đọc được khi người dùng đi tới.

**Independent Test**: Đếm thông báo trong một lượt nhiều phần: ≤ ~6 câu, gồm bắt đầu, đổi pha, mốc giữa, xong; thanh tiến độ có tên và giá trị đọc được.

**Acceptance Scenarios**:

1. **Given** lượt 6 phần, **When** chạy hết, **Then** số thông báo ≤ 6, mỗi câu có tên loại, theo ngôn ngữ giao diện hiện tại.

---

### User Story 4 - Không lẫn tiến độ giữa lượt, loại và notebook (Priority: P2)

Người dùng chạy Tóm tắt và FAQ cùng lúc, đổi notebook giữa chừng, gặp lỗi, hoặc dùng "Tạo bằng AI cục bộ" sau lỗi AI online. Mỗi thẻ chỉ hiện tiến độ của
lượt của chính nó; lượt cũ không làm sai thẻ mới; lỗi ⇒ tiến độ biến mất, hiện lỗi như hiện nay.

**Why this priority**: Sai tiến độ còn tệ hơn không có tiến độ.

**Independent Test**: Hai loại song song ⇒ mỗi thẻ đúng tiến độ của mình; đổi notebook ⇒ thẻ notebook mới không nhận sự kiện lượt cũ; lỗi ⇒ tiến độ mất.

**Acceptance Scenarios**:

1. **Given** Tóm tắt và FAQ chạy song song, **When** cả hai báo tiến độ, **Then** mỗi thẻ hiện đúng của mình.
2. **Given** đang tạo ở notebook A, **When** chuyển sang notebook B, **Then** thẻ ở B không hiện tiến độ của A; quay lại A không phục hồi tiến độ (giới hạn đã biết).
3. **Given** lượt lỗi giữa chừng, **When** lỗi trả về, **Then** tiến độ biến mất, hiện lỗi + nút như hiện nay.

---

### Edge Cases

- Rút gọn 0 vòng (ghi chú đã vừa) ⇒ không hiện pha rút gọn.
- Tối đa 12 phần (phần dư bị bỏ, ghi chú "đã cắt" như hiện nay) ⇒ N = số phần thực chạy, không phải số phần lý thuyết.
- Model nạp lần đầu chậm ⇒ phần 1 có thể kéo dài; thanh không giả vờ chạy.
- Giao diện cũ/không gửi định danh lượt ⇒ không có tiến độ, tạo vẫn chạy như cũ.
- Định danh lượt không hợp lệ (quá dài, sai kiểu) ⇒ bị bỏ qua (không báo tiến độ), tạo vẫn chạy.
- Cột Studio hẹp + câu English dài hơn ⇒ không tràn chữ.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Khi tạo Studio nhiều phần, ứng dụng MUST báo pha "đọc" kèm số phần i (phần đang đọc, báo trước khi đọc phần đó) và tổng N (số phần thực chạy).
- **FR-002**: Ứng dụng MUST báo pha "rút gọn" (không có tổng cố định) khi phải rút gọn ghi chú, và pha "viết" trước bước viết bản cuối.
- **FR-003**: Tạo một lượt MUST báo pha "viết" không có số đếm.
- **FR-004**: Thử lại trong cùng một phần MUST NOT báo thêm sự kiện; số phần hiển thị MUST NOT lùi.
- **FR-005**: Thẻ Studio của đúng loại đang tạo MUST hiện dòng tên pha và thanh tiến độ: xác định (i/N) ở pha đọc, bất định ở pha khác; thay khung chờ khi chưa có
  kết quả; nằm phía trên kết quả cũ khi "Tạo lại"; nút giữ nhãn "Đang tạo…".
- **FR-006**: Thanh tiến độ MUST có tên đọc và giá trị đọc được cho trình đọc màn hình; chuyển động MUST tắt khi hệ điều hành bật giảm chuyển động.
- **FR-007**: Ứng dụng MUST thông báo cho trình đọc màn hình khi bắt đầu, khi đổi pha, ở khoảng giữa pha đọc, và khi xong; tối đa ~6 thông báo mỗi lượt; mức lịch sự;
  mỗi câu có tên loại; theo ngôn ngữ giao diện hiện tại.
- **FR-008**: Mọi chuỗi mới MUST có bản tiếng Việt và English (câu chữ chốt ở clarify #11).
- **FR-009**: Mỗi lượt tạo MUST có định danh riêng do giao diện tạo; tiến trình chính MUST kiểm định danh (chuỗi, độ dài hợp lý) và chỉ báo tiến độ khi hợp lệ; thiếu ⇒
  tạo vẫn chạy, không báo.
- **FR-010**: Sự kiện tiến độ MUST chỉ gồm định danh lượt, notebook, loại, pha, i, N — không chứa nội dung ghi chú, đoạn nguồn, tiêu đề nguồn; nhật ký MUST NOT ghi nội dung.
- **FR-011**: Giao diện MUST chỉ áp sự kiện của lượt đang chạy cho đúng notebook và loại; sự kiện lượt khác hoặc lùi MUST bị bỏ; đổi notebook MUST xoá tiến độ đang hiển thị.
- **FR-012**: Lỗi giữa chừng MUST xoá tiến độ và hiện lỗi như hiện nay (kể cả nút "Tạo bằng AI cục bộ"/"Thử lại"); kết quả xong MUST xoá tiến độ.
- **FR-013**: Kênh thông báo tiến độ mới MUST nằm trong danh sách kênh được phép của cầu nối giao diện; không thêm kết nối mạng.
- **FR-014**: Tiến độ MUST NOT làm đổi kết quả tổng hợp, trích dẫn `[n]`, ghi chú "N phần"/"đã cắt", hay dữ liệu đã lưu.
- **FR-015**: Hoạt động như nhau với AI cục bộ, AI online và "Tạo bằng AI cục bộ".

### Key Entities

- **Sự kiện tiến độ Studio**: định danh lượt, notebook, loại (Tóm tắt / Ý chính / FAQ / Dàn ý), pha (đọc / rút gọn / viết), i và N (chỉ ở pha đọc).
- **Định danh lượt tạo**: chuỗi ngắn do giao diện tạo mỗi lần bấm tạo (kể cả tạo lại/tạo bằng AI cục bộ).
- **Trạng thái tiến độ trên thẻ**: theo từng loại — đang hiển thị pha nào, i/N, định danh lượt đang chờ.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Với notebook nhiều phần, người dùng thấy tiến độ thay đổi ít nhất mỗi khi bắt đầu một phần mới; 100% các phần thực chạy được hiển thị đúng i/N theo thứ tự, không lùi.
- **SC-002**: Với notebook một lượt, 100% lượt tạo chỉ hiện trạng thái "viết" bất định (không có i/N).
- **SC-003**: Mỗi lượt tạo có ≤ 6 thông báo cho trình đọc màn hình (gồm bắt đầu và xong).
- **SC-004**: 0 sự kiện tiến độ hiển thị sai thẻ trong các tình huống: hai loại song song, đổi notebook, lỗi, tạo lại, tạo bằng AI cục bộ (kiểm bằng test tự động).
- **SC-005**: Kết quả tổng hợp, trích dẫn và ghi chú "N phần" giống hệt trước feature cho cùng đầu vào (test hồi quy hiện có xanh, không sửa kỳ vọng).
- **SC-006**: Không chuỗi nào tràn khỏi thẻ ở cột Studio hẹp nhất, cả tiếng Việt và English (ảnh chụp kiểm tra).

## Assumptions

- Không có nút Huỷ (#149); không ETA; không phục hồi tiến độ khi quay lại notebook (giới hạn đã biết).
- Số phần tối đa và cách chia phần giữ như 105; pha rút gọn tối đa 3 vòng như hiện nay.
- Thông báo trình đọc màn hình dùng cơ chế hiện có (091); ngôn ngữ theo giao diện hiện tại (123).
- Không cần thay đổi dữ liệu đã lưu hay bản sao lưu.
