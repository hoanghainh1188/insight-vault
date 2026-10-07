# Feature Specification: Giao diện đa ngôn ngữ (Tiếng Việt + English), AI trả lời theo ngôn ngữ câu hỏi

**Feature Branch**: `123-i18n`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Giao diện đa ngôn ngữ (Tiếng Việt + English) cho InsightVault, AI trả lời theo ngôn ngữ câu
hỏi (issue #123; nguồn: `docs/intake/123-i18n.md`). Lần đầu theo hệ điều hành, Cài đặt › Ngôn ngữ (Tự động / Tiếng Việt /
English) áp dụng ngay; Chat trả lời theo ngôn ngữ câu hỏi, Studio theo ngôn ngữ giao diện; nhãn lỗi nguồn và câu 'không
tìm thấy' đã lưu hiển thị theo ngôn ngữ hiện tại; nội dung LLM đã sinh giữ nguyên; giữ local-first và kiểm chứng được."

## Bối cảnh (issue #123, khảo sát 2026-10-08)

- Hạn chế đã biết ⑦: mọi chuỗi giao diện viết cứng tiếng Việt ở cả tầng xử lý nền lẫn giao diện (đếm heuristic ~250 chuỗi
  ở 48 tệp giao diện + ~185 chuỗi ở 47 tệp tầng nền: nhãn, thông báo lỗi/tiến độ, thông báo cho trình đọc màn hình, hộp
  thoại hệ thống, báo lỗi soạn sẵn, lời nhắc cho mô hình). Repo đã hướng tới người dùng quốc tế từ #117 (README tiếng Anh).
- Một số văn bản tiếng Việt **đã được lưu bền**: nhãn lỗi của nguồn và câu "Không tìm thấy trong nguồn" trong lịch sử chat
  (câu này đã có cờ "không tìm thấy" đi kèm).
- Nhận diện "không tìm thấy" (108) **đã không phụ thuộc ngôn ngữ**: dựa vào cấu trúc (chế độ Theo nguồn không còn trích
  dẫn `[n]` hợp lệ nào ⇒ không tìm thấy), không so khớp văn bản. Chỉ câu hiển thị là văn bản tiếng Việt.

## Quyết định người dùng (2026-10-08) — không hỏi lại

1. Hỗ trợ **Tiếng Việt + English**; khung cho phép thêm ngôn ngữ bằng một tệp dịch.
2. Lần đầu theo **hệ điều hành** (máy đặt tiếng Việt ⇒ Tiếng Việt, còn lại ⇒ English); Cài đặt có mục **Ngôn ngữ** (Tự
   động / Tiếng Việt / English); đổi là **áp dụng ngay**, không khởi động lại.
3. Chat trả lời **theo ngôn ngữ câu hỏi**; Studio **theo ngôn ngữ giao diện** lúc tạo; lời nhắc hệ thống viết lại không phụ
   thuộc tiếng Việt; "không tìm thấy" giữ cơ chế không phụ thuộc ngôn ngữ; kiểm hồi quy bằng bộ đánh giá 108.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Người dùng không nói tiếng Việt dùng được app ngay lần đầu (Priority: P1)

Một nhà nghiên cứu ở Đức tải InsightVault về máy đặt ngôn ngữ English/Deutsch. Lần đầu mở app, toàn bộ giao diện —
màn chào, danh sách notebook, thêm nguồn, chat, Studio, Cài đặt, thông báo lỗi, hộp thoại chọn/lưu tệp — hiện bằng
English; họ hoàn thành luồng chính (tạo notebook → thêm PDF → hỏi → bấm `[n]` mở nguồn) mà không gặp chữ tiếng Việt nào
ngoài nội dung tài liệu của chính họ. Người dùng ở Việt Nam (máy đặt tiếng Việt) vẫn thấy giao diện tiếng Việt như cũ.

