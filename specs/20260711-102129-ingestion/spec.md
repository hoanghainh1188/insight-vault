# Feature Specification: Nạp nguồn (Ingestion)

**Feature Branch**: `011-ingestion`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: nạp nguồn PDF/.docx/.txt/.md/URL vào một notebook → parse → làm sạch →
chunk (gắn locator) → embed → lưu SQLite + LanceDB, kèm hàng đợi & trạng thái từng nguồn.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Nạp tệp vào notebook và sẵn sàng hỏi đáp (Priority: P1)

Người dùng mở một notebook, bấm "Thêm nguồn", kéo-thả hoặc chọn một tệp (PDF / Word `.docx` / `.txt` /
`.md`). Hệ thống thêm tệp vào hàng đợi, xử lý (trích xuất nội dung → làm sạch → chia đoạn → tạo vector) và
báo tiến độ realtime; khi xong, nguồn hiển thị trạng thái "Sẵn sàng" ở cột Nguồn của Workspace và được đếm
vào số "N nguồn" của notebook. Dữ liệu chia đoạn kèm vị trí gốc (trang/đoạn) được lưu bền để feature hỏi
đáp (RAG) sau này truy hồi và trích dẫn chính xác.

**Why this priority**: Đây là lý do tồn tại của pipeline — không có nguồn đã lập chỉ mục thì không thể hỏi
đáp theo nguồn. Là MVP nhỏ nhất mang lại giá trị: nạp một tệp và thấy nó "sẵn sàng".

**Independent Test**: Nạp một PDF nhiều trang vào notebook rỗng → quan sát tiến độ chạy qua các bước → nguồn
kết thúc ở trạng thái "Sẵn sàng", số nguồn của notebook tăng lên 1, và dữ liệu chia đoạn + vector được lưu
bền (còn sau khi khởi động lại app).

**Acceptance Scenarios**:

1. **Given** một notebook rỗng và AI runtime đang sẵn sàng, **When** người dùng thêm một tệp PDF hợp lệ,
   **Then** nguồn lần lượt qua trạng thái đang xử lý rồi "Sẵn sàng", số nguồn của notebook = 1, và cột Nguồn
   hiển thị tên tệp + loại + số trang.
2. **Given** một tệp `.txt` đã nạp xong, **When** người dùng khởi động lại ứng dụng và mở notebook, **Then**
   nguồn vẫn hiển thị "Sẵn sàng" với dữ liệu chia đoạn còn nguyên (không phải nạp lại).
3. **Given** một tệp đã được chia đoạn, **When** kiểm tra dữ liệu đã lưu, **Then** mỗi đoạn (chunk) có kèm
   vị trí gốc (locator) gắn ngay lúc tạo — với PDF gồm số trang, với loại khác gồm khoảng ký tự.

---

### User Story 2 - Nạp nguồn từ URL trang web (Priority: P2)

Người dùng chọn loại nguồn "URL", nhập địa chỉ một trang web. Hệ thống tải trang, trích nội dung chính (bỏ
menu/quảng cáo), rồi xử lý như một nguồn văn bản. Trong lúc tải trang, chỉ báo riêng tư phản ánh trạng thái
"đang online" (vì có dữ liệu ra ngoài máy). Nguồn URL hiển thị nhãn "Web" ở cột Nguồn.

**Why this priority**: URL là loại nguồn MVP theo brief, nhưng phụ thuộc thêm mạng + bảo mật (SSRF) nên tách
sau tệp cục bộ. Vẫn trong phạm vi feature này.

**Independent Test**: Nhập một URL bài viết công khai → nội dung chính được trích và nguồn kết thúc "Sẵn
sàng"; trong lúc tải, chỉ báo riêng tư chuyển "online" rồi trở lại "local" khi xong.

**Acceptance Scenarios**:

1. **Given** một URL `https://` hợp lệ trỏ tới trang bài viết, **When** người dùng thêm nguồn, **Then** hệ
   thống tải + trích nội dung chính, chia đoạn và nguồn đạt "Sẵn sàng" với nhãn "Web".
