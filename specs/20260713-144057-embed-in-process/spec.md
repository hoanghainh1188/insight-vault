# Feature Specification: Embedding in-process + gợi ý model theo RAM

**Feature Branch**: `059-embed-in-process`

**Created**: 2026-07-13

**Status**: Draft

**Input**: Thảo luận UX máy Windows/máy yếu sau khi merge 055/057. Quyết định kỹ thuật đã chốt ở
`docs/04-decisions/2026-07-13-embed-in-process-clarify.md` (ADR 059). KHÔNG cần `/speckit-clarify`.

## Bối cảnh

InsightVault chạy cục bộ và hiện phụ thuộc **Ollama** cho cả **embedding** (lập chỉ mục + truy vấn) lẫn
**chat**. Ollama chạy native trên Windows, nhưng trên máy phổ thông (không GPU rời, RAM ít) việc cài Ollama

- tải model lớn là ma sát lớn và suy luận chậm. Feature này **chuyển khâu embedding sang chạy in-process**
  (không cần Ollama cho embed) để giảm phụ thuộc và cải thiện trải nghiệm máy yếu, đồng thời **gợi ý cỡ model
  chat phù hợp cấu hình máy**. Chat generation vẫn qua Ollama như trước.

Đây **đảo một phần** quyết định 031 ("embedding LUÔN chạy qua Ollama") — đã ghi nhận ở ADR 059.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Lập chỉ mục & hỏi đáp không cần Ollama cho embedding (Priority: P1)

Người dùng nạp tài liệu và hỏi đáp có trích dẫn mà **không cần Ollama phục vụ khâu embedding**. Việc nhúng
văn bản (khi lập chỉ mục nguồn và khi truy vấn) chạy ngay trong ứng dụng. Lần đầu, ứng dụng tải model
embedding (~120MB) một lần, hiện chỉ báo riêng tư (egress); sau đó chạy hoàn toàn offline.

**Why this priority**: Đây là giá trị cốt lõi — bỏ một nửa phụ thuộc Ollama, giúp máy yếu/Windows dùng được
RAG mà không phải dựng thêm dịch vụ. Không có phần này thì cả feature vô nghĩa.

**Independent Test**: Tắt Ollama hoàn toàn, nạp một tài liệu mới → nguồn xử lý tới trạng thái sẵn sàng và
hỏi đáp trả lời có chip `[n]` trỏ đúng nguồn/vị trí. Việc chip `[n]` map chính xác chứng minh locator không
đổi khi đổi engine embedding.

**Acceptance Scenarios**:

1. **Given** Ollama đang tắt và model embedding đã tải, **When** người dùng nạp một tài liệu mới, **Then**
   nguồn được nhúng in-process và đạt trạng thái "sẵn sàng" với số chunk > 0.
2. **Given** một notebook đã lập chỉ mục bằng engine mới, **When** người dùng đặt câu hỏi có trong nguồn,
   **Then** câu trả lời kèm chip `[n]` mở đúng nguồn và cuộn tới đúng đoạn (locator gốc giữ nguyên).
3. **Given** câu hỏi không có thông tin trong nguồn, **When** truy vấn, **Then** hệ thống trả lời "không tìm
   thấy trong nguồn" (ngưỡng liên quan đã hiệu chỉnh cho engine mới), không bịa.
4. **Given** model embedding **chưa** tải và máy đang offline, **When** người dùng nạp nguồn hoặc hỏi,
   **Then** hệ thống báo cần tải model (một lần, có chỉ báo egress) thay vì lỗi mập mờ.

---

### User Story 2 - Tái lập chỉ mục dữ liệu cũ tự động ở nền (Priority: P2)

Người dùng đã có notebook/nguồn lập chỉ mục bằng engine embedding cũ (qua Ollama, 768 chiều). Sau khi cập
nhật ứng dụng, dữ liệu cũ **không tương thích** với engine mới (384 chiều, không gian ngữ nghĩa khác). Ứng
dụng tự phát hiện và **nhúng lại toàn bộ ở nền**, hiện tiến độ, không chặn thao tác khác.

**Why this priority**: Bảo toàn dữ liệu người dùng đã nạp — không bắt họ nạp lại thủ công. Là điều kiện để
nâng cấp không phá vỡ trải nghiệm hiện có.

**Independent Test**: Với một notebook có sẵn vector cũ, khởi động ứng dụng bản mới → xuất hiện tiến độ "đang
tái lập chỉ mục"; sau khi hoàn tất, hỏi đáp trả về kết quả đúng với chip `[n]`. Tắt ứng dụng giữa chừng rồi
mở lại → quá trình tiếp tục từ chỗ dang dở (không bắt đầu lại từ đầu, không hỏng dữ liệu).

**Acceptance Scenarios**:

1. **Given** dữ liệu vector cũ (phiên bản model khác), **When** khởi động ứng dụng bản mới, **Then** một
   tiến trình nền bắt đầu nhúng lại toàn bộ chunk và hiển thị tiến độ.
