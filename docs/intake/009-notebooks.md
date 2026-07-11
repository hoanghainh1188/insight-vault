# Intake — 009-notebooks

- Feature ID: 009 (GitHub issue #9)
- Branch: `009-notebooks`
- Loại: quản lý notebook (CRUD + màu + tìm kiếm) + schema SQLite metadata nền — pha `003 notebooks`
  trong lộ trình ADR D8 (feature ID = số issue GitHub, khác số thứ tự pha; đối chiếu
  `docs/04-decisions/2026-07-10-tech-stack.md` mục D8 để tránh nhầm "003" trong ADR với ID issue "009").

## Input sources

- `docs/OVERVIEW.md` — mục 5 MVP (Pha 1) "Quản lý notebook: tạo/đổi tên/xóa, đặt màu, tìm kiếm"; mục 1-3
  (notebook là không gian riêng cho 1 chủ đề nghiên cứu; local-first; kiểm chứng được); mục 6 ràng buộc
  bất biến #1 (local-first, dữ liệu không rời máy mặc định) và #5 (bảo mật desktop chuẩn — cách ly
  renderer, không lộ Node cho web content); mục 8 gợi ý kỹ thuật (SQLite cho metadata — đã chốt ở ADR D2).
- `docs/03-ui/prototype.html` — màn **S1 Notebooks** (dòng 324–369): `phead` gồm tiêu đề "Notebook của
  bạn" + phụ đề "Mỗi notebook là một không gian riêng cho một chủ đề nghiên cứu" (dòng 328–329), ô tìm
  kiếm "Tìm notebook…" (dòng 332, class `.search`), nút "Notebook mới" (dòng 333, `.btn.primary`). Lưới
  `.grid` (dòng 335, `grid-template-columns:repeat(3,1fr)`) chứa các `.nb` card:
  - Card notebook (dòng 336–363): `.stripe` (dải màu cao 6px ở đầu card, `background:<hex>` inline —
    4 màu mẫu dùng trong prototype: `#1E6B57`, `#3B6EA5`, `#8A5A9E`, `#B4713C`), tên `<h3>`, `.chips-row`
    chứa các `.tchip` (chip loại nguồn: PDF/Ghi âm/Web/Markdown/Ảnh/Video — **thuộc phạm vi 004-ingestion**,
    chỉ dùng để hiểu bố cục), `.meta` gồm `<span class="mono">N nguồn</span>` + `<span>Sửa <thời gian
tương đối></span>` (dòng 340, VD "12 nguồn" / "Sửa 2 giờ trước").
  - Card "Tạo notebook mới" (dòng 364–367): `.nb.new`, border-style dashed, icon `+` giữa card, text "Tạo
    notebook mới", bấm điều hướng sang màn khác (`data-s="s3"` trong prototype — s3 là modal Thêm nguồn,
    KHÔNG thuộc feature này; hành vi thật của feature 009 là mở modal/inline-form tạo notebook, xem
    Ambiguities #6).
  - Bấm 1 card notebook (`data-s="s2"`, dòng 336) → điều hướng sang màn **S2 Workspace** (khung route
    `/workspace` đã dựng placeholder ở `001-app-shell`; nội dung 3 cột thật thuộc feature sau).
  - CSS liên quan: `.nb` (dòng 97–107, hover: border đậm hơn + `box-shadow` + `translateY(-1px)`),
    `.chips-row`/`.tchip` (dòng 108–110). Đây là wireframe tĩnh HTML/CSS/JS, không phải file Figma — không
    có node ID để tra; **không có Figma MCP nào khả dụng/liên quan cho feature này**, không cần gọi
    (degrade: đọc trực tiếp prototype.html, không có snapshot Figma bổ sung nào khác cần đối chiếu).
