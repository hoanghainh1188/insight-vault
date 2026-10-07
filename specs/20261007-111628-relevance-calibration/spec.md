# Feature Specification: Hiệu chuẩn bộ lọc độ liên quan của truy xuất

**Feature Branch**: `108-relevance-calibration`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Hiệu chuẩn bộ lọc độ liên quan của truy xuất trong hỏi đáp có trích dẫn của
InsightVault (issue #108; nguồn: `docs/intake/108-relevance-calibration.md`; MỌI quyết định đã chốt ở
`docs/04-decisions/2026-10-07-relevance-calibration-clarify.md` — dùng nguyên, không hỏi lại)… (A) bộ đánh giá +
công cụ đo; (B) quét ngưỡng/cách chặn; (C) áp dụng, siết câu trả lời không có trích dẫn, ADR mới."

## Clarifications

### Session 2026-10-07

Mọi câu hỏi lớn đã chốt ở `docs/04-decisions/2026-10-07-relevance-calibration-clarify.md` (12 câu, người dùng trả
lời trước bước specify) cùng 2 quyết định trong issue #108. Tóm tắt để spec tự đủ nghĩa:

- Q: Bộ tài liệu đánh giá lưu thế nào? → A: Toàn văn trong repo, CHỈ nguồn được phép tái phân phối (văn bản quy
  phạm pháp luật Việt Nam; Wikipedia tiếng Việt theo CC BY-SA, ghi nguồn); mỗi tài liệu kèm nguồn + giấy phép.
- Q: Gắn nhãn đáp án thế nào? → A: Theo trích đoạn nguyên văn; một đoạn kết quả "trúng" nếu chứa BẤT KỲ trích đoạn
  đáp án nào của câu hỏi.
- Q: Công cụ đo chạy ở đâu? → A: Thủ công + một job CI chỉ chạy khi bấm tay; KHÔNG chặn PR.
- Q: Recall@6? → A: Tỉ lệ câu có ≥ 1 đoạn đáp án trong 6 đoạn cuối cùng đưa cho mô hình trả lời.
- Q: "Từ chối đúng" đo ở đâu? → A: Chuẩn ĐẠT ở tầng truy xuất (không có đoạn liên quan ⇒ "Không tìm thấy"); đo
  end-to-end có mô hình chỉ là tham khảo.
- Q: Không đạt cả hai mục tiêu? → A: Giữ từ chối đúng ≥ 90%; Recall@6 tối thiểu chấp nhận 75%; thấp hơn ⇒ dừng, báo lại.
- Q: Câu trả lời theo nguồn không có trích dẫn hợp lệ? → A: Trả "Không tìm thấy trong nguồn" (không gắn mọi đoạn).
- Q: Phạm vi? → A: Chỉ hỏi đáp; tìm toàn văn và Studio giữ nguyên; chế độ Mở rộng vẫn gọi mô hình khi không có đoạn
  liên quan.
- Q: Loại câu hỏi? → A: Tính ĐẠT trên câu tiếng Việt độc lập; ~10 câu tiếng Anh chỉ tham khảo; câu nối tiếp ngoài
  phạm vi.
- Q: Chống quá khớp? → A: Chia dev 70% / hold-out 30% + thêm tài liệu nhiễu.
- Q: Đổi mô hình embedding sau này? → A: Test canh giữ buộc hiệu chuẩn lại.
- Q: Câu "Không tìm thấy"? → A: Thêm gợi ý ngắn (chỉ đổi chữ).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Hỏi điều tài liệu không có ⇒ được báo "Không tìm thấy", không bị bịa (Priority: P1)

Người dùng (luật sư, nhà báo, nhà nghiên cứu) hỏi ở **chế độ theo nguồn** một câu mà các tài liệu trong notebook
**không chứa câu trả lời**. Hệ thống trả lời rõ **"Không tìm thấy trong nguồn"** kèm gợi ý ngắn (hỏi cụ thể hơn,
hoặc chuyển sang chế độ Mở rộng nếu chấp nhận nội dung ngoài tài liệu) — thay vì đưa ra một câu trả lời trông có căn
cứ nhưng thực chất dựa trên các đoạn không liên quan.

