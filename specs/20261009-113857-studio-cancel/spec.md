# Feature Specification: Huỷ lượt tạo kết quả Studio

**Feature Branch**: `149-studio-cancel`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Huỷ lượt tạo kết quả Studio đang chạy (issue #149; nguồn: docs/intake/149-studio-cancel.md; 17 quyết định clarify ở
docs/04-decisions/2026-10-09-studio-cancel-clarify.md)."

## Bối cảnh

Studio tạo tóm tắt tài liệu, ý chính, FAQ và dàn ý cho cả notebook. Với notebook lớn, một lượt tạo chạy theo nhiều phần (đọc từng phần → rút gọn ghi
chú → viết bản cuối) và có thể mất **nhiều phút** trên model chạy trên máy. Feature #146 đã cho người dùng thấy tiến độ, nhưng vẫn **không có cách dừng**:
bấm nhầm loại, chọn nhầm phạm vi hay đổi ý thì chỉ còn cách chờ hoặc đóng ứng dụng — trong lúc đó máy vẫn bận (và, với AI online, dữ liệu tiếp tục được
gửi đi). Ngoài ra, khi người dùng rời notebook giữa lúc tạo, lượt tạo vẫn chạy ngầm không ai thấy, và một lượt cũ về muộn có thể ghi đè trạng thái của lượt
mới khi người dùng đi A → B → A. Feature này thêm **Huỷ** và làm rõ vòng đời một lượt tạo. Không đổi cách tổng hợp, trích dẫn `[n]`, ghi chú "N phần" /
"đã cắt", hay dữ liệu đã lưu.

## Clarifications

### Session 2026-10-09

Nguồn: `docs/04-decisions/2026-10-09-studio-cancel-clarify.md` (người dùng chọn toàn bộ phương án khuyên dùng; 4 câu hỏi trực tiếp + 13 đề xuất của intake).