- `docs/04-decisions/2026-07-10-tech-stack.md` — D2 (Lưu trữ: metadata **SQLite** qua `better-sqlite3`
  chạy ở main process — đơn file, backup dễ; vector store LanceDB riêng, không liên quan feature này vì
  chưa có source/chunk); D5 (bảo mật: mọi truy cập FS/DB/model/mạng MUST ở main process, expose qua
  preload contextBridge whitelisted; tài liệu & vector thô không đi qua renderer); D6 (cấu trúc thư mục
  `src/main/services/<slug>/`, `src/renderer/features/<slug>/`, `src/shared/`); D8 (thứ tự pha: app-shell
  → ai-runtime → **notebooks** → ingestion → rag-qa → source-viewer → studio → online-provider — notebooks
  là feature ĐẦU dùng SQLite, đứng trước ingestion nên schema phải để feature sau (004, bảng source/chunk)
  mở rộng được mà không phá vỡ); "Hệ quả" (2 store SQLite + LanceDB cần giữ nhất quán khi xoá
  source/notebook — dọn cả metadata lẫn vector; feature này chưa có vector nên chỉ cần đảm bảo xoá
  notebook dọn sạch metadata liên quan trong SQLite, chuẩn bị cho ràng buộc khoá ngoại ở 004).
- `.specify/memory/constitution.md` — Principle I (Local-first & No Default Egress: notebook + metadata
  lưu hoàn toàn trên máy, không gửi ra ngoài); Principle III (Desktop Security Boundary — NON-NEGOTIABLE:
  renderer `sandbox:true`/`contextIsolation:true`/`nodeIntegration:false`; mọi truy cập DB MUST ở main
  process, expose qua preload contextBridge whitelisted; MUST NOT log nội dung tài liệu người dùng — áp
  dụng cho tên notebook nếu coi là nội dung người dùng, xem Ambiguities); Principle IV (Test-First &
  Coverage — business logic CRUD + schema migration MUST theo TDD, coverage tối thiểu 80%); Additional
  Constraints "Terminology fidelity" (tra glossary trước khi đặt tên field/IPC channel) và "ADR-governed
  stack" (đổi stack MUST cập nhật ADR, không sửa lén).
- `docs/00-glossary.md` — `notebook` đã có (dòng 11, "Notebook (không gian nghiên cứu 1 chủ đề)", không
  dịch "sổ tay" trong code); `source` đã có (dòng 12, dùng cho khái niệm "N nguồn" hiển thị trên card —
  đếm thật thuộc 004); `workspace` đã có (dòng 27, route `/workspace`, khung có từ 001). Chưa có entry cho
  "color"/"màu notebook", "search"/"tìm kiếm", hay "metadata"/"schema DB" — xem mục Glossary check.
- `docs/04-decisions/INDEX.md` — đã quét cả 4 dòng hiện có (ai-runtime-clarify, data-dir-path,
  app-shell-clarify, tech-stack). Không có quyết định nào về: bảng màu notebook cố định hay tự chọn, giới
  hạn độ dài tên, hành vi xoá (xác nhận/soft-delete), cách tính "N nguồn" khi chưa có source, tìm kiếm
  client-side hay SQL, danh sách IPC channel `notebook:*`, hay chiến lược migration/versioning schema
  SQLite → các điểm này **chưa** có quyết định cũ, hợp lệ để đưa vào Ambiguities bên dưới.
- `src/shared/ipc/channels.ts` — 10 kênh whitelisted hiện tại: 5 kênh `app:*` (001-app-shell:
  `getDataDir`, `getPrivacyState`, `getOnboardingState`, `setOnboardingComplete`, `getAppInfo`) + 5 kênh
  `ai:*` (007-ai-runtime: `listModels`, `testConnection`, `getSelectedModels`, `setSelectedModels`,
  `getRuntimeStatus`). File có comment "Feature sau THÊM kênh mới ở đây — KHÔNG đổi nghĩa kênh cũ." Feature
  này **thêm** nhóm kênh `notebook:*` mới, không đổi 10 kênh hiện có. Data dir đã khởi tạo ở 001 qua
  `app.getPath('userData')` (xem `docs/04-decisions/2026-07-11-data-dir-path.md`) — DB file SQLite của
  feature này đặt trong cùng data dir đó.

## Prompt for /speckit-specify

**Xây dựng tính năng quản lý notebook (CRUD notebook) cho InsightVault — màn hình đầu tiên người dùng
thấy khi mở ứng dụng, nơi họ tạo và quản lý các "notebook" (mỗi notebook là một không gian riêng cho một
chủ đề nghiên cứu). Đây cũng là feature ĐẦU TIÊN của dự án lưu dữ liệu vào SQLite — cần thiết kế schema
metadata nền để các feature sau (nạp nguồn, đếm nguồn — thuộc `004-ingestion`) mở rộng được mà không phá
vỡ dữ liệu đã có.**

