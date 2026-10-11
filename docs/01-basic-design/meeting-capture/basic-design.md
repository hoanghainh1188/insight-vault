# Feature Spec: Meeting Capture — ghi âm, transcript và nguồn tri thức cuộc họp

## 1. Mục tiêu

Cho phép người dùng ghi âm cuộc họp dài từ 120 phút trở lên, xem transcript xuất hiện gần thời gian thực, và lưu kết quả thành nguồn trong notebook để tìm kiếm, hỏi đáp, tóm tắt và trích dẫn chính xác theo mốc thời gian.

Tính năng vận hành local-first: audio và transcript được lưu, xử lý và lập chỉ mục trên máy mặc định. Dữ liệu chỉ rời thiết bị khi người dùng chủ động chọn dùng AI online.

## 2. Trải nghiệm cốt lõi

Luồng chính:

`Bắt đầu ghi → transcript hiện dần → tạm dừng/tiếp tục hoặc đánh dấu → kết thúc → chốt transcript → lập chỉ mục → hỏi đáp có trích dẫn`

Tính năng phải mang cảm giác của một máy ghi âm đáng tin cậy: ít thao tác, trạng thái dễ hiểu, audio luôn được lưu an toàn và có thể khôi phục sau sự cố. AI nên phát huy giá trị sau cuộc họp, thay vì làm người dùng phân tâm trong lúc họp.

## 3. Điểm vào và bắt đầu ghi

Trong notebook, người dùng có hai lựa chọn cạnh nút thêm nguồn:

`+ Thêm nguồn` · `Ghi cuộc họp`

Khi chọn ghi cuộc họp, mở hộp bắt đầu nhỏ với:

- Tên mặc định, ví dụ: `Cuộc họp 12/10, 14:30`.
- Notebook đích.
- Chọn microphone nếu có nhiều thiết bị.
- Ngôn ngữ: `Tự động` mặc định; có thể chọn `Tiếng Việt`, `English`, hoặc `Đa ngôn ngữ`.
- Thông điệp riêng tư: `Âm thanh và transcript được xử lý trên máy này.`
- Nút chính: `Bắt đầu ghi`.

App xin quyền microphone khi cần. Nếu quyền bị từ chối, giải thích ngắn gọn cách cấp quyền và không tạo nguồn rỗng.

## 4. Màn hình đang ghi

Trong khi họp, mở chế độ tập trung trong workspace gồm ba vùng:

| Vùng | Nội dung |
| --- | --- |
| Thanh đầu | Tên cuộc họp, trạng thái ghi, thời lượng và trạng thái lưu cục bộ |
| Nội dung chính | Transcript thời gian thực với timestamp |
| Thanh điều khiển dưới | Mức âm lượng, ngôn ngữ, đánh dấu, tạm dừng/tiếp tục và kết thúc ghi |

### Thanh đầu

Hiển thị ví dụ:

`● Đang ghi · 01:42:18 · Lưu trên máy`

- Chấm đỏ cho biết microphone đang hoạt động; không dùng màu làm tín hiệu duy nhất.
- Đồng hồ là thông tin nổi bật nhất cho phiên dài.
- Khi transcript chậm: `Đang xử lý bản ghi — audio vẫn được lưu an toàn`.
- Không hiển thị các chi tiết kỹ thuật như chunk, hàng đợi hoặc model tại đây.

### Transcript trực tiếp

- Audio được chia thành các đoạn ngắn để nhận dạng tiếng nói bất đồng bộ.
- Transcript xuất hiện với độ trễ mục tiêu vài giây.
- Mỗi đoạn có timestamp ở lề trái, ví dụ `01:18:42`.
- Đoạn còn đang được nhận dạng có nhãn nhẹ `Đang nhận dạng`; bản chốt sau cùng không có nhãn này.
- Tự cuộn chỉ khi người dùng đang ở phần mới nhất. Khi họ cuộn lên đọc phần cũ, dừng tự cuộn và hiển thị nút `Quay về hiện tại`.
- Bấm một timestamp để phát lại audio tại vị trí tương ứng.
- Người dùng có thể bôi chọn transcript hoặc bấm `Đánh dấu` để thêm nhãn thủ công: `Quyết định`, `Việc cần làm`, `Câu hỏi`.
- Không làm transcript nhấp nháy khi có bản nhận dạng tốt hơn; cập nhật tại chỗ một cách nhẹ nhàng.