**Why this priority**: Đây là giá trị cốt lõi — mở app cho người dùng quốc tế; không có nó các phần khác vô nghĩa.

**Independent Test**: Chạy app với ngôn ngữ hệ điều hành English trên vault trống, đi hết luồng chính; quét mọi màn hình,
thông báo và hộp thoại xuất hiện ⇒ không có chuỗi giao diện tiếng Việt. Lặp lại với ngôn ngữ hệ điều hành tiếng Việt ⇒
giao diện tiếng Việt, giống bản hiện tại.

**Acceptance Scenarios**:

1. **Given** máy đặt ngôn ngữ không phải tiếng Việt và app chưa từng chọn ngôn ngữ, **When** mở app lần đầu, **Then** mọi
   chuỗi giao diện hiện bằng English.
2. **Given** máy đặt tiếng Việt (bất kỳ biến thể vùng nào), **When** mở app lần đầu, **Then** giao diện tiếng Việt.
3. **Given** giao diện English, **When** một thao tác lỗi (vd thêm tệp không hỗ trợ, nguồn xử lý lỗi, sao lưu khi đang
   bận), **Then** thông báo lỗi hiện bằng English.
4. **Given** giao diện English, **When** mở hộp thoại hệ thống của app (chọn tệp sao lưu, khôi phục, chọn lại tệp gốc,
   xuất Studio), **Then** tiêu đề và tên bộ lọc tệp bằng English.
5. **Given** giao diện English, **When** dùng trình đọc màn hình, **Then** các thông báo trạng thái (tiến độ nạp nguồn,
   câu trả lời xong, sao lưu xong…) được đọc bằng English và trang khai báo đúng ngôn ngữ cho công nghệ hỗ trợ.

---

### User Story 2 - Đổi ngôn ngữ trong Cài đặt, áp dụng ngay cho mọi thứ (Priority: P1)

Một người dùng song ngữ đang dùng giao diện English muốn chuyển sang tiếng Việt cho đồng nghiệp xem. Họ vào Cài đặt ›
Ngôn ngữ, chọn "Tiếng Việt": giao diện đổi ngay, không khởi động lại, không mất câu hỏi đang gõ hay notebook đang mở;
nhãn lỗi của các nguồn cũ, câu "không tìm thấy" trong lịch sử chat cũ và chỉ báo riêng tư cũng đổi theo. Chọn "Tự động"
thì quay lại theo hệ điều hành. Lựa chọn được giữ cho lần mở sau.

**Why this priority**: Không đổi được thì người dùng bị khoá vào đoán của hệ điều hành; áp dụng ngay là quyết định đã chốt.

**Independent Test**: Có vault với nguồn lỗi và lịch sử chat chứa câu "không tìm thấy" tạo từ bản cũ; đổi ngôn ngữ qua
lại ⇒ mọi chuỗi giao diện, nhãn lỗi cũ, câu "không tìm thấy" cũ, chỉ báo riêng tư đổi ngay; khởi động lại ⇒ giữ lựa chọn.

**Acceptance Scenarios**:

1. **Given** giao diện English, **When** chọn "Tiếng Việt" trong Cài đặt, **Then** toàn bộ giao diện đang hiển thị chuyển
   sang tiếng Việt trong vòng 1 giây mà không tải lại cửa sổ, không mất trạng thái đang nhập/đang mở.
2. **Given** một nguồn bị lỗi từ trước khi nâng cấp (nhãn lỗi lưu bằng tiếng Việt), **When** giao diện English, **Then**
   nhãn lỗi hiện bằng English; đổi về tiếng Việt ⇒ hiện lại tiếng Việt.
3. **Given** lịch sử chat có câu "Không tìm thấy trong nguồn" từ trước khi nâng cấp, **When** giao diện English, **Then**
   câu đó và gợi ý đi kèm hiện bằng English; các câu trả lời thường do AI sinh giữ nguyên văn bản gốc.