2. **Given** một URL trỏ tới địa chỉ nội bộ/loopback (vd `http://localhost`, `http://192.168.x.x`), **When**
   người dùng thêm nguồn, **Then** hệ thống từ chối tải (chặn SSRF) và nguồn báo lỗi thân thiện.
3. **Given** đang tải một URL, **When** quá trình fetch diễn ra, **Then** chỉ báo riêng tư hiển thị "online";
   sau khi hoàn tất, trở lại "local".

---

### User Story 3 - Theo dõi tiến độ, xử lý lỗi và xoá nguồn (Priority: P2)

Người dùng thấy hàng đợi các nguồn đang xử lý với thanh tiến độ và nhãn trạng thái theo bước. Nếu một nguồn
lỗi (tệp hỏng, quá lớn, tải URL thất bại, hoặc AI runtime chưa sẵn sàng), nguồn hiển thị trạng thái lỗi thân
thiện và có thể **thử lại**. Người dùng có thể **xoá** một nguồn (kể cả đang xử lý); xoá phải dọn sạch mọi dữ
liệu liên quan (đoạn + vector), không để lại rác.

**Why this priority**: Vòng đời nguồn (tiến độ/lỗi/retry/xoá) là phần không thể thiếu để pipeline dùng được
thật, nhưng đứng sau khả năng nạp thành công.

**Independent Test**: Nạp một tệp không hợp lệ → nguồn báo lỗi + nút thử lại; xoá một nguồn đã "Sẵn sàng" →
số nguồn giảm, và dữ liệu đoạn + vector của nó biến mất hoàn toàn.

**Acceptance Scenarios**:

1. **Given** một tệp vượt giới hạn kích thước, **When** người dùng thêm, **Then** nguồn chuyển "lỗi" với
   nhãn "Tệp quá lớn", không làm treo hàng đợi các nguồn khác.
2. **Given** một nguồn ở trạng thái lỗi, **When** người dùng bấm "Thử lại", **Then** pipeline chạy lại từ đầu
   và (nếu điều kiện đã ổn) nguồn đạt "Sẵn sàng".
3. **Given** một nguồn đã "Sẵn sàng" với các đoạn + vector đã lưu, **When** người dùng xoá nguồn, **Then**
   mọi đoạn (metadata) và vector tương ứng bị xoá ở cả hai kho lưu trữ, số nguồn của notebook giảm 1.
4. **Given** một notebook có nhiều nguồn, **When** người dùng xoá cả notebook, **Then** toàn bộ nguồn + đoạn
   - vector của notebook bị dọn sạch (không mồ côi).

---

### User Story 4 - Nạp khi AI runtime tạm chưa sẵn sàng (Priority: P3)

Người dùng thêm nguồn trong khi AI runtime (model nhúng) chưa bật. Hệ thống vẫn trích xuất + chia đoạn + lưu
phần văn bản ngay, đặt nguồn ở trạng thái "chờ nhúng"; khi runtime sẵn sàng trở lại, hệ thống tự động nhúng
tiếp và chuyển nguồn sang "Sẵn sàng" — không bắt người dùng thêm lại từ đầu.

**Why this priority**: Cải thiện trải nghiệm quan trọng nhưng không chặn giá trị lõi (US1 giả định runtime
sẵn sàng). Là nhánh độ bền của pipeline.

**Independent Test**: Tắt AI runtime → thêm một tệp → nguồn dừng ở "chờ nhúng" (đã có đoạn văn bản lưu); bật
runtime → nguồn tự động hoàn tất "Sẵn sàng" mà không cần thao tác thêm.

**Acceptance Scenarios**:

1. **Given** AI runtime chưa sẵn sàng, **When** người dùng thêm một tệp, **Then** nguồn được trích xuất +
   chia đoạn + lưu văn bản và dừng ở trạng thái "chờ nhúng" (không báo lỗi cứng).