**Why this priority**: "Kiểm chứng được" và "không bịa" là lý do sản phẩm tồn tại (Constitution II). Hiện nay hệ
thống gần như luôn tìm thấy "đoạn liên quan" (bộ lọc không tác dụng với mô hình embedding hiện tại, nhánh từ khoá
không bị lọc) nên việc từ chối phụ thuộc gần hết vào mô hình tự giác — rủi ro trực tiếp cho người dùng chuyên môn.

**Independent Test**: Nạp bộ tài liệu đánh giá vào một notebook, hỏi các câu không có đáp án ⇒ tỉ lệ nhận "Không
tìm thấy" đạt mục tiêu; không cần phần còn lại của feature.

**Acceptance Scenarios**:

1. **Given** notebook có tài liệu không đề cập chủ đề X, **When** hỏi về X ở chế độ theo nguồn, **Then** hệ thống
   trả "Không tìm thấy trong nguồn" kèm gợi ý, không gọi mô hình trả lời và không hiện trích dẫn nào.
2. **Given** câu hỏi chỉ trùng vài từ thông dụng với tài liệu (vd "là gì", "quy định") nhưng không cùng chủ đề,
   **When** hỏi, **Then** các đoạn chỉ trùng từ thông dụng không được coi là căn cứ.
3. **Given** chế độ **Mở rộng**, **When** không có đoạn liên quan, **Then** hệ thống vẫn gọi mô hình (đúng ý nghĩa
   "mở rộng") và câu trả lời vẫn mang nhãn "có thể ngoài nguồn" như hiện tại.

---

### User Story 2 - Hỏi điều tài liệu có ⇒ vẫn nhận câu trả lời kèm trích dẫn đúng (Priority: P1)

Người dùng hỏi một câu **có đáp án trong tài liệu**. Bộ lọc chặt hơn không được làm mất các đoạn liên quan thật:
hệ thống vẫn đưa đúng đoạn chứa đáp án cho mô hình, câu trả lời kèm chip `[n]` mở đúng vị trí nguồn.

**Why this priority**: Siết bộ lọc mà từ chối nhầm nhiều câu có đáp án sẽ làm sản phẩm vô dụng; hai mục tiêu phải
cân bằng theo thứ tự ưu tiên đã chốt ("không bịa" trước, nhưng có sàn độ phủ).

**Independent Test**: Hỏi các câu có đáp án trong bộ đánh giá ⇒ tỉ lệ câu có ít nhất một đoạn đáp án trong 6 đoạn
đưa cho mô hình đạt mục tiêu.

**Acceptance Scenarios**:

1. **Given** câu hỏi có đáp án trong một tài liệu, **When** hỏi, **Then** ít nhất một đoạn chứa đáp án nằm trong
   các đoạn được chọn, và chip `[n]` của câu trả lời mở đúng đoạn/vị trí gốc.
2. **Given** câu hỏi diễn đạt khác từ ngữ trong tài liệu (đồng nghĩa), **When** hỏi, **Then** đoạn đáp án vẫn được
   chọn nhờ tìm theo ngữ nghĩa.
3. **Given** câu hỏi dùng đúng thuật ngữ hiếm có trong tài liệu (mã hiệu, tên riêng), **When** hỏi, **Then** đoạn
   chứa thuật ngữ đó vẫn được chọn nếu có căn cứ ngữ nghĩa phù hợp.

---

### User Story 3 - Câu trả lời không trích dẫn được thì không trình bày như có căn cứ (Priority: P1)

Ở chế độ theo nguồn, khi mô hình trả lời **mà không trích dẫn được đoạn nguồn hợp lệ nào** và cũng không tự nói
"không tìm thấy", hệ thống hiện **"Không tìm thấy trong nguồn"** (kèm gợi ý) thay vì hiển thị câu trả lời đó với danh
sách trích dẫn là toàn bộ các đoạn đã đưa vào ngữ cảnh.

**Why this priority**: Đây là đường "bịa" nằm ngoài tầng truy xuất: hiện tại câu trả lời như vậy vẫn được gắn mọi
đoạn ngữ cảnh làm trích dẫn, trông như có căn cứ dù không có. Sửa đường này là điều kiện để lời hứa "kiểm chứng được"
đúng end-to-end.

