# Feature Specification: Cải tiến RAG — query rewriting + hybrid search

**Feature Branch**: `055-rag-enhance`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Nâng cấp chất lượng truy xuất của tính năng hỏi đáp có trích dẫn (013)…"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Câu hỏi nối tiếp hiểu đúng ngữ cảnh (Priority: P1)

Người dùng đang hỏi đáp về một notebook. Sau khi hỏi "Hợp đồng này quy định thời hạn bao lâu?", họ hỏi
tiếp "Thế còn điều khoản phạt của **nó**?". Hệ thống hiểu "nó" = hợp đồng đang nói tới (từ lịch sử hội
thoại), truy xuất đúng đoạn về điều khoản phạt và trả lời có chip `[n]` chính xác.

**Why this priority**: Câu hỏi nối tiếp với đại từ/tham chiếu là mẫu hội thoại phổ biến nhất; hiện tại
truy xuất theo nguyên văn câu ("điều khoản phạt của nó") thường trượt vì thiếu ngữ cảnh. Đây là cải thiện
chất lượng cảm nhận rõ nhất.

**Independent Test**: Hỏi 1 câu, rồi hỏi câu nối tiếp dùng đại từ tham chiếu → câu trả lời thứ hai vẫn
đúng chủ đề và có chip `[n]` trỏ đúng đoạn.

**Acceptance Scenarios**:

1. **Given** một lượt hỏi trước về chủ thể X, **When** người dùng hỏi tiếp bằng câu chứa đại từ tham
   chiếu X, **Then** hệ thống truy xuất đúng đoạn liên quan X và trả lời có trích dẫn chính xác.
2. **Given** một câu hỏi ngắn/mơ hồ, **When** người dùng gửi, **Then** hệ thống vẫn truy xuất được đoạn
   liên quan (không trả "không tìm thấy" chỉ vì câu quá ngắn).

---

### User Story 2 - Tìm đúng theo tên riêng / thuật ngữ chính xác (Priority: P1)

Người dùng hỏi về một tên riêng, mã số, hoặc thuật ngữ hiếm xuất hiện nguyên văn trong tài liệu (ví dụ
"Điều 47", "Nghị định 13/2023", tên người). Hệ thống tìm đúng đoạn chứa cụm đó — kể cả khi tìm theo ngữ
nghĩa (embedding) bỏ sót — và trả lời có chip `[n]`.

**Why this priority**: Người dùng mục tiêu (luật sư, nhà nghiên cứu) thường tra cứu theo cụm chính xác;
tìm chỉ theo ngữ nghĩa hay trượt tên riêng/mã số. Ngang P1.

**Independent Test**: Hỏi câu chứa một cụm chính xác có trong 1 tài liệu → đoạn chứa cụm đó nằm trong ngữ
cảnh và được trích dẫn.

**Acceptance Scenarios**:

1. **Given** một tài liệu chứa cụm chính xác "Điều 47", **When** người dùng hỏi về "Điều 47", **Then**
   đoạn chứa "Điều 47" được đưa vào ngữ cảnh và trích dẫn, kể cả khi tìm ngữ nghĩa xếp nó thấp.
2. **Given** cụm có dấu tiếng Việt, **When** người dùng gõ không dấu (hoặc ngược lại), **Then** vẫn khớp
   (không phân biệt dấu).

---

### User Story 3 - Ngữ cảnh đa dạng, ít trùng lặp (Priority: P2)

Khi nhiều đoạn gần giống nhau cùng liên quan, hệ thống chọn các đoạn **đa dạng** (không lặp cùng một ý)
để ngữ cảnh bao phủ rộng hơn, giúp câu trả lời đầy đủ hơn.

**Why this priority**: Cải thiện chất lượng câu trả lời cho câu hỏi rộng; ít cấp thiết hơn US1/US2.

**Independent Test**: Hỏi câu mà corpus có nhiều đoạn gần trùng → ngữ cảnh không bị lấp đầy bởi các bản
gần-trùng của cùng một đoạn.