2. **Given** tiến trình tái lập chỉ mục đang chạy, **When** người dùng mở một notebook chưa nhúng lại xong,
   **Then** hệ thống báo "đang tái lập chỉ mục" thay vì trả kết quả sai/thiếu.
3. **Given** tái lập chỉ mục đang ở giữa chừng, **When** người dùng tắt rồi mở lại ứng dụng, **Then** quá
   trình tiếp tục từ phần chưa xong (idempotent, resume) và không tạo bản trùng.
4. **Given** tái lập chỉ mục hoàn tất, **When** khởi động các lần sau, **Then** hệ thống nhận diện dữ liệu đã
   ở phiên bản mới và **không** chạy lại tiến trình.

---

### User Story 3 - Gợi ý model chat theo cấu hình máy + kiểm tra Ollama (Priority: P3)

Trong phần cài đặt AI, người dùng thấy **gợi ý cỡ model chat phù hợp RAM máy** và trạng thái Ollama (đã cài/
đang chạy? model đang chọn đã tải chưa?) kèm hướng dẫn khắc phục. Hệ thống chỉ gợi ý, không tự tải.

**Why this priority**: Giảm hụt hẫng khi máy yếu chọn model quá lớn (chậm/treo) hoặc chưa cài Ollama/model.
Hữu ích nhưng không chặn giá trị cốt lõi ở P1/P2.

**Independent Test**: Mở phần cài đặt AI trên máy có RAM biết trước → thấy gợi ý cỡ model đúng khoảng RAM; khi
Ollama chưa chạy hoặc model chưa tải, thấy chỉ báo trạng thái và hướng dẫn tương ứng.

**Acceptance Scenarios**:

1. **Given** máy có RAM < 8GB, **When** mở cài đặt AI, **Then** hệ thống gợi ý cỡ model nhỏ (khoảng 3B) và
   giải thích ngắn gọn lý do.
2. **Given** máy có RAM 8–16GB (hoặc > 16GB), **When** mở cài đặt AI, **Then** gợi ý cỡ model tương ứng
   (7–8B / lớn hơn).
3. **Given** Ollama chưa chạy hoặc model đang chọn chưa tải, **When** mở cài đặt AI, **Then** hiển thị trạng
   thái rõ ràng và hướng dẫn khắc phục; hệ thống **không** tự tải model.

---

### Edge Cases

- **Model embedding tải lỗi/gián đoạn mạng** → báo lỗi rõ, cho thử lại; không để nguồn kẹt trạng thái mập mờ.
- **Nguồn không có văn bản** (vd ảnh không chữ) → vẫn "sẵn sàng" với 0 chunk, không có gì để nhúng lại.
- **Tái lập chỉ mục đang chạy khi người dùng nạp nguồn mới** → nguồn mới nhúng bằng engine mới ngay; không
  xung đột với hàng đợi nền.
- **Chuỗi rỗng/quá dài khi nhúng** → cắt/chuẩn hoá an toàn; không rơi tiến trình.
- **Ollama bật cho chat nhưng embedding đã in-process** → chip riêng tư chỉ hiện khi thực sự có egress (chat
  online hoặc tải model), không hiện nhầm cho embedding local.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hệ thống PHẢI nhúng văn bản (chunk khi lập chỉ mục và câu truy vấn) **trong tiến trình ứng
  dụng**, không phụ thuộc dịch vụ Ollama cho khâu embedding.
- **FR-002**: Hệ thống PHẢI dùng một model embedding đa ngôn ngữ phù hợp tiếng Việt, cố định ở v1 (không cho
  người dùng đổi qua cài đặt).
- **FR-003**: Hệ thống PHẢI áp đúng quy ước tiền tố của model khi nhúng (phân biệt vai trò "truy vấn" và
  "đoạn văn") để bảo đảm chất lượng xếp hạng.
- **FR-004**: Lần đầu cần model embedding, hệ thống PHẢI tải một lần, hiển thị **chỉ báo egress** (dùng chung
  cơ chế hiện có), lưu cache cục bộ và chạy offline sau đó.
- **FR-005**: Hệ thống PHẢI hiệu chỉnh ngưỡng "liên quan/không liên quan" cho engine mới sao cho hành vi
  "không tìm thấy trong nguồn" vẫn đúng (không trả rác, không bỏ sót rõ ràng).
- **FR-006** (Kiểm chứng được — Constitution II): Đổi engine embedding CHỈ ĐƯỢC đổi **vector dùng để xếp
  hạng**; mỗi chunk PHẢI giữ nguyên locator gốc (trang/ký tự/thời điểm/vùng ảnh) để chip `[n]` map chính xác.
- **FR-007**: Hệ thống PHẢI lưu **phiên bản model embedding** gắn với dữ liệu vector để phát hiện khi dữ liệu
  cũ không còn tương thích.
- **FR-008**: Khi phát hiện dữ liệu vector ở phiên bản cũ, hệ thống PHẢI **tự động nhúng lại toàn bộ chunk ở
  nền**, hiển thị tiến độ, và KHÔNG chặn các thao tác khác của người dùng.