**Independent Test**: Giả lập mô hình trả lời không kèm `[n]` hợp lệ ở chế độ theo nguồn ⇒ người dùng nhận "Không tìm
thấy trong nguồn"; ở chế độ Mở rộng hành vi không đổi.

**Acceptance Scenarios**:

1. **Given** chế độ theo nguồn và mô hình trả lời không có trích dẫn hợp lệ, **When** hiển thị, **Then** người dùng
   thấy "Không tìm thấy trong nguồn" + gợi ý, không có danh sách trích dẫn.
2. **Given** chế độ theo nguồn và mô hình trả lời có ít nhất một trích dẫn hợp lệ, **Then** hành vi giữ nguyên (chỉ các
   trích dẫn hợp lệ được giữ).
3. **Given** chế độ Mở rộng, **Then** hành vi giữ nguyên như hiện tại.
4. **Given** lượt bị chuyển thành "Không tìm thấy", **Then** lịch sử hội thoại lưu đúng nội dung người dùng đã thấy.

---

### User Story 4 - Người bảo trì đo chất lượng truy xuất bằng bộ đánh giá (Priority: P2)

Người bảo trì (nhà phát triển) chạy **một lệnh** trên máy (hoặc bấm chạy job CI thủ công) để đo chất lượng truy xuất
trên bộ đánh giá công khai trong repo, nhận **báo cáo** gồm: tỉ lệ câu có đáp án được tìm thấy (Recall@k), thứ hạng
trung bình của đoạn đáp án (MRR), tỉ lệ từ chối đúng/sai, phân bố khoảng cách của đoạn đúng/sai/không liên quan, tách
riêng tập dev và hold-out, và nhóm câu tiếng Anh tham khảo. Báo cáo dùng để chọn cấu hình bộ lọc và để kiểm tra hồi quy
khi đổi cách chia đoạn, mô hình hoặc tham số.

**Why this priority**: Không có thước đo thì mọi ngưỡng chỉ là đoán (tình trạng hiện tại). Đây là công cụ nội bộ —
người dùng cuối không thấy — nhưng là nền để US1/US2 đạt được và giữ được về sau.

**Independent Test**: Chạy lệnh trên một máy sạch ⇒ nhận báo cáo đầy đủ các chỉ số; chạy lại với cùng cấu hình cho
cùng kết quả.

**Acceptance Scenarios**:

1. **Given** repo có bộ đánh giá, **When** chạy lệnh đo, **Then** hệ thống dựng một không gian dữ liệu tạm, nạp tài
   liệu qua đúng quy trình nạp nguồn của ứng dụng, chạy truy xuất cho từng câu và in báo cáo; không đụng dữ liệu thật
   của người dùng.
2. **Given** chạy lại cùng cấu hình, **Then** kết quả truy xuất giống hệt (tất định).
3. **Given** truyền một cấu hình bộ lọc khác (ngưỡng, cách chặn), **Then** báo cáo phản ánh cấu hình đó để so sánh.
4. **Given** chọn tuỳ chọn có mô hình trả lời, **Then** báo cáo thêm phần end-to-end, ghi rõ chỉ để tham khảo.
5. **Given** chạy job CI thủ công, **Then** báo cáo được lưu làm tệp kết quả; job không chặn PR nào.

---

### User Story 5 - Đổi mô hình embedding thì bị nhắc hiệu chuẩn lại (Priority: P3)

Khi một thay đổi sau này đổi phiên bản mô hình embedding mà không cập nhật bản ghi hiệu chuẩn tương ứng, bộ test tự
động **báo lỗi**, nhắc chạy lại công cụ đo và cập nhật ngưỡng.

**Why this priority**: Ngưỡng hiệu chuẩn chỉ đúng với một mô hình cụ thể (khoảng cách mỗi mô hình phân bố khác). Thiếu
cơ chế này, lần đổi mô hình tới sẽ âm thầm làm hỏng việc "không bịa".

**Independent Test**: Đổi phiên bản mô hình trong code mà giữ nguyên bản ghi hiệu chuẩn ⇒ test fail với thông báo rõ.

**Acceptance Scenarios**:

1. **Given** phiên bản mô hình khớp bản ghi hiệu chuẩn, **Then** test xanh.
2. **Given** phiên bản mô hình đổi nhưng bản ghi không đổi, **Then** test fail, thông báo nêu việc cần làm.