4. **Given** đang dùng AI online (chỉ báo riêng tư "đang gửi ra ngoài"), **When** đổi ngôn ngữ, **Then** chỉ báo riêng tư
   hiện nhãn ngôn ngữ mới và vẫn phản ánh đúng trạng thái hiện tại.
5. **Given** đã chọn "English" rồi khởi động lại app, **When** mở lại, **Then** giao diện English dù hệ điều hành tiếng
   Việt; chọn "Tự động" ⇒ theo hệ điều hành.
6. **Given** đang có thao tác dài chạy (nạp nguồn, xử lý lại, Studio, sao lưu), **When** đổi ngôn ngữ, **Then** thao tác
   không bị gián đoạn và các thông báo tiến độ tiếp theo dùng ngôn ngữ mới.

---

### User Story 3 - Hỏi bằng ngôn ngữ nào, AI trả lời bằng ngôn ngữ đó, vẫn kiểm chứng được (Priority: P2)

Một nhà báo quốc tế nạp báo cáo tiếng Việt rồi hỏi bằng tiếng Anh: câu trả lời bằng tiếng Anh, có chip `[n]` mở đúng
đoạn nguồn tiếng Việt. Người dùng Việt hỏi bằng tiếng Việt về tài liệu tiếng Anh ⇒ trả lời tiếng Việt. Khi tài liệu không
chứa câu trả lời, chế độ Theo nguồn vẫn từ chối ("không tìm thấy" + gợi ý) bằng ngôn ngữ giao diện, không bịa.

**Why this priority**: Câu trả lời sai ngôn ngữ làm hỏng trải nghiệm quốc tế, nhưng giao diện (P1) phải có trước; ràng
buộc "không bịa" phải được giữ khi viết lại lời nhắc.

**Independent Test**: Với bộ câu hỏi đánh giá có câu hỏi tiếng Việt và tiếng Anh (cả câu có và không có đáp án) trên
nguồn tiếng Việt: kiểm ngôn ngữ câu trả lời khớp ngôn ngữ câu hỏi, tỉ lệ trả lời có `[n]` hợp lệ và tỉ lệ từ chối đúng
không kém bản trước khi viết lại lời nhắc; số liệu truy xuất của bộ đánh giá 108 không đổi.

**Acceptance Scenarios**:

1. **Given** nguồn tiếng Việt, **When** hỏi bằng tiếng Anh ở chế độ Theo nguồn, **Then** câu trả lời bằng tiếng Anh, mỗi
   ý lấy từ nguồn có `[n]` mở đúng đoạn tiếng Việt được tô sáng.
2. **Given** nguồn bất kỳ, **When** hỏi bằng tiếng Việt, **Then** trả lời bằng tiếng Việt (kể cả khi giao diện English).
3. **Given** chế độ Theo nguồn và câu hỏi không có đáp án trong nguồn, **When** hỏi bằng bất kỳ ngôn ngữ nào, **Then** hiện
   "không tìm thấy" + gợi ý **bằng ngôn ngữ giao diện**, không có nội dung bịa.
4. **Given** chế độ Mở rộng, **When** câu trả lời dùng kiến thức ngoài nguồn, **Then** phần đó vẫn được đánh dấu là ngoài
   nguồn bằng ngôn ngữ của câu trả lời, và nhãn giao diện "Mở rộng · có thể ngoài nguồn" theo ngôn ngữ giao diện.
5. **Given** câu hỏi nối tiếp có đại từ (cần viết lại câu hỏi từ lịch sử), **When** hỏi bằng tiếng Anh, **Then** câu hỏi
   viết lại vẫn bằng tiếng Anh và truy xuất không xấu đi so với hỏi trực tiếp.

---

### User Story 4 - Studio tạo nội dung theo ngôn ngữ giao diện, nội dung cũ giữ nguyên (Priority: P3)

