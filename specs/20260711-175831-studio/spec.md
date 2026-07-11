# Feature Specification: Studio (tổng hợp tri thức từ notebook)

**Feature Branch**: `021-studio`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: Cột thứ 3 của Workspace (Nguồn · Chat · Studio). Tạo nhanh 4 loại bản tổng hợp
(Tóm tắt · Ý chính · FAQ · Dàn ý) từ TOÀN BỘ nguồn notebook bằng LLM local, mỗi kết quả có chip trích dẫn
`[n]` kiểm chứng được, lưu lại và xem lại được. Pha 7 (D8).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Tạo bản tổng hợp có trích dẫn từ toàn bộ nguồn (Priority: P1)

Người dùng đã nạp một số nguồn vào notebook và muốn có cái nhìn tổng quan nhanh. Ở cột Studio, họ bấm một
nút "Tạo nhanh" (ví dụ **Tóm tắt tài liệu**). App đọc nội dung các nguồn đã lập chỉ mục, gọi LLM local để
tổng hợp, và hiển thị kết quả dạng card ngay trong cột Studio. Mỗi ý rút từ nguồn có chip trích dẫn `[n]`;
bấm chip mở Trình xem nguồn tới đúng đoạn được trích. Người dùng đọc bản tổng hợp và kiểm chứng từng ý về
nguồn gốc.

**Why this priority**: Đây là giá trị cốt lõi "tổng hợp tri thức" của sản phẩm và hoàn thiện vòng "kiểm
chứng được" cho luồng ngoài hỏi đáp. Một loại tổng hợp duy nhất chạy được end-to-end (sinh + hiển thị +
trích dẫn) đã là MVP có giá trị.

**Independent Test**: Với notebook có ≥1 nguồn đã sẵn sàng, bấm nút Tóm tắt → nhận nội dung tổng hợp có ít
nhất một chip `[n]` trỏ về một đoạn nguồn thật; bấm chip mở đúng nguồn + highlight.

**Acceptance Scenarios**:

1. **Given** notebook có ≥1 nguồn ở trạng thái sẵn sàng, **When** người dùng bấm nút "Tóm tắt tài liệu",
   **Then** trong vòng thời gian chờ hợp lý một card kết quả hiện ra với nội dung tổng hợp bằng tiếng Việt,
   kèm ít nhất một chip trích dẫn `[n]`.
2. **Given** một card kết quả đã có chip `[n]`, **When** người dùng bấm chip `[n]`, **Then** Trình xem nguồn
   mở đúng nguồn tương ứng và cuộn tới + highlight đoạn được trích dẫn (chunk thật).
3. **Given** LLM trả về nội dung có chèn `[n]` vượt ngoài số đoạn đã cấp cho nó, **When** hệ thống hậu kiểm,
   **Then** các chip vượt phạm vi bị gỡ và chỉ giữ lại các chip trỏ về đoạn nguồn thật.
4. **Given** LLM trả về nội dung nhưng không chèn chip nào hợp lệ, **When** hệ thống hậu kiểm, **Then** kết
   quả vẫn kèm danh sách các nguồn đã dùng làm ngữ cảnh (để người dùng kiểm chứng được), không hiển thị kết
   quả "trần" không nguồn.

---

### User Story 2 - Bốn loại tổng hợp khác nhau (Priority: P2)

Ngoài Tóm tắt, người dùng chọn được thêm **Ý chính** (danh sách điểm chính), **FAQ** (các cặp Hỏi–Đáp), và
**Dàn ý** (cấu trúc phân cấp) từ cùng bộ nguồn. Mỗi loại cho một góc nhìn khác nhau về cùng tài liệu.

**Why this priority**: Mở rộng giá trị nhưng phụ thuộc kiến trúc của US1 (chỉ khác câu lệnh hướng dẫn LLM);
làm sau khi luồng lõi chạy.

**Independent Test**: Với notebook có nguồn sẵn sàng, mỗi trong bốn nút tạo ra một card đúng phong cách của
loại đó (danh sách ý chính / cặp Hỏi–Đáp / dàn ý phân cấp), độc lập với nhau.

**Acceptance Scenarios**:

