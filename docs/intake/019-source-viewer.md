# Intake — 019-source-viewer

> Output của `design-intake`. Cầu nối giữa tài liệu thiết kế/prototype/ADR/constitution và
> `/speckit-specify`. KHÔNG chứa spec.md — chỉ chuẩn bị prompt sạch + ambiguity cho pipeline Spec Kit.

- **Feature ID:** 019 (GitHub issue #19) — pha 006 trong thứ tự build D8 (`... rag-qa ⭐ → source-viewer → studio ...`)
- **Branch:** `019-source-viewer`
- **Vai trò trong sản phẩm:** hoàn thiện vòng "kiểm chứng được" — bấm chip `[n]` (đã có từ 013-rag-qa)
  → mở đúng nguồn, cuộn + highlight đúng đoạn.

---

## 1. Input sources

| Nguồn           | Vị trí                                                                                                                           | Ghi chú                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview        | `docs/OVERVIEW.md` dòng 30, 34, 47                                                                                               | "chip `[n]`, bấm vào mở nguồn & cuộn tới đúng đoạn được highlight"; "Trình xem nguồn: xem PDF/markdown, highlight đoạn được trích dẫn"; ràng buộc bất biến #3                                                                                        |
| Prototype UI    | `docs/03-ui/prototype.html` dòng 462–478 (màn **S4 Source Viewer**, CSS `.viewer/.vhead/.vscroll/.page/.hl/.hltag` dòng 205–223) | Layout: header có nút quay lại chat (`.backlink`) + tiêu đề nguồn + "Nguồn của trích dẫn [n]" + pager trang (`Trang 12/48`); nội dung là trang PDF dạng text (`.page`) với đoạn `.hl` được tô nền + nhãn nổi `.hltag` "Trích dẫn [1]" phía trên đoạn |
| Prototype UI    | dòng 398–401 (S2 Chat)                                                                                                           | Chip `.cite[data-cite]` trong bong bóng trả lời + dòng `.srcnote` liệt kê "Nguồn: bấm 1 ... tr.12 · 2 ... tr.40"                                                                                                                                     |
| Prototype UI    | dòng 547–550 (script demo)                                                                                                       | `citation chips -> open source viewer`: mọi `[data-cite]` click → `go('s4')` (điều hướng phẳng, demo không phân biệt chip nào trỏ chunk nào)                                                                                                         |
| ADR             | `docs/04-decisions/2026-07-10-tech-stack.md` D4                                                                                  | "Viewer dùng pdf.js text layer (PDF) / char range (markdown) để cuộn tới + highlight đúng đoạn. Không tái tạo offset sau."                                                                                                                           |
| ADR             | D5, D6, D8                                                                                                                       | Bảo mật renderer/main; cấu trúc thư mục theo feature; thứ tự pha (006 sau rag-qa 013)                                                                                                                                                                |
| Constitution    | `II. Verifiable Citations`                                                                                                       | Cấm tái tạo/ước lượng locator; chip `[n]` MUST map xác định `n → chunk_id → source + locator`; viewer MUST cuộn tới + highlight đúng đoạn đó                                                                                                         |
| Constitution    | `III. Desktop Security Boundary`                                                                                                 | Mọi truy cập FS/DB ở main; renderer chỉ qua IPC whitelisted; tài liệu & vector thô MUST NOT đi qua renderer dưới dạng nội dung đầy đủ (cần làm rõ ý nghĩa khi viewer PHẢI hiển thị toàn văn — xem Ambiguity A6)                                      |
| Constitution    | `I. Local-first & No Default Egress`                                                                                             | Nguồn URL đã nạp → hiển thị bản đã lưu, KHÔNG fetch lại (fetch lại = egress ngoài ý muốn)                                                                                                                                                            |
| Glossary        | `docs/00-glossary.md`                                                                                                            | `locator`, `chunk`, `source`, `citation`, `notebook` đã có sẵn — dùng nguyên, không đặt tên khác                                                                                                                                                     |
| Decisions INDEX | `docs/04-decisions/INDEX.md`                                                                                                     | Đã quét — KHÔNG có quyết định nào về source-viewer/highlight-locator từ trước; không có ambiguity nào cần loại bỏ                                                                                                                                    |
| Figma           | —                                                                                                                                | Không có link Figma cho feature này; toàn bộ tham chiếu UI lấy từ `prototype.html`                                                                                                                                                                   |

### Code hiện có (traceability + gap)

| File                                                                             | Vai trò                                                                                                                                                                                                          | Liên quan                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/shared/ipc/types.ts`                                                        | `Citation{n,chunkId,sourceId,sourceTitle,locator}`, `Locator{page,charStart,charEnd}` (half-open), `Chunk{id,sourceId,ordinal,text,locator}`, `Source{id,notebookId,kind,title,status,errorLabel,pageCount,...}` | Dùng lại nguyên vẹn — không định nghĩa lại                                                                                                                                     |
| `src/renderer/features/rag-qa/MessageBubble.tsx` (dòng 6-7, 13-14, 26-29, 42-58) | Chip `[n]` = `<button class="cite" onClick={() => onCite?.(c)}>`; comment sẵn: "Bấm chip → 006-source-viewer sẽ mở nguồn; feature này chỉ cung cấp mapping (onCite optional)"                                    | **Điểm nối trực tiếp** — feature 019 truyền `onCite` thật từ ChatColumn xuống                                                                                                  |
| `src/renderer/features/rag-qa/ChatColumn.tsx`                                    | Hiện KHÔNG truyền `onCite` (no-op)                                                                                                                                                                               | Cần bổ sung handler mở viewer                                                                                                                                                  |
| `src/main/services/ingestion/source-repo.ts`                                     | `getById(id)`, `getOrigin(id)` (KHÔNG expose ra renderer), `listChunks(sourceId)` → mọi chunk sắp theo `ordinal`, mỗi chunk có `text` + `locator{page,charStart,charEnd}`; `getChunksByIds(ids)`                 | Nguyên liệu chính để tái dựng toàn văn nguồn (xem Ambiguity A1)                                                                                                                |
| `src/main/services/ingestion/chunker.ts` (`splitRanges`, dòng 46-95)             | Xác nhận: `pos = max(end-overlap, pos+1)` → các range **liền kề, overlap, phủ kín [0,len)** của văn bản mỗi trang (PDF) / mỗi nguồn (non-PDF); PDF không vắt trang (theo `2026-07-11-chunking-strategy.md`)      | Điều kiện kỹ thuật để hướng "tái dựng từ chunk" (A1 hướng 1) khả thi và chính xác                                                                                              |
| `src/shared/ipc/channels.ts`                                                     | 22 kênh hiện có: `app:*`(5) `ai:*`(5) `notebook:*`(5) `source:*`(6: add/listByNotebook/get/delete/retry + event progress) `rag:ask`(1)                                                                           | **Chưa có kênh lấy nội dung nguồn để hiển thị** — feature 019 cần thêm ít nhất 1 kênh mới, ví dụ `source:getContent` (tên cụ thể để `/speckit-plan` quyết, không tự đặt ở đây) |

---

## 2. Prompt for /speckit-specify

**Đoạn prompt gợi ý (copy nguyên vào `/speckit-specify`):**

> Xây tính năng **Trình xem nguồn (Source Viewer)** cho InsightVault — bước hoàn thiện vòng "kiểm
> chứng được" của luồng hỏi đáp. Trong cột Chat, mỗi câu trả lời của AI chèn các chip trích dẫn `[n]`
> (đã có từ tính năng rag-qa). Khi người dùng bấm vào một chip `[n]`, ứng dụng phải **mở đúng nguồn
> (source)** mà chip đó tham chiếu tới, **cuộn tới đúng đoạn (chunk)** đã được trích dẫn, và **highlight
> (tô nổi bật) chính xác đoạn văn bản đó** — dựa trên `locator` (`{page, charStart, charEnd}`) đã gắn
> sẵn từ lúc tài liệu được chia nhỏ (chunk) khi nạp nguồn (ingestion), **không được tái tạo hay ước
> lượng lại vị trí**.
>
> Theo wireframe (`prototype.html` màn "Xem nguồn"), màn hình trình xem nguồn gồm: một thanh đầu
> (header) có nút "Quay lại chat", tiêu đề nguồn đang xem, dòng phụ ghi rõ đây là "Nguồn của trích dẫn
> [n]", và bộ điều hướng trang (nếu nguồn có khái niệm trang, như PDF). Phần nội dung hiển thị văn bản
> của nguồn; đoạn được trích dẫn có nền tô màu nổi bật kèm nhãn nhỏ "Trích dẫn [n]" gắn phía trên đoạn.
>
> Người dùng phải xem được nội dung nguồn (PDF, Word/.docx, .txt, .md, hoặc trang web đã lưu) ngay cả
> khi không có kết nối mạng — với nguồn dạng URL, phải hiển thị **bản nội dung đã lưu lúc nạp nguồn**,
> **tuyệt đối không tải lại (fetch) từ Internet**. Mọi việc đọc nội dung nguồn từ đĩa/CSDL chỉ được thực
> hiện ở tiến trình chính (main process) của Electron; renderer chỉ nhận dữ liệu cần thiết để hiển thị
> qua kênh IPC đã được whitelist, không được truy cập trực tiếp filesystem/DB.
>
> Tính năng này tái sử dụng các kiểu dữ liệu đã có: `Citation` (số `n`, `chunkId`, `sourceId`,
> `sourceTitle`, `locator`) và `Locator` (`{page, charStart, charEnd}` — khoảng nửa mở) từ tính năng
> rag-qa; `Source` và `Chunk` (cùng các hàm đọc `listChunks`, `getChunksByIds`, `getById`, `getOrigin`)
> từ tính năng ingestion. Điểm khởi đầu của luồng: chip `[n]` trong `MessageBubble` đã sẵn cơ chế
> `onCite(citation)` (hiện là no-op) — tính năng này nối hành động thật vào đó: mở màn/khu vực trình
> xem nguồn tương ứng.
>
> Cần làm rõ (sẽ giải quyết ở bước `/speckit-clarify`): cách lấy được toàn văn nguồn để hiển thị (nguồn
> chỉ lưu từng đoạn `chunk` rời rạc trong CSDL, chưa chắc đã lưu sẵn toàn văn liền mạch); trình xem
> nguồn xuất hiện dưới hình thức nào trong bố cục 3 cột hiện tại (thay cột Chat, mở overlay, hay
> điều hướng sang màn riêng như wireframe vẽ); cách highlight cụ thể cho PDF (hiển thị dạng text thuần
> có highlight, hay render trang PDF thật kèm toạ độ); cách xử lý các loại nguồn không có khái niệm
> "trang" (.docx/.txt/.md — chỉ có offset ký tự); và hành vi khi nguồn đã bị xoá hoặc chunk không còn
> tồn tại.

**Lưu ý khi dán:** đây là văn bản mô tả HÀNH VI (WHAT), không tự chọn giải pháp kỹ thuật (HOW) — các
điểm "cần làm rõ" phải được `/speckit-clarify` hỏi lại, KHÔNG tự quyết ở bước specify.

---

## 3. Ambiguities to raise in /speckit-clarify

Đã quét `docs/04-decisions/INDEX.md` — không có quyết định cũ nào áp dụng được cho các mục dưới, tất
cả đều mới đối với feature 019.

### A1. Cách lấy TOÀN VĂN nguồn để hiển thị + highlight (mâu thuẫn/gap kỹ thuật cốt lõi)

`Locator.charStart/charEnd` là offset vào **văn bản đã làm sạch (cleaned) lúc chunk** (011-ingestion),
**không phải** file gốc trên đĩa. Muốn hiển thị "toàn văn + highlight đúng offset", cần 1 trong 3
hướng — mỗi hướng có trade-off khác nhau với Constitution I/II/III:

1. **Tái dựng từ chunk đã lưu (SQLite):** `listChunks(sourceId)` trả về mọi chunk sắp theo `ordinal`,
   mỗi chunk có `text` + `charStart/charEnd`. Đã xác nhận (`chunker.ts` `splitRanges`) các chunk liền
   kề overlap và phủ kín `[0, len)` của văn bản mỗi trang/nguồn, không có khoảng hở → có thể ghép lại
   đúng nguyên văn đã làm sạch bằng cách nối theo `charStart` tăng dần và cắt phần overlap trùng lặp.
   **Ưu:** hoàn toàn local, không re-parse file / không re-fetch URL (khớp Constitution I cho nguồn
   URL); offset khớp locator 100% vì cùng nguồn dữ liệu. **Nhược:** cần thuật toán dedup overlap chính
   xác (sai 1 ký tự là lệch highlight); nếu PDF chia theo từng trang riêng (không vắt trang) thì phải
   ghép theo từng trang, không phải toàn tài liệu.
2. **Re-parse file gốc + làm sạch lại (deterministic → cùng kết quả text):** chỉ khả thi với nguồn
   dạng file (pdf/docx/txt/md) vì `origin` (đường dẫn) còn tồn tại trên đĩa. **Không khả thi cho URL**
   — parse lại nghĩa là fetch lại trang web = network egress ngoài ý muốn, vi phạm Constitution I.
   Cũng rủi ro nếu file gốc đã bị người dùng sửa/xoá giữa lúc ingest và lúc xem — text lệch khỏi
   locator đã lưu.
3. **Lưu sẵn cleaned full text mỗi source** (thêm cột/bảng lúc ingestion, ví dụ `source.full_text`):
   đơn giản nhất cho việc hiển thị, nhưng **đụng ngược vào 011-ingestion đã hoàn thành** (thêm
   migration + thay đổi pipeline lưu trữ) và tốn dung lượng đĩa (trùng lặp với dữ liệu đã có trong
   bảng `chunk`).

**Khuyến nghị nêu trong prompt (không tự chốt):** hướng 1 (tái dựng từ chunk) có vẻ nhất quán nhất với
Constitution I + II + không đụng 011, nhưng cần `/speckit-clarify` xác nhận & `/speckit-plan` thiết kế
thuật toán dedup overlap cụ thể.

### A2. Hiển thị PDF: text-highlight đơn giản hay render canvas thật bằng pdf.js?

ADR D4 nói "pdf.js text layer" nhưng không nói rõ có cần **render trang PDF dạng ảnh/canvas thật** (để
giữ layout gốc, giống Adobe Reader) hay chỉ cần **hiển thị text đã trích xuất** (giống cách wireframe
S4 vẽ — trang `.page` là HTML/text thuần, không phải ảnh PDF). Wireframe cho thấy phương án 2 (text
thuần với `<p>` + `.hl`), nhưng đó là "wireframe định hướng, không phải bản UI cuối" (dòng 526). Ảnh
hưởng lớn tới độ phức tạp implement (canvas render + toạ độ bbox so với offset ký tự thuần).

### A3. Vị trí Source Viewer trong layout: cột thứ 4, overlay/modal, hay điều hướng sang màn riêng?

Layout hiện tại là workspace 3 cột cố định (Nguồn / Chat / Studio). Wireframe S4 vẽ Source Viewer là
**một MÀN RIÊNG** thay thế toàn bộ workspace (nút "Quay lại chat" để trở về S2), không phải overlay
hay cột phụ. Cần xác nhận đây là chủ đích hay chỉ là giới hạn của prototype demo (do dùng cơ chế
`go(screenId)` đơn giản); có thể UI thật muốn overlay/panel trượt để giữ ngữ cảnh chat.

### A4. Kênh IPC mới trả về gì — toàn văn hay chỉ đoạn quanh chunk?

Cần thêm kênh IPC (vd `source:getContent`) nhưng chưa rõ payload: (a) toàn văn nguồn + danh sách toàn
bộ chunk/locator để renderer tự highlight & cuộn, hay (b) chỉ đoạn văn bản "quanh" chunk được trích dẫn
(context window nhỏ, không phải toàn tài liệu) — nhẹ hơn nhưng không cho phép người dùng đọc/cuộn tự
do quanh đoạn đó như wireframe ngụ ý (pager "Trang 12/48" cho thấy người dùng có thể lật cả tài liệu).

### A5. Điều hướng khi có NHIỀU chip cùng trỏ 1 nguồn nhưng khác đoạn, hoặc trỏ nhiều nguồn khác nhau

Wireframe S2 cho thấy 1 câu trả lời có 2 chip `[1]` `[2]` trỏ **2 nguồn khác nhau** (Hợp đồng khung
tr.12, Báo cáo thẩm định tr.40). Chưa rõ: bấm chip khác trong CÙNG câu trả lời trong khi viewer đang mở
có cập nhật tại chỗ hay phải quay lại chat rồi bấm lại; có cần nút điều hướng "trích dẫn tiếp
theo/trước đó" trong viewer không (wireframe không vẽ, chỉ có pager theo TRANG, không theo chip).

### A6. Ý nghĩa cụ thể của "tài liệu & vector thô MUST NOT đi qua renderer dưới dạng nội dung đầy đủ" (Constitution III) khi viewer buộc phải hiển thị nội dung đầy đủ

Constitution III cấm gửi "tài liệu & vector thô" qua renderer dưới dạng "nội dung đầy đủ", nhưng bản
chất Source Viewer là hiển thị (một phần hoặc toàn bộ) nội dung tài liệu cho người dùng đọc. Cần
`/speckit-clarify` làm rõ ranh giới: điều khoản này nhắm tới việc cấm renderer tự ý truy cập
filesystem/DB trực tiếp (renderer luôn phải xin qua IPC main), hay có ý giới hạn thêm về khối lượng
nội dung trả cho renderer trong 1 lần gọi (vd chỉ gửi 1 trang/1 chunk lân cận thay vì cả tài liệu
48 trang cùng lúc)?

### A7. Hành vi khi nguồn đã bị xoá hoặc chunk mồ côi

`source:delete` đã tồn tại (011-ingestion) và xoá cascade cả chunk (FK). Nếu người dùng bấm chip `[n]`
trỏ tới 1 `sourceId`/`chunkId` không còn tồn tại (đã bị xoá sau khi câu trả lời được sinh ra, trong
cùng phiên chat), viewer phải xử lý ra sao — thông báo lỗi thân thiện, ẩn chip, hay gì khác? Chưa có
trong OVERVIEW/wireframe/ADR.

### A8. Hiển thị nguồn dạng .docx/.txt/.md (không có "trang") — cuộn theo gì?

`Locator.page` là `null` cho các kind ngoài PDF (theo comment trong `types.ts`). Wireframe S4 chỉ vẽ
trường hợp PDF (có pager "Trang 12/48"). Với .docx/.txt/.md/URL cần xác định: có pager gì thay thế
không (vd theo % cuộn, theo mục lục heading), hay chỉ là 1 trang dài cuộn tự do với auto-scroll tới
offset ký tự khi mở.

### A9. Có cho phép mở nguồn TRỰC TIẾP từ cột Nguồn (không qua chip trích dẫn) không?

Wireframe S2 cột "Nguồn" có `data-s="s4"` gắn trên 1 item nguồn (dòng 384: "Báo cáo thẩm định pháp lý")
— tức người dùng có thể bấm thẳng vào 1 nguồn trong danh sách để mở viewer, KHÔNG cần đi qua chip
trích dẫn trong chat. Nếu mở theo đường này thì không có `citation`/`locator` cụ thể để highlight —
cần làm rõ đây có nằm trong phạm vi feature 019 hay để lại cho feature khác (Studio/cột Nguồn
tương tác), và nếu trong phạm vi thì hành vi mặc định khi mở "trần" là gì (mở đầu tài liệu, không
highlight gì?).

---

## 4. Thuật ngữ mới (append vào glossary)

Không có thuật ngữ nghiệp vụ MỚI cần thêm — `source`, `chunk`, `locator`, `citation` đã có sẵn trong
`docs/00-glossary.md` và feature này chỉ tái sử dụng. Nếu `/speckit-plan` quyết định đặt tên riêng cho
khái niệm UI mới (vd "Source Viewer" như 1 route/feature slug, tương tự cách `workspace`/`studio` đã
được ghi glossary ở feature 001/013), gợi ý bổ sung khi đó:

| Tiếng Việt                         | English (dùng trong code)    | Ghi chú                                                                                    |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| Trình xem nguồn                    | source viewer                | Route/feature slug `source-viewer`; component tên cụ thể do `/speckit-plan` quyết          |
| Đoạn được highlight (trong viewer) | highlighted span / highlight | Phân biệt với `chunk` (đơn vị dữ liệu) — highlight là phần UI hiển thị `chunk` đang active |

(Không tự thêm vào file glossary chính thức ở đây — để người phụ trách append khi `/speckit-plan` chốt
tên cụ thể, theo rule 5 CLAUDE.md.)

---

## 5. Gap code (traceability, để `/speckit-plan` tham chiếu)

- **Nối `onCite`:** `MessageBubble.tsx` đã có `onCite?: (c: Citation) => void` sẵn, nhưng
  `ChatColumn.tsx` hiện KHÔNG truyền prop này xuống (no-op). Feature 019 cần: (a) `ChatColumn` nhận
  callback mở viewer từ cha, (b) route/state quản lý "đang xem citation nào".
- **Kênh IPC mới:** chưa có kênh nào đọc nội dung nguồn để hiển thị. Cần thêm ít nhất 1 kênh (ví dụ
  `source:getContent`), payload cụ thể phụ thuộc Ambiguity A1 + A4.
- **`source-repo.ts` có thể cần thêm method:** nếu chốt hướng "tái dựng từ chunk" (A1 hướng 1), có thể
  cần 1 hàm mới kiểu `reconstructFullText(sourceId)` hoặc để logic ghép nằm ở 1 service riêng
  (`src/main/services/source-viewer/` theo cấu trúc cô lập-theo-feature D6) gọi `listChunks` sẵn có —
  KHÔNG sửa `source-repo.ts` của 011 nếu tránh được (đụng file dùng chung của feature khác).
- **Đụng 011 hay không:** về nguyên tắc KHÔNG cần sửa `011-ingestion` (schema/pipeline) nếu chọn hướng
  1 (A1) — chỉ đọc dữ liệu đã có (`chunk.text`, `locator`). Nếu `/speckit-clarify` chọn hướng 3 (lưu
  full text riêng), thì sẽ đụng ngược 011 (thêm migration) — cần cân nhắc kỹ vì 011 đã "chạy ổn"
  (Constitution V — không nhảy cóc/phá vỡ pha trước).
- **Đụng 013 hay không:** KHÔNG sửa kiểu `Citation`/`Locator` đã định nghĩa trong `013-rag-qa`
  (`src/shared/ipc/types.ts`) — dùng nguyên. Chỉ sửa `MessageBubble`/`ChatColumn` (thuộc feature
  `rag-qa`) để nối `onCite` — đây là điểm chạm duy nhất vào code feature khác, cần review kỹ theo
  rule 5 CLAUDE.md (mức độ: sửa nhỏ, không phải file "dùng chung" toàn dự án nên không cần PR riêng,
  nhưng nên tách commit rõ ràng).

---

## 6. Suggested ADR

Đề xuất `/speckit-plan` cân nhắc tạo 1 ADR mới (tương tự `2026-07-11-chunking-strategy.md` /
`2026-07-11-rag-retrieval-strategy.md`) cho quyết định:

**"Source content reconstruction & highlight strategy"** — chốt chính thức: cách lấy toàn văn nguồn để
hiển thị (1 trong 3 hướng ở A1, kèm thuật toán dedup overlap nếu chọn hướng 1), và chiến lược render/
highlight cho từng `SourceKind` (pdf/docx/txt/md/url) — vì đây là quyết định kỹ thuật có ảnh hưởng lâu
dài tới mọi feature sau này cần hiển thị nguồn (không chỉ 019), tương tự cách chunking-strategy đã được
tách thành ADR riêng thay vì chỉ nằm trong 1 lần clarify.