Người dùng giao diện English bấm "Summary" cho notebook toàn tài liệu tiếng Việt ⇒ bản tóm tắt bằng English, có `[n]`
đúng. Các kết quả Studio đã tạo trước đó bằng tiếng Việt vẫn hiển thị nguyên văn; tạo lại thì theo ngôn ngữ hiện tại.
Tên tệp xuất Markdown dùng tên loại theo ngôn ngữ giao diện và ngày dạng ổn định.

**Why this priority**: Studio dùng ít hơn Chat và không có câu hỏi để suy ngôn ngữ; quy tắc đơn giản là đủ.

**Independent Test**: Giao diện English, tạo 4 loại Studio trên nguồn tiếng Việt ⇒ nội dung English, `[n]` hợp lệ; kết
quả cũ tiếng Việt không đổi; xuất tệp ⇒ tên tệp English + ngày ổn định.

**Acceptance Scenarios**:

1. **Given** giao diện English, **When** tạo Tóm tắt / Ý chính / FAQ / Dàn ý, **Then** nội dung bằng English, có trích
   dẫn `[n]` hợp lệ như hiện nay.
2. **Given** kết quả Studio cũ bằng tiếng Việt, **When** giao diện English, **Then** nội dung cũ hiển thị nguyên văn (chỉ
   khung, nút, nhãn quanh nó theo English).
3. **Given** giao diện bất kỳ, **When** xuất kết quả Studio, **Then** tên tệp gợi ý dùng tên loại theo ngôn ngữ giao diện
   và ngày dạng năm-tháng-ngày không phụ thuộc ngôn ngữ.

---

### User Story 5 - Ngày, giờ, số, dung lượng hiển thị theo ngôn ngữ (Priority: P3)

Người dùng English thấy ngày giờ, số, dung lượng tệp và thời gian tương đối ("3 minutes ago") theo quy ước English;
người dùng tiếng Việt thấy như hiện nay ("3 phút trước").

**Why this priority**: Chi tiết hoàn thiện; ít chỗ viết cứng.

**Independent Test**: Đổi ngôn ngữ ⇒ các vị trí hiển thị ngày/giờ/số/dung lượng/thời gian tương đối đổi quy ước tương ứng.

**Acceptance Scenarios**:

1. **Given** giao diện English, **When** xem thời điểm tạo notebook, thông tin bản sao lưu, dung lượng lưu trữ, **Then**
   định dạng theo English.
2. **Given** giao diện tiếng Việt, **When** xem các vị trí trên, **Then** định dạng như hiện nay.

---

### Edge Cases

- Hệ điều hành báo ngôn ngữ trống/không xác định hoặc danh sách ngôn ngữ ưu tiên rỗng ⇒ English.
- Hệ điều hành đặt tiếng Việt nhưng ở biến thể vùng lạ (vd `vi-VN`, `vi`) ⇒ Tiếng Việt.
- Giá trị lựa chọn ngôn ngữ đã lưu bị hỏng/không hợp lệ (sửa tay tệp cấu hình) ⇒ coi như "Tự động", không làm app lỗi.
- App gặp lỗi khởi động trước khi cài đặt sẵn sàng (thư mục dữ liệu hỏng, cập nhật cấu trúc dữ liệu lỗi) ⇒ hộp thoại lỗi
  khởi động theo ngôn ngữ hệ điều hành.
- Đổi ngôn ngữ khi đang stream câu trả lời ⇒ câu trả lời tiếp tục bằng ngôn ngữ của câu hỏi; chỉ giao diện quanh nó đổi.
- Nhãn lỗi đã lưu không thuộc tập nhãn đã biết (phiên bản lạ, sửa tay) ⇒ hiển thị nhãn lỗi chung theo ngôn ngữ hiện tại,
  không hiển thị văn bản thô lạ và không làm hỏng danh sách nguồn.