1. **Given** notebook có nguồn sẵn sàng, **When** người dùng bấm lần lượt bốn nút, **Then** mỗi loại tạo ra
   một card riêng, cùng tồn tại, mỗi card mang nhãn loại tương ứng.
2. **Given** đã có card của cả bốn loại, **When** người dùng bấm lại một nút bất kỳ, **Then** chỉ card cùng
   loại được thay bằng kết quả mới, ba card kia giữ nguyên.

---

### User Story 3 - Lưu và xem lại kết quả (Priority: P2)

Kết quả Studio được lưu theo notebook. Người dùng đóng notebook rồi mở lại vẫn thấy các card đã tạo trước
đó, không phải sinh lại.

**Why this priority**: Sinh bằng LLM local tốn thời gian; lưu lại giúp kết quả bền vững và tránh chờ lặp
lại. Phụ thuộc US1 nên ưu tiên sau lõi.

**Independent Test**: Tạo một kết quả, đóng notebook (hoặc khởi động lại app), mở lại cùng notebook → card
cũ hiển thị nguyên vẹn kèm chip trích dẫn còn bấm được.

**Acceptance Scenarios**:

1. **Given** người dùng đã tạo một kết quả Studio trong notebook A, **When** họ chuyển sang notebook khác
   rồi quay lại notebook A, **Then** kết quả cũ vẫn hiển thị.
2. **Given** một notebook có kết quả Studio, **When** notebook đó bị xoá, **Then** mọi kết quả Studio thuộc
   notebook đó cũng bị xoá theo (không còn dữ liệu mồ côi).
3. **Given** người dùng bấm lại nút cùng loại (tạo mới), **When** kết quả mới được lưu, **Then** kết quả cũ
   cùng loại bị thay thế (mỗi loại giữ đúng một bản mới nhất mỗi notebook).

---

### Edge Cases

- **Notebook rỗng / chưa có nguồn sẵn sàng**: các nút "Tạo nhanh" bị vô hiệu, kèm gợi ý "Nạp nguồn để tạo
  Studio". Không cho gọi khi không có gì để tổng hợp.
- **Model AI chưa sẵn sàng** (chưa chọn model / Ollama không chạy): cột Studio hiện chỉ báo trạng thái + vô
  hiệu nút; nếu vẫn kích hoạt được thì thao tác trả về thông báo lỗi thân thiện, không sinh nội dung bịa.
- **Notebook rất lớn vượt ngân sách ngữ cảnh**: chỉ tổng hợp phần đầu tài liệu (theo thứ tự nạp); card kèm
  ghi chú "dựa trên phần đầu tài liệu" khi không đưa được toàn bộ nội dung vào.
- **LLM lỗi / quá thời gian chờ**: hiển thị lỗi trên card/nút, không lưu kết quả rỗng; người dùng thử lại
  được.
- **Đang tạo**: nút/card hiện trạng thái "Đang tạo…"; tránh bấm chồng nhiều lần cùng loại.
- **Nguồn bị xoá sau khi đã tạo**: chip trích dẫn trỏ nguồn không còn tồn tại → khi bấm, Trình xem nguồn báo
  "Nguồn không còn tồn tại" (hành vi kế thừa 019).
- **Nội dung tài liệu không bao giờ ghi log** (kể cả khi lỗi).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Cột Studio trong Workspace MUST cung cấp bốn hành động "Tạo nhanh": Tóm tắt tài liệu, Ý chính,
  FAQ (Hỏi–Đáp), Dàn ý.
- **FR-002**: Khi người dùng kích hoạt một hành động, hệ thống MUST tổng hợp nội dung từ các nguồn đã lập
  chỉ mục trong notebook hiện tại bằng mô hình ngôn ngữ chạy cục bộ, không gửi dữ liệu ra Internet.
- **FR-003**: Hệ thống MUST gom nội dung từ TẤT CẢ nguồn sẵn sàng trong notebook (theo thứ tự nạp) đến một
  hạn mức ngữ cảnh; khi vượt hạn mức, phần dôi ra bị loại và kết quả kèm ghi chú cho người dùng biết chỉ
  dựa trên phần đầu tài liệu.
