# Intake — 112-pdf-layout

- Issue: #112 (repo `hoanghainh1188/insight-vault`)
- Slug: `pdf-layout`
- Ngày intake: 2026-10-07
- Loại: cải tiến chất lượng trích xuất của một loại nguồn có sẵn (PDF có lớp chữ). KHÔNG phải loại nguồn mới,
  KHÔNG có Figma, KHÔNG có basic/detail design của khách hàng (`docs/01-basic-design/` và
  `docs/02-detail-design/` chỉ có README). Giải quyết giới hạn đã biết: **"PDF chỉ lấy chữ, không giữ bố cục —
  bảng biểu và cột bị trộn lẫn"**.

## Input sources

- **GitHub issue #112** — brief chính, kèm 3 QUYẾT ĐỊNH NGƯỜI DÙNG ngày 2026-10-07 (mục "Đã chốt"). Lưu ý trung
  thực: phiên intake này KHÔNG chạy được `gh issue view 112` (Bash bị tắt trong subagent); nội dung issue lấy từ
  bản tóm tắt agent điều phối cung cấp. **Khuyến nghị:** người phụ trách đối chiếu lại với thân issue thật
  trước `/speckit-specify`.
- `docs/OVERVIEW.md` — 3 điểm bất biến (Local-first, Kiểm chứng được, Offline & tự chủ); phạm vi v1 gồm nạp
  PDF + "Trình xem nguồn: xem PDF/markdown, highlight đoạn được trích dẫn".