2. **Given** một nguồn đang "chờ nhúng", **When** AI runtime trở nên sẵn sàng, **Then** hệ thống tự động
   nhúng các đoạn còn thiếu và chuyển nguồn sang "Sẵn sàng".

---

### Edge Cases

- **Nguồn trùng**: thêm lại đúng một tệp (cùng nội dung) hoặc cùng một URL vào cùng notebook → hệ thống vẫn
  cho thêm nhưng cảnh báo "nguồn đã tồn tại trong notebook" để người dùng xác nhận.
- **Tệp rỗng / không trích được nội dung**: nguồn báo lỗi thân thiện, không tạo đoạn.
- **URL redirect nhiều lần**: giới hạn số lần chuyển hướng; mỗi hop vẫn kiểm địa chỉ nội bộ (chặn SSRF).
- **Tài liệu rất lớn (nhiều nghìn đoạn)**: hàng đợi xử lý tuần tự, tiến độ cập nhật; không làm treo giao diện.
- **Xoá nguồn đang xử lý**: dừng xử lý, dọn phần dữ liệu đã ghi một phần.
- **Loại nguồn ngoài phạm vi** (Audio/Video, Hình ảnh): hiển thị trong bố cục nhưng bị vô hiệu/không nạp
  được ở feature này.
- **Đoạn vắt qua ranh giới trang PDF**: không cho phép — mỗi đoạn nằm trong đúng một trang để trích dẫn chính
  xác.

## Requirements _(mandatory)_

### Functional Requirements

**Nạp & loại nguồn**

- **FR-001**: Hệ thống PHẢI cho phép người dùng thêm nguồn vào một notebook cụ thể qua giao diện "Thêm nguồn"
  (modal), hỗ trợ tệp `PDF`, `.docx`, `.txt`, `.md` (kéo-thả hoặc chọn tệp) và địa chỉ `URL` trang web.
- **FR-002**: Hệ thống PHẢI đưa mỗi nguồn mới vào một hàng đợi xử lý và xử lý **tuần tự** (một nguồn tại một
  thời điểm), theo thứ tự thêm vào (FIFO).
- **FR-003**: Hệ thống PHẢI vô hiệu (không nạp) các loại nguồn ngoài phạm vi (Audio/Video, Hình ảnh) trong
  feature này, dù chúng có thể xuất hiện trong bố cục giao diện.

**Pipeline xử lý**

- **FR-004**: Với mỗi nguồn, hệ thống PHẢI trích xuất nội dung văn bản theo loại: PDF theo từng trang; `.docx`
  → văn bản; `.txt`/`.md` → văn bản; URL → tải trang và trích **nội dung chính** (loại bỏ menu/quảng cáo).
- **FR-005**: Hệ thống PHẢI làm sạch văn bản đã trích (chuẩn hoá khoảng trắng, loại nhiễu) trước khi chia đoạn.
- **FR-006**: Hệ thống PHẢI chia nội dung đã làm sạch thành các **đoạn (chunk)**, và **NGAY khi tạo mỗi đoạn
  PHẢI gắn locator xác định vị trí gốc** trong nguồn. Locator KHÔNG được tái tạo/ước lượng ở bước sau. Với
  PDF, locator gồm số trang; với mọi loại, locator gồm khoảng ký tự trong văn bản nguồn. (Constitution II —
  NON-NEGOTIABLE.)
- **FR-007**: Hệ thống PHẢI sinh vector nhúng (embedding) cho từng đoạn thông qua AI runtime hiện có
  (ProviderRegistry của feature ai-runtime), KHÔNG gọi thẳng công cụ model bên dưới.
- **FR-008**: Hệ thống PHẢI lưu bền, với mỗi đoạn: nội dung văn bản, locator, thứ tự (ordinal), và liên kết
  tới nguồn cha; vector nhúng được lưu ở kho vector và tra cứu ngược được theo đúng đoạn.
