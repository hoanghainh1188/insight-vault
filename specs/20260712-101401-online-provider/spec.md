# Feature Specification: AI online (tùy chọn) — Claude · Google · OpenAI

**Feature Branch**: `031-online-provider`

**Created**: 2026-07-12

**Status**: Draft

**Input**: Bổ sung tùy chọn dùng AI online (3 nhà cung cấp: Claude/Anthropic, Google/Gemini, OpenAI) bằng
API key riêng của người dùng, bên cạnh AI cục bộ (Ollama) đã có. Local-first vẫn mặc định; mọi egress hiển
thị chỉ báo; key lưu an toàn (keytar), không log; trích dẫn `[n]` không đổi.

## Clarifications

### Session 2026-07-12

- Q: Embedding cho RAG khi dùng provider online? → A: **LUÔN dùng Ollama local** (nhất quán vector index;
  online chỉ lo `chat()`).
- Q: Áp online cho tính năng nào? → A: **Cả Chat (rag-qa) + Studio** (đều qua `LLMProvider.chat()`).
- Q: Cơ chế active provider? → A: **1 provider active toàn app, độc quyền** (bật 1 → tắt các cái khác; không
  bật online nào → về local Ollama).
- Q: Cách chọn model? → A: **Preset dropdown mỗi provider + tùy chọn "Khác" nhập tay**.
- Q: Lỗi/timeout online? → A: **Báo lỗi rõ, KHÔNG auto-fallback về Ollama**; timeout 60s; 401/403 = khóa sai;
  429 = giới hạn tốc độ (không auto-retry).
- Q: Chỉ báo egress? → A: **Badge trạng thái + note tĩnh + confirm 1 lần khi BẬT** (không confirm mỗi request).

Nguồn đầy đủ: `docs/04-decisions/2026-07-12-online-provider-clarify.md`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Cấu hình nhà cung cấp AI online (Priority: P1)

Người dùng vào Cài đặt, chọn 1 trong 3 nhà cung cấp (Claude/Gemini/OpenAI), nhập API key của chính mình,
chọn model, kiểm tra kết nối, và bật nhà cung cấp đó làm nguồn AI đang dùng.

**Why this priority**: Là cửa ngõ của toàn bộ tính năng — không cấu hình được thì không dùng được online.

**Independent Test**: Ở màn Cài đặt, nhập API key hợp lệ cho 1 provider → "Kiểm tra kết nối" báo OK → bật
provider → nó trở thành nguồn AI đang dùng; key hiển thị dạng che, không lưu plaintext.

**Acceptance Scenarios**:

1. **Given** chưa nhập key cho provider X, **When** mở Cài đặt, **Then** hàng provider X hiện "Chưa nhập khóa
   API" và không thể bật.
2. **Given** đã nhập key hợp lệ + chọn model, **When** bấm "Kiểm tra kết nối", **Then** báo trạng thái xác
   thực rõ ràng (thành công / lỗi khóa / lỗi mạng).
3. **Given** đã có key hợp lệ, **When** bật provider X, **Then** X thành **active** và các provider online
   khác **tự tắt** (độc quyền); nếu đang bật một provider khác thì hiện **confirm 1 lần**.
4. **Given** provider X đang bật, **When** xoá key của X, **Then** X tắt + về local (hoặc provider còn key).
5. **Given** một key đã nhập, **When** hiển thị lại, **Then** key ở dạng che (không lộ toàn bộ) và không lưu
   plaintext.

---

### User Story 2 - Hỏi đáp & Studio dùng AI online (Priority: P1)

Khi có provider online đang bật, câu trả lời Chat và bản tổng hợp Studio được sinh bởi provider đó; trích
dẫn `[n]` vẫn kiểm chứng được.

**Why this priority**: Là giá trị sử dụng thực tế của tính năng.

**Independent Test**: Bật provider online → hỏi 1 câu ở Chat → câu trả lời do provider online sinh, chip
`[n]` mở đúng nguồn/đoạn; tạo 1 bản Studio → cũng do provider online sinh.

**Acceptance Scenarios**:

1. **Given** provider online đang active, **When** hỏi ở Chat, **Then** câu trả lời do provider đó sinh và
   chip `[n]` giữ hành vi mở đúng nguồn/đoạn.
2. **Given** provider online đang active, **When** tạo kết quả Studio (tóm tắt/ý chính/FAQ/dàn ý), **Then**
   kết quả do provider đó sinh.
3. **Given** không có provider online nào bật, **When** hỏi/tạo Studio, **Then** dùng local Ollama (hành vi
   007 không đổi).