**Khi người dùng mở ứng dụng và vào màn Notebooks (route hiện có `/`, dựng khung ở 001-app-shell), họ
thấy:**

- Một **lưới các notebook đã tạo**, hiển thị dạng thẻ (card), mỗi thẻ gồm: một dải màu (stripe) ở đầu thẻ
  thể hiện màu người dùng đã đặt cho notebook đó, **tên notebook**, và một dòng thông tin phụ gồm số lượng
  nguồn đã nạp và thời điểm sửa gần nhất (ví dụ "12 nguồn · Sửa 2 giờ trước") — đúng bố cục prototype màn
  S1. Ở feature này, vì chưa có source thực (thuộc `004-ingestion`), số lượng nguồn hiển thị tạm là giá
  trị mặc định/placeholder nhất quán (không được hiển thị số giả tuỳ tiện) — cần làm rõ ở clarify.
- Một **ô tìm kiếm** để lọc nhanh danh sách notebook theo tên khi gõ.
- Một **nút "Notebook mới"** ở đầu trang và một **thẻ "Tạo notebook mới"** ở cuối lưới — cả hai đều dẫn
  tới hành động tạo notebook mới (đặt tên + chọn màu).
- Bấm vào một thẻ notebook đã có sẽ điều hướng sang màn Workspace (khung route đã có từ `001-app-shell`;
  nội dung 3 cột thật của Workspace KHÔNG thuộc feature này).

**Người dùng phải thực hiện được các thao tác quản lý notebook sau, mỗi thao tác đều lưu bền vững ngay
lập tức:**

- **Tạo notebook mới**: nhập tên, chọn một màu cho notebook (dùng làm dải màu trên thẻ). Notebook mới tạo
  xuất hiện ngay trong lưới.
- **Đổi tên notebook** đã có.
- **Đổi màu notebook** đã có (tương tự lúc tạo).
- **Xoá notebook**: gỡ notebook khỏi danh sách, cùng toàn bộ metadata liên quan trong cơ sở dữ liệu cục
  bộ (chuẩn bị cho việc feature sau — nạp nguồn — cũng phải dọn dữ liệu liên quan khi notebook bị xoá).
- **Tìm kiếm notebook theo tên**: gõ vào ô tìm kiếm, danh sách hiển thị lọc theo tên khớp (không phân biệt
  hoa/thường tối thiểu).

**Yêu cầu lưu trữ (tham chiếu ADR D2, D6 — đây là schema DB đầu tiên của dự án):**

- Metadata notebook (tên, màu, thời điểm tạo, thời điểm sửa gần nhất) MUST được lưu trong **SQLite**
  (qua `better-sqlite3`), chạy hoàn toàn ở **main process** của Electron, file DB đặt trong thư mục dữ
  liệu ứng dụng (`app.getPath('userData')`, đã khởi tạo ở `001-app-shell`).
  - Feature này khởi tạo database + cơ chế migration/versioning schema nền tảng — vì đây là bảng SQLite
    đầu tiên của dự án, cấu trúc migration phải cho phép feature sau (`004-ingestion`, thêm bảng
    source/chunk liên kết tới notebook) thêm bảng/cột mới một cách an toàn, không phá dữ liệu người dùng
    đã có. Cách chọn công cụ/chiến lược migration cụ thể để clarify quyết định.
- **Renderer (giao diện người dùng) KHÔNG được truy cập SQLite trực tiếp.** Mọi thao tác CRUD notebook từ
  giao diện (liệt kê, tạo, đổi tên, xoá, đổi màu, tìm kiếm) phải đi qua các kênh giao tiếp liên tiến trình
  (IPC) đã được liệt kê rõ ràng (whitelisted) trong `src/shared/ipc/channels.ts`, theo đúng khuôn mẫu 10
  kênh `app:*`/`ai:*` đã có — feature này bổ sung nhóm kênh mới với tiền tố `notebook:*`, không đổi nghĩa
  các kênh hiện có.
