# Intake — 001-app-shell

- Feature ID: 001 (GitHub issue #1)
- Branch: `001-app-shell`
- Loại: hạ tầng (vỏ ứng dụng + ranh giới bảo mật) — **không** phải nghiệp vụ notebook/RAG.

## Input sources

- `docs/OVERVIEW.md` — mục 1–4 (sản phẩm, người dùng, điểm khác biệt cốt lõi, nền tảng), mục 6
  (ràng buộc bất biến #1 local-first, #5 bảo mật desktop), mục 9 (tham chiếu prototype).
- `docs/03-ui/prototype.html` — khung `.window` / `.titlebar` (dòng 301–306, `#localBadge`), rail
  điều hướng trái `.rail` (dòng 309–322, nút Notebooks/Workspace/Cài đặt), toggle online ở màn Settings
  (dòng 583–590, minh hoạ hành vi đổi badge local ↔ online). Đây là wireframe tĩnh (HTML/CSS/JS thuần),
  **không phải file Figma** — không có node ID Figma để tra; không cần gọi Figma MCP cho feature này.
- `docs/04-decisions/2026-07-10-tech-stack.md` — D1 (shell/UI: Electron + electron-vite, React18+TS+Vite,
  Zustand + TanStack Query), D5 (bảo mật renderer: sandbox/contextIsolation/nodeIntegration, preload
  contextBridge whitelisted, main process độc quyền FS/DB/model/mạng, keytar cho key online), D6 (cấu
  trúc thư mục `src/main/services/<slug>/`, `src/renderer/features/<slug>/`, `src/shared/`), D7
  (packaging electron-builder — ngoài phạm vi 001, ghi nhận để không mâu thuẫn sau này).
- `.specify/memory/constitution.md` — Principle I (Local-first & No Default Egress, đặc biệt dòng
  "Privacy indicator MUST luôn phản ánh đúng trạng thái hiện tại"), Principle III (Desktop Security
  Boundary, đặc biệt `sandbox:true`/`contextIsolation:true`/`nodeIntegration:false`, preload whitelist,
  keytar, cấm log nội dung tài liệu), Principle V (Phased Delivery — 001 app-shell là bước đầu chuỗi
  dependency D8), Additional Constraints (Terminology fidelity, ADR-governed stack).
- `docs/00-glossary.md` — toàn bảng (đối chiếu thuật ngữ dùng trong feature này).
- `docs/04-decisions/INDEX.md` — đã quét; chỉ có 1 ADR cấp `_project` (2026-07-10-tech-stack.md), đã
  áp dụng trực tiếp làm ràng buộc kỹ thuật thay vì hỏi lại.

## Prompt for /speckit-specify

**Xây dựng vỏ ứng dụng desktop (app shell) cho InsightVault — một ứng dụng Electron chạy cục bộ
(local-first) trên macOS và Windows. Đây là nền tảng cho toàn bộ ứng dụng, chưa bao gồm bất kỳ tính
năng nghiệp vụ nào (chưa có notebook, chưa nạp nguồn, chưa hỏi đáp).**

**Khi người dùng mở ứng dụng lần đầu, họ thấy một cửa sổ desktop có cấu trúc ổn định gồm:**
- Một **thanh tiêu đề (titlebar)** hiển thị tên ứng dụng, và một **huy hiệu chỉ báo riêng tư (privacy
  indicator badge)** cho biết ứng dụng đang "Chạy cục bộ · dữ liệu không rời máy" hay "AI online đang
  bật" (khi có gửi dữ liệu ra ngoài). Ở phiên bản này (chưa có provider online — thuộc feature sau),
  badge phải **luôn** hiển thị trạng thái "Chạy cục bộ", nhưng cơ chế hiển thị phải là động (đọc từ một
  nguồn trạng thái thật, không phải hard-code văn bản tĩnh) để feature sau có thể bật/tắt mà không cần
  viết lại khung UI này.
- Một **rail điều hướng bên trái** với các mục điều hướng chính: Notebooks, Workspace, Cài đặt (theo
  đúng bố cục prototype — icon dọc, có trạng thái active/hover). Ở feature này, các mục điều hướng có
  thể click và chuyển route/state, nhưng vùng nội dung bên trong mỗi mục là **khung rỗng/placeholder**
  — màn hình thật (danh sách notebook, workspace 3 cột, cài đặt provider...) thuộc các feature sau.
- Một **vùng nội dung chính** rỗng, sẵn sàng để các feature sau lắp màn hình thật vào.
- Một **khung onboarding lần đầu** (placeholder) — hiển thị khi ứng dụng khởi động lần đầu, nhưng việc
  kiểm tra/cài đặt runtime AI local (Ollama) thực sự **không** thuộc feature này (thuộc feature
  002-ai-runtime); ở đây chỉ cần khung/màn hình placeholder có thể thay thế nội dung sau.

**Ràng buộc bảo mật bắt buộc (tham chiếu Constitution Principle III và ADR
`docs/04-decisions/2026-07-10-tech-stack.md` mục D5) — đây là hành vi phải kiểm chứng được, không chỉ
là chi tiết implementation:**
- Vùng nội dung web (renderer) **không được** có khả năng truy cập trực tiếp Node.js API hay
  filesystem của máy — mọi thao tác đó phải đi qua tiến trình chính (main process) và một cầu nối
  (preload) chỉ cho phép một danh sách kênh giao tiếp (IPC channel) đã được **liệt kê rõ ràng
  (whitelisted)** trước. Không có kênh nào ngoài danh sách đó được phép gọi.
- Ứng dụng phải khởi tạo (hoặc đảm bảo tồn tại) một thư mục dữ liệu cục bộ đúng theo hệ điều hành:
  `~/Library/InsightVault` trên macOS, `%APPDATA%/InsightVault` trên Windows — ở feature này chỉ cần
  đảm bảo thư mục tồn tại, **chưa** cần tạo schema database bên trong.
- Ứng dụng phải hoạt động và hiển thị đầy đủ khung UI trên **cả macOS và Windows**.

**Đặc biệt quan trọng — ràng buộc bất biến của toàn dự án (Constitution Principle I, local-first):**
mặc định ứng dụng không được kết nối mạng ra ngoài; chỉ báo riêng tư phải phản ánh đúng thực tế, không
được hiển thị sai lệch so với hành vi thực sự của ứng dụng. Ở feature app-shell này, vì chưa có tính
năng nào gọi mạng, trạng thái hiển thị đúng đắn duy nhất có thể có là "Chạy cục bộ".

**Ngoài phạm vi feature này** (sẽ làm ở các feature sau, không được lấn vào): quản lý notebook (tạo/
sửa/xóa), nạp nguồn/ingestion, RAG/hỏi đáp có trích dẫn, trình xem nguồn, Studio, tích hợp Ollama thực
sự, provider AI online, schema database, lưu trữ API key bằng keytar.

## Ambiguities to raise in /speckit-clarify

Đã quét `docs/04-decisions/INDEX.md` — chỉ có 1 ADR cấp `_project`, các quyết định trong đó (D1, D5,
D6) đã được đưa thẳng vào ràng buộc kỹ thuật ở trên, không liệt kê lại làm ambiguity. Các điểm dưới đây
**chưa** có quyết định ghi nhận và nên được `/speckit-clarify` làm rõ:

1. **Cơ chế route/điều hướng giữa các mục rail** — prototype dùng JS thuần chuyển `.active` class giữa
   các `<section>` tĩnh trong 1 trang HTML (SPA đơn giản, không có router thật). Feature 001 có cần
   dựng một client-side router thật (vd. react-router) hay chỉ cần state chuyển đổi đơn giản (Zustand)
   giữa 3 khung rỗng? Ảnh hưởng cấu trúc `src/renderer/features/app-shell/`.
2. **Nội dung khung onboarding lần đầu** — prototype không có màn onboarding riêng (5 tab đều là màn
   nghiệp vụ). Feature này cần "khung/placeholder" — nhưng chưa rõ: hiển thị onboarding **luôn** ở lần
   mở đầu tiên (dựa vào cờ trạng thái nào, lưu ở đâu?), hay có thể bỏ qua vĩnh viễn? Cần định nghĩa tối
   thiểu "lần đầu" được phát hiện thế nào (vd. thư mục data dir chưa tồn tại) mà không cần đợi
   002-ai-runtime.
3. **Danh sách IPC channel whitelisted ban đầu** — ADR D5 yêu cầu whitelist nhưng chưa liệt kê channel
   cụ thể nào cần có sẵn ở app-shell (vd. `app:getDataDir`, `app:getPrivacyState`?). Cần chốt danh sách
   tối thiểu để `src/shared/` có type contract ngay từ đầu, tránh feature sau phải sửa lại contract nền.
4. **Cửa sổ custom titlebar hay dùng frame hệ điều hành mặc định** — prototype vẽ `.lights` (3 chấm
   tròn kiểu macOS traffic light) trong titlebar tự vẽ, không phải titlebar hệ thống. Cần chốt: app
   dùng `frame:false` + custom titlebar (đúng như prototype, cả 2 OS) hay dùng frame mặc định của OS
   (title bar native, khác nhau giữa macOS/Windows)? Ảnh hưởng trực tiếp cấu hình `BrowserWindow` và
   trải nghiệm nút minimize/maximize/close trên Windows (prototype chỉ vẽ kiểu macOS).

## Traceability

| Yêu cầu trong prompt | Nguồn |
|---|---|
| Titlebar + tên app + privacy indicator badge (local/online) | prototype.html dòng 301–306, 582–590 · OVERVIEW.md mục 5 "Chỉ báo riêng tư" · Constitution Principle I ("Privacy indicator MUST luôn phản ánh đúng trạng thái") |
| Badge mặc định luôn "Chạy cục bộ" ở v1 (chưa có provider online) | ADR D8 (thứ tự pha: 001 app-shell trước 008 online-provider) · Constitution Principle V |
| Cơ chế badge phải động, sẵn cho feature sau bật/tắt | Constitution Principle I + III (kiến trúc phải tách main/renderer đúng chuẩn để feature sau cắắm vào) |
| Rail điều hướng trái: Notebooks / Workspace / Cài đặt | prototype.html dòng 309–322 (`.rail`, `.railbtn`) |
| Vùng nội dung rỗng/placeholder (màn thật ở feature sau) | OVERVIEW.md mục 9 (prototype 5 màn, nhưng phạm vi 001 chỉ lo "vỏ/khung" theo chỉ định người dùng) |
| Khung onboarding lần đầu (placeholder, chưa check Ollama thật) | ADR D8 + "Hệ quả" (002 ai-runtime xử lý phát hiện/cài Ollama) · OVERVIEW.md mục 5 "Onboarding lần đầu" |
| Electron 3 tiến trình main/renderer/preload | ADR D1 |
| `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false` | ADR D5 · Constitution Principle III |
| Preload contextBridge + IPC channel whitelisted | ADR D5 · Constitution Principle III · ADR D6 (`src/shared/` cho IPC contract) |
| Renderer không truy cập Node/FS trực tiếp | Constitution Principle III · OVERVIEW.md ràng buộc bất biến #5 |
| Data dir `~/Library/InsightVault` / `%APPDATA%/InsightVault`, chỉ khởi tạo | ADR D5 (main process độc quyền FS) · OVERVIEW.md mục 5 gợi ý lưu trữ cục bộ (prototype S5 "Lưu trữ cục bộ" dòng 510–519, dùng tham khảo bố cục, không phải hành vi 001) |
| Không network egress mặc định | Constitution Principle I · OVERVIEW.md ràng buộc bất biến #1 |
| macOS + Windows | OVERVIEW.md mục 4 "Nền tảng (đã chốt)" |
| Cấu trúc thư mục `src/main/services/<slug>/`, `src/renderer/features/<slug>/`, `src/shared/` | ADR D6 · Constitution "Feature ID = số issue GitHub; branch NNN-slug; cô lập theo feature" |
| Ngoài phạm vi (notebook/ingestion/RAG/viewer/studio/Ollama/provider online/DB schema/keytar) | ADR D8 (thứ tự pha 002–008) · OVERVIEW.md mục 5 (các mục đó thuộc MVP nhưng là feature riêng sau app-shell) |

## Glossary check

Thuật ngữ dùng trong feature 001-app-shell, đối chiếu `docs/00-glossary.md`:

| Thuật ngữ dùng trong prompt | Có trong glossary? | Ghi chú |
|---|---|---|
| Chỉ báo riêng tư / privacy indicator | Có (dòng 24) | Dùng đúng tên chuẩn `privacy indicator` |
| Chạy cục bộ / local | Có (dòng 23) | Dùng đúng tên chuẩn `local` |
| Nhà cung cấp AI / provider | Có (dòng 22) | Chỉ nhắc tới, chưa implement ở feature này |
| Notebook, Workspace, Cài đặt (Settings) | Notebook có (dòng 11); Workspace/Cài đặt **không có** entry riêng trong bảng — chỉ là tên màn hình/route, không phải field/type nghiệp vụ cần chuẩn hoá | Xem mục "Thuật ngữ mới" bên dưới |

### Thuật ngữ mới (append vào glossary)

Hai tên dưới đây là **tên route/màn hình điều hướng** (không phải field dữ liệu), nhưng vì rail điều
hướng là UI lâu dài xuất hiện xuyên suốt app, nên đề xuất chuẩn hoá tên biến/route ngay từ app-shell để
các feature sau không tự đặt tên khác nhau:

| Tiếng Việt | Đề xuất English (code) | Ghi chú |
|---|---|---|
| Workspace (màn 3 cột: Nguồn / Chat / Studio) | `workspace` | Route/feature-slug cho 003-notebooks trở đi; cần người phụ trách xác nhận đây có phải slug feature tương lai hay chỉ là tên UI |
| Cài đặt | `settings` | Route/feature-slug; chứa mô hình AI, provider online, lưu trữ cục bộ (008-online-provider và các phần khác) |
| Chỉ báo riêng tư — huy hiệu (badge) hiển thị 2 trạng thái | `privacy indicator badge` (đã có gốc `privacy indicator`, đề xuất bổ sung rõ đây là **UI component**, không chỉ khái niệm trừu tượng) | Cân nhắc thêm dòng con hoặc ghi chú "component hiển thị ở titlebar" vào glossary hiện có, không tạo entry trùng |
| Rail điều hướng (thanh icon dọc bên trái) | `nav rail` hoặc `navigation rail` | UI component gốc từ prototype `.rail`; chưa có trong glossary, dùng xuyên suốt app-shell và mọi feature sau |
| Onboarding lần đầu | `first-run onboarding` | OVERVIEW.md nhắc "Onboarding lần đầu" nhưng chưa có tên chuẩn tiếng Anh trong glossary |

*(Đây là đề xuất — người phụ trách append vào `docs/00-glossary.md` trong branch `001-app-shell`,
không tự sửa ở đây.)*

## Suggested constitution amendments

Không đề xuất sửa constitution — Principle I, III, V và Additional Constraints hiện tại đã đủ bao phủ
mọi ràng buộc của feature app-shell (privacy indicator, sandbox/contextIsolation, cấu trúc thư mục,
thứ tự pha). Không phát hiện gap cần bổ sung nguyên tắc mới từ tài liệu nguồn của feature này.