- Câu hỏi trộn hai ngôn ngữ hoặc quá ngắn để xác định ngôn ngữ (vd chỉ một mã số, một tên riêng) ⇒ trả lời theo ngôn ngữ
  mô hình tự chọn hợp lý nhất; không bắt buộc, không ép dịch lại (mô hình cục bộ nhỏ có thể không tuân thủ hoàn hảo).
- Chuỗi English dài hơn tiếng Việt ⇒ không tràn/cắt chữ ở nút, cột, hộp thoại ở kích thước cửa sổ mặc định và nhỏ nhất.
- Khôi phục bản sao lưu từ máy khác ⇒ lựa chọn ngôn ngữ của máy hiện tại được giữ (ngôn ngữ là tuỳ chọn của máy, không
  theo dữ liệu vault).
- Báo lỗi soạn sẵn gửi cho nhà phát triển ⇒ phần khung kỹ thuật dễ đọc với nhà phát triển bất kể ngôn ngữ giao diện; phần
  người dùng đọc trước khi gửi theo ngôn ngữ giao diện.

## Requirements _(mandatory)_

### Functional Requirements

**Chọn và áp dụng ngôn ngữ**

- **FR-001**: Hệ thống MUST hỗ trợ hai ngôn ngữ giao diện: Tiếng Việt và English. Thêm một ngôn ngữ mới MUST chỉ cần
  thêm một tệp dịch (không sửa logic ở nhiều nơi).
- **FR-002**: Khi người dùng chưa chọn ngôn ngữ (hoặc chọn "Tự động"), hệ thống MUST lấy ngôn ngữ theo hệ điều hành: ngôn
  ngữ ưu tiên là tiếng Việt (mọi biến thể vùng) ⇒ Tiếng Việt; mọi trường hợp khác (kể cả không xác định) ⇒ English.
- **FR-003**: Cài đặt MUST có mục **Ngôn ngữ** với ba lựa chọn **Tự động / Tiếng Việt / English**; tên mỗi ngôn ngữ hiển
  thị bằng chính ngôn ngữ đó để người không đọc được ngôn ngữ hiện tại vẫn tìm ra.
- **FR-004**: Đổi ngôn ngữ MUST áp dụng ngay cho toàn bộ giao diện đang mở — kể cả chuỗi do tầng nền sinh (nhãn lỗi nguồn,
  nhãn chỉ báo riêng tư, thông báo tiến độ) và thông báo cho trình đọc màn hình — không khởi động lại, không tải lại cửa
  sổ, không mất trạng thái đang nhập/đang mở, không gián đoạn thao tác đang chạy.
- **FR-005**: Lựa chọn ngôn ngữ MUST được lưu bền trên máy và áp dụng ở lần mở sau. Giá trị đã lưu không hợp lệ MUST được
  coi là "Tự động". Lựa chọn ngôn ngữ là tuỳ chọn của máy và KHÔNG đi theo bản sao lưu/khôi phục vault.
- **FR-006**: Tài liệu giao diện MUST khai báo ngôn ngữ hiện tại cho công nghệ hỗ trợ (trình đọc màn hình) và cập nhật khi
  đổi ngôn ngữ.
- **FR-007**: Kênh giao tiếp mới để đọc/đặt ngôn ngữ và nhận sự kiện đổi ngôn ngữ MUST nằm trong danh sách cho phép của
  cầu nối giao diện–tầng nền; thao tác đặt MUST chỉ nhận một trong ba giá trị `auto` / `vi` / `en` và được tầng nền kiểm
  lại, giá trị khác bị từ chối.

**Phạm vi chuỗi**

- **FR-008**: Mọi chuỗi người dùng nhìn thấy hoặc nghe thấy MUST đi qua khung dịch: nhãn/nút/tiêu đề/gợi ý/trạng thái
  trống của mọi màn; thông báo lỗi và tiến độ (kể cả lỗi từ tầng nền hiển thị cho người dùng); thông báo cho trình đọc màn
  hình; hộp thoại hệ thống do app mở (lỗi khởi động, chọn/lưu tệp sao lưu, khôi phục, chọn lại tệp gốc, xuất Studio — tiêu
  đề và tên bộ lọc tệp); hộp thoại và văn bản báo lỗi soạn sẵn; chỉ báo riêng tư; nhãn lỗi nguồn.