- Ứng dụng KHÔNG được ghi log nội dung tên notebook do người dùng đặt (coi tên notebook là nội dung người
  dùng, theo tinh thần Constitution Principle III — không log nội dung tài liệu người dùng).

**Ngoài phạm vi feature này** (thuộc feature khác, không được lấn vào):

- Nạp nguồn thực tế và đếm số nguồn thật ("N nguồn" hiển thị thật) — thuộc `004-ingestion`.
- Hỏi đáp / RAG / chat — thuộc `005-rag-qa`.
- Nội dung thật của màn Workspace 3 cột (Nguồn / Chat / Studio) — chỉ khung route đã có từ `001-app-shell`,
  nội dung thật thuộc các feature sau (004/005/006/007-studio... theo thứ tự ADR D8).
- Chip loại nguồn thật hiển thị trên thẻ notebook (PDF/Web/Ghi âm...) — phụ thuộc dữ liệu source, thuộc
  `004-ingestion`; feature này chỉ cần đảm bảo bố cục card có chỗ cho chips nhưng không cần render chip
  thật.

## Ambiguities to raise in /speckit-clarify

Đã quét `docs/04-decisions/INDEX.md` — 4 quyết định hiện có (ai-runtime-clarify, data-dir-path,
app-shell-clarify, tech-stack) không đề cập bất kỳ điểm nào dưới đây, nên **chưa** trùng quyết định cũ:

1. **Bảng màu notebook** — prototype chỉ cho thấy 4 màu ví dụ dùng trực tiếp làm `background` inline
   (`#1E6B57`, `#3B6EA5`, `#8A5A9E`, `#B4713C`), không có UI chọn màu (color picker) nào được vẽ trong
   phần S1. Người dùng chọn màu từ một **bảng màu cố định** (palette hữu hạn, ví dụ 8-10 màu được định
   nghĩa sẵn) hay được **chọn màu tự do** (color picker bất kỳ hex nào)? Ảnh hưởng trực tiếp kiểu dữ liệu
   cột `color` trong bảng `notebook` (enum ràng buộc hay text tự do lưu hex).
2. **Giới hạn độ dài / ký tự tên notebook** — có ràng buộc tối thiểu/tối đa số ký tự không, có cho phép
   trùng tên giữa 2 notebook khác nhau không, có validate ký tự đặc biệt/emoji không? Prototype không thể
   hiện giới hạn này.
3. **Hành vi xoá notebook** — có cần **xác nhận** (dialog "Bạn chắc chắn muốn xoá?") trước khi xoá không?
   Xoá là **hard delete** (xoá hẳn khỏi SQLite ngay) hay **soft-delete** (đánh dấu đã xoá, giữ lại để khôi
   phục)? Quyết định này ảnh hưởng trực tiếp thiết kế schema bảng `notebook` (có cần cột `deleted_at`
   không) — quan trọng vì đây là schema nền cho feature sau.
4. **"N nguồn" hiển thị gì khi chưa có source thật** — vì đếm nguồn thật thuộc `004-ingestion` (ngoài
   phạm vi), feature này hiển thị `0 nguồn` cố định, ẩn hẳn dòng đó khi chưa có source, hay hiển thị
   placeholder khác? Cần quyết định để tránh UI gây hiểu nhầm là đã có nguồn.
5. **Tìm kiếm client-side hay qua SQL query** — vì số lượng notebook dự kiến không lớn (ứng dụng cá nhân
   cục bộ), tìm kiếm theo tên có thể làm ở renderer (lọc mảng đã tải sẵn qua IPC `list`) hoặc ở main
   process qua SQL `LIKE`/`WHERE` mỗi lần gõ. Ảnh hưởng có cần thêm kênh IPC `notebook:search` riêng hay
   tái dùng `notebook:list` với tham số filter.
6. **Danh sách IPC channel chính xác cần thêm** — đề xuất sơ bộ trong OVERVIEW/scope:
   `notebook:list`, `notebook:create`, `notebook:rename`, `notebook:delete`, `notebook:setColor`,
   `notebook:search` (hoặc gộp search vào `list` với tham số) — cần chốt tên kênh, tập tham số, và kiểu
   response type chính xác trước khi thêm vào `src/shared/ipc/channels.ts`.