### Edge Cases

- Notebook chỉ có **một tài liệu rất ngắn** (1–2 đoạn): bộ lọc tương đối không được loại luôn đoạn đúng duy nhất.
- Notebook **lớn, nhiều tài liệu khác chủ đề** (gần thực tế người dùng): khoảng cách tốt nhất có thể kém hơn notebook
  nhỏ — được mô phỏng bằng tài liệu nhiễu trong bộ đánh giá.
- Câu hỏi **rất ngắn** (1–2 từ) hoặc toàn từ thông dụng: dễ trùng từ khoá với mọi tài liệu — không được coi là căn cứ
  nếu không có hỗ trợ ngữ nghĩa.
- Câu hỏi **tiếng Anh** về tài liệu tiếng Việt: chỉ báo cáo tham khảo; không được làm hỏng hành vi tiếng Việt.
- **Notebook đang tái lập chỉ mục** (đổi mô hình): giữ nguyên hành vi báo "đang tái lập" hiện có.
- **Tìm toàn văn** trong cột Nguồn: không bị bộ lọc mới làm thu hẹp kết quả.
- Có **lịch sử hội thoại** (câu nối tiếp được viết lại): bộ lọc áp lên câu đã viết lại như câu độc lập; chất lượng câu
  nối tiếp không đo trong feature này.
- Bộ đánh giá có **câu hỏi nhiều đoạn đáp án hợp lệ**: tính "trúng" khi gặp bất kỳ đoạn nào.
- Không đạt cả hai mục tiêu với mọi cấu hình đã quét: dừng, báo lại kèm số liệu (không tự hạ mục tiêu).

## Requirements _(mandatory)_

### Functional Requirements

**Bộ đánh giá & công cụ đo (A)**

- **FR-001**: Repo MUST chứa bộ tài liệu đánh giá gồm ~8–12 tài liệu tiếng Việt toàn văn từ nguồn được phép tái phân
  phối (văn bản quy phạm pháp luật VN; Wikipedia tiếng Việt CC BY-SA), mỗi tài liệu kèm nguồn gốc và giấy phép, cùng
  một số tài liệu **nhiễu** không liên quan tới bộ câu hỏi.
- **FR-002**: Bộ câu hỏi MUST gồm ~80 câu **có đáp án** (mỗi câu gắn ≥ 1 trích đoạn nguyên văn chứa đáp án), ~20 câu
  **không có đáp án** trong bộ tài liệu, ~10 câu **tiếng Anh** (đánh dấu "tham khảo"); mỗi câu được gán vào tập **dev**
  (~70%) hoặc **hold-out** (~30%).
- **FR-003**: Người dùng (chủ dự án) MUST duyệt bộ câu hỏi trước khi bộ dữ liệu được dùng để chọn cấu hình; trạng thái
  "đã duyệt" được ghi lại cùng bộ dữ liệu.
- **FR-004**: Một đoạn kết quả MUST được tính là "trúng" khi nội dung của nó chứa ít nhất một trích đoạn đáp án của câu
  hỏi (so khớp sau khi chuẩn hoá khoảng trắng như quy trình nạp nguồn).
- **FR-005**: Công cụ đo MUST chạy bằng một lệnh dành cho nhà phát triển, dựng không gian dữ liệu tạm riêng, nạp tài
  liệu qua đúng quy trình chia đoạn + embedding + chỉ mục của ứng dụng (mô hình embedding thật), chạy truy xuất cho từng
  câu và KHÔNG đọc/ghi dữ liệu người dùng; công cụ KHÔNG được đóng gói vào bản cài.
- **FR-006**: Báo cáo MUST gồm, tách theo dev / hold-out / nhóm tiếng Anh: Recall@k (k = 1, 3, 6), MRR, tỉ lệ **từ chối
  đúng** (câu không có đáp án ⇒ không có đoạn liên quan), tỉ lệ **từ chối nhầm** (câu có đáp án ⇒ không có đoạn liên
  quan), và phân bố khoảng cách của đoạn đúng / đoạn sai / câu không có đáp án.
- **FR-007**: Công cụ đo MUST nhận cấu hình bộ lọc làm tham số để quét nhiều phương án trong một lần chạy và in bảng
  so sánh.