4. **Given** bất kỳ provider chat nào đang active, **When** nạp nguồn / truy hồi RAG, **Then** embedding vẫn
   dùng Ollama local (nhất quán vector).

---

### User Story 3 - Riêng tư & ranh giới bảo mật (Priority: P1)

Người dùng luôn biết dữ liệu có rời máy hay không; API key và lời gọi mạng được cô lập ở tiến trình chính.

**Why this priority**: Local-first + ranh giới bảo mật là bất biến của sản phẩm.

**Independent Test**: Bật provider online → badge riêng tư ở header đổi sang trạng thái "đang gửi ra ngoài";
tắt hết → về "chạy cục bộ". Không có API key/nội dung nào bị ghi log.

**Acceptance Scenarios**:

1. **Given** không provider online nào bật, **When** xem header, **Then** badge = "Chạy cục bộ · dữ liệu
   không rời máy".
2. **Given** ≥1 provider online bật, **When** xem header, **Then** badge đổi sang trạng thái phản ánh có
   egress ra ngoài.
3. **Given** người dùng bật provider online lần đầu, **When** bật toggle, **Then** hiện **confirm 1 lần** nêu
   rõ dữ liệu sẽ gửi tới nhà cung cấp nào.
4. **Given** app đang chạy, **When** kiểm log, **Then** KHÔNG có API key, câu hỏi, hay đoạn nguồn trong log.
5. **Given** kiến trúc renderer, **When** kiểm truy cập, **Then** renderer KHÔNG chạm trực tiếp API key /
   HTTP client (chỉ qua kênh whitelisted ở main).

---

### User Story 4 - Xử lý lỗi online rõ ràng (Priority: P2)

Khi provider online lỗi (khóa sai, hết mạng, giới hạn tốc độ, timeout), người dùng nhận thông báo rõ ràng,
KHÔNG bị âm thầm chuyển provider.

**Why this priority**: Trải nghiệm tin cậy + giữ chỉ báo trung thực; nhưng dưới P1 vì là đường lỗi.

**Independent Test**: Nhập key sai → hỏi 1 câu → báo lỗi "khóa API không hợp lệ", KHÔNG tự trả lời bằng
Ollama.

**Acceptance Scenarios**:

1. **Given** key sai/hết hạn, **When** gọi provider, **Then** báo "Khóa API không hợp lệ hoặc đã hết hạn"
   (401/403), không auto-fallback.
2. **Given** bị giới hạn tốc độ (429), **When** gọi, **Then** báo "Nhà cung cấp đang giới hạn tốc độ, thử lại
   sau" (không auto-retry ở v1).
3. **Given** mạng chậm/không phản hồi, **When** quá **60s**, **Then** báo lỗi timeout rõ ràng.
4. **Given** mất mạng giữa chừng, **When** đang chờ trả lời, **Then** báo lỗi rõ, không silent fail.

---

### Edge Cases

- Bật provider online rồi tắt Wi-Fi → hỏi → báo lỗi mạng rõ, badge vẫn phản ánh "online đang bật".
- Nhiều provider có key hợp lệ → chỉ 1 active tại 1 thời điểm (độc quyền).
- Model nhập tay sai tên → provider trả lỗi → hiển thị lỗi (không crash).
- Xoá key của provider đang active → tự tắt, về local (hoặc provider còn key nếu người dùng chọn).
- Chọn Claude (không có embedding API) → embedding vẫn chạy Ollama, retrieval bình thường.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hệ thống MUST cho phép cấu hình 3 nhà cung cấp AI online — Claude (Anthropic), Google (Gemini),
  OpenAI — mỗi cái có: nhập/xoá API key, chọn model, kiểm tra kết nối, bật/tắt.
- **FR-002**: API key MUST được lưu qua kho bí mật của HĐH (keytar / OS keychain), KHÔNG lưu plaintext trong
  SQLite/electron-store/JSON, và KHÔNG bao giờ ghi vào log.
- **FR-003**: Tại một thời điểm chỉ MUST có **tối đa 1 provider online active**; bật một provider online phải
  tự tắt các provider online khác (độc quyền). Không provider online nào bật → hệ thống dùng **Ollama local**.
- **FR-004**: Khi có provider online active, câu trả lời **Chat** và kết quả **Studio** MUST được sinh bởi
  provider đó (qua `LLMProvider.chat()`).
- **FR-005**: **Embedding** (ingestion + truy hồi RAG) MUST luôn dùng Ollama local, độc lập với provider chat
  đang active (giữ nhất quán vector index).