- **FR-009**: Khi AI runtime chưa sẵn sàng lúc nạp, hệ thống PHẢI vẫn trích xuất + chia đoạn + lưu văn bản,
  đặt nguồn ở trạng thái "chờ nhúng", và **tự động** nhúng tiếp khi runtime sẵn sàng — không chặn việc nạp.

**Trạng thái, tiến độ, vòng đời**

- **FR-010**: Hệ thống PHẢI thể hiện trạng thái từng nguồn theo tập trạng thái: đang chờ → đang xử lý →
  (chờ nhúng) → sẵn sàng, hoặc lỗi; và báo **tiến độ realtime** trong lúc xử lý.
- **FR-011**: Hệ thống PHẢI hiển thị trạng thái nguồn ở cột "Nguồn" của Workspace (biểu tượng theo loại, chỉ
  báo trạng thái, mô tả phụ như "PDF · N trang" hoặc "Web").
- **FR-012**: Hệ thống PHẢI hiển thị số **"N nguồn" thật** của mỗi notebook (thay giá trị giữ chỗ trước đây),
  và trạng thái tổng hợp: "đã lập chỉ mục" khi mọi nguồn sẵn sàng, "đang xử lý M" khi còn nguồn chưa xong,
  ẩn phần chỉ mục khi 0 nguồn.
- **FR-013**: Khi một nguồn lỗi, hệ thống PHẢI hiển thị nhãn lỗi thân thiện theo bước lỗi (trích xuất / tải
  trang / nhúng / tệp quá lớn) và cho phép **thử lại** (chạy lại pipeline từ đầu). Một nguồn lỗi KHÔNG được
  làm treo việc xử lý các nguồn khác trong hàng đợi.
- **FR-014**: Người dùng PHẢI xoá được một nguồn (kể cả đang xử lý). Xoá nguồn PHẢI dọn sạch mọi đoạn +
  vector liên quan ở cả hai kho lưu trữ.
- **FR-015**: Xoá một notebook PHẢI dọn sạch toàn bộ nguồn + đoạn + vector của notebook đó (không để dữ liệu
  mồ côi ở bất kỳ kho nào).
- **FR-016**: Khi thêm một nguồn trùng (cùng nội dung tệp hoặc cùng URL) trong cùng notebook, hệ thống PHẢI
  cảnh báo để người dùng xác nhận, nhưng vẫn cho phép thêm nếu người dùng đồng ý.

**Bảo mật & riêng tư (ràng buộc bất biến)**

- **FR-017**: Toàn bộ đọc tệp, trích xuất, tải URL, chia đoạn, nhúng, và ghi hai kho lưu trữ PHẢI diễn ra ở
  tiến trình nền (main); giao diện (renderer) chỉ tương tác qua các kênh liên tiến trình được whitelist. Nội
  dung tài liệu toàn văn và vector thô KHÔNG được truyền qua renderer dưới dạng nội dung đầy đủ. (Constitution
  III.)
- **FR-018**: Hệ thống KHÔNG được ghi log nội dung tài liệu người dùng ra console/tệp log.
- **FR-019**: Tải URL PHẢI được coi là hoạt động **ra ngoài mạng**: chỉ báo riêng tư phản ánh "online" trong
  lúc tải, và hệ thống PHẢI chặn địa chỉ nội bộ/loopback (chống SSRF), chỉ chấp nhận `http`/`https`, giới hạn
  số lần chuyển hướng và dung lượng tải về. Ngoài trang web người dùng chủ động nhập và AI runtime cục bộ,
  KHÔNG có dữ liệu nào rời máy.
- **FR-020**: Hệ thống PHẢI áp giới hạn kích thước theo loại nguồn; vượt giới hạn → nguồn báo lỗi thân thiện,
  không xử lý.

**Lưu trữ & tương thích**