- **FR-008**: Công cụ đo MUST có tuỳ chọn gọi mô hình trả lời cục bộ để đo end-to-end; phần này ghi rõ "tham khảo",
  không dùng để xét ĐẠT.
- **FR-009**: Repo MUST có một job CI chỉ chạy khi được kích hoạt thủ công, chạy công cụ đo (có cache mô hình) và lưu
  báo cáo làm tệp kết quả; job KHÔNG chặn PR.

**Hiệu chuẩn (B)**

- **FR-010**: Việc hiệu chuẩn MUST quét ít nhất: (i) ngưỡng khoảng cách tuyệt đối của nhánh ngữ nghĩa; (ii) cách chặn
  nhánh từ khoá — chỉ giữ đoạn từ khoá khi có hỗ trợ ngữ nghĩa, và/hoặc ngưỡng điểm từ khoá; (iii) ngưỡng **tương đối**
  so với đoạn tốt nhất.
- **FR-011**: Cấu hình được chọn MUST được chọn trên tập **dev** và xác nhận trên tập **hold-out**; tiêu chí ĐẠT tính
  trên câu tiếng Việt: từ chối đúng ≥ 90% và Recall@6 ≥ 85%; nếu không cấu hình nào đạt cả hai, chọn cấu hình giữ từ
  chối đúng ≥ 90% có Recall@6 cao nhất, với sàn 75%; dưới sàn ⇒ dừng và báo lại.
- **FR-012**: Khi nhiều cấu hình cùng ĐẠT, MUST chọn cấu hình đơn giản nhất (ít tham số nhất), hoà thì chọn biên an toàn
  lớn nhất trên hold-out.

**Áp dụng (C)**

- **FR-013**: Bộ lọc mới MUST chỉ áp dụng cho bước chọn đoạn của **hỏi đáp**; tìm toàn văn nội dung nguồn và Studio
  giữ nguyên hành vi.
- **FR-014**: Ở chế độ theo nguồn, khi sau bộ lọc không còn đoạn liên quan, hệ thống MUST trả "Không tìm thấy trong
  nguồn" (kèm gợi ý) mà không gọi mô hình trả lời; ở chế độ Mở rộng MUST vẫn gọi mô hình như hiện nay.
- **FR-015**: Ở chế độ theo nguồn, khi câu trả lời của mô hình không có trích dẫn hợp lệ nào, hệ thống MUST hiển thị
  "Không tìm thấy trong nguồn" (kèm gợi ý) và KHÔNG gắn các đoạn ngữ cảnh làm trích dẫn; lượt đó được lưu đúng như người
  dùng đã thấy.
- **FR-016**: Câu "Không tìm thấy trong nguồn" MUST có thêm gợi ý ngắn: hỏi cụ thể hơn, hoặc chuyển sang chế độ Mở rộng
  nếu chấp nhận nội dung ngoài tài liệu. Chỉ đổi chữ — không đổi bố cục giao diện.
- **FR-017**: Bộ lọc MUST chỉ thay đổi **đoạn nào được chọn**; mỗi đoạn giữ nguyên vị trí gốc, chip `[n]` vẫn mở đúng
  nguồn và vị trí (Constitution II).
- **FR-018**: Các hành vi sẵn có MUST giữ nguyên: lỗi tìm từ khoá ⇒ chỉ dùng tìm ngữ nghĩa; lỗi viết lại câu hỏi ⇒ dùng
  câu gốc; viết lại chỉ khi có lịch sử; thông báo "đang tái lập chỉ mục".
- **FR-019**: Tham số bộ lọc đã chọn MUST được lưu kèm **phiên bản mô hình embedding** đã dùng để hiệu chuẩn; một test
  tự động MUST fail khi phiên bản mô hình hiện hành khác phiên bản trong bản ghi hiệu chuẩn.
- **FR-020**: MUST có ADR mới ghi số liệu đo, các phương án đã quét, cấu hình đã chọn và lý do, thay thế phát biểu ngưỡng
  0.75 đã lỗi thời; mục lục quyết định được cập nhật.
- **FR-021**: Logic lọc/chặn mới và phần tính chỉ số MUST có unit test viết trước (Constitution IV); phần nạp mô hình /
  cơ sở dữ liệu thật của công cụ đo được loại khỏi ngưỡng coverage theo quy ước hiện có.