- **FR-004**: Mỗi kết quả MUST kèm chip trích dẫn `[n]` chỉ về các đoạn nguồn thật đã đưa vào ngữ cảnh; hệ
  thống MUST gỡ mọi chip `[n]` nằm ngoài phạm vi các đoạn đã cấp (hậu kiểm — Constitution II).
- **FR-005**: Nếu kết quả không chứa chip hợp lệ nào nhưng có nội dung, hệ thống MUST đính kèm danh sách các
  nguồn đã dùng làm ngữ cảnh để kết quả vẫn kiểm chứng được (không có kết quả "không nguồn").
- **FR-006**: Bấm chip `[n]` trên kết quả Studio MUST mở Trình xem nguồn tới đúng nguồn + đoạn được trích
  dẫn (tái dùng luồng của 019).
- **FR-007**: Hệ thống MUST lưu kết quả Studio theo notebook để người dùng xem lại sau khi đóng/mở lại
  notebook hoặc khởi động lại ứng dụng.
- **FR-008**: Mỗi notebook MUST giữ nhiều nhất một kết quả mới nhất cho mỗi loại; tạo lại cùng loại MUST
  thay thế bản cũ cùng loại (không tích luỹ lịch sử ở MVP).
- **FR-009**: Khi một notebook bị xoá, hệ thống MUST xoá theo mọi kết quả Studio thuộc notebook đó.
- **FR-010**: Khi notebook không có nguồn nào ở trạng thái sẵn sàng, các nút "Tạo nhanh" MUST bị vô hiệu kèm
  gợi ý người dùng nạp nguồn trước.
- **FR-011**: Khi mô hình AI chưa sẵn sàng, cột Studio MUST hiển thị trạng thái đó và không cho phép sinh
  nội dung; nếu thao tác vẫn xảy ra khi runtime lỗi, hệ thống MUST trả thông báo lỗi thân thiện, không bịa
  nội dung.
- **FR-012**: Trong lúc đang sinh, giao diện MUST hiển thị trạng thái "đang tạo" cho loại tương ứng.
- **FR-013**: Việc đọc nội dung nguồn và gọi mô hình MUST chỉ diễn ra ở tiến trình chính; giao diện chỉ trao
  đổi qua kênh liên lạc được cấp phép (whitelisted), không truy cập trực tiếp tệp/CSDL/mô hình
  (Constitution III).
- **FR-014**: Hệ thống MUST KHÔNG BAO GIỜ ghi log nội dung tài liệu hay nội dung kết quả (kể cả khi lỗi).
- **FR-015**: Kết quả hiển thị dạng văn bản kèm chip trích dẫn; giao diện MUST render an toàn (không chèn
  HTML thô từ nội dung do mô hình sinh ra).

### Key Entities _(include if feature involves data)_

- **Kết quả Studio (StudioResult)**: một bản tổng hợp đã sinh cho một notebook. Thuộc tính: loại (một trong
  bốn: tóm tắt / ý chính / FAQ / dàn ý), nội dung văn bản, danh sách trích dẫn kèm theo, mốc thời gian tạo.
  Quan hệ: thuộc về đúng một notebook; mỗi cặp (notebook, loại) duy nhất một bản.
- **Trích dẫn (Citation)** _(tái dùng 013)_: `[n]` gắn với một đoạn nguồn thật (chunk) và vị trí trong nguồn
  để mở Trình xem nguồn.
- **Đoạn nguồn (Chunk)** _(tái dùng 011)_: đơn vị nội dung đã tách + có vị trí; là nguyên liệu ngữ cảnh cho
  việc tổng hợp và là đích của trích dẫn.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Với notebook có nguồn sẵn sàng, người dùng tạo được một bản tổng hợp bằng đúng một thao tác
  (một cú bấm) mà không cần cấu hình thêm.
- **SC-002**: 100% chip trích dẫn hiển thị trên kết quả Studio trỏ về một đoạn nguồn thật có trong ngữ cảnh
  đã cấp cho mô hình (không có chip "chết"/ngoài phạm vi sau hậu kiểm).
- **SC-003**: 100% kết quả có nội dung đều kèm ít nhất một nguồn kiểm chứng được (chip hoặc danh sách nguồn
  đã dùng); không có kết quả nào hiển thị mà không truy được về nguồn.