- **FR-021**: Mở rộng schema lưu trữ PHẢI theo cơ chế migration append-only đã chốt (thêm bảng nguồn + đoạn,
  khoá ngoại `ON DELETE CASCADE` về notebook), KHÔNG sửa migration đã phát hành trước đó → dữ liệu notebook
  hiện có không bị phá.

### Key Entities _(include if feature involves data)_

- **Nguồn (Source)**: một tài liệu/URL đã thêm vào một notebook. Thuộc tính: định danh, notebook cha, loại
  (`pdf`/`docx`/`txt`/`md`/`url`), tiêu đề hiển thị (tên tệp / tiêu đề trang), địa chỉ gốc (đường dẫn tệp
  hoặc URL — lưu để tham chiếu, tôn trọng ràng buộc không lộ nội dung), trạng thái (đang chờ / đang xử lý /
  chờ nhúng / sẵn sàng / lỗi), số trang (nếu có), mã băm nội dung (để phát hiện trùng), thời điểm tạo. Quan
  hệ: thuộc về một Notebook (xoá notebook → xoá cascade); có nhiều Đoạn.
- **Đoạn (Chunk)**: một mẩu văn bản đã chia từ một nguồn, đơn vị để nhúng và trích dẫn. Thuộc tính: định
  danh, nguồn cha, thứ tự (ordinal), nội dung văn bản, locator (`page` có/không + khoảng ký tự
  `charStart`/`charEnd`). Quan hệ: thuộc về một Nguồn (xoá nguồn → xoá cascade); ứng với một Vector.
- **Vector nhúng (Embedding)**: biểu diễn số của một đoạn để truy hồi ngữ nghĩa (dùng ở feature RAG sau).
  Thuộc tính: khoá theo định danh đoạn, notebook, nguồn (để lọc/xoá), giá trị vector, số chiều. Lưu ở kho
  vector riêng, đồng bộ vòng đời với Đoạn.
- **Trạng thái hàng đợi (Queue item)**: khái niệm vận hành — vị trí của một nguồn trong tiến trình xử lý
  tuần tự, kèm tiến độ hiện thời (không nhất thiết là bản ghi lưu bền riêng).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Người dùng nạp thành công một tệp PDF/`.docx`/`.txt`/`.md` và thấy nguồn đạt "Sẵn sàng" mà
  không cần thao tác kỹ thuật nào ngoài chọn tệp.
- **SC-002**: 100% đoạn được tạo ra có kèm locator hợp lệ trỏ đúng vị trí gốc (với PDF: đúng trang; với mọi
  loại: khoảng ký tự nằm trong độ dài văn bản nguồn) — kiểm chứng được, không có đoạn nào thiếu locator.
- **SC-003**: Sau khi xoá một nguồn hoặc một notebook, không còn bất kỳ đoạn hay vector mồ côi nào của nguồn
  đó ở cả hai kho lưu trữ (kiểm chứng: đếm về 0).
- **SC-004**: Dữ liệu đã nạp còn nguyên sau khi khởi động lại ứng dụng (nguồn "Sẵn sàng" vẫn "Sẵn sàng", số
  nguồn không đổi).
- **SC-005**: Khi AI runtime chưa sẵn sàng, việc nạp không bị chặn: nguồn dừng ở "chờ nhúng" và tự hoàn tất
  sau khi runtime sẵn sàng, không cần người dùng thêm lại.
- **SC-006**: Nguồn URL trỏ tới địa chỉ nội bộ/loopback luôn bị từ chối (0% trường hợp lọt qua), và chỉ báo
  riêng tư phản ánh đúng "online" trong lúc tải URL.
- **SC-007**: Một nguồn lỗi không làm treo hàng đợi: các nguồn hợp lệ khác trong hàng đợi vẫn hoàn tất.
- **SC-008**: Không có mục log nào chứa nội dung tài liệu người dùng (kiểm chứng qua rà log ở chế độ chi tiết).

## Assumptions

Các quyết định dưới đây đã chốt ở `docs/04-decisions/2026-07-11-ingestion-clarify.md`,
`2026-07-11-chunking-strategy.md`, `2026-07-11-lancedb-integration.md` (không còn là ẩn số):