- **FR-009**: Bản dịch English MUST đầy đủ cho mọi chuỗi ở FR-008 và dùng thuật ngữ chuẩn ở cột English của glossary dự
  án. Bản tiếng Việt MUST giữ nguyên văn phong và nội dung hiện tại (không đổi chữ khi không cần).
- **FR-010**: Thiếu bản dịch cho một khoá ở bất kỳ ngôn ngữ nào, hoặc tham số chèn vào chuỗi không khớp giữa các ngôn ngữ,
  MUST bị phát hiện tự động trước khi phát hành (kiểm tra tự động thất bại).
- **FR-011**: Chuỗi tiếng Việt viết cứng hiển thị cho người dùng nằm ngoài tệp dịch MUST bị phát hiện tự động (kiểm tra
  tự động thất bại); ghi chú mã nguồn, tên sự kiện nhật ký, mã kỹ thuật, dữ liệu kiểm thử và nội dung gửi cho mô hình được
  miễn theo danh sách rõ ràng.
- **FR-012**: Tên sự kiện nhật ký, mã lỗi kỹ thuật và nội dung tệp nhật ký MUST giữ nguyên, không dịch. Lỗi lập trình nội
  bộ không bao giờ hiển thị cho người dùng thì không cần dịch.
- **FR-013**: Tên ứng dụng "InsightVault" MUST giữ nguyên ở mọi ngôn ngữ.

**Dữ liệu đã lưu**

- **FR-014**: Nhãn lỗi của nguồn MUST được lưu và truyền dưới dạng **mã** (kèm tham số nếu cần) và được dịch khi hiển thị
  theo ngôn ngữ hiện tại; nhãn lỗi đã lưu bằng văn bản tiếng Việt từ bản cũ MUST hiển thị đúng ngôn ngữ hiện tại sau nâng
  cấp; nhãn không nhận ra MUST hiển thị nhãn lỗi chung. Logic xử lý (vd phân biệt "tệp gốc đã bị sửa") MUST dựa trên mã,
  không dựa trên so sánh văn bản.
- **FR-015**: Câu "không tìm thấy" + gợi ý trong lịch sử chat (cũ và mới) MUST hiển thị theo ngôn ngữ giao diện hiện tại,
  dựa trên cờ "không tìm thấy" đã lưu kèm tin nhắn, không dựa trên văn bản đã lưu.
- **FR-016**: Nội dung do mô hình đã sinh (câu trả lời chat, kết quả Studio) và tiêu đề nguồn MUST giữ nguyên văn bản gốc,
  không dịch lại. Thông báo tạm thời không lưu (vd "đang tái lập chỉ mục") MUST hiển thị theo ngôn ngữ hiện tại.

**Ngôn ngữ câu trả lời của AI**

- **FR-017**: Chat MUST trả lời bằng ngôn ngữ của câu hỏi hiện tại (tiếng Việt hoặc English), độc lập với ngôn ngữ giao
  diện và ngôn ngữ của nguồn; đây là mục tiêu chất lượng "cố gắng tốt nhất" với mô hình cục bộ, không có bước dịch lại hậu
  kiểm.
- **FR-018**: Studio MUST tạo nội dung bằng ngôn ngữ giao diện tại thời điểm bấm tạo.
- **FR-019**: Các lời nhắc hệ thống (hỏi đáp Theo nguồn, Mở rộng, Studio, viết lại câu hỏi nối tiếp) MUST được viết lại
  để không mặc định tiếng Việt; viết lại câu hỏi nối tiếp MUST giữ ngôn ngữ của câu hỏi gốc.
