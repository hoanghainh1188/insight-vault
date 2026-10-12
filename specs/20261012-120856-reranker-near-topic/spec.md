# Feature Specification: Bộ chấm độ liên quan từ chối câu "sát chủ đề" mà không loại nhầm đoạn bảng

**Feature Branch**: `187-reranker-near-topic`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Cải thiện bộ chấm độ liên quan (feature 109) để từ chối câu hỏi không có đáp án nhưng cùng chủ đề với tài liệu PDF, mà không từ chối nhầm câu có đáp án nằm trong đoạn dạng bảng (issue #187)." — mô tả đầy đủ, số liệu và ràng buộc ở mục "Prompt for /speckit-specify" của `docs/intake/187-reranker-near-topic.md`.

## Clarifications

### Session 2026-10-12

- Q: Chống học vẹt theo vài câu — chọn cấu hình thế nào, q-162 (hold-out) xử lý ra sao? → A: Chọn trên dev bằng `chooseRerankConfig`; q-162, q-170, q-171 là **bộ kiểm hồi quy đáp án-trong-bảng** riêng — cấu hình làm một câu trong đó bị từ chối ⇒ loại, nhưng không dùng chúng để xếp hạng / chọn.
- Q: Có mở rộng bộ câu hỏi (v5) không? → A: Có, làm TRƯỚC ở PR riêng: ~2 câu không đáp án sát chủ đề cho mỗi tài liệu thật (~20 câu, tiếng Việt, chia 70/30) + 2–3 câu có đáp án trong bảng nếu tài liệu có bảng; chủ dự án duyệt v5, rồi mới quét bộ chấm trên v5.
- Q: Ngân sách độ trễ / RAM / dung lượng? → A: Giữ ngân sách 109 (p50 ≤ 400 ms, p95 ≤ 800 ms trên macOS arm64 tham chiếu), cấu hình vượt ⇒ loại; nếu đổi model: tải ≤ 150 MB, RAM tăng ≤ 200 MB so với model hiện tại, vẫn ONNX int8.
- Q: Phạm vi tiếng Anh? → A: Giữ ngưỡng chung vi/en; tiếng Anh là điều kiện chặn — cấu hình làm Recall@6 hoặc từ chối đúng tiếng Anh thấp hơn mức hiện hành (72,7% / 83,3%) bị loại; không thêm câu tiếng Anh ở v5.
- Q: Chia PR và cập nhật bản ghi hiệu chuẩn? → A: PR 1 = bộ câu hỏi v5 + công cụ chẩn đoán (điểm bộ chấm từng câu khi `EVAL_DETAILS=1`) + báo cáo chẩn đoán, không đổi mã chạy app, chủ dự án duyệt v5; PR 2 = thay đổi cấu hình (hoặc model / cách đưa bảng) + đo lại `RELEVANCE_CALIBRATION` + ADR + bảng trước/sau so với mốc v4.

## User Scenarios & Testing _(mandatory)_

Người dùng cuối là người hỏi đáp trên notebook của mình (nhà nghiên cứu, luật sư, sinh viên…). Người thực hiện / kiểm chứng là chủ dự
án, đo bằng bộ đánh giá truy xuất (`datasetVersion` 4, đã duyệt).

### User Story 1 - Câu hỏi "cùng chủ đề nhưng tài liệu không trả lời" được trả "Không tìm thấy trong nguồn" (Priority: P1)

Người dùng có tài liệu về tuyến đường sắt Tuyến 2A và hỏi "Mỗi ga có bao nhiêu thang máy?" — tài liệu không hề nói về thang máy. Hôm
nay app vẫn đưa ra một đoạn "liên quan" (cùng chủ đề Tuyến 2A) để trả lời, khiến người dùng tưởng câu trả lời có nguồn. Sau thay đổi,
app trả "Không tìm thấy trong nguồn" cho loại câu này.

**Why this priority**: Vi phạm trực tiếp giá trị cốt lõi "kiểm chứng được" — câu trả lời có chip trích dẫn nhưng nguồn không thực sự trả
lời. Là vấn đề chính của issue.

**Independent Test**: Chạy bộ đánh giá v4 theo đường app thật ⇒ q-176 ("thang máy") và q-179 ("lương lái tàu") bị từ chối; tỉ lệ từ
chối đúng trên tập dev đạt lại ≥ 90%.

**Acceptance Scenarios**:

1. **Given** notebook có tài liệu Tuyến 2A, **When** hỏi một câu cùng chủ đề mà không tài liệu nào có đáp án (q-176, q-179), **Then** kết
   quả truy xuất rỗng và hỏi đáp trả "Không tìm thấy trong nguồn".
2. **Given** bộ đánh giá v4, **When** đo cấu hình mới trên tập dev, **Then** từ chối đúng tiếng Việt ≥ 90% (hiện 85,7%, 24/28).

---

### User Story 2 - Câu hỏi có đáp án nằm trong bảng vẫn được trả lời có trích dẫn (Priority: P1)

Người dùng hỏi "Theo bảng danh sách nhà ga, ga Láng thuộc phường nào?" — đáp án nằm trong một dòng bảng của PDF. Hôm nay đoạn bảng
đứng đầu kết quả tìm kiếm nhưng bộ chấm loại bỏ, nên app trả "Không tìm thấy". Sau thay đổi, đoạn bảng được giữ lại và câu trả lời có
chip trỏ đúng dòng bảng.

**Why this priority**: Từ chối nhầm làm mất câu trả lời đúng — cùng mức P1 vì sửa US1 không được đánh đổi bằng việc loại thêm đoạn
đúng.

**Independent Test**: Chạy bộ đánh giá v4 ⇒ q-162, q-170, q-171 (đáp án trong bảng) đều không bị từ chối và có đoạn đúng trong top 6.

**Acceptance Scenarios**:

1. **Given** PDF có bảng chứa đáp án, **When** hỏi câu có đáp án trong một dòng bảng (q-162, q-170, q-171), **Then** đoạn chứa dòng bảng
   nằm trong 6 đoạn đầu và câu không bị từ chối.
2. **Given** thay đổi cho US1, **When** đo lại, **Then** không câu có đáp án hiện có nào chuyển từ "trúng" sang "bị từ chối".

---

### User Story 3 - Thay đổi không làm tụt chất lượng ở chỗ khác và có số liệu ghi lại (Priority: P2)

Chủ dự án cần chắc rằng cải thiện US1/US2 không làm tụt câu nào khác (tiếng Việt, tiếng Anh), không làm app chậm quá ngân sách đã
chốt, và bản ghi hiệu chuẩn phản ánh đúng cấu hình mới.

**Why this priority**: Bảo vệ các cam kết đã chốt ở 108/109; chỉ có nghĩa sau khi US1/US2 có giải pháp.

**Independent Test**: So từng câu (trước / sau) trên bộ v4 theo đường app thật; cổng xác nhận 109 ĐẠT; độ trễ trong ngân sách; test canh
giữ bản ghi hiệu chuẩn xanh.

**Acceptance Scenarios**:

1. **Given** cấu hình mới, **When** so với cấu hình hiện hành theo từng câu, **Then** không câu hiện có nào tụt (Recall@6, MRR, từ chối
   đúng của vi dev / vi hold-out / en).
2. **Given** cấu hình mới, **When** chạy cổng xác nhận 109 trên hold-out, **Then** ĐẠT (từ chối đúng hold-out ≥ 90%, Recall@6 ≥ 85% / sàn
   75%, cận dưới Wilson vi gộp ≥ 0,75, tiếng Anh không tụt so với mốc cùng lượt).
3. **Given** không cấu hình / giải pháp nào đạt cả US1, US2 và cổng, **When** kết thúc đo, **Then** dừng, báo lại bằng số liệu, không tự
   hạ mục tiêu — giữ cấu hình hiện hành, ghi ADR "giới hạn đã biết" kèm số liệu, **giữ #187 mở** và tách issue mới cho hướng tiếp theo (thêm dữ liệu v5 / model lớn hơn).

---

### Edge Cases

- Model bộ chấm chưa tải / lỗi / quá 1500 ms ⇒ hành vi 108 (fail-open), hỏi đáp không bị chặn — không đổi.
- Câu hỏi tiếng Anh: thay đổi có thể đẩy tụt tiếng Anh (hiện từ chối đúng 83,3%, Recall@6 72,7%) ⇒ cấu hình làm tụt dưới hai mức này bị
  loại (ngoài điều kiện "không tụt so với mốc cùng lượt" của cổng).
- Biên cổng mỏng: cận dưới Wilson vi gộp hiện 0,769 (36/40); chỉ thêm 1 câu không đáp án lọt (35/40) là 0,739 < 0,75 ⇒ rớt cổng.
- q-162 thuộc hold-out: không được dùng hold-out để chọn tham số (mất tính độc lập).
- Đoạn dạng bảng rất dài / nhiều cột: không được cắt mất dòng chứa đáp án khi đưa vào bộ chấm; chip `[n]` vẫn trỏ đúng đoạn gốc.
- Cỡ mẫu nhỏ: chỉ 2 câu không đáp án sát chủ đề lọt + 3 câu đáp án-trong-bảng ⇒ nguy cơ "học vẹt" theo vài câu.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Trước khi chọn giải pháp, hệ thống đo MUST ghi được điểm của bộ chấm cho từng (câu hỏi, đoạn ứng viên) của các câu liên quan
  (q-176, q-179, 2 câu không đáp án cũ đang lọt ở dev, q-162, q-170, q-171) để kiểm chứng nguyên nhân (giả thuyết "đoạn bảng bị chấm thấp"
  chưa được chứng minh).
- **FR-002**: Cấu hình / giải pháp mới MUST được chọn CHỈ trên tập dev và xác nhận trên hold-out (quy tắc 108/109).
  Ba câu đáp án-trong-bảng (q-162, q-170, q-171) là bộ kiểm hồi quy riêng: cấu hình làm một câu trong đó bị từ chối ⇒ bị loại;
  chúng KHÔNG dùng để xếp hạng / chọn cấu hình (giữ hold-out độc lập).
- **FR-003**: Với cấu hình mới, từ chối đúng tiếng Việt trên dev MUST ≥ 90% (`TARGET_REJECTION`), trong đó q-176 và q-179 bị từ chối.
- **FR-004**: Câu có đáp án trong dòng bảng (q-162, q-170, q-171) MUST không bị từ chối và đoạn đúng MUST nằm trong 6 đoạn đầu.
- **FR-005**: Cổng xác nhận R6 của 109 MUST tiếp tục ĐẠT trên hold-out; không câu hiện có nào được tụt theo đường app thật (Recall@6, MRR,
  từ chối đúng — vi dev / vi hold-out / en), so từng câu.
- **FR-006**: Phạm vi giải pháp theo hai bước: **(1)** đổi cấu hình của bộ chấm hiện có (ngưỡng, ngưỡng tương đối, số ứng viên, độ dài cắt — có thể mở rộng lưới quét); **(2)** chỉ khi (1) không đạt FR-003…FR-005 mới đánh giá model bộ chấm khác (chạy cục bộ, giấy phép cho phép thương mại, có bản ONNX, ghim phiên bản, đo độ trễ / RAM / dung lượng tải).
- **FR-007**: Được đổi cách trình bày đoạn dạng bảng CHỈ cho bước chấm (vd gắn tiêu đề cột) **khi và chỉ khi** bước chẩn đoán (FR-001) cho thấy đoạn bảng thực sự bị chấm thấp; chunk, locator, chip `[n]` và văn bản hiển thị giữ nguyên; thay đổi trong main process phải có test.
- **FR-008**: Bộ chấm MUST vẫn chạy cục bộ, không egress, fail-open (lỗi / chưa sẵn sàng / quá 1500 ms ⇒ hành vi 108); độ trễ bước chấm
  trong ngân sách 109 (p50 ≤ 400 ms, p95 ≤ 800 ms trên máy tham chiếu macOS arm64) — cấu hình vượt ngân sách bị loại khỏi lựa chọn. Nếu
  đổi model (bước 2 của FR-006): dung lượng tải ≤ 150 MB, RAM tăng thêm ≤ 200 MB so với model hiện tại, định dạng ONNX int8.
- **FR-009**: Chunk, locator và chip `[n]` MUST không đổi; điểm khoảng cách giữ nghĩa cũ, điểm bộ chấm ở trường riêng.
- **FR-010**: MUST không đổi nhãn, tập (`split`), trích dẫn của câu hiện có, không hạ `TARGET_*` / ngưỡng Wilson, không đổi định nghĩa "từ
  chối đúng".
- **FR-011**: Giao theo 2 PR: **PR 1** (bộ câu hỏi v5 + công cụ chẩn đoán ghi điểm bộ chấm từng câu khi `EVAL_DETAILS=1` + báo cáo chẩn
  đoán; không đổi mã chạy app); **PR 2** (sau khi v5 được duyệt: thay đổi cấu hình / model / cách đưa bảng). Khi đổi cấu hình / model, bản
  ghi hiệu chuẩn MUST được đo lại và cập nhật (cấu hình, số liệu, phiên bản model nếu đổi) để test
  canh giữ đúng; ADR mới + dòng mục lục quyết định; không sửa ADR cũ.
- **FR-012**: Mã thuần mới MUST có unit test viết trước, coverage ≥ 80% phần logic.
- **FR-013**: Trước khi quét lại bộ chấm, bộ đánh giá MUST được mở rộng thành v5 ở PR riêng (câu không đáp án sát chủ đề cho mọi tài liệu
  thật + câu đáp án-trong-bảng nếu có bảng), tuân quy tắc nhãn hiện hành, và được chủ dự án duyệt. Mục tiêu FR-003…FR-005 đo trên v5
  (gồm q-176, q-179, q-162, q-170, q-171).

### Key Entities

- **Cấu hình bộ chấm**: ngưỡng điểm, ngưỡng tương đối, số ứng viên được chấm, độ dài cắt; gắn phiên bản model.
- **Điểm bộ chấm theo đoạn**: điểm cho từng cặp (câu hỏi, đoạn ứng viên) — dùng chẩn đoán.
- **Bản ghi hiệu chuẩn**: cấu hình + số liệu đo trên bộ v4 + phiên bản model.
- **Câu hỏi đánh giá liên quan**: q-176, q-179 (không đáp án sát chủ đề), q-162, q-170, q-171 (đáp án trong bảng), 2 câu không đáp án cũ
  đang lọt ở dev.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Trên tập dev, ≥ 90% câu tiếng Việt không có đáp án được trả "Không tìm thấy trong nguồn" (hiện 85,7%).
- **SC-002**: 100% câu có đáp án nằm trong bảng của bộ đánh giá (q-162, q-170, q-171) được trả lời có trích dẫn trỏ đúng đoạn.
- **SC-003**: 0 câu hiện có bị tụt (so từng câu, theo đường app thật) và cổng xác nhận trên hold-out ĐẠT.
- **SC-004**: Thời gian trả lời không tăng quá ngân sách đã chốt (p50 ≤ 400 ms, p95 ≤ 800 ms cho bước chấm trên máy tham chiếu); nếu đổi
  model, bản tải thêm ≤ 150 MB và bộ nhớ tăng ≤ 200 MB.
- **SC-005**: Kết quả có thể tái lập: chạy lại bộ đánh giá cho cùng số liệu; quyết định và số liệu trước / sau được ghi trong ADR.

## Assumptions

- Thước đo là bộ đánh giá **v5**: mở rộng từ v4 (đã duyệt 2026-10-12) ở PR riêng làm TRƯỚC — ~2 câu không đáp án sát chủ đề cho mỗi tài liệu
  thật (~20 câu, tiếng Việt, 70/30) + 2–3 câu có đáp án trong bảng nếu tài liệu có bảng; `datasetVersion` "5", `reviewed: null` ⇒ chủ dự
  án duyệt xong mới quét / chọn cấu hình. Số liệu v4 (85,7% dev, q-162…) là mốc "trước".
- Mục tiêu `TARGET_REJECTION` 0,9, `TARGET_RECALL` 0,85, `FLOOR_RECALL` 0,75, ngưỡng Wilson 0,75 giữ nguyên (108/109).
- Ngưỡng dùng chung cho tiếng Việt và tiếng Anh (109); tiếng Anh là điều kiện chặn (không thấp hơn Recall@6 72,7% / từ chối đúng 83,3% hiện
  hành); tách ngưỡng theo ngôn ngữ ngoài phạm vi issue này. v5 không thêm câu tiếng Anh.
- Bước chẩn đoán (FR-001) thuộc phạm vi và làm trước khi chọn giải pháp.
- Chốt ở specify (2026-10-12): Q1 = B (cấu hình trước, model sau nếu cần), Q2 = A (đổi cách đưa bảng chỉ khi chẩn đoán xác nhận), Q3 = A (không đạt ⇒ giữ cấu hình, ADR giới hạn, giữ #187 mở + issue mới).
- Các điểm mở khác (độ trễ / RAM / kích thước tải nếu đổi model, chi tiết lưới quét, chia PR) để `/speckit-clarify` theo danh sách B1–B11
  của intake.