- **FR-022**: Ứng dụng đóng gói MUST KHÔNG có thêm bất kỳ kết nối mạng nào do feature này (Constitution I); việc tải mô
  hình chỉ xảy ra trong môi trường phát triển/CI khi chạy công cụ đo.

### Key Entities _(include if feature involves data)_

- **Tài liệu đánh giá**: một văn bản công khai trong bộ đánh giá — nội dung toàn văn, tiêu đề, nguồn gốc (URL), giấy
  phép, cờ "tài liệu nhiễu".
- **Câu hỏi đánh giá**: nội dung câu hỏi, ngôn ngữ (vi / en), loại (có đáp án / không có đáp án), tập (dev / hold-out),
  danh sách trích đoạn đáp án (với câu có đáp án), tài liệu liên quan dự kiến (để đối chiếu).
- **Cấu hình bộ lọc**: ngưỡng tuyệt đối nhánh ngữ nghĩa, cách chặn nhánh từ khoá (và ngưỡng nếu có), ngưỡng tương đối.
- **Bản ghi hiệu chuẩn**: cấu hình bộ lọc đã chọn + phiên bản mô hình embedding + ngày + chỉ số trên dev và hold-out.
- **Báo cáo đánh giá**: chỉ số theo từng nhóm câu và từng cấu hình, phân bố khoảng cách, thông tin môi trường chạy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Trên tập hold-out (câu tiếng Việt), **≥ 90%** câu không có đáp án trong tài liệu nhận "Không tìm thấy
  trong nguồn" ở chế độ theo nguồn (hiện nay: gần như 0% ở tầng chọn đoạn — được đo làm mốc so sánh).
- **SC-002**: Trên tập hold-out (câu tiếng Việt), **≥ 85%** câu có đáp án có ít nhất một đoạn đáp án trong 6 đoạn được
  chọn (sàn chấp nhận 75% nếu không đạt đồng thời SC-001).
- **SC-003**: Ở chế độ theo nguồn, **0** câu trả lời được hiển thị kèm trích dẫn khi mô hình không trích dẫn được đoạn
  hợp lệ nào.
- **SC-004**: Người bảo trì nhận báo cáo đầy đủ chỉ số bằng **một lệnh**, chạy lại cho **kết quả truy xuất giống hệt**.
- **SC-005**: Kết quả tìm toàn văn trong cột Nguồn và nội dung Studio **không đổi** so với trước feature trên cùng dữ
  liệu.
- **SC-006**: Thời gian trả lời một câu hỏi ở chế độ theo nguồn **không tăng quá 10%** so với trước (bộ lọc không làm
  chậm cảm nhận được).
- **SC-007**: Một thay đổi phiên bản mô hình embedding mà không hiệu chuẩn lại **luôn** bị bộ test chặn.

## Assumptions

- Bộ đánh giá dùng tài liệu tiếng Việt; người dùng thật có thể có tài liệu ngôn ngữ khác — chỉ tiếng Anh được báo cáo
  tham khảo, các ngôn ngữ khác ngoài phạm vi.
- ~100 câu đủ để chọn cấu hình theo thứ tự ưu tiên đã chốt; độ bất định (vd 18/20 = 90%) được nêu trong báo cáo/ADR
  thay vì mở rộng bộ dữ liệu trong feature này.
- Mô hình embedding giữ nguyên như hiện tại; việc tải mô hình cho công cụ đo chỉ diễn ra ở môi trường phát triển/CI.
- Văn bản quy phạm pháp luật Việt Nam không thuộc đối tượng bảo hộ quyền tác giả; nội dung Wikipedia tái phân phối theo
  CC BY-SA kèm ghi nguồn — danh sách tài liệu cụ thể được người dùng xác nhận cùng lúc duyệt bộ câu hỏi.
- Ngoài phạm vi: đổi mô hình embedding, đổi cách chia đoạn, reranker/mô hình xếp hạng lại, provider online, câu hỏi
  nối tiếp cần mô hình viết lại, thay đổi giao diện ngoài câu chữ "Không tìm thấy".
- Theo quy tắc dự án, đề xuất sửa constitution (bắt buộc đo lại khi đổi tham số truy xuất) nếu có sẽ đi PR riêng, không
  thuộc feature này.
