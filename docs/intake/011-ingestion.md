# Intake — 011-ingestion

- Feature ID: GitHub issue #11 (pha 004 trong lộ trình, ADR D8: `app-shell → ai-runtime → notebooks →
**ingestion** → rag-qa → source-viewer → studio → online-provider`)
- Branch: `011-ingestion`
- Ngày intake: 2026-07-11
- Ghi chú độ phức tạp: đây là feature LÕI phức tạp nhất tới thời điểm này — chạm cả 3 nguyên tắc
  NON-NEGOTIABLE của constitution (I local-first/egress, II verifiable citations, III desktop
  security boundary) cùng lúc, và là feature đầu tiên phối hợp 2 store (SQLite + LanceDB).

## Input sources

- `docs/OVERVIEW.md` — mục 5 (MVP: nạp nguồn PDF/.docx/.txt/.md/URL + trạng thái xử lý; chỉ mục hoá
  tự động), mục 6 (ràng buộc bất biến #1 local-first, #3 locator chính xác, #5 bảo mật desktop),
  mục 10 (pipeline parse→làm sạch→chunk→embed→lưu vector, kèm hàng đợi & trạng thái)
- `docs/03-ui/prototype.html`:
  - dòng 372-389 — cột **Nguồn** (S2 Workspace): `.srclist`/`.src`, icon theo loại, trạng thái
    `.stat ready|proc|err` (chấm màu), ví dụ text "PDF · 48 trang", "Đang OCR… 62%", "Web" (không có
    số trang)
  - dòng 437-459 — modal **Thêm nguồn** (S3): 4 loại nguồn (`.types`: Tệp/URL/Audio-Video/Hình ảnh),
    vùng kéo-thả `.drop` ("Tệp được xử lý ngay trên máy bạn"), hàng đợi `.queue`/`.qi` (tên tệp +
    progress bar `.bar > i[style=width]` + nhãn trạng thái "Trích xuất"/"Sẵn sàng")
  - dòng 360-361 — chip loại nguồn + "N nguồn" trên card notebook (S1)
- `docs/04-decisions/2026-07-10-tech-stack.md` — D2 (SQLite `node:sqlite` metadata + LanceDB vector,
  cả 2 trong data dir), D3 (embed qua `ProviderRegistry`/`LLMProvider.embed()`, v1 = Ollama), D4
  (locator giữ ngay lúc chunk, không tái tạo sau; pdf.js map), D5 (bảo mật: FS/DB/model/mạng chỉ ở
  main), D6 (cấu trúc thư mục theo feature), D8 (thứ tự pha), mục "Hệ quả" (2 store cần nhất quán khi
  xoá source/notebook)
- `docs/04-decisions/2026-07-11-sqlite-migrations.md` — migration append-only qua `PRAGMA
user_version`; đã dự trù rõ: "**004-ingestion** append migration #2+ (bảng `source`/`chunk`, FK →
  notebook) theo đúng quy ước ở đây"; FK dùng `ON DELETE CASCADE`
- `.specify/memory/constitution.md` — Principle I (no default egress), II (Verifiable Citations —
  NON-NEGOTIABLE, chunk giữ locator ngay lúc tạo, cấm tái tạo sau), III (Desktop Security Boundary —
  parse/DB/LanceDB/embed chỉ ở main; renderer qua IPC whitelisted; không log nội dung tài liệu), IV
  (test-first, coverage 80%), V (phased delivery)
- `docs/00-glossary.md` — đã tra: `source`, `chunk`, `embedding`, `locator`, `index/indexing`,
  `retrieval`, `notebook`, `provider`, `AI runtime`, `LLMProvider`, `ProviderRegistry`,
  `migration (schema)` đã có sẵn, không cần dịch lại
- `docs/04-decisions/INDEX.md` — đã quét: không có quyết định nào trực tiếp trả lời các ambiguity của
  ingestion (parser cụ thể, chiến lược chunk, cấu hình LanceDB, hàng đợi song song/tuần tự...); chỉ
  có migration ADR đã xác nhận trước bảng `source`/`chunk` + FK CASCADE — áp dụng thẳng, không liệt
  lại vào Ambiguities
- Code hiện có (đọc để traceability, không phải nguồn thiết kế mới):
  - `src/shared/ipc/channels.ts` — 15 kênh hiện có (`app:*` x5, `ai:*` x5, `notebook:*` x5); feature
    này THÊM kênh `source:*`
  - `src/main/db/migrations.ts` — `MIGRATIONS[]`, migration #1 = bảng `notebook`; feature này APPEND
    migration #2 (không sửa #1)
  - `src/main/services/ai-runtime/provider.ts` — interface `LLMProvider { chat, embed, test }`; dùng
    `embed()` cho bước embed của pipeline
  - Không có Figma MCP nào được dùng cho feature này — mọi thiết kế UI liên quan lấy từ
    `docs/03-ui/prototype.html` (đã đọc trực tiếp, không qua snapshot)

## Prompt for /speckit-specify

Xây dựng tính năng **nạp nguồn (ingestion)** cho InsightVault — pipeline lõi biến tài liệu người dùng
thêm vào một notebook thành dữ liệu sẵn sàng hỏi đáp (RAG), chạy **hoàn toàn trên máy**.

**Nạp nguồn.** Người dùng mở modal "Thêm nguồn" từ một notebook, chọn loại nguồn: **Tệp** (PDF, Word
`.docx`, `.txt`, `.md` — kéo-thả hoặc bấm chọn) hoặc **URL** (trang web). (Audio/Video và Hình ảnh đã
xuất hiện trong bố cục modal nhưng KHÔNG thuộc phạm vi feature này — Pha 2.) Sau khi chọn, nguồn được
thêm vào một **hàng đợi xử lý**, hiển thị tên nguồn, thanh tiến độ, và nhãn trạng thái theo từng bước
(đang trích xuất → sẵn sàng, hoặc lỗi). Trạng thái này cũng phải phản ánh ở cột "Nguồn" của màn
Workspace (icon theo loại, chấm trạng thái ready/processing/error, text phụ như "PDF · 48 trang" hay
"Web"). Số lượng nguồn thật của notebook (thay vì giá trị giữ chỗ "0 nguồn" từ feature notebooks)
phải cập nhật theo dữ liệu thật.

**Pipeline xử lý** (chạy tuần tự cho từng nguồn, hoàn toàn trong main process — Constitution III):

1. **Parse** nội dung theo loại nguồn: PDF → text theo từng trang; `.docx` → text; `.txt`/`.md` →
   text thô/markdown; URL → fetch HTML rồi trích nội dung chính (loại bỏ nav/quảng cáo).
2. **Làm sạch** văn bản đã parse (chuẩn hoá whitespace, loại nhiễu — tuỳ hợp lý theo từng loại).
3. **Chunk**: chia nội dung đã làm sạch thành các đoạn (chunk) — và **NGAY khi tạo mỗi chunk PHẢI
   gắn locator xác định vị trí gốc trong nguồn** (`{page, char_start, char_end}` cho PDF/text theo
   trang; range ký tự tương đương cho docx/txt/md/URL không có khái niệm "trang"). Đây là yêu cầu
   NON-NEGOTIABLE (Constitution Principle II) — **cấm** tái tạo hay ước lượng locator sau khi đã tạo
   chunk; locator phải chính xác ngay từ bước chunk.
4. **Embed**: sinh vector embedding cho từng chunk bằng model embedding đã chọn, gọi qua
   `ProviderRegistry`/`LLMProvider.embed()` đã có sẵn từ feature `ai-runtime` (007) — KHÔNG tự gọi
   Ollama trực tiếp. Nếu runtime AI (Ollama) chưa sẵn sàng tại thời điểm nạp, hành vi cần được đặc tả
   rõ (xem Ambiguities).
5. **Lưu trữ**: chunk metadata (text, locator, thứ tự, source_id) lưu ở **SQLite** (bảng mới `source`
   - `chunk`, mở rộng schema qua **migration #2** — append vào mảng migration hiện có, tuân thủ ADR
     migration: không sửa migration #1 đã phát hành, dùng transaction, FK `source.notebook_id` và
     `chunk.source_id` đều `ON DELETE CASCADE`). Vector embedding lưu ở **LanceDB** (embedded, thư mục
     riêng trong data dir), khoá theo id của chunk để tra cứu ngược.

**Nhất quán giữa 2 store.** Khi xoá một nguồn (source) hoặc xoá một notebook (cascade xuống mọi
source/chunk của nó), hệ thống phải dọn sạch cả bản ghi trong SQLite lẫn vector tương ứng trong
LanceDB — không được để "mồ côi" ở một trong hai bên.

**Ranh giới bảo mật (Constitution III).** Toàn bộ việc đọc file, parse tài liệu, fetch URL, chunk,
gọi embed, và ghi SQLite/LanceDB PHẢI diễn ra ở **main process**. Renderer không được truy cập
filesystem/DB/LanceDB/network trực tiếp — mọi thao tác đi qua các kênh IPC mới **`source:*`**
(whitelisted trong `src/shared/ipc/channels.ts`, theo đúng khuôn mẫu `notebook:*`/`ai:*` đã có), ví
dụ thêm nguồn, liệt kê nguồn theo notebook, lấy trạng thái/tiến độ, xoá nguồn. Nội dung tài liệu đầy
đủ và vector thô không được truyền qua renderer dưới dạng nội dung toàn văn; không log nội dung tài
liệu người dùng ra console/file log.

**Local-first (Constitution I).** Toàn bộ pipeline (kể cả fetch URL do người dùng chủ động nhập) chạy
không phụ thuộc dịch vụ mạng của bên thứ ba ngoài chính trang web người dùng chỉ định và Ollama local;
không có telemetry/analytics nào gửi nội dung tài liệu ra ngoài.

## Ambiguities to raise in /speckit-clarify

Đã quét `docs/04-decisions/INDEX.md` trước — không có quyết định cũ nào trả lời trực tiếp các câu hỏi
dưới đây (khác migration schema, đã áp dụng thẳng vào prompt trên). Tất cả các mục sau cần
`/speckit-clarify` xử lý:

1. **Thư viện parser cụ thể từng loại nguồn** — chưa chốt. Cần chọn: PDF (`pdf.js` — đã có tiền lệ
   dùng cho viewer ở D4/D6, hay `pdf-parse`/khác cho tác vụ extract text ở main process, có thể khác
   thư viện dùng để hiển thị ở source-viewer 006?), `.docx` (`mammoth` là lựa chọn phổ biến), URL →
   HTML (fetch bằng gì; trích nội dung chính bằng `@mozilla/readability` + `turndown` sang markdown,
   hay cách khác?), `.txt`/`.md` (đọc trực tiếp, không cần parser ngoài).
2. **Chiến lược chunk** — kích thước chunk (theo số ký tự/token?), độ chồng lấn (overlap) giữa các
   chunk liền kề, chunk theo ranh giới gì (câu/đoạn/cố định ký tự?), có tôn trọng ranh giới trang PDF
   hay chunk có thể vắt qua nhiều trang (ảnh hưởng tới locator `{page,...}`)?
3. **Tích hợp LanceDB cụ thể** — dùng package nào (`@lancedb/lancedb`, native binding — cần rebuild
   theo Electron ABI hay có prebuilt?), đường dẫn thư mục store trong data dir (`app.getPath('userData')`
   theo tiền lệ 001/009 — tên thư mục con là gì?), schema bảng LanceDB (field nào ngoài vector + chunk
   id), tạo index ANN lúc nào.
4. **Hàng đợi xử lý** — xử lý tuần tự từng nguồn hay cho phép song song nhiều nguồn cùng lúc? Có giới
   hạn số lượng đồng thời không? Thứ tự ưu tiên trong hàng đợi (FIFO)? Có cho phép huỷ một nguồn đang
   xử lý giữa chừng?
5. **Hành vi khi Ollama/AI runtime chưa sẵn sàng lúc nạp nguồn** — chặn không cho nạp (báo lỗi ngay),
   hay vẫn parse+chunk+lưu SQLite rồi giữ ở trạng thái "chờ embedding" và tự động embed khi runtime
   sẵn sàng? Ảnh hưởng trực tiếp tới định nghĩa trạng thái nguồn (`queued/processing/ready/error`) và
   UX của "Sẵn sàng hỏi đáp".
6. **Fetch URL có tính là network egress cần cảnh báo/chỉ báo riêng tư không?** OVERVIEW mục 5 liệt
   URL là loại nguồn hợp lệ trong MVP, nhưng Constitution I yêu cầu privacy indicator phản ánh đúng
   khi "đang gửi dữ liệu ra ngoài". Cần làm rõ: fetch trang web do người dùng chủ động nhập có kích
   hoạt trạng thái "online" của privacy indicator không, và có giới hạn nào (redirect, scheme
   http/https, IP nội bộ/localhost) để tránh SSRF không.
7. **Giới hạn kích thước file / số trang** — có giới hạn dung lượng file tối đa cho mỗi loại nguồn
   không? Hành vi khi vượt giới hạn.
8. **Dedup nguồn trùng** — thêm lại cùng 1 file hoặc cùng 1 URL vào cùng notebook: chặn, cảnh báo, hay
   cho phép tạo bản ghi mới độc lập?
9. **Retry khi lỗi** — nguồn ở trạng thái `error` có nút thử lại không, hay phải xoá và thêm lại từ
   đầu? Lỗi ở bước nào (parse/embed/lưu) có retry khác nhau không?
10. **Danh sách đầy đủ kênh IPC `source:*`** cần chốt tên và payload/response, theo khuôn mẫu
    `notebook:*` hiện có — ví dụ (không phải quyết định cuối): `source:add` (nhận tệp/URL, trả về
    nguồn ở trạng thái queued), `source:listByNotebook`, `source:getStatus` hoặc qua event, `source:delete`.
    Cần khớp với `ChannelResponse` type trong `channels.ts`.
11. **Locator cho docx/.txt/.md/URL** — không có khái niệm "trang" như PDF. Xác nhận dùng
    `{char_start, char_end}` (không có `page`) hay đặt `page: null`/`page: 1` mặc định? Cấu trúc type
    `Locator` dùng chung hay khác nhau theo loại nguồn — ảnh hưởng tới type `Locator` trong
    `src/shared/`.
12. **Cơ chế báo tiến độ (progress reporting)** — renderer nhận cập nhật tiến độ hàng đợi bằng cách
    nào: poll định kỳ qua IPC invoke, hay main chủ động push event (`ipcRenderer.on`) tới renderer?
    Ảnh hưởng thiết kế `source:*` (thêm kênh event riêng hay không).
13. **"Đã lập chỉ mục" hiển thị ở đâu** — prototype dòng 378 ghi "12 tài liệu · đã lập chỉ mục" ở
    header cột Nguồn — đây là trạng thái tổng hợp của cả notebook (tất cả nguồn ready) hay chỉ là text
    tĩnh? Cần làm rõ điều kiện hiển thị.
14. **Trạng thái lỗi (`.stat err`)** xuất hiện trong CSS/class của prototype nhưng không có ví dụ nội
    dung cụ thể (text hiển thị khi lỗi) — cần đặc tả nội dung/nhãn hiển thị khi một nguồn lỗi.

## Thuật ngữ mới (append vào glossary)

Các thuật ngữ nghiệp vụ sau xuất hiện trong phạm vi feature này nhưng CHƯA có trong
`docs/00-glossary.md` (đề xuất bản dịch, người phụ trách append trong branch `011-ingestion`):

| Tiếng Việt đề xuất                 | English (đề xuất)                 | Ghi chú                                                                                                             |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Pipeline nạp nguồn                 | ingestion pipeline                | Chuỗi parse → làm sạch → chunk → embed → lưu vector (OVERVIEW mục 10)                                               |
| Phân đoạn (hoá)                    | chunking                          | Hành động/bước tạo ra các `chunk`; phân biệt với danh từ `chunk` đã có                                              |
| Kho vector                         | vector store                      | LanceDB cụ thể hoá; đã ngụ ý trong ADR D2 nhưng chưa có dòng glossary riêng                                         |
| Trạng thái xử lý (nguồn)           | processing status / source status | Enum hiển thị ở `.stat` (ready/proc/err) + hàng đợi; đề xuất giá trị chuẩn `queued \| processing \| ready \| error` |
| Hàng đợi nạp nguồn                 | ingestion queue                   | UI `.queue`/`.qi` trong modal Thêm nguồn                                                                            |
| Làm sạch (văn bản)                 | cleaning / text cleaning          | Bước giữa parse và chunk trong pipeline                                                                             |
| Trích xuất (nội dung chính từ URL) | content extraction                | Bước lọc HTML → nội dung chính, phân biệt với `parse` chung                                                         |

Lưu ý: `source`, `chunk`, `embedding`, `locator`, `index/indexing`, `retrieval`, `provider`,
`LLMProvider`, `migration (schema)` đã có sẵn trong glossary — dùng nguyên, không đặt tên khác.

## Suggested constitution amendments

Không đề xuất sửa constitution — các nguyên tắc I/II/III đã bao trùm đầy đủ yêu cầu của feature này
(đặc biệt Principle II viết sẵn cho đúng tình huống ingestion). Tuy nhiên đề xuất **2 ADR mới** (không
phải sửa constitution) nên tạo trong quá trình `/speckit-plan` hoặc `/speckit-clarify` của feature
này, theo đúng tiền lệ "ADR-governed stack":

1. **ADR chunking strategy** — chốt kích thước/overlap/ranh giới chunk, xử lý locator cho từng loại
   nguồn (đặc biệt docx/URL không có "trang"). Lý do cần ADR riêng: đây là quyết định kỹ thuật ảnh
   hưởng trực tiếp tới chất lượng retrieval của feature `005-rag-qa` kế tiếp — nên chốt tường minh,
   không để ngầm định rải rác trong code.
2. **ADR LanceDB integration cụ thể** — package, schema bảng, đường dẫn lưu trữ trong data dir, chiến
   lược đồng bộ xoá với SQLite. Lý do: D2 mới chỉ chọn LanceDB ở mức khái niệm; feature này là nơi
   đầu tiên hiện thực hoá, nên các chi tiết tích hợp xứng đáng ghi lại để feature `006-source-viewer`
   và `005-rag-qa` tái sử dụng đúng cách, tránh mỗi feature tự suy diễn khác nhau.

Cả hai nên được tạo bằng đúng quy trình đã dùng cho `2026-07-11-sqlite-migrations.md` (ADR cấp
`_project` hoặc gắn feature `011-ingestion`, append dòng vào `docs/04-decisions/INDEX.md`).