### Điều khiển

- Nút chính: `Tạm dừng`; khi tạm dừng đổi thành `Tiếp tục`.
- Lúc tạm dừng, trạng thái ghi rõ: `Đã tạm dừng — không thu âm`.
- Nút `Đánh dấu` phải dễ tiếp cận trong lúc họp.
- `Kết thúc ghi` là hành động nguy hiểm, đặt tách biệt và yêu cầu xác nhận cho phiên dài.
- Hiển thị meter âm lượng đơn giản: có tín hiệu, tín hiệu yếu hoặc âm thanh quá lớn.

## 5. Yêu cầu ghi âm và độ bền

- Hỗ trợ ghi liên tục tối thiểu 120 phút.
- Lưu audio thành các phân đoạn độc lập, mặc định 5–10 phút mỗi đoạn.
- Sau khi một phân đoạn đóng, dữ liệu đó phải còn nguyên nếu app hoặc máy gặp sự cố.
- Audio vẫn tiếp tục được ghi nếu transcript xử lý chậm.
- Có thể tạm dừng/tiếp tục mà không làm hỏng phiên; transcript phải biểu thị rõ khoảng ngừng.
- Hiển thị cảnh báo sớm khi gần hết dung lượng đĩa.
- Khi mất quyền microphone, mất thiết bị hoặc lỗi ghi, giữ toàn bộ dữ liệu đã có và hướng dẫn người dùng chọn thiết bị khác hoặc hoàn tất phiên.
- Khi mở lại app sau sự cố, hiển thị thẻ `Phục hồi cuộc họp chưa hoàn tất`, cho phép tiếp tục hoàn tất transcript hoặc giữ lại bản ghi như một nguồn chưa hoàn thiện.

## 6. Nhận dạng ngôn ngữ và transcript

- Tự nhận dạng ngôn ngữ từ khoảng 20–30 giây đầu.
- Hiển thị trạng thái `Đang nhận dạng ngôn ngữ…`, sau đó hiển thị kết quả, ví dụ `Tiếng Việt · Tự động`.
- Người dùng luôn có thể khóa ngôn ngữ thủ công.
- Không tự đổi ngôn ngữ theo từng đoạn ngắn; chỉ đánh giá lại trên cửa sổ dài, khoảng 1–2 phút.
- Nếu app nhận thấy có khả năng đổi ngôn ngữ đáng kể, hiện gợi ý: `Có vẻ cuộc họp đang dùng English. Chuyển transcript sang English?`
- Với cuộc họp pha trộn Việt–Anh, dùng chế độ `Đa ngôn ngữ` và chấp nhận rằng tên riêng/thuật ngữ có thể cần bản chốt để chính xác hơn.

## 7. Kết thúc và hoàn tất nguồn

Khi người dùng chọn `Kết thúc ghi`, app chuyển sang trạng thái hoàn tất, không đóng vội về notebook.

Màn hình hiển thị:

- Tiêu đề cuộc họp, có thể sửa.
- Tổng thời lượng.
- Trạng thái: `Đang chốt transcript và lập chỉ mục`.
- Nút `Về notebook`; tác vụ tiếp tục chạy nền.
- Nút `Mở khi hoàn tất`.

App phải chạy bước transcript cuối để ghép các phân đoạn, xử lý ranh giới giữa chúng và cải thiện transcript nháp. Sau đó, transcript được chunk, tạo embedding và lập chỉ mục qua pipeline nguồn hiện có.

Nguồn chuyển sang `Sẵn sàng` khi toàn bộ bước này thành công. Trong lúc xử lý, nguồn có trạng thái `Đang hoàn tất`, không phải lỗi.

## 8. Nguồn cuộc họp và trình xem

Nguồn cuộc họp là một dạng audio có metadata bổ sung:

- Tiêu đề, notebook, thời gian bắt đầu/kết thúc và thời lượng.
- Thiết bị ghi, ngôn ngữ, trạng thái xử lý.
- Danh sách phân đoạn audio để hỗ trợ khôi phục.
- Transcript, map ký tự ↔ timestamp và các đánh dấu thủ công.

