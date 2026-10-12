# Feature Specification: Meeting Capture — ghi âm cuộc họp, transcript gần thời gian thực, nguồn cuộc họp trích dẫn theo timestamp

**Feature Branch**: `186-meeting-capture`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Tính năng Meeting Capture (issue #186, branch 186-meeting-capture). Lấy NGUYÊN mục 'Prompt for /speckit-specify' trong
docs/intake/186-meeting-capture.md làm mô tả tính năng. Mọi điểm mơ hồ ĐÃ được chốt trong docs/04-decisions/2026-10-12-meeting-capture-clarify.md (33 quyết định
A1–A10, C1–C6, D1–D17) — áp dụng trực tiếp vào spec. Chia 4 PR theo D1 (A → B → C1 độ bền → C2 trình xem)."

## Bối cảnh

InsightVault đã nạp được tệp audio/video có sẵn, bóc băng cục bộ, trích dẫn `[n]` theo mốc thời gian và phát lại tại đúng vị trí. Người dùng chưa thể **ghi một cuộc
họp ngay trong app**: họ phải ghi bằng công cụ khác rồi nạp tệp, không thấy transcript lúc họp, và mất bản ghi nếu công cụ kia gặp sự cố.

Feature này thêm **Ghi cuộc họp**: ghi microphone liên tục tối thiểu 120 phút, transcript nháp hiện dần trong lúc họp, và sau khi kết thúc tạo một **nguồn cuộc họp**
tham gia đầy đủ vào tìm kiếm, hỏi đáp RAG, Studio và trích dẫn theo timestamp. Trải nghiệm phải như một máy ghi âm đáng tin cậy: ít thao tác, trạng thái dễ hiểu, audio
luôn an toàn và khôi phục được sau sự cố. AI phát huy giá trị **sau** cuộc họp, không làm người dùng phân tâm trong lúc họp.

Ba điểm bất biến của sản phẩm được giữ nguyên: âm thanh và transcript **không rời máy** (nhận dạng tiếng nói luôn cục bộ ở v1); mọi trích dẫn trỏ đúng đoạn transcript
và mốc audio; ghi và nhận dạng chạy được khi offline (sau lần tải model đầu).

Thứ tự giao (mỗi PR ship được độc lập):

- **PR A — Ghi âm thành nguồn** (User Story 1, 2).
- **PR B — Transcript gần thời gian thực** (User Story 3, 4).
- **PR C1 — Độ bền** (User Story 5, 6).
- **PR C2 — Trình xem cuộc họp** (User Story 7).

Ghi âm trực tiếp là **mở rộng phạm vi sản phẩm có chủ đích** (không có trong OVERVIEW §5 hay prototype); UI mới là thiết kế mới, phải vừa cột Nguồn 262 px ở cả tiếng
Việt và English. Prototype không sửa.

## Clarifications

### Session 2026-10-12

Nguồn: `docs/04-decisions/2026-10-12-meeting-capture-clarify.md` (33 quyết định, chủ dự án đồng ý toàn bộ). Tóm tắt các quyết định ảnh hưởng hành vi người dùng:

- Q: Điểm vào nằm ở đâu? → A: Đầu cột Nguồn có hai nút icon cạnh nhau: `+` (Thêm nguồn) và 🎙 (Ghi cuộc họp), mỗi nút có tooltip và nhãn cho trình đọc màn hình (C5).
- Q: Trục thời gian và khoảng tạm dừng? → A: Mọi mốc là **thời gian audio** (không tính khoảng tạm dừng); khoảng ngừng hiện thành dòng phân cách "Tạm dừng N phút",
  không đưa vào văn bản lập chỉ mục (D2).
- Q: Tạm dừng có tắt mic thật không? → A: Có — tạm dừng tắt hẳn microphone (chỉ báo mic của hệ điều hành tắt); tiếp tục mở lại cùng thiết bị (D11).
- Q: Bấm trích dẫn của nguồn audio/video có tự phát không? → A: **Chỉ tua, không tự phát, cho mọi nguồn audio/video** — thay hành vi "tua rồi tự phát" của #49; không
  có tuỳ chọn tự phát ở v1 (C1).
- Q: Trạng thái nguồn trong lúc ghi/hoàn tất? → A: Nguồn hiện trong danh sách với nhãn "Đang ghi" / "Đã tạm dừng" / "Đang hoàn tất" (không phải lỗi); chưa tham gia hỏi
  đáp/Studio cho đến khi `Sẵn sàng` (A9).
- Q: "Nguồn chưa hoàn thiện" là gì? → A: Nguồn `Sẵn sàng` nhưng chưa có transcript: nghe được, có nút "Hoàn tất transcript"; không tham gia hỏi đáp/Studio (A9).
- Q: Chất lượng transcript nháp và độ trễ? → A: Nháp dùng model nhỏ, chốt dùng model hiện có của đường nạp audio; "độ trễ vài giây" là **mục tiêu, không cam kết** —
  khi máy không theo kịp, nháp bỏ bớt và hiện "Đang xử lý bản ghi — audio vẫn được lưu an toàn" (A2).
- Q: Phím tắt? → A: v1 có phím tắt **cố định, chỉ khi app đang focus**: `Cmd/Ctrl+Shift+P` tạm dừng/tiếp tục, `Cmd/Ctrl+Shift+M` đánh dấu, `Cmd/Ctrl+Shift+E` mở xác
  nhận kết thúc. Phím tắt **cấu hình được** và **toàn cục** hoãn sang issue sau — lệch có chủ đích so với design mục 10 (A6).
- Q: Ngưỡng cảnh báo đĩa? → A: Theo **thời gian ghi còn lại**: dưới 30 phút cảnh báo; dưới 5 phút cảnh báo khẩn; dưới 1 phút tự dừng ghi an toàn và chuyển sang hoàn
  tất; không cho bắt đầu khi còn dưới 10 phút. Có tính phần dự phòng cho bước chốt (A7).
- Q: Xác nhận kết thúc khi nào? "Mở khi hoàn tất" làm gì? → A: Xác nhận khi phiên ≥ 5 phút. "Mở khi hoàn tất": nếu người dùng còn ở màn hoàn tất thì tự mở trình xem;
  nếu đã rời đi thì hiện thông báo trong app "Cuộc họp … đã sẵn sàng — Mở", kèm thông báo hệ điều hành khi cửa sổ không focus (D15).
- Q: Ngôn ngữ? → A: `Tự động` phát hiện trên 30 giây đầu rồi khoá, đánh giá lại mỗi 2 phút trên 30 giây gần nhất, gợi ý chuyển khi ngôn ngữ khác thắng 2 lần liên tiếp;
  chấp nhận ⇒ áp từ thời điểm đó. `Đa ngôn ngữ` = nhận dạng tự chọn theo từng cửa sổ, có ghi chú giới hạn chất lượng. UI v1 chỉ có Tiếng Việt và English (D6).
- Q: Bản chốt thất bại? → A: Dùng bản nháp làm transcript, gắn nhãn "Transcript nháp" + nút "Chốt lại"; audio vẫn an toàn (D5).
- Q: Phục hồi sau sự cố? → A: Thẻ "Phục hồi cuộc họp chưa hoàn tất" ở cột Nguồn của notebook đó (và huy hiệu trên trang Notebooks), ba hành động: Hoàn tất transcript
  (mặc định), Giữ như nguồn chưa hoàn thiện, Xoá bản ghi (có xác nhận). **Không** ghi nối tiếp vào phiên cũ ở v1 (D9).
- Q: Mất thiết bị giữa phiên? → A: Tự tạm dừng, hướng dẫn chọn thiết bị khác để tiếp tục **cùng phiên** hoặc kết thúc; phần mất ghi nhận như khoảng ngừng (D10).
- Q: Xoá nguồn / sao lưu? → A: Audio cuộc họp do app giữ; xoá nguồn xoá luôn audio; sao lưu vault **có gồm** audio cuộc họp và hộp sao lưu hiện dung lượng (C3).
- Q: Đánh dấu? → A: 3 nhãn cố định, neo theo thời gian, không có ghi chú; không đưa vào chỉ mục ở v1; có trong bản xuất Markdown; sửa nhãn/xoá được sau hoàn tất (D4).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ghi một cuộc họp thành nguồn (Priority: P1) — PR A

Một luật sư mở notebook vụ việc, bấm 🎙 **Ghi cuộc họp**. Hộp bắt đầu hiện tên mặc định "Cuộc họp 12/10, 14:30", notebook đích, microphone, ngôn ngữ (`Tự động`) và câu
"Âm thanh và transcript được xử lý trên máy này." Họ bấm **Bắt đầu ghi**, app xin quyền micro (lần đầu), rồi chuyển sang màn đang ghi với `● Đang ghi · 00:00:07 · Lưu
trên máy`. Giữa buổi họ bấm **Tạm dừng** khi nghỉ giải lao ("Đã tạm dừng — không thu âm"), rồi **Tiếp tục**. Cuối buổi bấm **Kết thúc ghi**, xác nhận, và thấy màn
hoàn tất với tiêu đề sửa được, tổng thời lượng và "Đang chốt transcript và lập chỉ mục". Họ bấm **Về notebook**; khi xong, nguồn cuộc họp chuyển `Sẵn sàng`.

**Why this priority**: Đây là giá trị lõi — có một bản ghi cục bộ đáng tin cậy biến thành nguồn tri thức. Không có transcript thời gian thực vẫn đủ hữu ích.

**Independent Test**: Ghi 3 phút (có 1 lần tạm dừng) → kết thúc → nguồn cuộc họp chuyển `Sẵn sàng`; nghe lại được; transcript có khoảng ngừng; hỏi một câu về nội dung
cuộc họp ⇒ câu trả lời có `[n]`, bấm `[n]` mở nguồn tại đúng mốc audio (chỉ tua, không tự phát).

**Acceptance Scenarios**:

1. **Given** notebook đang mở, **When** bấm Ghi cuộc họp, **Then** hộp bắt đầu hiện tên mặc định theo ngày giờ hiện tại và ngôn ngữ giao diện, notebook đích là notebook
   hiện tại, microphone và ngôn ngữ là lựa chọn lần trước (hoặc mặc định), cùng thông điệp riêng tư.
2. **Given** máy có nhiều microphone, **When** mở hộp bắt đầu, **Then** người dùng chọn được thiết bị; máy chỉ có một thì không cần chọn.
3. **Given** chưa cấp quyền microphone, **When** bấm Bắt đầu ghi, **Then** app xin quyền; nếu bị từ chối thì hiện giải thích ngắn cách cấp quyền trong cài đặt hệ điều
   hành và **không tạo nguồn**.
4. **Given** đang ghi, **When** nhìn thanh đầu, **Then** thấy tên cuộc họp, trạng thái ghi bằng chữ kèm chấm đỏ, đồng hồ thời lượng nổi bật nhất, và "Lưu trên máy".
5. **Given** đang ghi, **When** bấm Tạm dừng, **Then** microphone tắt thật, trạng thái ghi "Đã tạm dừng — không thu âm", đồng hồ đứng; **When** bấm Tiếp tục, **Then** ghi
   tiếp cùng phiên và transcript có dòng phân cách "Tạm dừng N phút".
6. **Given** phiên ≥ 5 phút, **When** bấm Kết thúc ghi, **Then** có hộp xác nhận; phiên < 5 phút thì kết thúc ngay.
7. **Given** đã kết thúc, **When** màn hoàn tất hiện, **Then** có tiêu đề sửa được, tổng thời lượng, trạng thái "Đang chốt transcript và lập chỉ mục", nút Về notebook và
   Mở khi hoàn tất; nguồn trong danh sách mang nhãn "Đang hoàn tất" (không phải lỗi).
8. **Given** đang hoàn tất, **When** bấm Về notebook, **Then** việc hoàn tất tiếp tục chạy nền; người dùng vẫn thêm nguồn khác, hỏi đáp như thường, và nguồn khác không
   phải chờ việc hoàn tất cuộc họp.
9. **Given** hoàn tất thành công, **When** nguồn chuyển `Sẵn sàng`, **Then** nguồn tham gia tìm toàn văn, hỏi đáp RAG và Studio; nếu người dùng đã bấm Mở khi hoàn tất và
   vẫn ở màn hoàn tất thì trình xem tự mở; nếu đã rời đi thì có thông báo trong app (và thông báo hệ điều hành khi cửa sổ không focus).
10. **Given** câu trả lời có `[n]` trỏ vào nguồn cuộc họp, **When** bấm `[n]`, **Then** trình xem mở, audio tua đến mốc của đoạn trích và **không tự phát**; đoạn
    transcript tương ứng được tô sáng.
11. **Given** đang ghi hoặc đang hoàn tất, **When** hỏi đáp/Studio trong notebook, **Then** nguồn cuộc họp không được dùng làm căn cứ.
12. **Given** nguồn cuộc họp `Sẵn sàng`, **When** xoá nguồn (sau xác nhận), **Then** audio, transcript, đánh dấu và mọi dữ liệu của cuộc họp đều bị xoá khỏi máy.

---

### User Story 2 - Bấm trích dẫn audio/video chỉ tua (Priority: P1) — PR A

Một nhà báo bấm `[n]` trỏ vào một tệp ghi âm phỏng vấn đã nạp từ trước. Trình xem mở và tua đến đúng mốc nhưng **không tự phát** — họ đang ở quán cà phê và chỉ muốn
đọc đoạn transcript trước.

**Why this priority**: Đổi hành vi hiện có cho mọi audio/video để thống nhất với nguồn cuộc họp (C1); phải cùng PR A để không có hai hành vi khác nhau.

**Independent Test**: Nạp một tệp mp3 và một tệp video, hỏi đáp có trích dẫn vào từng tệp; bấm `[n]` ⇒ player ở đúng mốc, trạng thái dừng; bấm Phát ⇒ phát từ mốc đó.

**Acceptance Scenarios**:

1. **Given** câu trả lời trích dẫn nguồn audio hoặc video, **When** bấm `[n]`, **Then** player tua đến mốc bắt đầu của đoạn trích và ở trạng thái dừng.
2. **Given** player đang phát một đoạn khác, **When** bấm một `[n]` khác của cùng nguồn, **Then** player tua đến mốc mới và dừng phát.

---

### User Story 3 - Xem transcript nháp trong lúc họp (Priority: P2) — PR B

Trong lúc họp, nhà nghiên cứu thấy transcript hiện dần với timestamp ở lề trái (`01:18:42`). Đoạn đang nhận dạng có nhãn nhẹ "Đang nhận dạng"; khi có bản tốt hơn, chữ
cập nhật tại chỗ mà không nhấp nháy. Họ cuộn lên đọc lại một ý cũ — transcript ngừng tự cuộn và hiện nút **Quay về hiện tại**. Bấm một timestamp để nghe lại đoạn vừa
nói. Thanh dưới có meter âm lượng cho biết "Tín hiệu yếu" khi họ ngồi xa micro.

**Why this priority**: Giúp người dùng tin rằng app đang "nghe" đúng và theo dõi được cuộc họp, nhưng PR A đã đủ giá trị khi thiếu phần này.

**Independent Test**: Ghi 3 phút với nguồn âm thanh có lời nói ⇒ transcript nháp xuất hiện trong lúc ghi, có timestamp, có nhãn "Đang nhận dạng" cho đoạn mới nhất; cuộn
lên ⇒ hết tự cuộn và có nút Quay về hiện tại; bấm timestamp của đoạn đã ghi ⇒ nghe lại đúng vị trí.

**Acceptance Scenarios**:

1. **Given** đang ghi và có lời nói, **When** vài giây trôi qua, **Then** đoạn transcript nháp mới xuất hiện kèm timestamp thời gian audio ở lề trái.
2. **Given** một đoạn nháp đang hiển thị, **When** có kết quả nhận dạng tốt hơn cho đoạn đó, **Then** chữ được thay tại chỗ, vị trí cuộn và vùng chọn của người dùng không
   bị xô lệch, không nhấp nháy.
3. **Given** người dùng đang ở cuối transcript, **When** đoạn mới đến, **Then** transcript tự cuộn; **Given** người dùng đã cuộn lên, **When** đoạn mới đến, **Then**
   không tự cuộn và hiện nút Quay về hiện tại; bấm nút ⇒ về cuối và bật lại tự cuộn.
4. **Given** máy không theo kịp nhận dạng, **When** nháp tụt lại, **Then** thanh đầu hiện "Đang xử lý bản ghi — audio vẫn được lưu an toàn", việc ghi không bị ảnh hưởng,
   và không lộ chi tiết kỹ thuật (chunk, hàng đợi, model).
5. **Given** đang ghi, **When** nhìn thanh dưới, **Then** meter âm lượng hiện một trong ba trạng thái có nhãn chữ: "Tín hiệu yếu", "Có tín hiệu", "Âm thanh quá lớn".
6. **Given** đoạn audio đã được ghi, **When** bấm timestamp của đoạn đó, **Then** audio phát lại từ mốc đó trong khi việc ghi vẫn tiếp tục.
7. **Given** chưa có model nhận dạng và không có Internet, **When** bắt đầu ghi, **Then** việc ghi vẫn chạy và hiện "Chưa có model nhận dạng — transcript sẽ tạo khi có
   model"; hộp bắt đầu có nút "Tải model (~N MB)" khi thiếu model.
8. **Given** đang trong cuộc họp, **When** đoạn audio là im lặng, **Then** không sinh dòng transcript vô nghĩa cho đoạn im lặng.

---

### User Story 4 - Đánh dấu và ngôn ngữ trong lúc họp (Priority: P2) — PR B

Khi nhóm chốt một việc, người dùng bấm **Đánh dấu** (hoặc `Cmd/Ctrl+Shift+M`) và chọn "Việc cần làm"; hoặc bôi chọn một câu trong transcript rồi gắn nhãn "Quyết định".
Lúc bắt đầu, app hiện "Đang nhận dạng ngôn ngữ…" rồi "Tiếng Việt · Tự động". Nửa sau cuộc họp chuyển sang tiếng Anh, app gợi ý "Có vẻ cuộc họp đang dùng English.
Chuyển transcript sang English?"; họ đồng ý.

**Why this priority**: Đánh dấu là cách ít phân tâm nhất để lưu ý quan trọng trong lúc họp; nhận dạng đúng ngôn ngữ quyết định chất lượng transcript.

**Independent Test**: Ghi 2 phút, thêm 3 đánh dấu (một bằng nút, một bằng bôi chọn, một bằng phím tắt) ⇒ cả 3 xuất hiện với nhãn và mốc thời gian, còn nguyên sau khi
hoàn tất; với audio tiếng Việt ở chế độ Tự động ⇒ hiện "Tiếng Việt · Tự động" trong vòng 30 giây đầu.

**Acceptance Scenarios**:

1. **Given** đang ghi hoặc đang tạm dừng, **When** bấm Đánh dấu và chọn một trong ba nhãn `Quyết định` / `Việc cần làm` / `Câu hỏi`, **Then** đánh dấu được tạo tại thời
   điểm audio hiện tại (khi tạm dừng: tại điểm dừng).
2. **Given** người dùng bôi chọn một phần transcript nháp, **When** gắn nhãn, **Then** đánh dấu bao trọn khoảng thời gian của phần được chọn, và vẫn trỏ đúng nội dung sau
   khi transcript được chốt.
3. **Given** chế độ `Tự động`, **When** ghi được khoảng 30 giây có lời nói, **Then** trạng thái chuyển từ "Đang nhận dạng ngôn ngữ…" sang "<Ngôn ngữ> · Tự động" và ngôn
   ngữ được giữ cố định.
4. **Given** ngôn ngữ đã khoá tự động, **When** hai lần đánh giá liên tiếp (mỗi 2 phút) cho thấy ngôn ngữ khác, **Then** app hiện gợi ý chuyển; người dùng đồng ý ⇒
   transcript dùng ngôn ngữ mới từ thời điểm đó; từ chối ⇒ giữ nguyên và không gợi ý lại cho tới khi đổi ngôn ngữ thêm lần nữa.
5. **Given** bất kỳ lúc nào trong phiên, **When** người dùng chọn ngôn ngữ thủ công, **Then** ngôn ngữ được khoá theo lựa chọn, không còn gợi ý tự động.
6. **Given** chế độ `Đa ngôn ngữ`, **When** ghi một cuộc họp pha trộn Việt–Anh, **Then** transcript chấp nhận cả hai ngôn ngữ và giao diện có ghi chú rằng tên riêng/thuật
   ngữ có thể cần bản chốt để chính xác hơn.

---

### User Story 5 - Không mất cuộc họp khi có sự cố (Priority: P2) — PR C1

Laptop của kỹ sư hết pin ở phút 87 của một buổi họp. Khi mở lại app, cột Nguồn của notebook hiện thẻ **Phục hồi cuộc họp chưa hoàn tất** với thời lượng đã ghi. Họ bấm
**Hoàn tất transcript** và nhận được nguồn cuộc họp dài khoảng 87 phút. Ở một buổi khác, họ lỡ bấm Cmd+Q trong lúc ghi — app hỏi lại trước khi thoát.

**Why this priority**: "Audio luôn được lưu an toàn" là cam kết cốt lõi của một máy ghi âm; với cuộc họp dài, sự cố là chuyện chắc chắn sẽ gặp.

**Independent Test**: Ghi 3 phút rồi buộc tắt tiến trình app ⇒ mở lại có thẻ phục hồi; Hoàn tất transcript ⇒ nguồn `Sẵn sàng`, audio mất không quá 5 giây cuối; thử lại
với "Giữ như nguồn chưa hoàn thiện" và "Xoá bản ghi".

**Acceptance Scenarios**:

1. **Given** app hoặc máy dừng đột ngột khi đang ghi, **When** mở lại app, **Then** cột Nguồn của notebook đích hiện thẻ Phục hồi cuộc họp chưa hoàn tất (trang Notebooks có
   huy hiệu cho notebook đó), audio mất không quá 5 giây cuối trước sự cố.
2. **Given** thẻ phục hồi, **When** chọn Hoàn tất transcript, **Then** phiên đi qua hoàn tất như bình thường và thành nguồn `Sẵn sàng`.
3. **Given** thẻ phục hồi, **When** chọn Giữ như nguồn chưa hoàn thiện, **Then** nguồn nghe được, có nút "Hoàn tất transcript" trong trình xem, và không tham gia hỏi
   đáp/Studio cho tới khi hoàn tất.
4. **Given** thẻ phục hồi, **When** chọn Xoá bản ghi và xác nhận, **Then** toàn bộ audio và dữ liệu của phiên bị xoá.
5. **Given** đang ghi, **When** người dùng thoát app hoặc đóng cửa sổ, **Then** app hỏi "Đang ghi — thoát sẽ kết thúc phiên (audio đã lưu)"; đồng ý ⇒ phiên được đóng an
   toàn và lần mở sau tự tiếp tục hoàn tất (không cần thẻ phục hồi); huỷ ⇒ tiếp tục ghi.
6. **Given** đang hoàn tất (chưa xong), **When** thoát app, **Then** không bị chặn; lần mở sau việc hoàn tất tự tiếp tục từ phần đã xong, không làm lại từ đầu.
7. **Given** hoàn tất thất bại hoặc chưa có model chốt, **When** hoàn tất kết thúc, **Then** nguồn dùng transcript nháp, hiện nhãn "Transcript nháp" và nút "Chốt lại";
   audio vẫn nguyên.
8. **Given** máy đang ghi, **When** máy rảnh lâu hoặc người dùng khoá màn hình, **Then** máy không tự ngủ làm gián đoạn việc ghi.

---

### User Story 6 - Cảnh báo đĩa, lỗi thiết bị và phím tắt (Priority: P2) — PR C1

Đang họp thì tai nghe Bluetooth hết pin. App tự tạm dừng và hiện "Mất microphone — chọn thiết bị khác để tiếp tục, hoặc Kết thúc". Họ chọn micro tích hợp và ghi tiếp
cùng phiên. Ở một buổi khác, đĩa gần đầy: app cảnh báo "Còn khoảng 25 phút ghi".

**Why this priority**: Biến các lỗi phổ biến của phiên dài thành trạng thái dễ hiểu và phục hồi được thay vì mất dữ liệu.

**Independent Test**: Rút thiết bị đang dùng ⇒ tự tạm dừng + hướng dẫn; chọn thiết bị khác ⇒ ghi tiếp cùng phiên. Mô phỏng dung lượng trống thấp ⇒ cảnh báo đúng ngưỡng.

**Acceptance Scenarios**:

1. **Given** đang ghi, **When** thiết bị ghi biến mất hoặc quyền micro bị thu hồi, **Then** phiên tự tạm dừng, dữ liệu đã ghi giữ nguyên, và hướng dẫn chọn thiết bị khác
   hoặc kết thúc; chọn thiết bị khác ⇒ ghi tiếp cùng phiên, phần gián đoạn hiện như một khoảng ngừng.
2. **Given** thời gian ghi còn lại ước tính dưới 30 phút, **Then** hiện cảnh báo kèm số phút còn lại; dưới 5 phút ⇒ cảnh báo khẩn; dưới 1 phút ⇒ app tự kết thúc ghi an
   toàn và chuyển sang màn hoàn tất.
3. **Given** thời gian ghi còn lại ước tính dưới 10 phút, **When** mở hộp bắt đầu, **Then** không cho bắt đầu và giải thích lý do.
4. **Given** app đang focus trong phiên ghi, **When** bấm `Cmd/Ctrl+Shift+P`, **Then** tạm dừng/tiếp tục; `Cmd/Ctrl+Shift+M` ⇒ mở đánh dấu; `Cmd/Ctrl+Shift+E` ⇒ mở hộp
   xác nhận kết thúc (không kết thúc ngay). Phím tắt hiện trong tooltip và được khai báo cho trình đọc màn hình.
5. **Given** đang ghi, **When** người dùng chuyển sang notebook khác, **Then** việc ghi tiếp tục và đầu app có thanh "● Đang ghi 00:12:03 — Quay lại" để trở về màn ghi.
6. **Given** đang ghi, **When** người dùng cố bắt đầu phiên ghi thứ hai, khôi phục/sao lưu vault, hoặc xoá notebook đích, **Then** thao tác bị chặn với giải thích.

---

### User Story 7 - Trình xem cuộc họp (Priority: P3) — PR C2

Sau cuộc họp, người dùng mở nguồn cuộc họp: player cố định ở đầu, transcript bên dưới; đoạn đang phát được tô sáng và tự đi theo. Họ bấm một câu để nghe lại, tìm
"ngân sách" trong transcript, xem danh sách đánh dấu, rồi **Xuất Markdown** để gửi biên bản.

**Why this priority**: Nâng trải nghiệm xem lại; nguồn cuộc họp đã dùng được qua trình xem hiện có từ PR A.

**Independent Test**: Mở nguồn cuộc họp `Sẵn sàng` ⇒ phát audio thấy đoạn đang phát được tô sáng; bấm câu ⇒ tua đúng; tìm từ ⇒ có kết quả và chuyển qua lại được; xuất
Markdown ⇒ tệp có tiêu đề, metadata, đánh dấu, transcript có timestamp và dòng tạm dừng.

**Acceptance Scenarios**:

1. **Given** nguồn cuộc họp `Sẵn sàng`, **When** phát audio, **Then** câu đang phát được tô sáng và đưa vào tầm nhìn khi người dùng không tự cuộn.
2. **Given** trình xem cuộc họp, **When** bấm một câu transcript, **Then** audio tua đúng mốc bắt đầu của câu đó.
3. **Given** trình xem cuộc họp, **When** gõ từ khoá vào ô tìm, **Then** các vị trí khớp được tô, có số đếm và chuyển trước/sau được.
4. **Given** cuộc họp có đánh dấu, **When** mở danh sách đánh dấu, **Then** thấy nhãn + mốc thời gian + trích đoạn; bấm một mục ⇒ tua đến đó; đổi nhãn hoặc xoá được.
5. **Given** trình xem cuộc họp, **When** bấm Sao chép transcript, **Then** clipboard chứa transcript có timestamp; **When** bấm Xuất Markdown, **Then** hộp lưu tệp mở và
   tệp gồm tiêu đề, ngày, thời lượng, ngôn ngữ, danh sách đánh dấu, transcript có `[hh:mm:ss]` mỗi đoạn và dòng phân cách tạm dừng.

---

### Edge Cases

- Từ chối quyền micro ⇒ không tạo nguồn; quyền bị thu hồi giữa phiên ⇒ luồng mất thiết bị (US6-1).
- Máy không có microphone nào ⇒ nút Bắt đầu ghi bị vô hiệu kèm giải thích.
- Bắt đầu ghi rồi kết thúc ngay khi chưa có lời nói ⇒ vẫn tạo nguồn hợp lệ (có thể 0 đoạn transcript, nghe được).
- Phiên rất dài (> 180 phút) ⇒ không có trần cứng; giới hạn duy nhất là dung lượng đĩa (US6-2).
- Thiết bị đổi tần số mẫu (Bluetooth) ⇒ audio lưu ra vẫn đúng tốc độ và mốc thời gian không lệch.
- Renderer bị crash/tải lại trong lúc ghi ⇒ phiên được đóng an toàn và đưa vào luồng phục hồi.
- Nhiều phiên dang dở (nhiều lần sự cố) ⇒ mỗi phiên một thẻ phục hồi; phiên bị bỏ không tự xoá.
- Đổi tên tiêu đề ở màn hoàn tất trong lúc đang chốt ⇒ tên mới được giữ khi nguồn `Sẵn sàng`.
- Xoá nguồn cuộc họp đang hoàn tất ⇒ việc hoàn tất bị huỷ và mọi dữ liệu bị xoá.
- Cuộc họp toàn im lặng hoặc nhạc nền ⇒ không sinh transcript ảo; nguồn vẫn nghe được.
- Đánh dấu tạo trên đoạn nháp mà bản chốt viết khác ⇒ đánh dấu vẫn trỏ đúng khoảng thời gian.
- Bật AI online khi mở hộp bắt đầu ⇒ thông điệp riêng tư thêm phụ chú rằng hỏi đáp/Studio về cuộc họp sẽ dùng AI online đang bật; nhận dạng vẫn cục bộ.
- Đang tải model lần đầu trong lúc họp ⇒ chỉ báo riêng tư chuyển sang "đang gửi/tải" đúng trong thời gian tải.
- Vault khôi phục từ bản sao lưu cũ ⇒ cuộc họp có trong bản sao lưu được khôi phục kèm audio.

## Requirements _(mandatory)_

### Functional Requirements

**Điểm vào và bắt đầu (PR A)**

- **FR-001**: Cột Nguồn MUST có nút Ghi cuộc họp cạnh nút Thêm nguồn, dạng icon có tooltip và nhãn cho trình đọc màn hình, vừa cột 262 px ở cả tiếng Việt và English.
- **FR-002**: Hộp bắt đầu MUST có: tên mặc định "Cuộc họp <dd/MM>, <HH:mm>" (bản English tương ứng theo ngôn ngữ giao diện, lưu như chuỗi thường), notebook đích, chọn
  microphone khi có nhiều thiết bị, ngôn ngữ (`Tự động` mặc định, `Tiếng Việt`, `English`, `Đa ngôn ngữ`), thông điệp "Âm thanh và transcript được xử lý trên máy này."
  và nút Bắt đầu ghi. App MUST nhớ microphone và ngôn ngữ đã chọn lần trước.
- **FR-003**: Thông điệp riêng tư MUST chỉ nói về ghi và nhận dạng; khi AI online đang bật MUST thêm phụ chú về hỏi đáp/Studio; khi chưa có model nhận dạng MUST thêm dòng
  "Lần đầu cần tải model nhận dạng (~N MB) — cần Internet" kèm nút tải.
- **FR-004**: App MUST xin quyền microphone chỉ khi người dùng bấm Bắt đầu ghi, chỉ cho thu âm (không camera), và vẫn từ chối mọi quyền khác. Bị từ chối ⇒ hướng dẫn cấp
  quyền theo hệ điều hành và MUST NOT tạo nguồn.
- **FR-005**: Nguồn cuộc họp MUST chỉ được tạo sau khi microphone đã mở thành công. Tại một thời điểm chỉ có tối đa một phiên ghi.

**Ghi và điều khiển (PR A)**

- **FR-006**: App MUST ghi liên tục tối thiểu 120 phút, lưu audio thành các phân đoạn ghi âm độc lập 5 phút; phân đoạn đã đóng MUST còn nguyên nếu app/máy gặp sự cố.
- **FR-007**: Việc ghi MUST không bị chậm, dừng hay mất mẫu khi nhận dạng tiếng nói chậm, treo hoặc lỗi.
- **FR-008**: Thanh đầu MUST hiện tên cuộc họp, trạng thái ghi bằng chữ (không chỉ màu), thời lượng audio đã ghi (thông tin nổi bật nhất) và "Lưu trên máy".
- **FR-009**: Tạm dừng MUST tắt hẳn microphone và hiện "Đã tạm dừng — không thu âm"; tiếp tục MUST mở lại cùng thiết bị trong cùng phiên. Thời lượng và mọi mốc thời gian
  MUST là thời gian audio (không tính khoảng tạm dừng); khoảng ngừng MUST được lưu và hiện thành dòng phân cách "Tạm dừng N phút", không vào văn bản lập chỉ mục.
- **FR-010**: Kết thúc ghi MUST đặt tách biệt với các điều khiển khác và MUST hỏi xác nhận khi phiên ≥ 5 phút.
- **FR-011**: Màn hoàn tất MUST hiện tiêu đề sửa được (sửa = đổi tên nguồn), tổng thời lượng, "Đang chốt transcript và lập chỉ mục", nút Về notebook (việc hoàn tất chạy
  nền) và Mở khi hoàn tất (hành vi theo Clarifications/D15).
- **FR-012**: Bước hoàn tất MUST nhận dạng lại từng phân đoạn bằng model chốt, xử lý ranh giới giữa các phân đoạn để không mất hay lặp chữ, rồi chunk/embed/lập chỉ mục
  qua pipeline nguồn hiện có. Locator thời gian MUST tính từ transcript chốt tại lúc chunk.
- **FR-013**: Trong lúc ghi/hoàn tất, nguồn MUST hiện trong danh sách với nhãn "Đang ghi" / "Đã tạm dừng" / "Đang hoàn tất" (không phải lỗi) và MUST NOT tham gia hỏi
  đáp, tìm kiếm hay Studio. Sau khi thành công nguồn MUST chuyển `Sẵn sàng` và tham gia đầy đủ.
- **FR-014**: Việc hoàn tất một cuộc họp MUST NOT chặn việc nạp các nguồn khác ngoài bước lập chỉ mục cuối ngắn.
- **FR-015**: Xoá nguồn cuộc họp MUST xoá audio, transcript, đánh dấu và mọi dữ liệu của phiên khỏi máy; đường dẫn tệp MUST NOT lộ ra giao diện.
- **FR-016**: Sao lưu vault MUST gồm audio cuộc họp và hộp sao lưu MUST hiện dung lượng; khôi phục vault MUST khôi phục cuộc họp kèm audio.

**Trích dẫn và phát lại (PR A)**

- **FR-017**: Bấm `[n]` trỏ vào bất kỳ nguồn audio/video/cuộc họp nào MUST mở trình xem, tua đến mốc bắt đầu của đoạn trích và MUST NOT tự phát.
- **FR-018**: Nguồn cuộc họp MUST phát lại được với tua chính xác trong trình xem, kể cả cuộc họp ≥ 120 phút.

**Transcript nháp (PR B)**

- **FR-019**: Trong lúc ghi, transcript nháp MUST hiện dần theo đoạn, mỗi đoạn có timestamp thời gian audio ở lề trái; đoạn đang nhận dạng có nhãn "Đang nhận dạng"; độ
  trễ mục tiêu vài giây (mục tiêu, không cam kết).
- **FR-020**: Cập nhật một đoạn nháp MUST thay tại chỗ, không nhấp nháy, không xô lệch vị trí cuộn hay vùng chọn.
- **FR-021**: Transcript MUST tự cuộn chỉ khi người dùng đang ở cuối; cuộn lên ⇒ dừng tự cuộn và hiện Quay về hiện tại.
- **FR-022**: Khi nhận dạng tụt lại, app MUST bỏ bớt phần nháp tồn đọng thay vì để tồn đọng tăng mãi, và hiện "Đang xử lý bản ghi — audio vẫn được lưu an toàn"; MUST NOT
  hiện chi tiết kỹ thuật.
- **FR-023**: Bấm timestamp của đoạn đã ghi MUST phát lại audio từ mốc đó mà không ảnh hưởng việc ghi.
- **FR-024**: Meter âm lượng MUST hiện ba trạng thái có nhãn chữ: "Tín hiệu yếu" (mức trung bình dưới −50 dBFS), "Có tín hiệu", "Âm thanh quá lớn" (đỉnh trên −1 dBFS).
- **FR-025**: Đoạn im lặng MUST NOT sinh transcript; cụm từ lặp vô nghĩa do nhận dạng ảo MUST bị lọc.
- **FR-026**: Thiếu model nhận dạng MUST NOT chặn việc ghi; transcript được tạo khi có model.
- **FR-027**: Transcript nháp MUST NOT được dùng để trả lời hay trích dẫn.

**Ngôn ngữ và đánh dấu (PR B)**

- **FR-028**: Chế độ `Tự động` MUST hiện "Đang nhận dạng ngôn ngữ…", phát hiện trên khoảng 30 giây có lời nói đầu tiên, hiện "<Ngôn ngữ> · Tự động" rồi khoá; đánh giá
  lại mỗi 2 phút trên 30 giây gần nhất; gợi ý chuyển khi ngôn ngữ khác thắng 2 lần liên tiếp; chấp nhận ⇒ áp cho phần sau thời điểm đó (cả nháp và chốt).
- **FR-029**: Người dùng MUST luôn khoá được ngôn ngữ thủ công; đã khoá thủ công thì không gợi ý tự động.
- **FR-030**: Chế độ `Đa ngôn ngữ` MUST cho phép mỗi cửa sổ nhận dạng tự chọn ngôn ngữ và MUST hiện ghi chú giới hạn chất lượng.
- **FR-031**: Người dùng MUST tạo được đánh dấu với 3 nhãn cố định (`Quyết định`, `Việc cần làm`, `Câu hỏi`) bằng nút, bằng bôi chọn transcript hoặc bằng phím tắt, cả khi
  đang tạm dừng. Đánh dấu MUST neo theo khoảng thời gian và trỏ đúng nội dung sau khi chốt. Đánh dấu MUST NOT vào chỉ mục ở v1.

**Độ bền (PR C1)**

- **FR-032**: Audio MUST được ghi xuống đĩa liên tục để sự cố bất ngờ mất không quá 5 giây cuối; trạng thái phiên (phân đoạn, tiến độ nhận dạng, đánh dấu, cài đặt) MUST
  được lưu điểm kiểm tối thiểu mỗi 30 giây và mỗi khi đóng phân đoạn, theo cách không bao giờ để lại tệp trạng thái hỏng.
- **FR-033**: Mở lại app sau sự cố MUST hiện thẻ Phục hồi cuộc họp chưa hoàn tất (cột Nguồn của notebook đích + huy hiệu trang Notebooks) cho từng phiên dang dở, với 3 hành
  động: Hoàn tất transcript, Giữ như nguồn chưa hoàn thiện, Xoá bản ghi (có xác nhận). Phiên dang dở MUST NOT tự bị xoá.
- **FR-034**: Nguồn chưa hoàn thiện MUST nghe được, có nút Hoàn tất transcript, và không tham gia hỏi đáp/Studio.
- **FR-035**: Việc hoàn tất MUST tiếp tục được sau khi bị gián đoạn mà không làm lại phần đã xong; mở lại app MUST tự tiếp tục hoàn tất các phiên người dùng đã chủ động
  kết thúc (kể cả qua thoát app).
- **FR-036**: Hoàn tất thất bại hoặc thiếu model chốt ⇒ nguồn MUST dùng transcript nháp, hiện nhãn "Transcript nháp" và nút "Chốt lại".
- **FR-037**: Thoát app/đóng cửa sổ khi đang ghi MUST hỏi xác nhận; đồng ý ⇒ đóng phiên an toàn. Thoát khi đang hoàn tất MUST NOT bị chặn.
- **FR-038**: Trong lúc ghi, máy MUST NOT tự ngủ làm gián đoạn việc ghi.
- **FR-039**: Mất thiết bị hoặc quyền giữa phiên MUST tự tạm dừng, giữ dữ liệu, hướng dẫn chọn thiết bị khác (ghi tiếp cùng phiên, phần gián đoạn là khoảng ngừng) hoặc kết thúc.
- **FR-040**: Cảnh báo đĩa MUST dựa trên thời gian ghi còn lại (đã trừ dự phòng cho bước hoàn tất), kiểm tối thiểu mỗi 30 giây: < 30 phút cảnh báo, < 5 phút khẩn, < 1 phút tự
  kết thúc ghi an toàn; < 10 phút thì không cho bắt đầu.
- **FR-041**: Việc ghi MUST tiếp tục khi người dùng điều hướng trong app; đầu app MUST có thanh trạng thái ghi để quay lại màn ghi. Renderer gặp sự cố ⇒ phiên MUST được
  đóng an toàn và đưa vào luồng phục hồi.
- **FR-042**: Trong lúc ghi MUST chặn: phiên ghi thứ hai, khôi phục và sao lưu vault, xoá notebook đích, xoá nguồn đang ghi.
- **FR-043**: Phím tắt cố định khi app focus: `Cmd/Ctrl+Shift+P` tạm dừng/tiếp tục, `Cmd/Ctrl+Shift+M` đánh dấu, `Cmd/Ctrl+Shift+E` mở xác nhận kết thúc; MUST hiện trong
  tooltip và khai báo cho trình đọc màn hình.

**Trình xem cuộc họp (PR C2)**

- **FR-044**: Trình xem cuộc họp MUST có player cố định ở đầu, transcript đồng bộ tô sáng câu đang phát, bấm câu để tua, tìm toàn văn trong transcript (tô kết quả, đếm,
  trước/sau), danh sách đánh dấu (tua, đổi nhãn, xoá), sao chép transcript có timestamp và xuất Markdown qua hộp lưu tệp.
- **FR-045**: Bản xuất Markdown MUST gồm tiêu đề, ngày, thời lượng, ngôn ngữ, danh sách đánh dấu, transcript có `[hh:mm:ss]` mỗi đoạn và dòng phân cách tạm dừng.

**Riêng tư, bảo mật, khả năng tiếp cận (mọi PR)**

- **FR-046**: Audio và transcript MUST NOT rời máy; nhận dạng tiếng nói luôn cục bộ. Tải model lần đầu MUST bật chỉ báo riêng tư "đang tải" đúng trong thời gian tải.
- **FR-047**: App MUST NOT ghi nội dung audio, transcript, đánh dấu hay API key vào log.
- **FR-048**: Trạng thái microphone đang hoạt động MUST luôn hiện rõ bằng chữ (không chỉ màu) trong suốt phiên, kể cả khi người dùng ở màn khác.
- **FR-049**: Mọi điều khiển MUST có nhãn cho trình đọc màn hình (trạng thái ghi, thời lượng, mức âm lượng, trạng thái transcript); các mốc trạng thái quan trọng (bắt
  đầu, tạm dừng, tiếp tục, mất thiết bị, cảnh báo đĩa, kết thúc, sẵn sàng) MUST được thông báo qua live region; MUST NOT đọc từng câu transcript.
- **FR-050**: Mọi chuỗi giao diện mới MUST có tiếng Việt (nguồn) và English.

### Key Entities

- **Nguồn cuộc họp (meeting source)**: một loại nguồn mới trong notebook. Có tiêu đề, trạng thái, audio do app giữ; tham gia tìm kiếm/hỏi đáp/Studio khi `Sẵn sàng`.
- **Phiên ghi (recording session)**: gắn 1-1 với nguồn cuộc họp. Thiết bị ghi, chế độ ngôn ngữ, ngôn ngữ phát hiện, thời điểm bắt đầu/kết thúc, thời lượng audio, giai
  đoạn (đang ghi, tạm dừng, hoàn tất, gián đoạn, chưa hoàn thiện, xong), danh sách phân đoạn ghi âm, danh sách khoảng ngừng, chất lượng transcript (chốt/nháp).
- **Phân đoạn ghi âm (capture segment)**: một tệp audio độc lập ~5 phút; đơn vị khôi phục và đơn vị hoàn tất.
- **Khoảng ngừng (pause gap)**: vị trí trong thời gian audio + độ dài thực của lần tạm dừng hoặc gián đoạn.
- **Transcript nháp / Transcript chốt**: nháp là kết quả gần thời gian thực, không dùng để trả lời; chốt là văn bản được lập chỉ mục và là cơ sở trích dẫn.
- **Đoạn thời gian transcript (transcript span)**: ánh xạ một khoảng ký tự của transcript chốt ↔ khoảng thời gian audio ở mức câu; dùng cho tô sáng, tua, đánh dấu.
- **Đánh dấu (marker)**: nhãn (`Quyết định` / `Việc cần làm` / `Câu hỏi`) + khoảng thời gian audio; thuộc một phiên ghi.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Ghi liên tục 120 phút (kiểm thử tay trước phát hành) và 180 phút (mô phỏng tăng tốc) không mất bất kỳ phân đoạn đã đóng nào; thời lượng nguồn khớp thời
  lượng audio thực trong ±1 giây.
- **SC-002**: Khi nhận dạng bị làm chậm hoặc dừng hẳn, audio ghi được vẫn liên tục, không có khoảng trống > 0,1 giây ngoài các lần tạm dừng của người dùng.
- **SC-003**: Bị buộc tắt giữa phiên, sau khi mở lại và hoàn tất, audio mất không quá 5 giây cuối trước sự cố; 100% đánh dấu đã tạo trước điểm kiểm cuối cùng còn nguyên.
- **SC-004**: Từ lúc mở hộp bắt đầu đến khi đang ghi cần không quá 2 thao tác (khi đã có quyền micro).
- **SC-005**: Bấm `[n]` của nguồn cuộc họp đưa player tới mốc nằm trong khoảng thời gian của đoạn trích (sai số ≤ 1 giây), và không tự phát — với 100% trích dẫn trong bộ
  kiểm thử.
- **SC-006**: Sau khi nguồn cuộc họp `Sẵn sàng`, câu hỏi về nội dung đã nói trong cuộc họp nhận câu trả lời có trích dẫn trỏ về đúng đoạn transcript.
- **SC-007**: Trên máy mục tiêu yếu nhất được hỗ trợ (đo ở spike), transcript nháp xuất hiện trong vòng vài giây sau lời nói trong điều kiện bình thường; khi không theo
  kịp, trạng thái "Đang xử lý bản ghi" hiện ra và tồn đọng không tăng không giới hạn.
- **SC-008**: Chế độ `Tự động` hiển thị ngôn ngữ phát hiện trong vòng 45 giây kể từ khi bắt đầu có lời nói; không đổi ngôn ngữ khi chưa có gợi ý được người dùng chấp nhận.
- **SC-009**: Lỗi quyền micro, mất thiết bị, đĩa gần đầy và lỗi transcript đều cho ra một trạng thái có chữ giải thích và ít nhất một hành động phục hồi; không trường hợp
  nào làm mất audio đã ghi.
- **SC-010**: Ở chế độ local, không có kết nối mạng nào mang audio hay transcript ra ngoài trong suốt ghi, hoàn tất và xem lại (kiểm bằng theo dõi lưu lượng mạng).
- **SC-011**: Toàn bộ luồng ghi → tạm dừng → đánh dấu → kết thúc → mở trình xem làm được chỉ bằng bàn phím và được trình đọc màn hình đọc đúng các mốc trạng thái.
- **SC-012**: Hoàn tất một cuộc họp không làm một nguồn khác nạp cùng lúc phải chờ quá thời gian lập chỉ mục cuối của cuộc họp.

## Assumptions

- Kế thừa: engine nhận dạng tiếng nói cục bộ đã dùng cho nạp audio (045), cơ chế phát/tua audio (049), pipeline nguồn và locator thời gian, chỉ báo riêng tư 3 trạng
  thái (103), i18n (123), live region (091), migration append-only.
- Ràng buộc kỹ thuật đã chốt, áp vào plan (chi tiết ở `docs/04-decisions/2026-10-12-meeting-capture-clarify.md`): audio WAV PCM16 16 kHz mono, phân đoạn 5 phút, ghép thành
  một tệp khi hoàn tất (A1); nhận dạng nháp + chốt trong tiến trình riêng tách khỏi việc ghi tệp (A3); audio đi từ renderer sang main theo lô có số thứ tự, main kiểm
  định dạng/kích thước/tần suất — ngoại lệ có chủ đích của Constitution III (A4); quyền micro chỉ audio, có thời điểm cụ thể, khai báo cho macOS (A5); loại nguồn mới
  `meeting` + migration v12 với bảng phiên ghi, đánh dấu và đoạn thời gian transcript (A8, D3); không đổi tập trạng thái nguồn, nhãn lấy theo giai đoạn phiên ghi (A9);
  audio cuộc họp ở thư mục dữ liệu app, không đi qua giới hạn kích thước nạp tệp (C2, C3).
- **Spike là cổng**: PR A đo tần số mẫu 16 kHz trên Electron hiện dùng; trước PR B đo tốc độ nhận dạng của model nhỏ trên Mac Apple Silicon và một máy Windows chỉ CPU, và
  xác minh cách lấy ngôn ngữ phát hiện. Kết quả spike chọn model nháp; model chốt là model hiện có.
- Hỗ trợ macOS và Windows ngang nhau. Bản macOS chưa ký ở v1; khai báo quyền micro phải không hỏng khi bật ký sau này.
- Kiểm thử tự động dùng microphone giả và bộ nhận dạng giả chỉ trong bản chưa đóng gói; 120 phút thật là kiểm thử tay trước phát hành.
- Thiết bị đổi tần số mẫu được chuẩn hoá về 16 kHz trước khi ghi.

## Out of Scope

- Nhận diện/gán tên người nói; phát hiện tự động quyết định/việc cần làm; tóm tắt khi cuộc họp chưa kết thúc; thu âm nhiều micro/kênh hoặc audio hệ thống (toàn bộ Pha D).
- Đồng bộ cloud; cộng tác chỉnh sửa transcript; sửa nội dung transcript bằng tay.
- Tự phát audio khi mở trích dẫn (và tuỳ chọn bật nó).
- Phím tắt cấu hình được và phím tắt toàn cục (issue sau).
- Ghi nối tiếp vào một phiên cũ sau sự cố.
- Nhận dạng tiếng nói bằng AI online.
- Tính năng trình xem nâng cao (tô sáng đồng bộ, tìm trong transcript, xuất Markdown) cho nguồn audio/video thường.
- Ngôn ngữ ngoài Tiếng Việt và English trong giao diện chọn ngôn ngữ; ghi chú tự do cho đánh dấu; đưa đánh dấu vào chỉ mục.
