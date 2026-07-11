# Feature Specification: Hỏi đáp theo nguồn với trích dẫn kiểm chứng được (RAG Q&A)

**Feature Branch**: `013-rag-qa`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: hỏi đáp trong notebook — embed câu hỏi → truy hồi chunk (LanceDB) → LLM local
trả lời có chip trích dẫn [n] map về locator; 2 chế độ theo nguồn / mở rộng.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Hỏi và nhận câu trả lời có trích dẫn kiểm chứng được (Priority: P1)

Người dùng mở một notebook đã có nguồn "Sẵn sàng", vào cột Chat, gõ câu hỏi và gửi (chế độ mặc định "Theo
nguồn"). Hệ thống tìm các đoạn liên quan trong chính các nguồn của notebook, sinh câu trả lời **chỉ dựa trên
các đoạn đó**, chèn chip trích dẫn `[n]` tại chỗ dùng thông tin, và liệt kê nguồn ở cuối. Mỗi `[n]` ánh xạ
xác định tới đúng một đoạn (chunk) → nguồn → vị trí gốc (trang/đoạn), sẵn cho việc mở nguồn + highlight sau
này (feature 006).

**Why this priority**: Đây là lời hứa cốt lõi của sản phẩm ("kiểm chứng được") và là giá trị trung tâm nối
tiếp pipeline nạp nguồn. Là MVP nhỏ nhất mang giá trị: hỏi một câu và nhận câu trả lời có căn cứ trích dẫn.

**Independent Test**: Nạp một tài liệu, hỏi một câu có câu trả lời nằm trong tài liệu → nhận câu trả lời kèm
ít nhất một chip `[n]`; kiểm chip đó ánh xạ đúng tới đoạn/nguồn/vị trí thật (không trỏ sai, không trỏ đoạn
không tồn tại).

**Acceptance Scenarios**:

1. **Given** notebook có ≥1 nguồn "Sẵn sàng" và runtime AI sẵn sàng, **When** người dùng hỏi một câu mà tài
   liệu có chứa câu trả lời (chế độ Theo nguồn), **Then** hệ thống trả lời dựa trên nguồn, có ≥1 chip `[n]`,
   và mỗi `[n]` ánh xạ tới đúng chunk/nguồn/locator có thật.
2. **Given** một câu trả lời có chip `[3]`, **When** kiểm dữ liệu citation trả về, **Then** phần tử số 3 trỏ
   tới đúng chunk đã được dùng làm ngữ cảnh (id + source + locator khớp), không phải đoạn khác.
3. **Given** hệ thống sinh chip vượt phạm vi (vd `[9]` khi chỉ có 6 đoạn), **When** hậu xử lý câu trả lời,
   **Then** chip lỗi bị gỡ khỏi câu trả lời hiển thị và KHÔNG xuất hiện trong danh sách citation.

---

### User Story 2 - "Không tìm thấy trong nguồn" khi thiếu căn cứ (Priority: P1)

Người dùng hỏi (chế độ Theo nguồn) một câu mà các nguồn trong notebook **không chứa** câu trả lời. Hệ thống
KHÔNG được bịa; phải trả lời rõ ràng "Không tìm thấy trong nguồn" (không có chip trích dẫn).

**Why this priority**: Cùng độ ưu tiên P1 vì đây là mặt còn lại của "kiểm chứng được" — thà không trả lời còn
hơn bịa. Là ranh giới đạo đức/độ tin cậy của sản phẩm (Constitution II).

**Independent Test**: Hỏi một câu hoàn toàn ngoài phạm vi tài liệu ở chế độ Theo nguồn → hệ thống trả "Không
tìm thấy trong nguồn", không có chip, không có nội dung bịa.

**Acceptance Scenarios**:

1. **Given** notebook không có đoạn nào liên quan tới câu hỏi (chế độ Theo nguồn), **When** người dùng gửi,
   **Then** hệ thống trả "Không tìm thấy trong nguồn", danh sách citation rỗng.
2. **Given** notebook chưa có nguồn nào "Sẵn sàng", **When** người dùng mở cột Chat, **Then** ô nhập bị vô
   hiệu kèm gợi ý "Nạp nguồn để bắt đầu hỏi đáp".

---

### User Story 3 - Chế độ Mở rộng (dùng thêm kiến thức chung, gắn nhãn) (Priority: P2)

Người dùng chuyển công tắc sang "Mở rộng" rồi hỏi. Hệ thống được phép dùng kiến thức chung ngoài tài liệu,
nhưng phần không lấy từ nguồn phải được ghi rõ là **kiến thức chung (không dựa trên nguồn)**; phần lấy từ
nguồn vẫn có chip `[n]`.

**Why this priority**: Là chế độ thứ 2 trong MVP (OVERVIEW), hữu ích khi tài liệu không đủ nhưng người dùng
vẫn muốn hỗ trợ; đứng sau chế độ Theo nguồn (giá trị lõi + ràng buộc chặt hơn).

**Independent Test**: Ở chế độ Mở rộng, hỏi câu tài liệu không có → nhận câu trả lời từ kiến thức chung có
nhãn "không dựa trên nguồn"; hỏi câu tài liệu có → phần từ nguồn vẫn gắn `[n]`.

**Acceptance Scenarios**:

1. **Given** chế độ Mở rộng và câu hỏi ngoài tài liệu, **When** gửi, **Then** hệ thống trả lời từ kiến thức
   chung, phần ngoài nguồn được gắn nhãn "không dựa trên nguồn".
2. **Given** chế độ Mở rộng và câu hỏi tài liệu có chứa, **When** gửi, **Then** phần lấy từ nguồn vẫn có chip
   `[n]` ánh xạ đúng.

---

### User Story 4 - Hội thoại nhiều lượt trong phiên + xử lý runtime chưa sẵn sàng (Priority: P2)

Người dùng hỏi tiếp câu thứ hai dựa trên ngữ cảnh câu trước trong cùng phiên (hội thoại giữ trong phiên, mất
khi đóng). Nếu runtime AI (Ollama) chưa sẵn sàng hoặc chưa chọn model, cột Chat hiển thị hướng dẫn và không
cho gửi câu hỏi (không gửi request chắc chắn lỗi).

**Why this priority**: Multi-turn cải thiện trải nghiệm nhưng không chặn giá trị lõi (US1/US2 hoạt động với
câu hỏi đơn). Xử lý runtime là độ bền.

**Independent Test**: Hỏi 2 câu liên tiếp trong 1 phiên, câu 2 tham chiếu câu 1 → câu trả lời 2 hiểu ngữ
cảnh. Tắt runtime → cột Chat báo chưa sẵn sàng + vô hiệu gửi.

**Acceptance Scenarios**:

1. **Given** đã hỏi 1 câu, **When** hỏi câu tiếp nối trong cùng phiên, **Then** hệ thống dùng lịch sử hội
   thoại gần nhất để hiểu ngữ cảnh khi trả lời.
2. **Given** runtime AI chưa sẵn sàng (chưa chạy Ollama / chưa chọn model), **When** người dùng mở cột Chat,
   **Then** hiển thị hướng dẫn + vô hiệu ô gửi; không gửi request.
3. **Given** một phiên hội thoại, **When** người dùng đóng notebook rồi mở lại, **Then** lịch sử hội thoại
   trống (không persist ở MVP) — đúng kỳ vọng.

---

### Edge Cases

- **Câu hỏi quá dài** (> giới hạn): từ chối với thông báo thân thiện, không gửi.
- **Model sinh chip trỏ sai/không tồn tại**: hệ thống gỡ chip lỗi, câu trả lời phần còn lại vẫn hiển thị.
- **Search trả về đoạn kém liên quan** (vượt ngưỡng): coi như không có căn cứ → chế độ Theo nguồn báo "không
  tìm thấy".
- **Notebook có nguồn nhưng chưa nhúng xong** (đang xử lý): chỉ truy hồi từ nguồn đã "Sẵn sàng".
- **Câu trả lời rất dài / nhiều chip**: mọi chip đều phải ánh xạ đúng; danh sách citation dedup theo số.
- **Nội dung nhạy cảm**: không ghi log câu hỏi hay nội dung tài liệu.

## Requirements _(mandatory)_

### Functional Requirements

**Hỏi đáp & truy hồi**

- **FR-001**: Hệ thống PHẢI cho phép người dùng gửi câu hỏi tự do trong cột Chat của một notebook, kèm chế độ
  trả lời đã chọn (Theo nguồn / Mở rộng).
- **FR-002**: Hệ thống PHẢI truy hồi các đoạn (chunk) liên quan nhất **trong phạm vi notebook đó** (chỉ từ
  nguồn đã "Sẵn sàng") để làm ngữ cảnh trả lời.
- **FR-003**: Hệ thống PHẢI sinh câu trả lời bằng mô hình ngôn ngữ cục bộ dựa trên ngữ cảnh truy hồi + câu
  hỏi (và lịch sử hội thoại gần nhất trong phiên nếu có).

**Trích dẫn kiểm chứng được (NON-NEGOTIABLE — Constitution II)**

- **FR-004**: Ở chế độ Theo nguồn, hệ thống CHỈ được trả lời dựa trên ngữ cảnh truy hồi; nếu không đủ căn cứ,
  PHẢI trả lời "Không tìm thấy trong nguồn" và KHÔNG được bịa đặt.
- **FR-005**: Mỗi chip trích dẫn `[n]` trong câu trả lời PHẢI ánh xạ **xác định** tới đúng một chunk có thật
  trong ngữ cảnh, từ đó suy ra đúng nguồn (source) và đúng vị trí gốc (locator: trang + khoảng ký tự).
- **FR-006**: Hệ thống PHẢI hậu kiểm mọi chip `[n]`: chip trỏ ra ngoài tập đoạn ngữ cảnh PHẢI bị loại khỏi
  câu trả lời hiển thị và KHÔNG được đưa vào danh sách citation. (Không tin số do mô hình tự sinh mà không
  kiểm chứng.)
- **FR-007**: Hệ thống PHẢI trả về renderer: nội dung câu trả lời (đã làm sạch chip lỗi) + danh sách citation
  (số thứ tự → chunk id → source id/tên → locator) + cờ "không tìm thấy" khi áp dụng.
- **FR-008**: Ở chế độ Mở rộng, hệ thống được dùng kiến thức chung ngoài nguồn nhưng PHẢI gắn nhãn rõ phần
  không lấy từ tài liệu là "không dựa trên nguồn"; phần lấy từ nguồn vẫn có chip `[n]` hợp lệ.

**Trạng thái, giới hạn, độ bền**

- **FR-009**: Hệ thống PHẢI hiển thị trạng thái "đang trả lời" trong lúc chờ và hiển thị câu trả lời khi xong.
- **FR-010**: Khi notebook chưa có nguồn "Sẵn sàng", hệ thống PHẢI vô hiệu ô gửi và gợi ý người dùng nạp nguồn.
- **FR-011**: Khi runtime AI cục bộ chưa sẵn sàng (chưa chạy / chưa chọn model), hệ thống PHẢI hiển thị hướng
  dẫn trong cột Chat và KHÔNG gửi câu hỏi (tránh request chắc chắn lỗi).
- **FR-012**: Hệ thống PHẢI hỗ trợ hội thoại nhiều lượt **trong phiên** (dùng lịch sử gần nhất để hiểu ngữ
  cảnh câu tiếp nối); lịch sử KHÔNG cần lưu bền qua các lần mở lại (MVP).
- **FR-013**: Hệ thống PHẢI giới hạn độ dài câu hỏi; câu hỏi vượt giới hạn bị từ chối với thông báo thân thiện.

**Bảo mật & riêng tư (bất biến)**

- **FR-014**: Toàn bộ embed câu hỏi, truy hồi vector, đọc DB, và gọi mô hình PHẢI diễn ra ở tiến trình nền
  (main); renderer chỉ tương tác qua kênh liên tiến trình được whitelist. (Constitution III)
- **FR-015**: Hệ thống KHÔNG được ghi log câu hỏi người dùng hay nội dung tài liệu/ngữ cảnh. (Constitution III)
- **FR-016**: Việc hỏi đáp PHẢI chạy với mô hình cục bộ, không gửi dữ liệu ra ngoài ở chế độ mặc định.
  (Constitution I)

### Key Entities _(include if feature involves data)_

- **Câu hỏi (Question)**: chuỗi người dùng nhập, kèm `notebookId` + chế độ. Không lưu bền.
- **Ngữ cảnh truy hồi (Retrieval context)**: tập đoạn (chunk) liên quan nhất được đánh số `[1..k]`, mỗi đoạn
  gồm text + locator + nguồn cha. Tạm thời (per-request).
- **Câu trả lời (Answer)**: nội dung do mô hình sinh (đã hậu kiểm chip), cờ "không tìm thấy", chế độ đã dùng.
- **Trích dẫn (Citation)**: ánh xạ số `[n]` → `{ chunkId, sourceId, sourceTitle, locator }`. Là dữ liệu để
  feature source-viewer (006) mở nguồn + highlight.
- **Lượt hội thoại (Message/Turn)**: cặp câu hỏi + câu trả lời trong một phiên; giữ ở bộ nhớ phiên (renderer),
  không lưu bền.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Với câu hỏi có câu trả lời nằm trong tài liệu (chế độ Theo nguồn), người dùng nhận câu trả lời
  kèm ít nhất một trích dẫn ánh xạ đúng nguồn.
- **SC-002**: 100% chip `[n]` hiển thị trong câu trả lời ánh xạ tới một chunk **có thật** trong ngữ cảnh
  (không có chip trỏ sai hoặc trỏ đoạn không tồn tại) — kiểm chứng được.
- **SC-003**: Với câu hỏi ngoài phạm vi tài liệu (chế độ Theo nguồn), hệ thống trả "Không tìm thấy trong
  nguồn", KHÔNG bịa nội dung.
- **SC-004**: Câu trả lời chế độ Mở rộng phân biệt rõ phần có nguồn (`[n]`) và phần kiến thức chung (nhãn
  "không dựa trên nguồn").
- **SC-005**: Không có mục log nào chứa câu hỏi người dùng hay nội dung tài liệu (kiểm qua rà log chi tiết).
- **SC-006**: Khi runtime AI chưa sẵn sàng hoặc notebook chưa có nguồn ready, người dùng KHÔNG gửi được câu
  hỏi vô ích (ô gửi bị chặn) và thấy hướng dẫn rõ ràng.
- **SC-007**: Câu hỏi vượt giới hạn độ dài luôn bị từ chối trước khi xử lý.

## Assumptions

Các quyết định đã chốt ở `docs/04-decisions/2026-07-11-rag-qa-clarify.md` +
`2026-07-11-rag-retrieval-strategy.md` (không còn ẩn số):

- **A1 — Truy hồi**: top-k=6 + ngưỡng liên quan; 0 hit / mọi hit vượt ngưỡng → "không tìm thấy trong nguồn".
- **A2 — Ghép context**: ~6000 ký tự, thêm chunk theo điểm số tới khi đầy, **bỏ nguyên chunk** điểm thấp
  (không cắt giữa chunk → locator không lệch); mỗi chunk gắn `[n]` + nhãn nguồn.
- **A3 — System prompt**: 2 template (grounded / open) theo ADR retrieval-strategy.
- **A4 — Không streaming**: giữ `LLMProvider.chat` hiện tại; UI hiện "đang trả lời…" rồi show trọn.
- **A5 — Chip [n] hậu kiểm**: đánh số context `[1..k]`, regex trích `[n]`, `n∈[1..k]`→map citation, ngoài
  phạm vi→gỡ chip; danh sách citation chỉ gồm chip hợp lệ & thực xuất hiện.
- **A6 — Model bịa số**: gỡ chip lỗi, câu trả lời phần còn lại vẫn hiển thị, log cảnh báo (redact).
- **A7 — Cả 2 chế độ** grounded + open đều hoạt động.
- **A8 — Lịch sử in-memory phiên** (renderer), không persist, không migration mới.
- **A9 — Multi-turn**: gửi ~6 message gần nhất làm ngữ cảnh chat; retrieval chỉ dùng câu hỏi hiện tại.
- **A10 — 0 nguồn / 0 chunk**: notebook chưa có nguồn ready → vô hiệu ô nhập; search rỗng → grounded "không
  tìm thấy", open trả lời kiến thức chung gắn nhãn.
- **A11 — Runtime chưa sẵn sàng**: tái dùng `RuntimeStatus` (007), banner inline cột Chat + vô hiệu gửi.
- **A12 — IPC**: 1 kênh `rag:ask` (`{notebookId,question,mode,history}`→`{answer,citations,notFound,modeUsed}`).
- **A13 — Giới hạn câu hỏi**: 2000 ký tự.
- **A14 — Gap code (additive)**: `VectorStore.search(vector,notebookId,topK)→VectorSearchHit[]{id,sourceId,
score}` (mở rộng 011); `source-repo.getChunksByIds(ids)→Chunk[]`. `LLMProvider.chat` KHÔNG đổi.
- **A15 — "Đang trả lời"**: spinner đơn giản.
- Kế thừa: chunk + `Locator` + vector-store + source-repo (011), `ProviderRegistry`/`LLMProvider.{chat,embed}`
  - `RuntimeStatus` (007), khuôn IPC whitelisted + `ChannelResponse` (001/007/009/011).
- Ngoài phạm vi: source-viewer + highlight thật (006), Studio (007-ui), persist hội thoại, streaming,
  Audio/Video/Ảnh (Pha 2).