Trình xem cuộc họp gồm:

- Audio player cố định ở đầu.
- Transcript đồng bộ; đoạn đang phát được tô sáng.
- Bấm transcript để tua đúng timestamp.
- Tìm toàn văn trong transcript.
- Danh sách đánh dấu.
- Sao chép transcript và xuất Markdown.

Khi người dùng bấm trích dẫn `[n]` trong chat, app mở nguồn tại timestamp liên quan. Mặc định chỉ tua đến vị trí; tự phát audio là tùy chọn người dùng.

## 9. Hỏi đáp và Studio

Sau khi nguồn ở trạng thái `Sẵn sàng`, nó tham gia hoàn toàn vào các tính năng notebook hiện có:

- Tìm toàn văn.
- Hỏi đáp RAG.
- Câu trả lời có trích dẫn đến đoạn transcript và audio tương ứng.
- Studio tạo tóm tắt, ý chính, FAQ và dàn ý.

Trong lúc đang ghi, transcript nháp không nên được coi là nguồn đáng tin cậy để trả lời. Có thể đưa vào tìm kiếm ở giai đoạn sau, nhưng v1 chỉ cần bật hỏi đáp sau khi transcript cuối và index hoàn tất.

## 10. Bảo mật, riêng tư và khả năng tiếp cận

- Không gửi audio hoặc transcript ra ngoài trong chế độ local.
- Nếu cần tải model speech-to-text lần đầu, hiển thị chỉ báo riêng tư rõ ràng.
- Không ghi nội dung audio, transcript hay API key vào log.
- Luôn hiển thị rõ microphone có đang hoạt động không.
- Mọi điều khiển có nhãn cho screen reader: trạng thái ghi, thời lượng, mức âm lượng và trạng thái transcript.
- Thông báo trạng thái quan trọng qua live region, nhưng không đọc từng câu transcript.
- Cung cấp phím tắt có thể cấu hình cho tạm dừng/tiếp tục, đánh dấu và kết thúc ghi.
- Không dùng chỉ màu sắc để biểu thị trạng thái.

## 11. Ngoài phạm vi v1

- Nhận diện và gán tên người nói tự động.
- Thu âm nhiều microphone/kênh hoặc audio hệ thống.
- Đồng bộ bản ghi cloud.
- Tóm tắt tự động khi cuộc họp chưa kết thúc.
- Cộng tác chỉnh sửa transcript.
- Tự động phát audio khi mở citation.

## 12. Chia pha triển khai

### Pha A — Ghi âm thành nguồn

Ghi microphone, lưu audio theo phân đoạn, tạo nguồn cuộc họp và xử lý transcript sau khi dừng.

### Pha B — Transcript gần thời gian thực

Thêm transcript nháp, nhận dạng ngôn ngữ ban đầu, hiển thị tiến độ và các trạng thái UI đang ghi.

### Pha C — Cuộc họp dài và khôi phục

Thêm checkpoint, khôi phục phiên dang dở, cảnh báo dung lượng, xử lý lỗi thiết bị và kiểm thử 120+ phút.

### Pha D — Nâng cao

Nhận diện người nói, phát hiện quyết định/việc cần làm, tóm tắt trong lúc họp và thu âm đa kênh.

## 13. Tiêu chí nghiệm thu

- Có thể ghi tối thiểu 120 phút mà không mất các phân đoạn đã hoàn tất.
- Transcript hiện dần và việc ghi không bị dừng khi transcript chậm.
- Người dùng có thể tạm dừng, tiếp tục, đánh dấu và kết thúc ghi.
- Sau khi hoàn tất, cuộc họp trở thành nguồn có thể tìm kiếm, hỏi đáp và tóm tắt.
- Citation nhảy đến đúng timestamp trong audio.
- Khởi động lại app giữa phiên vẫn phục hồi được audio/transcript đã checkpoint.
- Người dùng có thể xem, xác nhận hoặc đổi ngôn ngữ transcript.
- Lỗi quyền micro, mất thiết bị, đầy đĩa và lỗi transcript đều có trạng thái dễ hiểu, có thể phục hồi.
- Chế độ local không gửi audio hoặc transcript ra ngoài.