- `docs/03-ui/prototype.html` — màn S3 "Thêm nguồn" (loại Tệp: PDF · Word · txt · md; hàng đợi có thanh tiến
  độ + bước "Trích xuất") và S4 "Xem nguồn" (pager "Trang 12 / 48", đoạn highlight). Prototype KHÔNG có hành
  động "xử lý lại" nào ⇒ UX của nó là mới (xem ambiguity #10).
- `.specify/memory/constitution.md` (v1.0.0) — I (không egress mới), II (locator `{page,charStart,charEnd}`
  gắn lúc chunk, cấm ước lượng sau; chip `[n]` → đúng trang + đoạn highlight), III (mọi truy cập ở main;
  kênh IPC mới phải whitelist ở preload), IV (test-first, coverage ≥80% business logic).
- `docs/00-glossary.md` — đã tra: có `ingestion pipeline`, `chunking`, `locator`, `text cleaning`, `page break`,
  `source status`, `relink`, `source viewer`, `highlight`, `citation`. **Chưa có** thuật ngữ về dựng dòng / thứ
  tự đọc / bảng / xử lý lại (xem mục thuật ngữ mới).
- `docs/04-decisions/INDEX.md` + ADR đã đọc:
  - `2026-07-11-ingestion-clarify.md` (011) — parser PDF = `pdfjs-dist` thuần JS ở main, `getTextContent()` theo
    từng trang; giới hạn 50 MB cho PDF/docx; **mục 9: `source:retry` chỉ chạy lại nguồn `error`, từ đầu
    (re-parse), xoá dữ liệu một phần trước**; nhãn lỗi "Lỗi trích xuất" (parse).
  - `2026-07-11-chunking-strategy.md` (011) — ~1000 ký tự + overlap 150, cắt theo `\n\n` > `\n` > câu > khoảng
    trắng; **chunk không vắt trang**; locator tính một lần trên văn bản đã làm sạch (nối trang bằng `"\n\n"`);
    heading-aware chunking đã bị **loại cho MVP** ("để dành tối ưu sau").
  - `2026-07-11-source-viewer-strategy.md` (019) — viewer TÁI DỰNG toàn văn từ chunk (không re-parse), highlight
    theo offset toàn cục, `pageBreaks` suy từ chunk, render text thuần (không canvas). Nhờ vậy locator luôn tự
    nhất quán với văn bản chunk đã lưu.
  - `2026-07-13-rag-enhance-clarify.md` (055), `2026-07-13-embed-in-process-clarify.md` (059),
    `2026-10-07-relevance-calibration*.md` (108) — retrieval hybrid, e5-small, ngưỡng đã hiệu chuẩn gắn
    `EMBEDDING_MODEL_VERSION`. Chỉ liên quan gián tiếp (văn bản chunk đổi ⇒ phân bố khoảng cách có thể đổi).
  - `2026-07-12-chat-history-clarify.md` (027), `2026-07-11-studio-clarify.md` (021) — chat/Studio lưu
    `citations_json` bền (xem ambiguity #1).
  - `2026-10-06-vault-backup-clarify.md` (085) — `vaultLock` chặn thêm/thử lại/xoá nguồn trong lúc sao lưu/khôi
    phục; hành động xử lý lại mới phải tôn trọng khoá này.
  - Quét INDEX: KHÔNG có quyết định nào về bố cục PDF, OCR PDF quét, hay xử lý lại nguồn đã `ready` ⇒ các mục đó
    thuộc phạm vi 112 (đã chốt một phần bên dưới).
- Code hiện có (chỉ để mô tả điểm tích hợp, KHÔNG phải thiết kế mới):
  - `src/main/services/ingestion/parsers/pdf.ts` — `parsePdf(bytes)`: với mỗi trang gọi `getTextContent()` rồi
    `items.map(it => it.str).join(" ")` ⇒ **mất xuống dòng, đọc theo thứ tự item của pdf.js (cột trái/phải xen kẽ),
    bảng bị dẹt thành một dòng**. Trả `ParseResult{ pageCount, pages: PageText[] }`.
  - `src/main/services/ingestion/cleaning.ts` — `cleanText`: CRLF→LF, **gộp mọi `[ \t nbsp]+` thành 1 dấu cách**,
    bỏ khoảng trắng cuối dòng, gộp ≥3 `\n` thành 2, `trim()`. Đây là văn bản CHÍNH TẮC mà locator tính lên.
  - `src/main/services/ingestion/chunker.ts` — `chunkPages` (không vắt trang; `joinPages` nối trang bằng
    `"\n\n"`); điểm cắt ưu tiên `\n\n` rồi `\n`.
  - `src/main/services/ingestion/pipeline.ts` — `parseAndClean` → `chunkPages` → `deleteChunks` + `insertChunks`
    → `embedAndStore` (xoá vector theo source rồi ghi lại). `retry(id)` chỉ cho `status === "error"`, xoá vector +
    chunk rồi xếp hàng lại `processFull`. `sourceOrigin` luôn đọc cột `origin` (đường dẫn file gốc, tham chiếu
    không copy).
  - `src/main/services/ingestion/source-repo.ts` — chunk id là `crypto.randomUUID()` mỗi lần `insertChunks` ⇒
    **xử lý lại sinh chunk id mới**.
  - `src/main/services/source-viewer/reconstruct.ts` — `reconstructText` (fill gap trang bằng `"\n".repeat(gap)`),
    `derivePageBreaks`.
  - `src/shared/ipc/types.ts` — `Citation{ n, chunkId, sourceId, sourceTitle, locator }`: citation lưu **cả
    chunkId lẫn locator offset**. Chat (`chat_message.citations_json`) và Studio
    (`studio_result.citations_json`) lưu bền các Citation này.
  - `src/renderer/features/source-viewer/{useSourceViewer.ts,SourceViewer.tsx,source-viewer.css}` —
    `openCitation(c)` highlight theo **`c.locator.charStart/charEnd` áp lên nội dung HIỆN TẠI** từ
    `source:getContent`; `.vtext` là `white-space: pre-wrap` (text thuần; dấu `|` của bảng sẽ hiện nguyên văn).
  - `src/renderer/features/sources/SourceItem.tsx` — hàng nguồn có "Thử lại" (chỉ khi `error`), "Chọn lại tệp gốc…"
    (101, chỉ khi `error` + không phải URL), "Xoá". Chưa có hành động nào cho nguồn `ready`.
  - Kênh IPC: `src/shared/ipc/channels.ts` (`sourceRetry: "source:retry"`), `src/main/ipc/register.ts`,
    `src/preload/index.ts` — khuôn để thêm kênh mới (whitelist).
  - `tests/fixtures/sample.pdf` — fixture PDF duy nhất hiện có; `tests/unit/{ingestion-pipeline,reconstruct}.test.ts`.
- Figma: không dùng. Design token: không đổi.

## Sự kiện cần ghi nhận (từ code, để spec không phải đoán)

1. **Văn bản PDF hiện là một "dòng dài" mỗi trang.** Không có `\n` nào từ PDF ⇒ chunker không có ranh giới dòng/đoạn
   để cắt (chỉ còn câu/khoảng trắng); Source Viewer hiển thị khối chữ liền.
2. **Locator offset gắn với văn bản đã-làm-sạch lúc chunk, và viewer áp offset đó lên nội dung hiện tại.** Mọi thay
   đổi extraction làm đổi văn bản `T` ⇒ citation cũ (chat/Studio) trỏ offset của `T` cũ. Quyết định 3 (giữ PDF cũ
   nguyên trạng) là cách tránh điều này cho PDF cũ; riêng "Xử lý lại" thì KHÔNG tránh được (ambiguity #1).
3. **`cleanText` áp dụng cho mọi loại nguồn** (không có nhánh theo `kind`) và gộp khoảng trắng liên tiếp ⇒ nếu bảng
   Markdown được căn lề bằng nhiều dấu cách thì bị nén về 1 (ambiguity #3).
4. **Chunk id đổi mỗi lần chunk lại**, và `retry` đã tồn tại với ngữ nghĩa "xoá hết rồi dựng lại" (chỉ nguồn lỗi)
   — là tiền lệ gần nhất cho "Xử lý lại", nhưng KHÔNG đủ vì nguồn `ready` có citation sống.

## Đã chốt (USER DECISIONS 2026-10-07) — KHÔNG hỏi lại ở clarify

1. **Phạm vi:** PDF **có lớp chữ (text layer)**. Dựng lại **dòng (lines)** từ toạ độ item của pdf.js; **thứ tự đọc
   (reading order)** đúng cho trang **nhiều cột**; giữ **bảng (tables)** dưới dạng hàng/ô. **PDF quét (cần OCR)
   nằm NGOÀI phạm vi.**
2. **Định dạng bảng:** xuất thành **Markdown table** (`| a | b |`) ngay trong văn bản trích xuất.
3. **Dữ liệu cũ:** PDF đã nạp **giữ nguyên** (citation cũ vẫn hợp lệ). Trích xuất mới áp dụng cho PDF **thêm mới**,
   cộng thêm hành động người dùng chủ động **"Xử lý lại" (reprocess)** cho từng nguồn. **KHÔNG tự động xử lý lại
   nền khi mở app.**

## Prompt for /speckit-specify

Cải thiện việc trích xuất văn bản từ tệp PDF có lớp chữ (text layer) của InsightVault để **giữ được bố cục cơ
bản của tài liệu**: dòng chữ, thứ tự đọc của trang nhiều cột, và bảng biểu. Hiện nay (giới hạn đã biết) trình
phân tích PDF (`parsers/pdf.ts`, pdf.js `getTextContent`) chỉ nối các mẩu chữ của mỗi trang bằng dấu cách, nên
mất xuống dòng, chữ của hai cột bị xen kẽ, và bảng bị dẹt thành một dòng chữ liền — làm chất lượng chunk, truy
xuất và trích dẫn kém trên các tài liệu như hợp đồng, báo cáo, bài báo khoa học nhiều cột, bảng số liệu.
KHÔNG thêm loại nguồn mới; KHÔNG đổi cách phân tích DOCX/TXT/MD/URL/audio/video/ảnh; KHÔNG làm OCR cho PDF quét.

**Hành vi mong muốn (theo quyết định đã chốt 2026-10-07):**

- **Dựng dòng (lines):** từ toạ độ của từng mẩu chữ (item) mà pdf.js trả về, gom các mẩu cùng một hàng thành một
  dòng và xuống dòng giữa các hàng, thay cho việc nối phẳng bằng dấu cách.
- **Thứ tự đọc (reading order):** với trang nhiều cột, văn bản phải được đọc hết cột này rồi mới sang cột kế
  tiếp, không xen kẽ chữ giữa các cột.
- **Bảng (tables):** nhận diện vùng bảng và giữ cấu trúc hàng/ô; trong văn bản trích xuất, bảng được biểu diễn
  bằng **Markdown table** (`| a | b |`).
- **Phạm vi áp dụng:** PDF **thêm mới** từ sau feature này dùng cách trích xuất mới. PDF **đã nạp trước đó giữ
  nguyên** (chunk, locator và mọi trích dẫn cũ vẫn hợp lệ). Mỗi nguồn PDF có thêm một hành động do người dùng chủ
  động bấm **"Xử lý lại" (reprocess)** để trích xuất lại bằng cách mới. **Không** có xử lý lại tự động ở nền khi
  mở app.
- **PDF quét (không có lớp chữ):** ngoài phạm vi; hành vi hiện tại (báo "Lỗi trích xuất" khi không có chữ) giữ
  nguyên.

**Ràng buộc bất biến phải giữ (Constitution):**

- **II — Kiểm chứng được (NON-NEGOTIABLE):** locator `{page, charStart, charEnd}` vẫn được tính MỘT LẦN trên văn
  bản chính tắc đã làm sạch (kể cả phần Markdown table), chunk vẫn không vắt qua ranh giới trang, chip `[n]` vẫn
  mở đúng trang và highlight đúng đoạn. Source Viewer tiếp tục tái dựng văn bản từ chunk đã lưu (không re-parse),
  nên `reconstructText(chunks) === văn bản chính tắc` phải tiếp tục đúng với văn bản có xuống dòng/bảng.
- **I — Local-first:** không thêm network egress; toàn bộ phân tích bố cục chạy cục bộ bằng dữ liệu pdf.js đã có.
- **III — Biên bảo mật:** mọi xử lý ở main process; nếu cần kênh IPC mới cho "Xử lý lại" thì phải đăng ký
  whitelist ở `preload`, renderer chỉ gửi `sourceId` (không gửi đường dẫn tệp); không log nội dung tài liệu.
- **IV — Test-first:** logic dựng dòng, xác định cột/thứ tự đọc, và dựng bảng là **hàm thuần** nhận mảng item (chuỗi
  - toạ độ + kích thước) và trả văn bản; kiểm thử bằng fixture tất định (item tổng hợp, và PDF mẫu nhỏ); coverage
    ≥80% business logic; phần I/O pdf.js loại khỏi coverage như quy ước hiện có.

**Kế thừa, không phá vỡ:** `parsePdf` giữ hợp đồng trả `ParseResult{pageCount, pages[{page,text}]}`;
`cleanText`/`chunkPages`/`reconstructText` giữ vai trò hiện có (nếu phải chỉnh để không làm hỏng bảng/xuống dòng thì
chỉ đổi theo hướng không ảnh hưởng nguồn khác loại); giới hạn 50 MB PDF, hàng đợi tuần tự, trạng thái nguồn và
cơ chế "Thử lại"/"Chọn lại tệp gốc" (101) giữ nguyên.

**Ngoài phạm vi:** OCR PDF quét; tự động xử lý lại nền; đổi parser DOCX/TXT/MD/URL/audio/ảnh; render bảng
HTML trong viewer (feature sau — clarify #6); đổi model embedding; heading-aware chunking.

## Ambiguities to raise in /speckit-clarify

> **ĐÃ CHỐT TOÀN BỘ (2026-10-07)** — xem `docs/04-decisions/2026-10-07-pdf-layout-clarify.md`. Giữ danh sách dưới làm bối cảnh.

Đã loại: phạm vi (text layer, không OCR), dạng bảng (Markdown), chính sách dữ liệu cũ/không tự động (3 quyết định
trên); parser = pdf.js thuần JS, giới hạn 50 MB, retry từ đầu (ADR 011); chunk không vắt trang + locator gắn lúc
chunk (ADR chunking); viewer tái dựng từ chunk (ADR 019). Còn lại:

1. **Citation cũ sau khi "Xử lý lại" (rủi ro Constitution II — ưu tiên cao nhất).** Xử lý lại xoá chunk, sinh
   chunk id mới và văn bản chính tắc `T` mới. `chat_message.citations_json` và `studio_result.citations_json` lưu
   `chunkId` + `locator` cũ; viewer sẽ highlight offset cũ trên `T` mới ⇒ **highlight sai chỗ** (hoặc `chunkId` mồ
   côi). Cần chốt chiến lược: (a) chặn xử lý lại khi nguồn đang được trích dẫn trong chat/Studio; (b) cảnh báo
   rồi vô hiệu hoá các chip cũ ("nguồn đã được xử lý lại, vị trí không còn chính xác") thay vì highlight sai; (c) giữ
   cả hai phiên bản chunk cho đến khi xoá hội thoại/Studio liên quan; (d) xoá chat/Studio liên quan. Và: người dùng
   có phải xác nhận trước khi mất khả năng kiểm chứng trích dẫn cũ không?
2. **Studio / chat đã sinh dựa trên bản trích xuất cũ.** Nội dung đã lưu giữ nguyên nhưng căn cứ không còn tái hiện
   được. Có đánh dấu "dựa trên bản trích xuất cũ" không? Có đề nghị tạo lại Studio sau khi xử lý lại không?
   (Phụ thuộc đáp án #1.)
3. **`cleanText` và Markdown table.** `cleanText` gộp mọi dấu cách/tab liên tiếp thành 1 và `trim()`. Quy ước biểu
   diễn bảng: không căn lề bằng dấu cách (mỗi ô cách `|` đúng 1 dấu cách), hàng phân cách `|---|---|`, thoát ký tự
   `|` trong ô, ô rỗng, ô nhiều dòng (xuống dòng trong ô) — chốt từng điểm. Hàng phân cách `---` và `|` có được tính vào
   locator/chunk (có, vì nằm trong văn bản chính tắc) — xác nhận chấp nhận việc chúng xuất hiện trong trích dẫn.
4. **Chunker và bảng/đoạn xuống dòng.** Chunker cắt ưu tiên `\n\n` rồi `\n`, nên chunk có thể bắt đầu giữa bảng,
   mất hàng tiêu đề (header) và Markdown vỡ. Vì `chunk.text` PHẢI bằng `T.slice(charStart,charEnd)` (Constitution II),
   **không được chèn hàng tiêu đề giả** vào chunk. Chấp nhận vỡ bảng khi cắt, hay chunker được học "đừng cắt giữa
   bảng nếu vừa size", hay bảng lớn hơn ~1000 ký tự cắt theo hàng? (Đổi chunker chạm ADR chunking — có nằm trong
   phạm vi 112 không?)
5. **Cách nhận diện bảng và phương án dự phòng khi không chắc.** pdf.js `getTextContent` KHÔNG cho đường kẻ ô (ruling
   lines); chỉ có toạ độ chữ. Nhận diện theo căn cột (alignment) hay có đọc thêm toạ độ đường kẻ qua operator list?
   Ngưỡng tối thiểu (số hàng/số cột) để coi là bảng? Khi không chắc là bảng (văn bản thường căn thẳng hàng, mục lục
   có dấu chấm dẫn, bảng không viền, ô gộp) thì xuất **văn bản dòng thường** thay vì Markdown table — xác nhận
   nguyên tắc "thà không nhận diện còn hơn nhận nhầm". Khi bước phân tích bố cục của một trang ném lỗi/quá chậm thì
   dự phòng về cách nối phẳng cũ cho **trang đó** (hay cả tài liệu, hay báo lỗi)?
6. **Hiển thị trong Source Viewer.** `.vtext` là `white-space: pre-wrap` text thuần, nên bảng hiện dạng `| a | b |`
   thô và xuống dòng hiện đúng. Giữ nguyên (đơn giản, highlight offset đúng) hay render bảng thành bảng HTML (phải
   map offset ↔ ô, khó giữ highlight chính xác — có thể là việc của feature sau)? Có dùng font đơn cách cho vùng bảng
   không?
7. **Ranh giới đoạn văn và dòng.** Giữa các dòng cùng đoạn dùng `\n` hay nối thành một câu (để chunk/embedding sạch,
   đặc biệt dòng bị ngắt cứng ở lề)? Khi nào chèn dòng trống `\n\n` (khoảng cách dọc lớn hơn bao nhiêu so với cỡ chữ)?
   Có xử lý từ bị ngắt bằng dấu gạch nối cuối dòng ("trích-\nxuất") không? Có nhận diện tiêu đề (heading) theo cỡ chữ
   không, hay chỉ tách đoạn (heading-aware chunking đã bị loại khỏi MVP)?
8. **Đầu trang / chân trang / số trang / chú thích cuối trang.** Có loại bỏ chữ lặp lại ở mọi trang và số trang
   không (cải thiện chunk nhưng có thể xoá nhầm nội dung — vi phạm "kiểm chứng được"), hay giữ nguyên? Chú thích cuối
   trang và chỉ số trên/dưới (superscript) đặt ở đâu trong thứ tự đọc?
9. **Văn bản đặc biệt:** chữ xoay (trang ngang, chữ dọc), RTL, chữ ở nhiều cỡ trên cùng đường cơ sở (baseline),
   chữ chồng nhau (watermark), trang có cả vùng chữ lẫn ảnh quét, trang bố cục phức tạp (3+ cột, chữ bao quanh
   hình). Xác nhận phạm vi "best-effort" và nhóm nào chắc chắn KHÔNG hỗ trợ ở v1 (và dự phòng nào).
10. **UX "Xử lý lại".** (a) Đặt ở đâu — hàng nguồn ở cột Nguồn (cạnh "Thử lại"/"Xoá") và/hoặc trong Source Viewer?
    (b) Chỉ hiện cho PDF? (c) Hiện cho nguồn ở trạng thái nào (`ready`, `awaiting_embedding`, `error`)? Quan hệ với
    "Thử lại" hiện có ở nguồn `error`: gộp hay tách? (d) Hộp thoại xác nhận nêu rõ hệ quả với trích dẫn cũ (#1)?
    (e) Có tác vụ hàng loạt "Xử lý lại tất cả PDF trong notebook" không? (f) Bị khoá trong lúc `vaultLock`, khi nguồn
    đang `queued/processing`, và khi tệp gốc không còn (→ luồng "Chọn lại tệp gốc…" 101)? (g) Nếu tệp gốc đã bị sửa
    (khác `content_hash`) thì chặn hay cho xử lý lại?
11. **Tính nguyên tử khi xử lý lại thất bại.** `retry` hiện xoá chunk + vector TRƯỚC rồi mới dựng lại; nếu xử lý lại
    thất bại giữa chừng, nguồn `ready` cũ mất sạch dữ liệu. Với "Xử lý lại", có yêu cầu **giữ dữ liệu cũ cho đến khi
    bản mới dựng xong** (dựng tạm rồi hoán đổi) và khôi phục bản cũ khi lỗi không? Nhãn lỗi/tiến độ hiển thị thế nào?
12. **Đánh dấu "PDF dùng trích xuất cũ" và phiên bản trích xuất.** Để gợi ý hoặc để biết nguồn nào đã xử lý lại, có cần
    lưu một cờ/phiên bản trích xuất (`extraction version`, cần migration SQLite mới — ADR sqlite-migrations) không,
    hay không lưu gì và coi mọi PDF cũ như nhau? Có hiện huy hiệu/gợi ý "Xử lý lại để giữ bố cục" trên PDF cũ không
    (tôn trọng quyết định "không tự động" nhưng có thể là gợi ý thụ động)? Cờ này cũng cần cho các lần nâng thuật
    toán sau.
13. **Tác động lên truy xuất và bộ đánh giá 108.** Văn bản chunk đổi (xuống dòng, ký tự `|`) có thể làm dịch phân bố
    khoảng cách e5 và kết quả BM25 (token `|` bị bỏ khi fold). Có thêm tài liệu PDF nhiều cột/có bảng + câu hỏi vào
    `tests/eval/` và chạy lại `npm run eval:retrieval` để so trước/sau không, hay chỉ kiểm bằng unit test?
14. **Hiệu năng và giới hạn.** Phân tích bố cục tăng chi phí CPU cho PDF tới 50 MB / hàng trăm trang. Có ngân sách thời
    gian/bộ nhớ, tiến độ theo trang trong bước "Trích xuất", và giới hạn số item/trang để tránh treo hàng đợi tuần
    tự không? Có cho huỷ khi đang xử lý lại không (hiện `queue.cancel` có sẵn)?
15. **Fixture kiểm thử và giấy phép.** Dùng PDF tổng hợp (sinh bằng mã/tự soạn, không vướng bản quyền) hay PDF công
    khai thật (hợp đồng mẫu, bài báo 2 cột, báo cáo có bảng — cần xác nhận giấy phép tái phân phối trong repo như ở
    108)? Tối thiểu nhóm fixture nào: 1 cột/2 cột/3 cột, bảng có viền/không viền, bảng nhiều trang, trang xoay,
    tiếng Việt có dấu tổ hợp (NFC/NFD)?

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md`. Đề xuất append (không sửa term cũ; cột 日本語 để `—`). Tên English dùng làm
tên hàm/type/kênh chuẩn trong code:

| 日本語 | Tiếng Việt (đề xuất)                                                    | English (đề xuất, dùng trong code)                 | Ghi chú                                                                                      |
| ------ | ----------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| —      | Lớp chữ của PDF (PDF có chữ chọn/sao chép được, không phải ảnh quét)    | text layer (`hasTextLayer`)                        | Phạm vi 112; PDF quét (cần OCR) ngoài phạm vi — 112                                          |
| —      | Mẩu chữ do pdf.js trả về kèm toạ độ/kích thước                          | text item (`PdfTextItem`)                          | `{str, x, y, width, height, ...}` — đầu vào các hàm thuần dựng dòng/cột/bảng — 112           |
| —      | Dựng dòng (gom mẩu chữ cùng hàng, xuống dòng giữa các hàng)             | line reconstruction (`buildLines`)                 | Thay cho `join(" ")` phẳng — 112                                                             |
| —      | Thứ tự đọc (trang nhiều cột: hết cột này rồi sang cột kế)               | reading order (`orderBlocks` / `detectColumns`)    | Không xen kẽ chữ giữa các cột — 112                                                          |
| —      | Bảng (nhận diện từ toạ độ chữ) xuất dạng Markdown                       | Markdown table (`toMarkdownTable`, `detectTables`) | `\| a \| b \|`; quy ước ô/hàng phân cách chốt ở clarify (#3, #5) — 112                       |
| —      | Xử lý lại nguồn (trích xuất lại bằng thuật toán mới, do người dùng bấm) | reprocess (`source:reprocess`, "Xử lý lại")        | KHÁC `retry` (chỉ nguồn `error`) và `relink` (chọn lại tệp gốc 101); sinh chunk id mới — 112 |
| —      | Phiên bản trích xuất (nếu chốt lưu — ambiguity #12)                     | extraction version (`extractionVersion`)           | Chưa chắc có; chỉ thêm nếu clarify chốt — 112                                                |

Ghi chú: "text layer", "reading order" là thuật ngữ chuẩn ngành xử lý tài liệu, giữ nguyên tiếng Anh; cột Tiếng
Việt chỉ giải nghĩa. Người phụ trách có thể gộp bớt dòng khi append trong branch feature (rule 5 `CLAUDE.md`: THÊM
term được làm ngay trong branch).

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa đổi constitution phải qua PR riêng được steward duyệt, rule 5). Có thể cân nhắc
về sau, không bắt buộc ở 112: một dòng tường minh trong Principle II rằng "mọi thay đổi **parser/làm sạch/chunk** làm
đổi văn bản chính tắc của một nguồn đã có MUST nêu rõ cách xử lý các trích dẫn (citation) đã lưu của nguồn đó
(giữ nguyên dữ liệu cũ, hoặc vô hiệu hoá chip cũ) — KHÔNG được để chip cũ highlight sai vị trí". Tình huống này sẽ lặp
lại mỗi lần nâng parser (DOCX, URL, OCR), nên đáng thành nguyên tắc chung.