- **A1 — Thư viện parse**: PDF dùng `pdfjs-dist`; `.docx` dùng `mammoth`; URL dùng
  `@mozilla/readability` + `jsdom` + `turndown`; `.txt`/`.md` đọc trực tiếp. Ưu tiên thư viện thuần JS để
  tránh biên dịch native (chỉ kho vector là native).
- **A2 — Chia đoạn**: theo ký tự, mục tiêu ~1000 ký tự, overlap ~150, cắt recursive theo ranh giới
  đoạn→câu→cứng; **không vắt qua ranh giới trang PDF**. Locator = `{ page: số|null, charStart, charEnd }`,
  offset nửa mở vào toàn văn bản đã làm sạch; `page` chỉ có ở PDF; mỗi đoạn có `ordinal` 0-based.
- **A3 — Kho vector**: LanceDB (`@lancedb/lancedb`) chạy ở main, lưu tại `userData/vectors/`; một bảng
  `chunks(id, notebook_id, source_id, vector, dim)`; nội dung/locator KHÔNG lặp sang kho vector (SQLite là
  nguồn sự thật metadata); MVP tìm kiếm brute-force.
- **A4 — Hàng đợi**: tuần tự 1 nguồn/lần, FIFO; cho phép huỷ/xoá nguồn đang chờ/đang xử lý.
- **A5 — Runtime offline**: parse+chunk+lưu ngay, trạng thái `awaiting_embedding`, tự embed khi runtime sẵn
  sàng.
- **A6 — URL/egress**: fetch URL bật chỉ báo "online"; chặn SSRF (chỉ http/https, từ chối host nội bộ/loopback,
  ≤5 redirect, giới hạn body).
- **A7 — Giới hạn kích thước**: PDF/docx 50MB, txt/md 25MB, body URL 10MB; vượt → lỗi "Tệp quá lớn".
- **A8 — Dedup**: tính `content_hash` (sha256) cho tệp / URL chuẩn hoá; trùng trong cùng notebook → cảnh báo
  `duplicateWarning`, vẫn cho thêm khi người dùng xác nhận.
- **A9 — Retry**: nguồn `error` chạy lại pipeline từ đầu (dọn dữ liệu một phần trước).
- **A10 — Kênh liên tiến trình**: 5 kênh invoke (`source:add`, `source:listByNotebook`, `source:get`,
  `source:delete`, `source:retry`) + 1 kênh event push tiến độ (`source:progress`, main→renderer). Renderer
  đăng ký nhận qua `onSourceProgress(cb)`.
- **A11 — Enum trạng thái**: `queued → processing → (awaiting_embedding) → ready`, nhánh lỗi `error`. Ánh xạ
  UI prototype: `.stat ready=ready`, `.stat proc=queued/processing/awaiting_embedding`, `.stat err=error`.
- **A12 — Tiến độ**: báo qua event push (không polling); `listByNotebook` cấp snapshot ban đầu khi mở màn.
- **A13 — "Đã lập chỉ mục"**: trạng thái tổng hợp của notebook (mọi nguồn ready → "đã lập chỉ mục"; còn
  nguồn chưa xong → "đang xử lý M").
- **A14 — Nhãn lỗi**: thân thiện theo bước ("Lỗi trích xuất"/"Lỗi tải trang"/"Lỗi nhúng"/"Tệp quá lớn"); chi
  tiết kỹ thuật chỉ log server-side có redact.
- Kế thừa: module DB chung + migration runner (009), `ProviderRegistry`/`LLMProvider.embed()` (007), data
  dir `app.getPath('userData')` (001), khuôn kênh IPC whitelisted + `ChannelResponse` (001/007/009).
- Ngoài phạm vi: truy hồi RAG + chat + chip trích dẫn (005), trình xem nguồn highlight (006), Audio/Video +
  Hình ảnh (Pha 2), Studio.
