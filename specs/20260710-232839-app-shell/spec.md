# Feature Specification: App Shell (vỏ ứng dụng desktop)

**Feature Branch**: `001-app-shell`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Xây dựng vỏ ứng dụng desktop (app shell) cho InsightVault — ứng dụng
desktop chạy cục bộ (local-first) trên macOS và Windows. Nền tảng cho toàn bộ ứng dụng, chưa gồm tính
năng nghiệp vụ. Cửa sổ có titlebar (tên app + privacy indicator badge), rail điều hướng trái
(Notebooks/Workspace/Cài đặt) với nội dung placeholder, khung onboarding lần đầu placeholder. Ràng buộc:
renderer không truy cập trực tiếp Node/filesystem — qua main + preload với IPC whitelisted; khởi tạo
data dir đúng OS; không network egress mặc định; chỉ báo riêng tư phản ánh đúng thực tế."

## Clarifications

### Session 2026-07-10

- Q: A2 — Cơ chế điều hướng giữa Notebooks / Workspace / Cài đặt? → A: Route phản ánh khu vực đang chọn (dạng hash), để deep-link được về sau.
- Q: A3 — Kiểu khung cửa sổ (titlebar)? → A: Dùng frame OS mặc định (nút minimize/maximize/close native) + một header in-app chứa tên app + privacy badge. Custom frameless để pha sau.
- Q: A4 — Bộ kênh IPC whitelist ban đầu ở app-shell? → A: 5 kênh: getDataDir, getPrivacyState, getOnboardingState, setOnboardingComplete, getAppInfo.
- Q: A5 — Phát hiện & lưu cờ "lần đầu"? → A: Lưu cờ onboarding ở **OS settings store** (tách khỏi thư mục dữ liệu); thiếu/không đọc được cờ ⇒ coi là lần đầu.

### Session 2026-07-11 (remediation từ /speckit-analyze)

- Q: F1 — Đường dẫn data dir (spec/OVERVIEW nói `~/Library/InsightVault` vs plan dùng `userData`)? → A: Dùng `app.getPath('userData')` (`~/Library/Application Support/InsightVault` mac · `%APPDATA%/InsightVault` win); sửa FR-011 cho khớp. Xem `docs/04-decisions/2026-07-11-data-dir-path.md`.
- Ghi chú F3 (thuật ngữ): trong feature này "titlebar" = **app header in-app** (dưới khung cửa sổ **native OS**), không phải titlebar tự vẽ. Nút minimize/maximize/close do OS cung cấp.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mở ứng dụng và thấy trạng thái riêng tư rõ ràng (Priority: P1)

Là người dùng coi trọng quyền riêng tư, khi mở InsightVault lần đầu tôi thấy ngay một cửa sổ desktop
hoàn chỉnh, ổn định, với một chỉ báo riêng tư (privacy indicator) nói rõ ứng dụng đang **chạy cục bộ,
dữ liệu không rời máy**. Tôi tin tưởng dùng app vì trạng thái này phản ánh đúng hành vi thật.

**Why this priority**: Local-first và "cho người dùng biết dữ liệu đang ở đâu" là lý do sản phẩm tồn
tại (Constitution I). Vỏ + chỉ báo riêng tư là điều đầu tiên người dùng thấy và là nền cho mọi feature sau.

**Independent Test**: Mở app trên máy sạch → cửa sổ hiện đầy đủ titlebar + tên app + badge "Chạy cục bộ".
Ngắt mạng hoàn toàn → app vẫn mở và hiển thị bình thường, badge vẫn "Chạy cục bộ".

**Acceptance Scenarios**:

1. **Given** máy chưa từng chạy app, **When** người dùng mở app, **Then** hiện cửa sổ desktop với
   titlebar chứa tên "InsightVault" và badge chỉ báo riêng tư ở trạng thái "Chạy cục bộ · dữ liệu không rời máy".
2. **Given** máy không có kết nối Internet, **When** người dùng mở app, **Then** app vẫn khởi động và
   hiển thị đầy đủ vỏ UI (không lỗi, không treo chờ mạng).