- **FR-020**: Nguyên tắc "không bịa" MUST giữ nguyên ở mọi ngôn ngữ: chế độ Theo nguồn không còn trích dẫn `[n]` hợp lệ
  nào (hoặc truy xuất rỗng) ⇒ "không tìm thấy" + gợi ý; nhận diện MUST không phụ thuộc văn bản/ngôn ngữ do mô hình sinh.
- **FR-021**: Trích dẫn `[n]` → đoạn nguồn → vị trí gốc và bước hậu kiểm trích dẫn MUST không đổi; không dịch hay viết lại
  nội dung nguồn hoặc văn bản đoạn nguồn gửi cho mô hình.
- **FR-022**: Nhận dạng chữ trong ảnh và bóc băng audio/video MUST không đổi theo ngôn ngữ giao diện.

**Định dạng**

- **FR-023**: Ngày, giờ, số, dung lượng tệp và thời gian tương đối MUST hiển thị theo quy ước của ngôn ngữ giao diện hiện
  tại. Ngày trong tên tệp xuất MUST giữ dạng năm-tháng-ngày ổn định, không theo ngôn ngữ.

**Local-first & bảo mật**

- **FR-024**: Toàn bộ dữ liệu dịch MUST đóng gói cùng app; KHÔNG tải gói ngôn ngữ, font hay dữ liệu dịch từ mạng; KHÔNG gửi
  thông tin ngôn ngữ đi đâu (không telemetry).
- **FR-025**: Tham số chèn vào chuỗi dịch (tên notebook, tên tệp, thông báo lỗi…) MUST được hiển thị như văn bản thuần,
  không bao giờ được diễn giải thành mã/HTML.

**Kiểm thử**

- **FR-026**: Các kiểm thử tự động hiện có dựa vào chuỗi tiếng Việt MUST được cập nhật có chủ đích (cố định ngôn ngữ hoặc
  tham chiếu khoá dịch); MUST có ít nhất một kịch bản đầu-cuối chạy app bằng English và một kịch bản đổi ngôn ngữ trong Cài
  đặt rồi kiểm giao diện đổi ngay.
- **FR-027**: Hồi quy truy xuất của bộ đánh giá 108 MUST không đổi số liệu; tác động của lời nhắc mới lên tuân thủ `[n]`,
  tỉ lệ từ chối đúng và ngôn ngữ câu trả lời MUST được đo trên câu hỏi tiếng Việt và English (cách đo chốt ở clarify) và ghi
  kết quả vào quyết định.

### Key Entities _(include if feature involves data)_

- **Lựa chọn ngôn ngữ (UI language preference)**: giá trị `auto` / `vi` / `en` lưu trên máy; mặc định `auto`; không thuộc
  dữ liệu vault.
- **Ngôn ngữ hiệu lực (effective language)**: `vi` hoặc `en`, suy ra từ lựa chọn + ngôn ngữ hệ điều hành; là nguồn duy nhất
  cho mọi chuỗi giao diện, định dạng và ngôn ngữ Studio; thay đổi được phát tới mọi cửa sổ.
- **Tệp dịch (message catalog)**: tập khoá → chuỗi cho mỗi ngôn ngữ; tiếng Việt là ngôn ngữ nguồn; mọi ngôn ngữ phải có
  cùng tập khoá và cùng tham số.
- **Mã nhãn (label code)**: định danh ổn định thay cho văn bản hiển thị, dùng cho nhãn lỗi nguồn (lưu bền), trạng thái chỉ
  báo riêng tư, thông báo do tầng nền sinh; ánh xạ ngược từ văn bản tiếng Việt cũ sang mã cho dữ liệu đã lưu.
- **Tin nhắn chat "không tìm thấy"**: tin nhắn trợ lý có cờ không tìm thấy; hiển thị câu dịch thay vì nội dung đã lưu.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Với giao diện English, đi hết luồng chính (tạo notebook → thêm nguồn từng loại → hỏi → mở trích dẫn → Studio
  → sao lưu/khôi phục → Cài đặt) gặp **0** chuỗi giao diện tiếng Việt (ngoài nội dung tài liệu và nội dung AI đã sinh).