- Q: Cách yêu cầu huỷ? → A: Một lệnh huỷ mới theo định danh lượt tạo (của #146), trả "đã huỷ / không có gì để huỷ", gọi lặp vô hại; định danh lạ ⇒ không có gì
  để huỷ, không lỗi.
- Q: Ai được huỷ một lượt? → A: Chỉ đúng cửa sổ đã bắt đầu lượt đó; tiến trình chính giữ sổ các lượt đang chạy và dọn khi lượt kết thúc hoặc cửa sổ đóng.
  Lượt không có định danh vẫn chạy như trước nhưng không huỷ được.
- Q: Huỷ có dừng thật việc gọi AI không? → A: Có — cả AI cục bộ lẫn ba nhà cung cấp AI online; huỷ phải ngắt kết nối thật và được phân biệt với "hết thời
  gian chờ".
- Q: Khi nào kiểm huỷ? → A: Trước mỗi phần, trong lần thử lại (đã huỷ thì không thử lại), mỗi vòng rút gọn, trước bước viết, sau khi xác định ngân sách,
  và ngay trước khi lưu; đã lưu xong thì huỷ không có tác dụng (kết quả hiển thị bình thường); không báo tiến độ sau khi huỷ.
- Q: Huỷ hiện ra thế nào với giao diện? → A: Là một kết cục riêng, không phải lỗi: không khối lỗi, không bật "Tạo bằng AI cục bộ".
- Q: Nút Huỷ ở đâu? → A: Trong vùng kết quả của loại đang tạo, mỗi khi loại đó đang tạo (cả trước sự kiện tiến độ đầu tiên và khi "Tạo lại" trên kết quả cũ),
  cùng hàng dòng pha / khung chờ; nút loại vẫn "Đang tạo…"; tên đọc có tên loại; sau khi bấm hiện "Đang huỷ…" và không bấm lại được; không hỏi xác nhận.
- Q: Huỷ lượt "Tạo bằng AI cục bộ"? → A: Như lượt thường; huỷ xong về nghỉ, không khôi phục khối lỗi AI online trước đó; nhãn "AI cục bộ" của kết quả cũ giữ nguyên.
- Q: Phản hồi sau huỷ? → A: Thẻ về trạng thái nghỉ (kết quả cũ nếu có) và trình đọc màn hình đọc "Đã huỷ tạo {loại}." / "Cancelled creating {kind}."; không
  thêm chữ trên màn hình.
- Q: Focus sau huỷ? → A: Về "Tạo lại" của kết quả cũ nếu có, ngược lại về nút loại; chỉ khi focus đang ở nút Huỷ vừa bấm.
- Q: Rời notebook / đóng Workspace giữa lúc tạo? → A: **Tự huỷ** mọi lượt đang chạy của notebook đó (thay quyết định #8 của #146 "giữ chạy").
- Q: Lượt cũ về muộn sau A → B → A? → A: Chỉ lượt **còn hiện hành** của loại (theo định danh lượt) mới được ghi kết quả / trạng thái.
- Q: Tạo lại cùng loại khi lượt cũ còn chạy? → A: **Lượt mới thắng** — tiến trình chính huỷ lượt cũ cùng notebook và loại.
- Q: Nhiều loại cùng lúc? → A: Huỷ chỉ loại được bấm; không có "Huỷ tất cả".
- Q: Nhật ký? → A: Ghi sự kiện huỷ với loại, pha và lý do (người dùng / rời notebook / đóng cửa sổ / bị lượt mới thay) — không nội dung, không định danh.
- Q: Câu chữ? → A: Nhãn "Huỷ" / "Cancel" (dùng lại nhãn chung); tên đọc "Huỷ tạo {loại}" / "Cancel creating {kind}"; "Đang huỷ…" / "Cancelling…"; câu đọc màn
  hình như trên; mã kết cục huỷ có thông điệp dự phòng ở cả hai ngôn ngữ.
- Q: Kiểm thử? → A: Test trước cho mọi logic thuần; kiểm thử đầu-cuối với AI giả trả lời chậm (huỷ giữa phần 2: kết nối bị đóng, không có yêu cầu mới, dữ liệu
  không đổi, kết quả cũ giữ nguyên, cửa sổ 900 px không tràn); thủ công với AI cục bộ thật.
- Q: Riêng tư khi huỷ AI online? → A: Không nói "chưa gửi gì"; chỉ báo ra mạng phải tắt, không có yêu cầu mới sau huỷ; giới hạn đã biết: yêu cầu đã tới nhà
  cung cấp có thể vẫn bị tính phí.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Huỷ một lượt tạo đang chạy lâu (Priority: P1)

Người dùng bấm "Tóm tắt tài liệu" cho notebook lớn, thấy "Đang đọc phần 2/5…" và đổi ý. Họ bấm **Huỷ** trên thẻ: nút chuyển "Đang huỷ…", rồi thẻ trở về như
trước khi bấm tạo — không kết quả nửa vời, không thông báo lỗi; máy thôi bận.

**Why this priority**: Lý do chính của feature — một lượt dài phút không thể dừng.

**Independent Test**: Với AI giả trả lời chậm, bấm Huỷ khi đang đọc phần 2: không có yêu cầu AI nào gửi thêm (kể cả thử lại), không có kết quả được lưu,
thẻ về nghỉ trong vài giây, không hiện lỗi.

**Acceptance Scenarios**:

1. **Given** lượt tạo nhiều phần đang ở phần 2/5, **When** bấm Huỷ, **Then** không có yêu cầu AI nào được gửi thêm, không lưu kết quả, thẻ về trạng thái nghỉ,
   không khối lỗi, nút loại sáng lại.
2. **Given** lượt đang thử lại một phần sau lỗi tạm, **When** bấm Huỷ, **Then** không thử lại nữa.
3. **Given** lượt đang ở pha rút gọn hoặc viết, hoặc là lượt một-lượt, hoặc chưa gọi AI lần nào, **When** bấm Huỷ, **Then** cùng kết cục như (1).
4. **Given** lượt vừa lưu xong đúng lúc người dùng bấm Huỷ, **When** kết quả về, **Then** kết quả hiển thị bình thường (huỷ không có tác dụng).

---

### User Story 2 - Huỷ khi "Tạo lại" giữ nguyên kết quả cũ (Priority: P1)

Người dùng đã có bản tóm tắt, bấm "Tạo lại" rồi đổi ý và bấm Huỷ. Bản tóm tắt cũ vẫn hiển thị và vẫn còn trong dữ liệu đã lưu.

**Why this priority**: Huỷ không được làm mất công việc đã có.

**Independent Test**: Có kết quả cũ ⇒ Tạo lại ⇒ Huỷ ⇒ kết quả cũ và dữ liệu đã lưu không đổi; focus về "Tạo lại".

**Acceptance Scenarios**:

1. **Given** đã có kết quả, **When** Tạo lại rồi Huỷ, **Then** kết quả cũ hiển thị nguyên vẹn, dữ liệu đã lưu không đổi, focus về "Tạo lại".

---

### User Story 3 - Huỷ khi dùng AI online dừng gửi dữ liệu (Priority: P1)

Người dùng đang dùng AI online (khoá API của chính họ) hoặc "Tạo bằng AI cục bộ" sau lỗi online. Bấm Huỷ ⇒ kết nối bị ngắt, chỉ báo "đang gửi dữ liệu ra
ngoài" về nghỉ, không hiện như lỗi "hết thời gian" và không hiện nút "Tạo bằng AI cục bộ".

**Why this priority**: Local-first và riêng tư là cam kết bất biến; huỷ bị hiểu nhầm là lỗi gây hành động sai.

**Independent Test**: Với từng nhà cung cấp AI giả, huỷ giữa lúc gọi ⇒ kết cục "đã huỷ" (không phải hết thời gian), chỉ báo ra mạng tắt, không có yêu cầu mới.

**Acceptance Scenarios**:

1. **Given** lượt dùng AI online đang gọi, **When** bấm Huỷ, **Then** kết nối bị ngắt, chỉ báo riêng tư về nghỉ, không khối lỗi, không nút "Tạo bằng AI cục bộ".
2. **Given** lượt "Tạo bằng AI cục bộ", **When** bấm Huỷ, **Then** về nghỉ như lượt thường, không khôi phục khối lỗi online trước đó.

---

### User Story 4 - Rời notebook giữa lúc tạo không để lượt chạy ngầm hay ghi đè (Priority: P2)

Người dùng đang tạo ở notebook A rồi chuyển sang B (hoặc rời Workspace). Lượt ở A tự huỷ. Quay lại A rồi tạo lại ngay, kết quả cũ về muộn của lượt trước
(nếu có) không ghi đè lượt mới; nếu lượt cũ cùng loại vẫn còn chạy thì lượt mới thắng.

**Why this priority**: Tránh tốn tài nguyên / gửi dữ liệu ngầm và tránh trạng thái sai — nhưng ít gặp hơn huỷ trực tiếp.

**Independent Test**: A → B ⇒ lượt ở A bị huỷ (không lưu); A → B → A với kết quả cũ về muộn ⇒ không ghi đè kết quả / trạng thái "đang tạo" của lượt mới.

**Acceptance Scenarios**:

1. **Given** đang tạo ở A, **When** chuyển sang B, **Then** lượt ở A bị huỷ, không lưu, trình đọc màn hình báo đã huỷ.
2. **Given** lượt cũ của A về muộn sau A → B → A và người dùng đã bắt đầu lượt mới, **When** kết quả cũ về, **Then** không ghi đè kết quả, cờ "đang tạo" hay nhãn của lượt mới.
3. **Given** một lượt cùng notebook và loại còn chạy, **When** bắt đầu lượt mới, **Then** lượt cũ bị huỷ, chỉ lượt mới chạy tới cùng.

---

### User Story 5 - Người dùng trình đọc màn hình biết đã huỷ (Priority: P2)

Người dùng trình đọc màn hình nghe "Đang tạo Tóm tắt tài liệu…", các mốc tiến độ, rồi "Đã huỷ tạo Tóm tắt tài liệu." khi bấm Huỷ; focus không rơi mất.

**Why this priority**: Câu "đang tạo" đã được đọc thì phải có câu kết thúc; nút biến mất không được làm mất focus.

**Independent Test**: Bấm Huỷ bằng bàn phím ⇒ nghe câu huỷ có tên loại (theo ngôn ngữ giao diện), focus về "Tạo lại" hoặc nút loại.

**Acceptance Scenarios**:

1. **Given** đang tạo, **When** bấm Huỷ bằng bàn phím, **Then** trình đọc màn hình đọc câu huỷ có tên loại; focus về "Tạo lại" (có kết quả cũ) hoặc nút loại.

---

### Edge Cases

- Bấm Huỷ hai lần / bấm khi lượt vừa xong ⇒ vô hại.
- Huỷ một loại khi loại khác cũng đang chạy ⇒ loại kia chạy tiếp, tiến độ không lẫn.
- Lượt không có định danh (giao diện cũ) ⇒ vẫn chạy như trước, không huỷ được.
- Định danh lạ / của cửa sổ khác ⇒ "không có gì để huỷ", không ảnh hưởng lượt khác.
- Đóng cửa sổ giữa lúc tạo ⇒ lượt bị huỷ, không chạy ngầm.
- AI cục bộ không dừng sinh ngay khi ngắt kết nối ⇒ giao diện vẫn về nghỉ ngay, không lưu (ghi giới hạn đã biết nếu đo được).
- Câu English dài hơn ở cột Studio hẹp ⇒ không tràn.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Khi một loại Studio đang tạo, thẻ của loại đó MUST hiện nút Huỷ (cả trước sự kiện tiến độ đầu tiên và khi "Tạo lại" trên kết quả cũ); nút loại giữ
  nhãn "Đang tạo…"; tên đọc của nút MUST có tên loại; không hỏi xác nhận.
- **FR-002**: Sau khi bấm Huỷ, nút MUST chuyển "Đang huỷ…" và không bấm lại được cho tới khi lượt kết thúc.
- **FR-003**: Ứng dụng MUST cung cấp lệnh huỷ theo định danh lượt tạo; gọi lặp hoặc với định danh lạ / đã xong MUST vô hại và trả "không có gì để huỷ".
- **FR-004**: Chỉ cửa sổ đã bắt đầu một lượt MUST được huỷ lượt đó; tiến trình chính MUST dọn thông tin lượt khi lượt kết thúc (xong / lỗi / huỷ) và khi cửa sổ đóng.
- **FR-005**: Huỷ MUST dừng việc gọi AI thật sự với AI cục bộ và cả ba nhà cung cấp AI online (ngắt kết nối), và MUST được phân biệt với lỗi hết thời gian chờ.
- **FR-006**: Sau khi huỷ, ứng dụng MUST NOT gửi thêm yêu cầu AI nào cho lượt đó (kể cả thử lại, rút gọn, viết) và MUST NOT báo thêm tiến độ.
- **FR-007**: Lượt bị huỷ MUST NOT lưu kết quả; nếu kết quả đã lưu trước khi huỷ có hiệu lực, kết quả đó MUST hiển thị bình thường.
- **FR-008**: Kết cục huỷ MUST NOT hiện như lỗi (không khối lỗi, không nút "Tạo bằng AI cục bộ" / "Thử lại"); thẻ MUST về trạng thái trước khi bấm tạo (kết quả cũ nếu có).
- **FR-009**: Sau khi huỷ, trình đọc màn hình MUST nhận câu "đã huỷ tạo {loại}" (mức lịch sự, theo ngôn ngữ giao diện); focus MUST về "Tạo lại" của kết quả cũ hoặc nút
  loại, chỉ khi focus đang ở nút Huỷ.
- **FR-010**: Rời notebook hoặc Workspace MUST tự huỷ mọi lượt đang chạy của notebook đó.
- **FR-011**: Chỉ lượt còn hiện hành của một loại (theo định danh lượt) MUST được ghi kết quả, cờ "đang tạo", nhãn "AI cục bộ" và lỗi.
- **FR-012**: Bắt đầu lượt mới cho cùng notebook và loại khi lượt cũ còn chạy MUST huỷ lượt cũ.
- **FR-013**: Huỷ một loại MUST NOT ảnh hưởng các loại khác đang chạy.
- **FR-014**: Huỷ lượt dùng AI online MUST đưa chỉ báo "đang gửi dữ liệu ra ngoài" về nghỉ; giao diện MUST NOT khẳng định "chưa gửi dữ liệu".
- **FR-015**: Ứng dụng MUST ghi nhật ký sự kiện huỷ gồm loại, pha và lý do; MUST NOT ghi nội dung, định danh lượt hay notebook.
- **FR-016**: Lệnh huỷ MUST nằm trong danh sách lệnh được phép của cầu nối giao diện và kiểm định danh ở tiến trình chính; không thêm kết nối mạng.
- **FR-017**: Mọi chuỗi mới MUST có bản tiếng Việt và English.
- **FR-018**: Huỷ MUST NOT làm đổi kết quả tổng hợp, trích dẫn `[n]`, ghi chú "N phần" / "đã cắt" của các lượt hoàn tất, hay dữ liệu đã lưu.

### Key Entities

- **Lượt tạo Studio**: một lần bấm Tạo / Tạo lại / Tạo bằng AI cục bộ cho một notebook và một loại, có định danh riêng (#146); trạng thái: đang chạy → xong / lỗi / đã huỷ.
- **Sổ lượt đang chạy (tiến trình chính)**: định danh lượt → cửa sổ đã bắt đầu, notebook, loại, tín hiệu huỷ; xoá khi lượt kết thúc hoặc cửa sổ đóng.
- **Kết cục huỷ**: kết cục riêng của một lượt (không phải lỗi), có lý do: người dùng, rời notebook, đóng cửa sổ, bị lượt mới thay.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Sau khi bấm Huỷ, 0 yêu cầu AI mới được gửi cho lượt đó và thẻ trở về trạng thái nghỉ trong ≤ 2 giây (không chờ hết thời gian chờ).
- **SC-002**: 100% lượt bị huỷ không để lại kết quả mới trong dữ liệu đã lưu; khi "Tạo lại" bị huỷ, kết quả cũ giữ nguyên 100%.
- **SC-003**: 0 lần huỷ hiện như lỗi (khối lỗi, "hết thời gian", nút "Tạo bằng AI cục bộ") với AI cục bộ và cả ba nhà cung cấp AI online (kiểm bằng test tự động).
- **SC-004**: 0 lần lượt cũ ghi đè trạng thái lượt mới trong các tình huống A → B → A, tạo lại, hai loại song song (kiểm bằng test tự động).
- **SC-005**: 100% lượt đang chạy bị huỷ khi rời notebook hoặc đóng cửa sổ (không lượt nào chạy ngầm).
- **SC-006**: Mỗi lần huỷ có đúng một câu thông báo huỷ cho trình đọc màn hình, theo ngôn ngữ giao diện; focus không rơi về đầu trang.
- **SC-007**: Kết quả tổng hợp, trích dẫn và ghi chú "N phần" của lượt hoàn tất giống hệt trước feature (test hồi quy hiện có xanh, không sửa kỳ vọng).
- **SC-008**: Nút Huỷ / "Đang huỷ…" không tràn ở cột Studio hẹp nhất, cả tiếng Việt và English.

## Assumptions

- Dùng lại định danh lượt và tiến độ của #146; không thêm kênh đọc trạng thái hay khôi phục tiến độ (đã chọn tự huỷ khi rời notebook).
- Không có "Huỷ tất cả", lưu bản nháp / kết quả một phần, hay huỷ cho tác vụ khác (nạp nguồn, tái lập chỉ mục) và Chat (đã có Dừng).
- AI cục bộ có thể không dừng sinh ngay lập tức khi ngắt kết nối; giao diện vẫn về nghỉ và không lưu (đo thủ công, ghi giới hạn nếu cần).
- Yêu cầu AI online đã tới nhà cung cấp trước khi huỷ có thể vẫn bị tính phí (giới hạn đã biết).
- Thông báo trình đọc màn hình dùng cơ chế hiện có (091); ngôn ngữ theo giao diện hiện tại (123); không thay đổi dữ liệu đã lưu hay bản sao lưu.