3. **Given** app đang mở, **When** người dùng quan sát badge, **Then** trạng thái badge khớp đúng hành
   vi mạng thực tế của app (v1: luôn "Chạy cục bộ" vì chưa có tính năng gọi mạng).

---

### User Story 2 - Renderer bị cô lập khỏi hệ thống (Priority: P1)

Là người dùng xử lý dữ liệu nhạy cảm, tôi cần đảm bảo phần hiển thị nội dung của app (renderer) không
thể tự ý đọc/ghi ổ đĩa hay chạy mã hệ thống — kể cả khi một nội dung web độc hại lọt vào — mọi thao tác
hệ thống chỉ đi qua các kênh được cho phép trước.

**Why this priority**: Ràng buộc bảo mật bất biến (Constitution III, OVERVIEW #5). Nếu vỏ nền không cô
lập đúng ngay từ đầu, mọi feature sau (đọc file, chạy model, lưu key) đều thừa hưởng lỗ hổng.

**Independent Test**: Từ phần renderer, thử truy cập API hệ thống/filesystem trực tiếp → phải thất bại.
Chỉ các kênh IPC nằm trong danh sách whitelist mới gọi được; gọi một kênh ngoài danh sách → bị từ chối.

**Acceptance Scenarios**:

1. **Given** app đang chạy, **When** mã trong renderer thử truy cập trực tiếp Node/filesystem, **Then**
   không có quyền truy cập (thao tác thất bại).
2. **Given** app đang chạy, **When** renderer gọi một kênh IPC **có** trong danh sách whitelist, **Then**
   yêu cầu được main process xử lý và trả kết quả.
3. **Given** app đang chạy, **When** renderer gọi một kênh IPC **không** có trong whitelist, **Then**
   yêu cầu bị từ chối, không có tác dụng phụ lên hệ thống.

---

### User Story 3 - Điều hướng giữa các khu vực chính (Priority: P2)

Là người dùng, tôi thấy một rail điều hướng bên trái với các mục Notebooks, Workspace, Cài đặt; bấm vào
mỗi mục sẽ chuyển sang khu vực tương ứng (ở phiên bản này là khung trống/placeholder), với chỉ báo mục
đang chọn rõ ràng.

**Why this priority**: Khung điều hướng lâu dài xuất hiện xuyên suốt app; dựng đúng ngay giúp các feature
sau chỉ việc lắp nội dung thật vào, không phải sửa vỏ.

**Independent Test**: Bấm lần lượt 3 mục rail → khu vực nội dung đổi tương ứng, mục đang chọn được đánh
dấu active; trạng thái hover hoạt động.

**Acceptance Scenarios**:

1. **Given** app đang mở ở mục mặc định, **When** người dùng bấm một mục khác trên rail, **Then** khu
   vực nội dung chuyển sang placeholder của mục đó và mục được đánh dấu đang chọn.
2. **Given** người dùng đang ở một mục, **When** họ đóng và mở lại app, **Then** app mở lại ở trạng thái
   điều hướng nhất quán, dự đoán được (mục mặc định hoặc mục gần nhất — xem Assumptions).

---

### User Story 4 - Onboarding lần đầu (placeholder) (Priority: P3)

Là người dùng mới, ở lần mở đầu tiên tôi thấy một màn/khung chào mừng (onboarding) placeholder; sau khi
bỏ qua/hoàn tất, các lần mở sau không hiện lại nữa.

**Why this priority**: OVERVIEW yêu cầu "onboarding lần đầu", nhưng nội dung thật (kiểm tra runtime AI
local) thuộc feature 002. Ở đây chỉ cần cơ chế phát hiện "lần đầu" + khung có thể thay nội dung sau.

**Independent Test**: Mở app trên máy sạch → onboarding hiện. Hoàn tất/bỏ qua, mở lại → onboarding không hiện.

**Acceptance Scenarios**:

1. **Given** máy chưa từng chạy app, **When** mở app lần đầu, **Then** khung onboarding placeholder hiển thị.
2. **Given** người dùng đã hoàn tất/bỏ qua onboarding, **When** mở lại app, **Then** onboarding không hiển thị nữa.

---

### Edge Cases

- Thư mục dữ liệu cục bộ **chưa tồn tại** → app tự tạo khi khởi động; nếu **không tạo được** (thiếu
  quyền/đĩa đầy) → hiển thị thông báo lỗi thân thiện, không crash im lặng.
- Thư mục dữ liệu **đã tồn tại** từ lần chạy trước → app dùng lại, không ghi đè. (Phát hiện "lần đầu"
  độc lập với data dir — dựa vào cờ onboarding ở OS settings store, xem A5.)
- Cờ onboarding ở OS settings store bị hỏng/không đọc được → coi như chưa hoàn tất (hiện onboarding), không crash.
- Cửa sổ bị thu nhỏ tới kích thước rất hẹp → khung UI vẫn dùng được (rail + nội dung không vỡ layout).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ứng dụng MUST hiển thị một cửa sổ desktop có **titlebar** chứa tên ứng dụng ("InsightVault")
  và một **privacy indicator badge**.
- **FR-002**: Privacy indicator MUST phản ánh **đúng** trạng thái thực tế (đang chạy cục bộ ↔ đang gửi dữ
  liệu ra ngoài); giá trị hiển thị MUST đọc từ một **nguồn trạng thái thật** (động), KHÔNG được hard-code
  chuỗi tĩnh. Ở phiên bản này, trạng thái đúng duy nhất là "Chạy cục bộ · dữ liệu không rời máy".
- **FR-003**: Ứng dụng MUST khởi động và hiển thị đầy đủ vỏ UI **không phụ thuộc kết nối mạng** (chạy được offline).
- **FR-004**: Mặc định ứng dụng MUST NOT phát sinh kết nối mạng ra ngoài.
- **FR-005**: Ứng dụng MUST hiển thị **rail điều hướng** với 3 mục: Notebooks, Workspace, Cài đặt; mỗi mục
  có trạng thái **active** và **hover** rõ ràng.
- **FR-006**: Người dùng MUST có thể chuyển giữa 3 khu vực qua rail; mỗi khu vực hiển thị **nội dung
  placeholder rỗng** (màn hình thật thuộc feature sau).
- **FR-007**: Ứng dụng MUST có một **vùng nội dung chính** dạng khung rỗng, sẵn sàng để feature sau lắp
  màn hình thật vào mà không phải sửa vỏ.
- **FR-008**: Ở lần mở đầu tiên, ứng dụng MUST hiển thị **khung onboarding placeholder**; sau khi người
  dùng hoàn tất/bỏ qua, các lần mở sau MUST NOT hiển thị lại.
- **FR-009**: Phần renderer MUST NOT truy cập trực tiếp Node.js API hay filesystem của máy; mọi thao tác
  hệ thống MUST đi qua main process.
- **FR-010**: Giao tiếp renderer ↔ main MUST chỉ diễn ra qua một **danh sách kênh IPC được whitelist rõ
  ràng**; kênh ngoài danh sách MUST bị từ chối, không gây tác dụng phụ.
- **FR-011**: Ứng dụng MUST khởi tạo (hoặc đảm bảo tồn tại) **thư mục dữ liệu cục bộ** đúng chuẩn hệ điều
  hành qua đường dẫn userData của nền tảng — thực tế là `~/Library/Application Support/InsightVault` trên
  macOS và `%APPDATA%/InsightVault` trên Windows (chốt F1, xem `docs/04-decisions/2026-07-11-data-dir-path.md`).
  Ở feature này **chưa** cần tạo schema database bên trong.
- **FR-012**: Nếu không khởi tạo được thư mục dữ liệu, ứng dụng MUST hiển thị thông báo lỗi thân thiện,
  không crash im lặng.
- **FR-013**: Ứng dụng MUST chạy và hiển thị đầy đủ khung UI trên **cả macOS và Windows**.
- **FR-014**: Ứng dụng MUST NOT ghi log chứa nội dung tài liệu người dùng (ở feature này chưa có tài liệu,
  nhưng cơ chế log phải tuân nguyên tắc này ngay từ đầu — Constitution III).

### Key Entities *(include if feature involves data)*

- **Privacy State (trạng thái riêng tư)**: cho biết ứng dụng đang chạy hoàn toàn cục bộ hay có gửi dữ
  liệu ra ngoài. Là nguồn sự thật cho privacy indicator. v1 chỉ có giá trị "local".
- **Onboarding State (trạng thái onboarding)**: cho biết người dùng đã hoàn tất/bỏ qua onboarding lần đầu
  hay chưa. Lưu bền ở **OS settings store** (tách khỏi thư mục dữ liệu). Quyết định có hiển thị onboarding
  khi khởi động; thiếu/không đọc được ⇒ coi là chưa hoàn tất.
- **Data Directory (thư mục dữ liệu cục bộ)**: nơi lưu mọi dữ liệu app trên máy người dùng, đúng chuẩn OS.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Trên máy sạch, người dùng mở app và thấy vỏ UI đầy đủ (titlebar + privacy badge + rail)
  trong vòng **≤ 3 giây** kể từ khi khởi chạy, trên cả macOS và Windows.
- **SC-002**: Ở **100%** thời điểm, trạng thái privacy indicator khớp đúng hành vi mạng thực của app
  (0 trường hợp hiển thị "Chạy cục bộ" trong khi có dữ liệu gửi ra ngoài, và ngược lại).
- **SC-003**: Với mạng bị ngắt hoàn toàn, app vẫn khởi động thành công **100%** số lần và hiển thị đầy đủ vỏ UI.
- **SC-004**: Kiểm thử bảo mật: **100%** nỗ lực truy cập filesystem/Node trực tiếp từ renderer đều thất
  bại; **100%** lời gọi kênh IPC ngoài whitelist đều bị từ chối.
- **SC-005**: Người dùng chuyển được giữa cả 3 mục điều hướng và thấy phản hồi active/hover đúng trong **100%** lần thử.
- **SC-006**: Onboarding hiển thị đúng **1 lần** ở lần mở đầu; sau khi hoàn tất, **0** lần hiển thị lại ở các phiên sau.

## Assumptions

> ✅ Bốn điểm A2–A5 đã được **chốt ở `/speckit-clarify` (Session 2026-07-10)** — xem mục Clarifications;
> quyết định cũng ghi ở `docs/04-decisions/2026-07-10-app-shell-clarify.md`.

- **A1**: Tên hiển thị ứng dụng là "InsightVault"; UI tiếng Việt (i18n để sau — OVERVIEW #9).
- **A2 (Router — đã chốt)**: Điều hướng giữa 3 khu vực dùng route phản ánh khu vực đang chọn (dạng hash)
  để sau này deep-link được; feature 001 chỉ cần chuyển giữa 3 khung placeholder.
- **A3 (Titlebar — đã chốt)**: v1 dùng **khung cửa sổ mặc định của hệ điều hành** (nút minimize/maximize/
  close native) + một header in-app chứa tên app và privacy badge. Custom titlebar "traffic light" như
  prototype để pha sau.
- **A4 (IPC whitelist — đã chốt)**: Bộ kênh ban đầu ở app-shell gồm đúng 5 kênh: `getDataDir`,
  `getPrivacyState`, `getOnboardingState`, `setOnboardingComplete`, `getAppInfo`. Feature sau mở rộng danh sách.
- **A5 (First-run — đã chốt)**: "Lần đầu" xác định bằng một cờ onboarding lưu bền ở **OS settings store**
  (tách khỏi thư mục dữ liệu cục bộ); chưa hoàn tất / không đọc được cờ ⇒ coi là lần đầu (hiện onboarding).
- **A6**: Trạng thái điều hướng khi mở lại app: mở ở **mục mặc định (Notebooks)** — không cần khôi phục
  mục gần nhất ở feature nền này.
- **A7**: Đóng gói/cài đặt/ký app (electron-builder, code-sign) **ngoài phạm vi** feature này (ADR D7,
  thuộc pha đóng gói sau); feature 001 chỉ cần chạy được ở môi trường dev trên cả 2 OS.

## Dependencies

- Không phụ thuộc feature khác (đây là feature nền đầu chuỗi — ADR D8).
- Ràng buộc kỹ thuật nền do ADR `docs/04-decisions/2026-07-10-tech-stack.md` quy định; nguyên tắc bất
  biến do `.specify/memory/constitution.md` (Principle I, III, V) quy định.