- **SC-004**: Kết quả đã tạo vẫn hiển thị đầy đủ sau khi đóng và mở lại notebook (hoặc khởi động lại ứng
  dụng), với chip trích dẫn còn bấm mở nguồn được.
- **SC-005**: Ở chế độ mặc định (chưa bật nhà cung cấp AI online), việc tạo bản tổng hợp không phát sinh bất
  kỳ lưu lượng mạng ra ngoài nào.
- **SC-006**: Khi notebook chưa có nguồn sẵn sàng hoặc mô hình chưa sẵn sàng, người dùng không thể kích hoạt
  việc tạo và được chỉ dẫn bước cần làm trước.

## Assumptions

- **A1 — Bốn loại**: phạm vi gồm cả bốn loại (tóm tắt / ý chính / FAQ / dàn ý); chúng khác nhau chủ yếu ở
  câu lệnh hướng dẫn mô hình, chung kiến trúc.
- **A2 — Ngữ cảnh toàn notebook theo hạn mức**: gom đoạn nguồn của mọi nguồn sẵn sàng theo thứ tự nạp đến
  một hạn mức ký tự (~8000), một lượt gọi mô hình; không dùng chiến lược nhiều lượt (map-reduce) ở MVP. Ghi
  ở `docs/04-decisions/2026-07-11-studio-context-strategy.md`.
- **A3 — Trích dẫn tái dùng hậu kiểm 013**: đánh số đoạn nguồn `[1..k]` khi dựng ngữ cảnh, sau khi mô hình
  trả lời thì hậu kiểm chip; 0 chip hợp lệ → gắn danh sách nguồn đã dùng (hành vi tương tự hỏi đáp có
  nguồn).
- **A4 — Lưu trữ cục bộ**: kết quả lưu bền vững theo notebook, ràng buộc "một bản mới nhất mỗi loại mỗi
  notebook", xoá theo khi notebook bị xoá. Ghi ở `docs/04-decisions/2026-07-11-studio-clarify.md`.
- **A5 — Tạo lại ghi đè**: bấm lại cùng loại thay thế bản cũ, không hỏi xác nhận (rẻ để tạo lại, đã lưu).
- **A6 — Vô hiệu khi chưa sẵn sàng**: nút bị vô hiệu khi notebook rỗng/chưa có nguồn sẵn sàng hoặc khi mô
  hình chưa sẵn sàng (tái dùng trạng thái runtime của 007).
- **A7 — Đầu ra dạng văn bản**: kết quả là văn bản kèm chip `[n]` (không dựng cấu trúc dữ liệu phức tạp
  riêng cho FAQ/Dàn ý ở MVP), render an toàn không HTML thô.
- **A8 — Giới hạn**: hạn mức ngữ cảnh chặn kích thước đầu vào; một lượt gọi mô hình (dùng ngưỡng thời gian
  chờ đã có cho hội thoại); không có thanh tiến trình.
- **A9 — Kế thừa**: tái dùng dữ liệu nguồn/đoạn (011), kiểu Trích dẫn/Vị trí (013), nhà cung cấp mô hình +
  trạng thái runtime (007), luồng dựng ngữ cảnh + hậu kiểm trích dẫn (013), Trình xem nguồn (019). KHÔNG sửa
  quy trình nạp nguồn (011) hay kiểu Trích dẫn/Vị trí (013); chỉ THÊM lưu trữ mới + kênh/giao diện mới.
- **A10 — Ngôn ngữ**: nội dung do mô hình sinh bằng tiếng Việt (khớp UI + tài liệu nguồn tiếng Việt); i18n
  để pha sau.

## Out of Scope

- Chiến lược nhiều lượt (map-reduce) cho notebook rất lớn (pha sau nếu cần bao phủ toàn bộ).
- Cấu trúc dữ liệu phức tạp riêng cho FAQ/Dàn ý (JSON phân cấp) và trình render markdown.
- Xuất/chia sẻ kết quả; chỉnh sửa thủ công nội dung kết quả; ghim; lưu nhiều bản lịch sử mỗi loại.
- Sửa quy trình nạp nguồn (011) hoặc kiểu Trích dẫn/Vị trí (013).
