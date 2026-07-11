# Feature Specification: AI Runtime (runtime AI cục bộ)

**Feature Branch**: `007-ai-runtime`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Xây dựng runtime AI cục bộ cho InsightVault — lớp nền cho phép gọi LLM
(chat model) + embedding model chạy trên máy qua Ollama, qua một giao diện provider chung; màn Cài đặt
chọn/kiểm tra model; onboarding thật kiểm tra Ollama; gọi Ollama ở main, renderer qua IPC whitelisted;
Ollama local không phải egress. Ngoài phạm vi: online provider/keytar (008), ingestion (004), RAG/chat UI (005)."

## Clarifications

### Session 2026-07-11

- Q: A1 — Lưu lựa chọn model ở đâu? → A: **electron-store** (không SQLite ở feature này).
- Q: A2 — Ollama rớt giữa phiên: poll hay check? → A: **Check-on-demand** (mở Cài đặt + nút kiểm tra); modelchip trạng thái rớt → 005.
- Q: A3 — Embedding model mặc định khi chưa cài? → A: **Không tự tải**; liệt kê model đã cài + gợi ý cài `nomic-embed-text`.
- Q: A4 — IPC mới + OnboardingState? → A: 5 kênh `ai:*` (listModels/testConnection/getSelectedModels/setSelectedModels/**getRuntimeStatus**), tách khỏi `app:getOnboardingState`.
- Q: A5 — Onboarding blocking hay bỏ qua? → A: **Bỏ qua được**; `ollamaReady` là sub-state riêng (qua `ai:getRuntimeStatus`), tách `OnboardingState.completed`.
- Q: A6 — Nút "Tải thêm mô hình"? → A: **Link/hướng dẫn tĩnh**, không tự `ollama pull` ở v1.
- Q: A7 — Host/port Ollama cấu hình? → A: **Hardcode `http://localhost:11434`** (override qua env var, chưa có UI).

Đầy đủ: `docs/04-decisions/2026-07-11-ai-runtime-clarify.md`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Gọi AI qua một provider chung (Priority: P1)

Là nền cho mọi tính năng AI, ứng dụng phải **tạo được câu trả lời hội thoại** và **tạo được vector
embedding** cho văn bản, dùng mô hình người dùng đã chọn, thông qua **một giao diện provider chung** —
để feature sau (ingestion, hỏi đáp) gọi AI mà không cần biết đang dùng Ollama hay provider nào.

**Why this priority**: Đây là lõi hạ tầng (ADR D3, D8) — không có nó thì ingestion (004) và RAG (005)
không chạy được. Lớp trừu tượng cho phép cắm provider online sau (008) mà không viết lại nơi gọi AI.

**Independent Test**: Với Ollama đang chạy và một chat model + embedding model hợp lệ đã chọn: yêu cầu
provider trả lời một câu → nhận về văn bản trả lời; yêu cầu embed một đoạn văn → nhận về vector; yêu cầu
provider tự kiểm tra → báo "sẵn sàng".

**Acceptance Scenarios**:

1. **Given** Ollama đang chạy + đã chọn chat model hợp lệ, **When** ứng dụng gọi provider để trả lời một
   câu hỏi, **Then** nhận về nội dung trả lời từ mô hình local.
2. **Given** Ollama đang chạy + đã chọn embedding model hợp lệ, **When** ứng dụng gọi provider để tạo
   embedding cho một đoạn văn bản, **Then** nhận về một vector số.
3. **Given** Ollama đang chạy nhưng model đang chọn KHÔNG tồn tại trên máy, **When** provider tự kiểm tra
   sẵn sàng, **Then** báo "chưa sẵn sàng" kèm lý do (model thiếu), không crash.
4. **Given** kiến trúc provider, **When** thêm một provider mới (giả lập) vào registry, **Then** ứng dụng
   gọi được provider đó qua **cùng giao diện** mà không phải sửa nơi gọi AI.

---

### User Story 2 - Chọn & lưu mô hình trong Cài đặt (Priority: P1)

Là người dùng, trong màn Cài đặt tôi thấy khu vực "AI cục bộ (Ollama)": trạng thái kết nối, nút **kiểm
tra kết nối**, **danh sách mô hình trả lời** và **mô hình embedding** đã cài (lấy động từ Ollama), và
tôi chọn một chat model + một embedding model làm mặc định; lựa chọn được **lưu bền** cho lần mở sau.

**Why this priority**: Người dùng phải kiểm soát mô hình & chi phí (OVERVIEW mục 3, 5). Không chọn được
model thì runtime (US1) không có gì để chạy.

**Independent Test**: Mở Cài đặt → thấy trạng thái kết nối + danh sách model đã cài; chọn chat model +
embedding model; đóng và mở lại app → lựa chọn vẫn giữ nguyên. Bấm "kiểm tra kết nối" → cập nhật trạng thái đúng.

**Acceptance Scenarios**:

1. **Given** Ollama đang chạy với vài model đã cài, **When** người dùng mở khu vực "AI cục bộ", **Then**
   thấy trạng thái "Đã kết nối" và danh sách mô hình trả lời/embedding **đúng theo model thực có** trên máy.
2. **Given** đang ở Cài đặt, **When** người dùng chọn một chat model + một embedding model, **Then** lựa
   chọn được lưu; mở lại app ở phiên sau vẫn giữ đúng lựa chọn đó.
3. **Given** đang ở Cài đặt, **When** người dùng bấm "kiểm tra kết nối", **Then** ứng dụng kiểm tra lại
   tại thời điểm đó và hiển thị kết quả (kết nối được / không).
4. **Given** máy chưa cài model embedding nào, **When** người dùng mở khu vực embedding, **Then** ứng
   dụng gợi ý cài `nomic-embed-text` (hướng dẫn), không tự tải.

---

### User Story 3 - Onboarding lần đầu kiểm tra Ollama thật (Priority: P2)

Là người dùng mới, ở lần mở đầu ứng dụng **thực sự kiểm tra** Ollama đã cài và đang chạy chưa: nếu sẵn
sàng thì vào app; nếu chưa thì thông báo rõ + hướng dẫn khắc phục, nhưng tôi **được phép bỏ qua ("cài
sau")** để vào app ở trạng thái giới hạn (chưa hỏi đáp được nhưng vẫn xem được giao diện).

**Why this priority**: Thay khung onboarding placeholder của app-shell bằng nội dung thật (ADR D3 "Hệ
quả"). Không chặn cứng để tránh nhốt người dùng khi họ muốn khám phá app trước.

**Independent Test**: Máy chưa cài/không chạy Ollama → mở app lần đầu: thấy hướng dẫn + nút "cài sau";
bấm "cài sau" → vào được app (giao diện hiển thị). Cài/chạy Ollama rồi kiểm tra lại → báo sẵn sàng.

**Acceptance Scenarios**:

1. **Given** Ollama chưa cài hoặc chưa chạy, **When** người dùng mở app lần đầu, **Then** hiện thông báo
   rõ tình trạng + hướng dẫn khắc phục (không lỗi im lặng / màn trắng).
2. **Given** onboarding hiển thị vì Ollama chưa sẵn sàng, **When** người dùng chọn "cài sau", **Then**
   vào được ứng dụng ở trạng thái giới hạn (xem UI được; các thao tác cần AI báo chưa sẵn sàng).
3. **Given** Ollama đã cài và đang chạy, **When** người dùng mở app, **Then** onboarding không cản trở;
   trạng thái runtime báo "sẵn sàng".

---

### User Story 4 - Cô lập gọi Ollama trong main, giữ local-first (Priority: P1)

Là người dùng coi trọng riêng tư, mọi cuộc gọi tới Ollama phải nằm ở tiến trình chính; giao diện
(renderer) không tự gọi Ollama mà chỉ yêu cầu qua các kênh IPC được whitelisted; và vì Ollama chạy trên
chính máy tôi, chỉ báo riêng tư vẫn phải hiển thị "Chạy cục bộ".

**Why this priority**: Ràng buộc bất biến (Constitution I & III, ADR D5). Nếu renderer gọi mạng trực
tiếp thì phá ranh giới bảo mật đã dựng ở app-shell.

**Independent Test**: Từ renderer, không có cách gọi Ollama trực tiếp — mọi thao tác AI đi qua đúng các
kênh IPC `ai:*` whitelisted; gọi kênh ngoài danh sách bị từ chối. Khi dùng Ollama, badge vẫn "Chạy cục bộ".

**Acceptance Scenarios**:

1. **Given** app đang chạy, **When** renderer cố gọi Ollama HTTP trực tiếp, **Then** không thực hiện được
   (renderer bị cô lập; chỉ IPC whitelisted mới chạm main).
2. **Given** app dùng Ollama để chat/embed, **When** người dùng nhìn chỉ báo riêng tư, **Then** vẫn hiển
   thị "Chạy cục bộ · dữ liệu không rời máy" (Ollama local không phải egress).
3. **Given** whitelist IPC, **When** renderer gọi một kênh `ai:*` không thuộc danh sách đã định, **Then**
   bị từ chối, không side effect.

---

### Edge Cases

- Ollama đang chạy nhưng **không có model nào** đã cài → danh sách rỗng + hướng dẫn cài model; runtime báo chưa sẵn sàng.
- Ollama **rớt kết nối giữa phiên** (người dùng tắt Ollama) → lần kiểm tra tiếp theo (mở Cài đặt / bấm
  kiểm tra) báo "không kết nối được"; app không crash. (Không poll định kỳ ở v1 — A2.)
- Model đang chọn **bị gỡ** khỏi Ollama → provider.test() báo chưa sẵn sàng (model thiếu); Cài đặt gợi
  người dùng chọn lại.
- Lựa chọn model đã lưu **không đọc được / hỏng** → coi như chưa chọn (không crash); yêu cầu chọn lại.
- Ollama chạy ở **cổng khác** mặc định → v1 không kết nối được qua UI (hardcode localhost:11434, A7);
  chỉ nhận override qua env var.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Ứng dụng MUST cung cấp một **giao diện provider chung** với tối thiểu 3 khả năng: trả lời
  hội thoại (chat), tạo embedding cho văn bản, và tự kiểm tra sẵn sàng (test). Mọi nơi gọi AI trong app
  MUST đi qua giao diện này, không phụ thuộc trực tiếp Ollama.
- **FR-002**: Ứng dụng MUST có một **registry** quản lý các provider; v1 đăng ký đúng **một** provider
  hoạt động (Ollama cục bộ). Thêm provider mới sau (008) MUST không phải sửa nơi gọi AI.
- **FR-003**: Provider Ollama MUST gọi Ollama qua HTTP cục bộ (mặc định `http://localhost:11434`) cho cả
  chat và embedding.
- **FR-004**: Ứng dụng MUST **liệt kê động** các mô hình đã cài trên Ollama (không hard-code danh sách).
- **FR-005**: Người dùng MUST chọn được **một chat model** và **một embedding model** làm mặc định toàn app.
- **FR-006**: Lựa chọn chat model + embedding model MUST được **lưu bền vững**; mở lại app giữ nguyên lựa chọn.
- **FR-007**: Ứng dụng MUST cho người dùng **kiểm tra kết nối** tới Ollama theo yêu cầu (khi mở Cài đặt +
  khi bấm nút kiểm tra); MUST NOT poll định kỳ ở v1.
- **FR-008**: Ở lần mở đầu, ứng dụng MUST **thực sự kiểm tra** Ollama đã cài và đang chạy; nếu chưa, MUST
  hiển thị thông báo + hướng dẫn khắc phục (không lỗi im lặng / màn trắng).
- **FR-009**: Onboarding MUST cho phép **bỏ qua ("cài sau")** → vào app ở trạng thái giới hạn (xem UI
  được; thao tác cần AI báo chưa sẵn sàng). Trạng thái "Ollama sẵn sàng" (`ollamaReady`) MUST là sub-state
  **riêng**, tách khỏi cờ "đã xem màn chào" (`OnboardingState.completed`) của app-shell.
- **FR-010**: Khi máy chưa cài model embedding, ứng dụng MUST **gợi ý cài** `nomic-embed-text` (hướng dẫn),
  MUST NOT tự tải model.
- **FR-011**: Nút "Tải thêm mô hình" MUST chỉ là **link/hướng dẫn tĩnh** (mở trang / hiển thị lệnh
  `ollama pull`); MUST NOT tự chạy `ollama pull` từ trong app ở v1.
- **FR-012**: Mọi cuộc gọi HTTP tới Ollama MUST nằm ở **main process**. Renderer MUST NOT gọi Ollama trực
  tiếp; renderer chỉ yêu cầu thao tác AI qua các kênh IPC **whitelisted**.
- **FR-013**: Ứng dụng MUST thêm đúng các kênh IPC sau vào whitelist (không đổi 5 kênh app-shell):
  `ai:listModels`, `ai:testConnection`, `ai:getSelectedModels`, `ai:setSelectedModels`, `ai:getRuntimeStatus`.
- **FR-014**: Khi dùng Ollama, chỉ báo riêng tư MUST tiếp tục hiển thị "Chạy cục bộ" (Ollama local không
  phải network egress).
- **FR-015**: Khi model đang chọn không tồn tại / Ollama không kết nối được, provider.test() và
  `ai:getRuntimeStatus` MUST báo "chưa sẵn sàng" kèm lý do, không crash.

### Key Entities _(include if feature involves data)_

- **Provider**: nhà cung cấp AI với khả năng chat / embed / test. v1: Ollama.
- **ProviderRegistry**: nơi đăng ký & lấy provider đang hoạt động qua giao diện chung.
- **Model**: một mô hình AI cụ thể trên Ollama (tên + loại: chat hoặc embedding + kích thước nếu có).
- **ModelSelection**: `{ chatModel, embeddingModel }` — lựa chọn của người dùng, lưu bền (electron-store).
- **RuntimeStatus**: `{ reachable, ollamaReady, reason? }` — Ollama kết nối được không + model đã chọn có
  sẵn không; nguồn cho onboarding & Cài đặt.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Với Ollama chạy + model hợp lệ, **100%** yêu cầu chat trả về nội dung và **100%** yêu cầu
  embed trả về vector (không lỗi chưa xử lý).
- **SC-002**: Lựa chọn model được giữ đúng **100%** qua các lần đóng/mở lại app.
- **SC-003**: Danh sách model hiển thị khớp **đúng** model thực có trên Ollama (0 model hard-code, 0 model ma).
- **SC-004**: Khi Ollama chưa sẵn sàng, **100%** lần mở đầu hiển thị hướng dẫn (0 trường hợp màn trắng /
  lỗi im lặng) và người dùng luôn có thể "cài sau" để vào app.
- **SC-005**: Kiểm thử bảo mật: **100%** nỗ lực gọi Ollama trực tiếp từ renderer thất bại; **100%** lời
  gọi kênh IPC ngoài whitelist bị từ chối; chỉ báo riêng tư hiển thị "Chạy cục bộ" ở **100%** thời điểm dùng Ollama.
- **SC-006**: Thêm một provider mới vào registry để chuyển đổi **không cần sửa** nơi gọi AI (đo bằng test
  với provider giả lập).

## Assumptions

> Bảy điểm A1–A7 đã chốt ở `docs/04-decisions/2026-07-11-ai-runtime-clarify.md` (xem mục Clarifications).

- **A1**: Lựa chọn model lưu bằng **electron-store** (không dùng SQLite ở feature này — schema metadata ở 004).
- **A2**: Kiểm tra kết nối **check-on-demand** (mở Cài đặt + nút kiểm tra); không poll. Modelchip trạng
  thái rớt ở composer Workspace → thuộc `005-rag-qa`.
- **A3**: Không tự tải model; chỉ liệt kê model đã cài; gợi ý cài `nomic-embed-text` nếu thiếu embedding model.
- **A4**: Thêm 5 kênh `ai:*`; `ollamaReady` qua `ai:getRuntimeStatus`, **tách** khỏi `app:getOnboardingState`.
- **A5**: Onboarding **bỏ qua được**; trạng thái Ollama-ready tách khỏi cờ onboarding.
- **A6**: "Tải thêm mô hình" = link/hướng dẫn tĩnh; không auto-pull.
- **A7**: Hardcode `http://localhost:11434` (override env var); chưa có UI đổi host/port.
- **A8**: Tận dụng khung Cài đặt (`/settings`) + cơ chế onboarding + privacy badge đã dựng ở `001-app-shell`.

## Dependencies

- Phụ thuộc `001-app-shell` (đã merge): khung Cài đặt, onboarding, privacy indicator, contract IPC nền.
- Ràng buộc kỹ thuật: ADR `docs/04-decisions/2026-07-10-tech-stack.md` (D3), quyết định
  `2026-07-11-ai-runtime-clarify.md`; nguyên tắc `.specify/memory/constitution.md` (I, III, V).
- **Runtime ngoài:** Ollama do người dùng cài (feature phát hiện + hướng dẫn, không tự cài).