**Acceptance Scenarios**:

1. **Given** nhiều đoạn gần trùng cùng liên quan, **When** truy xuất, **Then** ngữ cảnh gồm các đoạn đa
   dạng thay vì nhiều bản gần-trùng của một đoạn.

---

### Edge Cases

- **Không có đoạn liên quan** (cả ngữ nghĩa lẫn từ khoá) → giữ nguyên hành vi "không tìm thấy trong nguồn"
  (KHÔNG bịa).
- **Bước viết lại câu hỏi lỗi/quá lâu** → dùng câu hỏi gốc, không chặn luồng (câu trả lời vẫn ra).
- **Tìm theo từ khoá lỗi** → lùi về chỉ tìm ngữ nghĩa (vector-only), không chặn.
- **Câu hỏi đầu tiên (không có lịch sử)** → viết lại chỉ mở rộng/làm rõ, không cần giải tham chiếu.
- **Provider online đang bật** → bước viết lại câu hỏi rời máy → chỉ báo riêng tư phản ánh đúng (như khi
  hỏi đáp online hiện tại).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Trước khi truy xuất, hệ thống MUST viết lại câu hỏi bằng mô hình ngôn ngữ: giải tham chiếu
  hội thoại (dùng vài lượt gần nhất của lịch sử chat) + làm rõ/mở rộng câu ngắn hoặc mơ hồ.
- **FR-002**: Việc viết lại MUST chạy cho mọi câu hỏi nhưng MUST bảo toàn nội dung khi câu đã rõ ràng (không
  bóp méo ý người dùng).
- **FR-003**: Hệ thống MUST NOT hiển thị câu hỏi đã viết lại cho người dùng (chạy ngầm; UI hỏi đáp giữ
  nguyên).
- **FR-004**: Nếu bước viết lại lỗi hoặc quá thời gian, hệ thống MUST dùng câu hỏi gốc và tiếp tục (không
  chặn).
- **FR-005**: Truy xuất MUST kết hợp tìm theo **ngữ nghĩa** và tìm theo **từ khoá chính xác**, rồi hợp
  nhất kết quả thành một danh sách xếp hạng.
- **FR-006**: Tìm theo từ khoá MUST khớp không phân biệt dấu tiếng Việt (gõ có dấu/không dấu đều khớp).
- **FR-007**: Hệ thống MUST đa dạng hoá tập đoạn đưa vào ngữ cảnh (giảm đoạn gần-trùng), trong ngân sách
  ngữ cảnh hiện có.
- **FR-008**: Nếu tìm theo từ khoá không khả dụng, hệ thống MUST lùi về chỉ tìm ngữ nghĩa (không chặn).
- **FR-009**: Khi không có đoạn liên quan, hệ thống MUST giữ hành vi "không tìm thấy trong nguồn" (không
  bịa) — KHÔNG đổi.
- **FR-010** (BẤT BIẾN — Constitution II): Mọi bước (viết lại / hợp nhất / đa dạng hoá) MUST chỉ đổi **đoạn
  nào được chọn** vào ngữ cảnh; mỗi đoạn MUST giữ vị trí gốc (locator) để chip `[n]` map chính xác về
  nguồn + vị trí. KHÔNG được tạo/suy diễn nội dung đoạn.
- **FR-011**: Chỉ mục tìm từ khoá MUST được tạo cho các đoạn hiện có (backfill) và đồng bộ khi thêm/xoá
  nguồn — không bỏ sót đoạn.
- **FR-012** (Constitution I): Viết lại + tìm ngữ nghĩa + tìm từ khoá MUST chạy cục bộ; nếu nhà cung cấp
  online đang bật thì bước viết lại đi ra ngoài — MUST dùng chung chỉ báo riêng tư hiện có, không phát sinh
  egress ngầm không được báo.
- **FR-013** (Constitution III): Toàn bộ chạy ở tiến trình chính; MUST NOT ghi log nội dung câu hỏi/đoạn.
- **FR-014**: Cải tiến MUST luôn bật (không có công tắc tắt ở Cài đặt).