- **FR-006**: Trích dẫn `[n]` MUST giữ hành vi kiểm chứng (mở đúng nguồn/đoạn) bất kể provider nào đang active.
- **FR-007**: Mọi lời gọi mạng ra nhà cung cấp online + đọc/ghi API key MUST chỉ diễn ra ở **tiến trình
  chính**; renderer chỉ tương tác qua kênh IPC whitelisted, KHÔNG chạm trực tiếp key/HTTP client.
- **FR-008**: Chỉ báo riêng tư (badge header) MUST phản ánh đúng: "chạy cục bộ" khi không provider online nào
  bật; trạng thái "có egress" khi ≥1 provider online bật.
- **FR-009**: Khi người dùng BẬT một provider online, hệ thống MUST hiện **xác nhận 1 lần** nêu rõ dữ liệu sẽ
  gửi tới nhà cung cấp nào (không xác nhận lặp mỗi request).
- **FR-010**: Khi provider online lỗi, hệ thống MUST báo lỗi rõ ràng và KHÔNG âm thầm fallback về Ollama:
  401/403 = khóa không hợp lệ; 429 = giới hạn tốc độ; quá 60s = timeout; mất mạng = lỗi mạng.
- **FR-011**: Model cho mỗi provider MUST hỗ trợ **preset danh sách** phổ biến + tùy chọn **nhập tay** ("Khác");
  tên model nhập tay MUST được validate ở boundary (độ dài/ký tự hợp lệ).
- **FR-012**: Thay đổi này MUST KHÔNG phá vỡ hành vi AI cục bộ (Ollama) hiện có (007-ai-runtime) — chỉ cắm
  thêm provider, không sửa provider local.
- **FR-013**: Mọi input từ renderer tới kênh online (provider id, model, key, active) MUST được validate ở
  boundary; giá trị lạ MUST bị từ chối với lỗi thân thiện (không âm thầm hạ cấp).

### Key Entities _(include if feature involves data)_

- **OnlineProviderConfig** — mỗi provider: `id` (anthropic/gemini/openai), `enabled` (bật/tắt), `model` (đã
  chọn). Lưu qua electron-store. **KHÔNG chứa apiKey.**
- **ApiKey (secret)** — chuỗi khóa API theo provider id; lưu **chỉ ở keytar**. Không entity DB.
- **ActiveProvider** — provider đang active (1 giá trị: local hoặc 1 provider online). Suy ra từ config.
- **PrivacyState** (đã có, 001/007) — `mode` + `label`; nay tính thêm theo active provider online.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Người dùng cấu hình + bật được 1 trong 3 provider online và nhận câu trả lời do provider đó
  sinh ở cả Chat và Studio.
- **SC-002**: 100% chip `[n]` giữ hành vi mở đúng nguồn/đoạn khi trả lời bằng provider online.
- **SC-003**: API key KHÔNG xuất hiện trong bất kỳ file lưu trữ plaintext hay log nào (kiểm được).
- **SC-004**: Badge riêng tư khớp 100% trạng thái thực (local ↔ online) trong mọi thao tác bật/tắt.
- **SC-005**: Embedding luôn dùng Ollama local — đổi provider chat KHÔNG làm hỏng/khác vector index.
- **SC-006**: Mọi đường lỗi online (khóa sai/429/timeout/mất mạng) hiển thị thông báo rõ ràng, KHÔNG
  auto-fallback.
- **SC-007**: 0 hồi quy — luồng local Ollama (007), hỏi đáp (013), Studio (021), mở nguồn (019) vẫn đúng.

## Assumptions

- **A1 — Embedding LUÔN local Ollama** (online chỉ `chat()`); provider online không dùng cho đường embedding.
- **A2 — Áp online cho cả Chat + Studio** (đều qua `LLMProvider.chat()`).
- **A3 — 1 active toàn app, độc quyền**; local là fallback khi không có online active.
- **A4 — Model preset + nhập tay** ("Khác"), validate boundary.
- **A5 — Lỗi online báo rõ, KHÔNG auto-fallback**; timeout 60s.
- **A6 — Egress: badge + note tĩnh + confirm 1 lần khi bật** (không confirm mỗi request).
- **A7 — Kế thừa** `ProviderRegistry`/`LLMProvider` (007), kênh `ai:*` + Settings "AI cục bộ" (007),
  `PrivacyState` (001), keytar (ADR D5). KHÔNG migration DB (key ở keytar, config ở electron-store).

## Out of Scope

- Streaming câu trả lời (giữ chờ-trọn như 013).
- Thu phí / license / đồng bộ đám mây.
- Tự động tải/cài model.
- Thêm provider ngoài Claude/Gemini/OpenAI.
- Đổi hành vi Ollama/local hiện có.
- Chọn provider khác nhau cho Chat vs Studio (chỉ 1 active toàn app).