- **FR-009**: Tiến trình tái lập chỉ mục PHẢI **idempotent và resume được** — tắt ứng dụng giữa chừng rồi mở
  lại thì tiếp tục phần chưa xong, không tạo bản trùng, không hỏng dữ liệu.
- **FR-010**: Khi một notebook **chưa** tái lập chỉ mục xong, hệ thống PHẢI báo "đang tái lập chỉ mục" thay
  vì trả kết quả hỏi đáp sai/thiếu.
- **FR-011**: Sau khi tái lập chỉ mục hoàn tất, các lần khởi động sau PHẢI nhận diện dữ liệu đã ở phiên bản
  mới và KHÔNG chạy lại tiến trình.
- **FR-012**: Phần cài đặt AI PHẢI **gợi ý cỡ model chat theo RAM máy** (nhỏ/vừa/lớn theo các mốc RAM) kèm
  giải thích ngắn.
- **FR-013**: Phần cài đặt AI PHẢI hiển thị **trạng thái Ollama** (đã cài/đang chạy? model đang chọn đã tải
  chưa?) và hướng dẫn khắc phục; hệ thống KHÔNG tự tải model.
- **FR-014** (Constitution I & III): Toàn bộ nhúng/lập chỉ mục/truy vấn PHẢI chạy ở tiến trình chính; giao
  diện KHÔNG trực tiếp chạm model/mạng; hệ thống KHÔNG ghi log nội dung câu hỏi/đoạn văn/đường dẫn tệp.

### Key Entities

- **Vector chỉ mục (embedding index)**: biểu diễn số của mỗi chunk, gắn với chunk theo id; đặc trưng bởi số
  chiều và **phiên bản model embedding**. Dữ liệu cũ và mới khác chiều/không gian → không dùng lẫn.
- **Phiên bản model embedding (embedding_model_version)**: định danh model + số chiều, dùng để so khớp và
  kích hoạt tái lập chỉ mục khi lệch.
- **Trạng thái tái lập chỉ mục (reindex state)**: theo dõi chunk/notebook đã nhúng lại để hỗ trợ tiến độ,
  idempotent và resume.
- **Gợi ý model theo RAM**: ánh xạ khoảng RAM máy → cỡ model chat khuyến nghị (dữ liệu tĩnh, không rời máy).
- **Trạng thái Ollama (health)**: đã cài/đang chạy, model đang chọn đã tải chưa (chỉ phục vụ chat).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Với Ollama tắt hoàn toàn, người dùng nạp một tài liệu mới và nhận câu trả lời có chip `[n]`
  trỏ đúng nguồn — chứng minh embedding không còn cần Ollama.
- **SC-002**: 100% chip `[n]` trong câu trả lời (trên bộ tài liệu kiểm thử) mở đúng nguồn và cuộn tới đúng
  đoạn — locator không đổi khi đổi engine embedding.
- **SC-003**: Sau khi tái lập chỉ mục hoàn tất, chất lượng hỏi đáp trên bộ câu hỏi kiểm thử không kém hơn rõ
  rệt so với trước (số câu trả lời đúng không giảm; "không tìm thấy" không tăng đột biến).
- **SC-004**: Tắt ứng dụng giữa lúc tái lập chỉ mục rồi mở lại → tiến trình tiếp tục và hoàn tất, không có
  chunk trùng và không có chunk bị bỏ sót.
- **SC-005**: Trong phần cài đặt AI, gợi ý cỡ model khớp đúng khoảng RAM của máy thử (3 mốc RAM cho 3 kết quả
  khác nhau) và trạng thái Ollama phản ánh đúng thực tế (đang chạy / chưa chạy / model chưa tải).
- **SC-006**: Không có egress ngoài ý muốn: chỉ báo riêng tư chỉ xuất hiện khi tải model lần đầu hoặc khi
  chat online — KHÔNG xuất hiện cho embedding local thường ngày.

## Assumptions

- Model embedding cố định ở v1 (đa ngôn ngữ, nhẹ, hợp máy yếu); không cho đổi qua cài đặt (chốt ADR C2).
- Migration = **nhúng lại nền toàn bộ** khi phát hiện lệch phiên bản (chốt ADR C3); không migrate tăng dần
  theo notebook, không chạy song song nhiều model embedding.
- Chat vẫn qua Ollama/ProviderRegistry (031) — không bundle engine chat trong phạm vi này.
- Cơ chế tải model lần đầu + chỉ báo egress tái dùng từ 045/031 (không thêm kênh egress mới).
- Retrieval hybrid RRF/MMR (055) đứng **sau** bước nhúng — không đổi trong phạm vi này.

## Out of Scope

- Bundle engine chat cục bộ (node-llama-cpp) — chat vẫn dùng Ollama.
- Tự tải/tự chọn model chat (chỉ gợi ý + hướng dẫn).
- Cho người dùng đổi model embedding qua cài đặt (cố định v1).
- Đa model embedding song song / migrate tăng dần theo từng notebook.
- Thay đổi thuật toán truy xuất (rewrite/hybrid/RRF/MMR của 055).