7. **Chiến lược migration/versioning schema SQLite** — vì đây là bảng đầu tiên của dự án, cần chốt cách
   quản lý migration (tự viết SQL migration runner đơn giản, hay dùng thư viện migration cho
   better-sqlite3?) và cách đánh version schema, để `004-ingestion` (thêm bảng `source`/`chunk` có khoá
   ngoại tới `notebook`) áp dụng migration tiếp theo một cách nhất quán, không phá dữ liệu người dùng.
8. **Hành động "Tạo notebook mới"** — bấm nút "Notebook mới" hoặc thẻ "Tạo notebook mới" mở **modal** hay
   **inline form** ngay trên lưới? Trong prototype tĩnh, `data-s="s2"`/`data-s="s3"` chỉ là điều hướng demo
   sang màn khác (Workspace/modal Thêm nguồn) không phản ánh đúng hành vi thật của việc tạo notebook — cần
   quyết định UI pattern cụ thể cho feature này thay vì áp nguyên `data-s` trong prototype.
9. **Định dạng hiển thị "Sửa <thời gian>"** — prototype dùng thời gian tương đối kiểu tiếng Việt ("2 giờ
   trước", "hôm qua", "3 ngày trước", "tuần trước"). Có cần chuẩn hoá quy tắc làm tròn (ngưỡng chuyển từ
   "X giờ trước" sang "hôm qua"...) hay dùng thư viện có sẵn xử lý tự động?

## Traceability

| Yêu cầu trong prompt                                                                | Nguồn                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Notebook là không gian riêng 1 chủ đề nghiên cứu                                    | OVERVIEW.md mục 1-3 · prototype.html dòng 329 (psub "Mỗi notebook là một không gian riêng cho một chủ đề nghiên cứu")    |
| CRUD notebook: tạo/đổi tên/xoá, đặt màu, tìm kiếm (phạm vi MVP)                     | OVERVIEW.md mục 5 "Quản lý notebook: tạo/đổi tên/xóa, đặt màu, tìm kiếm"                                                 |
| Lưới notebook card: stripe màu, tên, chips loại nguồn, meta "N nguồn · Sửa..."      | prototype.html dòng 335–363 (`.grid`, `.nb`, `.stripe`, `h3`, `.chips-row`, `.meta`)                                     |
| Card "Tạo notebook mới"                                                             | prototype.html dòng 364–367 (`.nb.new`)                                                                                  |
| Ô tìm kiếm "Tìm notebook…"                                                          | prototype.html dòng 332 (`.search`)                                                                                      |
| Nút "Notebook mới"                                                                  | prototype.html dòng 333 (`.btn.primary`)                                                                                 |
| Bấm card → điều hướng Workspace (khung có từ 001)                                   | prototype.html dòng 336 (`data-s="s2"`) · docs/00-glossary.md dòng 27 (workspace: route `/workspace`, placeholder ở 001) |
| Bảng màu stripe mẫu trong prototype (4 hex)                                         | prototype.html dòng 337, 344, 351, 358                                                                                   |
| SQLite metadata ở main process, feature ĐẦU dùng SQLite → thiết kế schema nền       | ADR D2 · ADR D8 ("notebooks" đứng trước "ingestion" trong chuỗi pha)                                                     |
| Renderer không chạm SQLite trực tiếp, qua IPC whitelisted                           | Constitution Principle III (NON-NEGOTIABLE) · ADR D5                                                                     |
| Không log nội dung tên notebook (nội dung người dùng)                               | Constitution Principle III "MUST NOT log nội dung tài liệu người dùng"                                                   |
| Data dir dùng `app.getPath('userData')`, DB đặt trong đó                            | docs/04-decisions/2026-07-11-data-dir-path.md · ADR D6                                                                   |
| IPC mới `notebook:*` thêm vào `src/shared/ipc/channels.ts`, không đổi 10 kênh cũ    | `src/shared/ipc/channels.ts` (comment "Feature sau THÊM kênh mới ở đây") · Constitution Principle III                    |
| Cấu trúc thư mục `src/main/services/notebooks/`, `src/renderer/features/notebooks/` | ADR D6                                                                                                                   |
| Thứ tự pha: notebooks sau ai-runtime, trước ingestion                               | ADR D8 · Constitution Principle V                                                                                        |
| Ngoài phạm vi: ingestion/đếm nguồn thật, RAG/chat, workspace 3 cột thật, chips thật | ADR D8 · OVERVIEW.md mục 10 · nhiệm vụ (mô tả "NGOÀI phạm vi")                                                           |
| Local-first: metadata notebook không rời máy                                        | OVERVIEW.md mục 6 ràng buộc #1 · Constitution Principle I                                                                |
| TDD + coverage 80% cho CRUD + migration                                             | Constitution Principle IV                                                                                                |