- **SC-002**: Kiểm tra tự động phát hiện **100%** khoá thiếu bản dịch và chuỗi tiếng Việt viết cứng ngoài tệp dịch (chứng
  minh bằng ca cố ý gây lỗi).
- **SC-003**: Đổi ngôn ngữ trong Cài đặt cập nhật toàn bộ giao diện đang mở trong **≤ 1 giây**, không khởi động lại, không
  mất trạng thái.
- **SC-004**: Lần đầu mở trên máy English ⇒ English; trên máy tiếng Việt ⇒ Tiếng Việt — đúng **100%** ở các biến thể ngôn
  ngữ hệ điều hành được kiểm.
- **SC-005**: **100%** nhãn lỗi nguồn và câu "không tìm thấy" đã lưu từ bản cũ hiển thị đúng ngôn ngữ hiện tại sau nâng cấp;
  không mất dữ liệu chat/Studio nào.
- **SC-006**: Trên bộ câu hỏi đánh giá có cả tiếng Việt và English: ngôn ngữ câu trả lời khớp ngôn ngữ câu hỏi ở **≥ 90%**
  câu có đáp án; tỉ lệ câu trả lời có `[n]` hợp lệ và tỉ lệ từ chối đúng câu không có đáp án **không thấp hơn** bản trước
  khi viết lại lời nhắc (đo cùng mô hình tham chiếu).
- **SC-007**: Số liệu truy xuất của bộ đánh giá 108 (hồi quy) **không đổi**.
- **SC-008**: Không có yêu cầu mạng mới nào phát sinh do tính năng ngôn ngữ (kiểm bằng cách chạy app ngoại tuyến ở cả hai
  ngôn ngữ).
- **SC-009**: Ở kích thước cửa sổ nhỏ nhất được hỗ trợ, **0** chuỗi English bị tràn che chữ khác hoặc bị cắt mất nghĩa ở các
  màn chính.

## Assumptions

- Ngôn ngữ nguồn của tệp dịch là tiếng Việt (giao diện hiện tại là chuẩn gốc theo prototype); bản English là bản dịch phát
  sinh, không có thiết kế gốc riêng — bố cục và luồng giữ nguyên, prototype và OVERVIEW không sửa.
- "Máy tiếng Việt" = ngôn ngữ ưu tiên đầu tiên của hệ điều hành là tiếng Việt; không xét các ngôn ngữ ưu tiên phía sau.
- Mô hình cục bộ nhỏ có thể không tuân thủ ngôn ngữ câu trả lời tuyệt đối; app không dịch lại hay chặn câu trả lời sai ngôn
  ngữ (SC-006 đặt ngưỡng chất lượng, không phải bảo đảm tuyệt đối).
- Menu hệ điều hành mặc định, trình cài đặt (dmg/exe) và hộp thoại do chính hệ điều hành dịch nằm ngoài phạm vi.
- Phần khung kỹ thuật của báo lỗi soạn sẵn (dành cho nhà phát triển) có thể giữ English cố định; quyết định ở clarify.
- Không cần thêm thư viện tải từ mạng lúc chạy; lựa chọn thư viện hay giải pháp tự viết thuộc bước lập kế hoạch.
- Ngoài phạm vi: dịch tài liệu thiết kế/ADR/specs/README; ngôn ngữ thứ ba (khung sẵn sàng); chữ viết phải-sang-trái; dịch
  nội dung nguồn; đổi ngôn ngữ nhận dạng chữ/bóc băng; dịch lại nội dung AI đã sinh; đổi thuật toán truy xuất hay ngưỡng.
- Mọi quyết định của clarify chốt ở `docs/04-decisions/2026-10-08-i18n-clarify.md`.