### Key Entities _(include if feature involves data)_

- **Câu hỏi viết lại (rewritten query)**: dẫn xuất tạm từ câu hỏi gốc + lịch sử; dùng cho truy xuất; không
  lưu, không hiển thị.
- **Đoạn (Chunk) + Locator**: đơn vị trích dẫn — KHÔNG đổi; hybrid chỉ đổi thứ tự/tập chọn.
- **Chỉ mục từ khoá (keyword index)**: chỉ mục toàn văn trên nội dung đoạn để tìm BM25; đồng bộ với đoạn.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Với bộ câu hỏi nối tiếp có tham chiếu, tỷ lệ câu trả lời trích dẫn đúng đoạn tăng rõ so với
  hiện tại (đo trên tập kiểm thử thủ công; mục tiêu ≥ 80% câu nối tiếp trả lời đúng chủ đề).
- **SC-002**: 100% truy vấn chứa một cụm chính xác có trong tài liệu đưa được đoạn chứa cụm đó vào ngữ
  cảnh (khi đoạn tồn tại), kể cả khi tìm ngữ nghĩa xếp thấp.
- **SC-003**: Tìm từ khoá khớp đúng bất kể có/không dấu tiếng Việt (100% cặp có dấu ↔ không dấu trên tập
  mẫu).
- **SC-004**: Chip `[n]` vẫn map chính xác 100% về nguồn + vị trí gốc sau cải tiến (không hồi quy tính
  kiểm chứng được).
- **SC-005**: Độ trễ thêm do viết lại ở mức chấp nhận được (một lượt mô hình bổ sung); khi lỗi/timeout,
  câu trả lời vẫn ra bằng câu hỏi gốc (0% câu bị chặn do bước viết lại).
- **SC-006**: 0 yêu cầu mạng ngoài Internet khi dùng nhà cung cấp cục bộ; khi online, chỉ báo riêng tư
  phản ánh đúng bước viết lại.

## Assumptions

Quyết định đã chốt ở `docs/04-decisions/2026-07-13-rag-enhance-clarify.md` (Assumptions, KHÔNG cần làm rõ):

- **Viết lại câu hỏi** = mô hình ngôn ngữ cục bộ (nhà cung cấp active — Ollama local mặc định); luôn chạy,
  bảo toàn câu rõ; không hiển thị; lỗi → dùng câu gốc.
- **Hybrid** = tìm ngữ nghĩa (vector) + tìm từ khoá **BM25 (SQLite FTS5**, tokenizer unicode61
  remove_diacritics — không phân biệt dấu) → hợp nhất **RRF** (k=60) → đa dạng hoá **MMR** (λ≈0.7). Mỗi
  nhánh lấy top-K, MMR chọn ~6 đoạn vào ngữ cảnh. KHÔNG LLM-rerank, KHÔNG cross-encoder.
- **Migration #7**: bảng FTS5 external-content trên `chunk.text` (tiếp nối migration #6) + backfill đoạn
  hiện có; đồng bộ khi thêm/xoá đoạn.
- **Kế thừa**: 013 (retrieve/buildContext/citation/constants — TOP_K, ngưỡng liên quan, ngân sách ngữ
  cảnh); 027 (chat history cho viết lại); 031 (Ollama local + provider active + badge egress).
- **Bất biến**: hybrid/rewrite chỉ đổi đoạn nào chọn — locator + chip `[n]` chính xác giữ nguyên; "không
  tìm thấy" giữ nguyên; luôn bật (không toggle); không log nội dung.

### Ngoài phạm vi (v1)

- Xếp hạng lại bằng mô hình ngôn ngữ (LLM-rerank); mô hình cross-encoder; HyDE; tokenizer đa ngôn ngữ nâng
  cao; hiển thị câu hỏi viết lại cho người dùng; tinh chỉnh tham số qua Cài đặt.

### Dependencies

- `013-rag-qa`, `027-chat-history`, `031-online-provider` (đã merge).