## Glossary check

Thuật ngữ dùng trong feature 009-notebooks, đối chiếu `docs/00-glossary.md`:

| Thuật ngữ dùng trong prompt                        | Có trong glossary?       | Ghi chú                                                                                |
| -------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| Notebook                                           | Có (dòng 11)             | Dùng đúng tên chuẩn `notebook`, không dịch "sổ tay" trong code                         |
| Nguồn / source (dùng cho "N nguồn" placeholder)    | Có (dòng 12)             | Chỉ hiển thị placeholder ở feature này; đếm thật thuộc 004                             |
| Workspace                                          | Có (dòng 27)             | Route `/workspace` đã có từ 001; feature này chỉ điều hướng tới, không đổi nội dung    |
| Màu notebook / color                               | **Không có** entry riêng | Cần thêm — xem đề xuất bên dưới                                                        |
| Tìm kiếm (notebook)                                | **Không có** entry riêng | Cần thêm — xem đề xuất bên dưới                                                        |
| Metadata (dữ liệu mô tả notebook lưu trong SQLite) | **Không có** entry riêng | Khái niệm hạ tầng mới do feature này định nghĩa lần đầu (schema DB đầu tiên của dự án) |

### Thuật ngữ mới (append vào glossary)

| Tiếng Việt                                                | Đề xuất English (code)           | Ghi chú                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Màu notebook (dải màu định danh trực quan cho 1 notebook) | `notebook color` (field `color`) | Kiểu dữ liệu (enum palette hay hex tự do) phụ thuộc kết quả Ambiguities #1                                                                                    |
| Tìm kiếm notebook theo tên                                | `notebook search`                | Hành động lọc danh sách notebook theo tên; có thể là kênh IPC riêng hoặc tham số của `notebook:list`                                                          |
| Siêu dữ liệu notebook (bản ghi SQLite mô tả 1 notebook)   | `notebook metadata`              | Bảng `notebook(id, name, color, created_at, updated_at)` — schema SQLite đầu tiên của dự án, đề xuất ghi nhận field chuẩn để feature 004 mở rộng đúng quy ước |

_(Đây là đề xuất — người phụ trách append vào `docs/00-glossary.md` trong branch `009-notebooks`,
không tự sửa ở đây.)_

## Suggested constitution amendments

Không đề xuất sửa constitution. Principle I (Local-first) đã đủ rõ để khẳng định metadata notebook lưu
hoàn toàn trên máy; Principle III (Desktop Security Boundary) đã đủ rõ về việc mọi truy cập DB phải ở
main process qua IPC whitelisted và không log nội dung người dùng; Principle IV (Test-First & Coverage)
đã áp dụng trực tiếp cho CRUD + migration logic mới; Principle V (Phased Delivery) đã xác định đúng vị trí
notebooks trong chuỗi dependency (sau ai-runtime, trước ingestion). Không phát hiện gap cần nguyên tắc mới
từ tài liệu nguồn của feature này — các điểm còn mơ hồ (bảng màu, xác nhận xoá, chiến lược migration...)
là chi tiết cấp feature, phù hợp xử lý ở `/speckit-clarify` chứ không phải sửa constitution. Một điểm đáng
lưu ý cho ADR (không phải constitution): vì đây là schema SQLite đầu tiên của dự án, kết quả clarify về
migration/versioning (Ambiguities #7) nên được ghi thành ADR riêng (`docs/04-decisions/<ngày>-notebooks-*.md`)
để `004-ingestion` tham chiếu khi thêm bảng `source`/`chunk` — không phải sửa constitution nhưng cần trở
thành quyết định cấp dự án tương tự D2.
