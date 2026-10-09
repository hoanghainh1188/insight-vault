# Intake — 147-pdf-layout

- Issue: #147 (repo `hoanghainh1188/insight-vault`) — "PDF layout: right-aligned numeric tables, table grid view, /Rotate pages, hyphenated line breaks"
- Slug: `pdf-layout` (cùng slug với 112; phân biệt bằng số issue: `docs/intake/112-pdf-layout.md` ↔ file này; thư mục code `src/main/services/ingestion/pdf-layout/` là vùng
  DÙNG CHUNG đã có từ 112, không phải thư mục riêng của 147)
- Ngày intake: 2026-10-09
- Loại: **tiếp nối 112** — xử lý 4 trong số các mục "Giới hạn" mà ADR `2026-10-07-pdf-layout.md` đã ghi nhận và chủ dự án chọn làm tiếp (nhãn theo issue: **b** cột số
  căn phải · **e** hiển thị bảng dạng lưới · **c** trang `/Rotate` · **a** gạch nối cuối dòng). KHÔNG loại nguồn mới, KHÔNG có Figma, KHÔNG có basic/detail design của khách
  hàng (`docs/01-basic-design/`, `docs/02-detail-design/` chỉ có README). Chạm: main (`parsers/pdf.ts` adapter + `pdf-layout/{tables,paragraphs,lines,layout-page,types}.ts`),
  shared (`PDF_EXTRACTION_VERSION`, có thể `SourceContent`), renderer (`source-viewer/`: `SourceViewer.tsx`, `highlight.ts`, css; `sources/SourceItem.tsx` + i18n gợi ý xử lý lại),
  tests (fixture PDF tự sinh, perf). **Không đổi** locator, chunker (về nguyên tắc), kênh IPC xử lý lại, lược đồ DB (cột `extraction_version` đã có).

## Input sources

- **GitHub issue #147** — brief chính. Phiên intake KHÔNG có Bash (`gh issue view` không chạy được); nội dung issue do agent điều phối dán lại (tóm tắt): _"#112 extracts PDF text with layout.
  Its ADR ('Giới hạn') lists known limitations; the owner chose four: b. right-aligned numeric columns are not detected as tables (detection anchors on the LEFT edge of cells);
  e. table grid view — the viewer shows `| a | b |` text; show a real grid while keeping citation highlighting exact; c. pages with `/Rotate` — coordinates are not rotated;
  a. hyphenated line breaks — 'long-' / 'term' becomes 'longterm'; keep the hyphen for real compound words when it can be decided safely. Constraints: citations stay exact (Constitution II);
  changing extraction requires `PDF_EXTRACTION_VERSION` handling and 'Reprocess' for old sources (as in #112); measured on a PDF sample set (performance budget of #112 SC-006)."_
  **Khuyến nghị:** người phụ trách đối chiếu với thân issue thật trước `/speckit-specify`.
- `docs/OVERVIEW.md` — 3 điểm bất biến (Local-first, Kiểm chứng được, Offline & tự chủ); đối tượng dùng là luật sư/nhà nghiên cứu/kỹ sư xử lý báo cáo, hợp đồng, bảng số liệu ⇒ bảng tài chính
  và PDF quét xoay là tình huống thật.
- `docs/03-ui/prototype.html` (màn 4 "Xem nguồn", dòng ≈ 474–475) — chỉ có văn bản đoạn + `span.hl` + `hltag`; **không có bảng, không có lưới** ⇒ lưới bảng trong viewer là **UI mới, không có nguồn
  thiết kế gốc** (như tiến độ ở 146). Không sửa prototype.
- `.specify/memory/constitution.md` (v1.0.0) — **II** (locator `{page,charStart,charEnd}` gắn lúc chunk, highlight đúng đoạn — nguyên tắc chi phối cả 4 mục), **I** (không egress mới),
  **III** (không log nội dung), **IV** (test-first, ≥ 80% business logic), **V** (không vi phạm).
- `docs/00-glossary.md` — đã tra: có `text layer`, `page layout (layoutPage…)`, `reading order`, `Markdown table (renderTable, blocks)`, `reprocess`, `extraction version`, `stale citation`, `legacy join`,
  `text block`, `segment / line`, `chunking`, `page break`. **Chưa có** thuật ngữ cột số/căn phải, dạng lưới, xoay trang hiển thị, gạch nối ngắt dòng (xem mục thuật ngữ mới).
- `docs/04-decisions/INDEX.md` + ADR đã đọc (kế thừa, KHÔNG hỏi lại — xem "Đã chốt / kế thừa"): `2026-10-07-pdf-layout.md` + `2026-10-07-pdf-layout-clarify.md` (112; đặc biệt #3 quy ước Markdown table,
  #5 "thà bỏ sót", #6 viewer giữ văn bản — **147 thay thế một phần #6**, #7 gạch nối, #9 chữ xoay best-effort, #12 phiên bản trích xuất, #14 hiệu năng ≤ 2×, #15 fixture tự sinh),
  `2026-07-11-source-viewer-strategy.md` / `-clarify.md` (019; viewer tái dựng từ chunk, text-highlight không canvas), `2026-07-11-chunking-strategy.md`, `2026-10-07-relevance-calibration.md` (108).
  Spec của 112: `specs/20261007-180934-pdf-layout/` (SC-006 hiệu năng; SC-007 bộ đánh giá không chứa PDF). Quét INDEX: **không** có quyết định nào khác về cột số căn phải, lưới bảng, `/Rotate`
  hay quy tắc gạch nối ngoài 112 và 157/159 (tô sáng — xem dưới).
- Code đã đọc (chỉ để mô tả điểm tích hợp, KHÔNG phải thiết kế mới): `src/main/services/ingestion/parsers/pdf.ts`, `pdf-layout/{types,lines,columns,paragraphs,tables,layout-page}.ts`, `cleaning.ts`, `chunker.ts`,
  `pipeline.ts` (≈ 104–112 `cleanPage`, 358, 437–439), `source-repo.ts` (grep `extraction_version`), `src/main/db/migrations.ts` (≈ 225–231), `src/main/services/source-viewer/{source-content,reconstruct}.ts`,
  `src/shared/ipc/types.ts` (`PDF_EXTRACTION_VERSION`, `SourceContent`), `src/renderer/features/source-viewer/{SourceViewer.tsx,highlight.ts,source-viewer.css}`, `src/renderer/features/sources/SourceItem.tsx`,
  `src/shared/i18n/domains/{sources,viewer}.ts` (khoá `reprocessHint`, `viewer.stale`), `src/main/services/ingestion/fts-fold.ts`, `tests/unit/pdf-*.test.ts`, `tests/unit/pdf-parse-perf.test.ts`,
  `tests/fixtures/pdf/{make-pdf,samples}.ts`, `tests/eval/` (liệt kê).
- Figma: không dùng. Design token: không đổi (lưới bảng tái dùng biến CSS có sẵn của viewer: `--ink`, `--ink-faint`, `--cite-bg`, `--cite-line`, `--font-mono`… — xem Ambiguities #11).
- **Không đọc/xác minh trong phiên này:** thân issue thật (xem trên); `src/renderer/features/source-viewer/useSourceViewer.ts`; `tests/unit/helpers/layout-items.ts`; `tests/e2e/source-viewer.spec.ts` & `source-reprocess.spec.ts`
  (sẽ phải cập nhật); bề rộng thực tế của panel viewer (`.viewer`/`.vscroll`) ở cửa sổ nhỏ; cấu hình tokenizer FTS5 thật trong migration (chỉ đọc chú thích `fts-fold.ts`: "unicode61");
  **hành vi thật của pdf.js 6.x** (`^6.1.200`) với trang `/Rotate` (tọa độ `getTextContent` có nằm trong hệ chưa xoay như ADR 112 nói không; `page.rotate`, `getViewport`) — cần thí nghiệm bằng fixture ở plan;
  hành vi của bộ PDF thật (PDF của chủ dự án) — chưa có tệp mẫu thật nào trong repo.

## Sự kiện cần ghi nhận (từ issue + code, để spec không phải đoán)

Nhóm A — (b) vì sao cột số căn phải không thành bảng:

1. **`detectTables(region, page)`** (`tables.ts`) duyệt các `Line` (đã theo thứ tự đọc trong từng vùng cột) có ≥ 2 segment; mỗi lần bắt đầu `startRun(line)` lấy **`anchors = segment.x` (MÉP TRÁI) của dòng ĐẦU TIÊN**
   làm vị trí cột; các dòng sau vào bằng `extendRun` → `alignCells`: mỗi segment phải có `|anchor − s.x| ≤ CELL_ALIGN_RATIO·h` (= 0,5·h) với một anchor, **chỉ một segment lệch ⇒ `null` ⇒ dòng đó không thuộc bảng, run dừng**.
2. **Hệ quả với bảng tài chính:** số căn phải có mép TRÁI thay đổi theo số chữ số ("1.234" vs "12.345.678"), tiêu đề cột thường căn phải/giữa nên mép trái của dòng tiêu đề (dòng đầu, nguồn anchor) cũng khác mép trái của số ⇒ dòng thứ 2 đã
   không khớp anchor ⇒ run chỉ có 1 hàng < `TABLE_MIN_ROWS = 3` ⇒ `isTable` false ⇒ cả cụm giữ là **văn bản dòng thường** (`pushText`) — đúng như ADR ("thà bỏ sót").
3. **Ngưỡng/bảo vệ hiện có** (`types.ts`, `isTable`): ≥ 3 hàng × ≥ 2 cột (`TABLE_MIN_ROWS/COLS`); ≥ 80% hàng có ≥ 2 ô có chữ (`TABLE_FULL_ROW_RATIO`); loại dấu chấm dẫn `.{4,}` (mục lục), danh sách đầu dòng
   (`BULLET`), ô dài như văn xuôi (trung vị bề rộng segment ≥ 25% bề rộng trang — `DENSE_COLUMN_RATIO`); dòng sát hơn 1,25·h mà ít ô hơn ⇒ phần tiếp của ô nhiều dòng; hàng cách > 2,5·h ⇒ hết bảng.
4. **`Segment` đã có `x` và `w`** (⇒ mép phải = `x + w` tính được, `columns.ts` đã dùng `right(s)`); không có khái niệm kiểu ô (số/chữ) hay căn lề. `buildLines` tách segment khi khe ngang > `CELL_GAP_RATIO = 1`·h — hai cột số sát
   nhau (khe < 1·h) sẽ bị **gộp thành một segment** ngay từ tầng dòng, trước cả khi dò bảng. `WORD_GAP_RATIO = 0,15`·h quyết định chèn dấu cách giữa item.
5. **Fixture hiện có** (`tests/fixtures/pdf/samples.ts`): `borderlessTable`/`borderedTable`/`tableAcrossPages` (cột căn TRÁI x = 50/200/350), `tocNotTable` (có dấu chấm dẫn, số trang căn phải ở x = 500 nhưng bị loại nhờ `....`),
   `bulletList`. **Chưa có** fixture bảng số căn phải/thập phân, số âm trong ngoặc, hàng tổng. Bề rộng ký tự fixture cố định 0,5 em ⇒ mép phải của số tính tất định được trong test.

Nhóm B — (e) bảng được lưu và hiển thị thế nào:

6. **Bảng đi vào văn bản dưới dạng Markdown cố định** (`renderTable`): `| a | b |`, ô rỗng `| |`, `|` trong ô thoát `\|`, hàng phân cách `|---|---|` sau hàng đầu, ô được `replace(/\s+/g," ").trim()` (không còn xuống dòng trong ô);
   bảng cách văn bản `\n\n`; `cleanText(text) === text` (112 clarify #3). `LayoutResult.blocks` = `{start,end}` vùng bảng trong văn bản trang.
7. **`blocks` CHỈ sống trong lúc nạp:** `PageText.blocks` → `chunkPages` (không cắt ngang bảng ngắn; bảng dài cắt ở ranh giới hàng; điểm bắt đầu sau overlap dời về đầu hàng) rồi **bị bỏ** — không lưu DB.
   `pipeline.cleanPage` còn bỏ `blocks` nếu `cleanText` làm đổi văn bản.
8. **Viewer dựng lại từ chunk:** `getSourceContent` → `reconstructText(chunks)` (nối `chunk.text` theo `charStart`, bù `\n` ở ranh giới trang, cắt overlap) + `derivePageBreaks`; trả `SourceContent {kind,title,pageCount,text,pageBreaks,citationValid?}`.
   **Không có thông tin bảng** trong `SourceContent`; muốn vẽ lưới ở renderer thì hoặc **phân tích lại Markdown từ `text`** hoặc thêm trường mới (Ambiguities #6).
9. **Cách viewer hiển thị hôm nay** (`SourceViewer.tsx` + `highlight.ts`): `buildSegments(text, {charStart,charEnd}|null, pageBreaks)` cắt văn bản thành các đoạn `plain|highlight` + `pageMark`; render bằng **React text node** (không `innerHTML`);
   container `.vtext` có `white-space: pre-wrap; word-break: break-word; font-size 14px; line-height 1.7`; `<mark class="hl">` có `hltag` `[n]` (`position:absolute; top:-0.95em`) cho đoạn tô sáng ĐẦU TIÊN; `scrollIntoView({block:"center"})` tới mark đầu.
   Bảng hôm nay hiện là các dòng `| a | b |` chữ thường trong `pre-wrap` (lệch cột với phông tỉ lệ).
10. **Điều chỉnh tô sáng gần đây (157/159):** `trimRange` bỏ khoảng trắng hai đầu vùng tô; `alignStart` không bắt đầu GIỮA chữ (đuôi ngắn ≤ 40 ký tự của đoạn trước bị bỏ, hoặc lùi về đầu chữ). ⇒ vùng tô sáng thực tế có thể **bắt đầu/kết thúc giữa một ô** hoặc giữa hai hàng;
    lưới phải ánh xạ được vùng ký tự tuỳ ý (không chỉ cả hàng/cả bảng). Chunk bảng ngắn thường phủ nguyên bảng; bảng dài cắt theo hàng; overlap 150 ký tự có thể kéo vùng tô về cuối bảng liền trước.
11. **Trích dẫn cũ (112):** `citationValid=false` ⇒ viewer không tô sáng, hiện ghi chú `viewer.stale`. Không liên quan trực tiếp lưới nhưng lưới phải tôn trọng trạng thái "không tô sáng".
12. **Bảng khác trong hệ thống dùng chữ `|`:** chat/Studio render Markdown bằng `MarkdownContent` (renderer/shared/markdown) — không dùng cho viewer; văn bản chunk (có Markdown table) vẫn là thứ được **nhúng vector, đánh chỉ mục FTS và đưa vào prompt**; lưới chỉ là lớp hiển thị.

Nhóm C — (c) trang `/Rotate`:

13. **Adapter không xét xoay trang:** `parsePdf` lấy `page.view` (`[x0,y0,x1,y1]`, hệ chưa xoay) chỉ để đặt gốc trên-trái: `LayoutItem.x = transform[4]` (**không trừ `x0`**), `y = y1 − transform[5]`; `PageGeometry = {width: x1−x0, height: y1−y0}`.
    **Không đọc `page.rotate`**, không dùng `getViewport`/`rotation`. (Khác biệt nhỏ cần xem: `x` không trừ `x0` — chỉ ảnh hưởng PDF có CropBox/MediaBox không về gốc.)
14. **Cờ `rotated` theo từng item:** `toLayoutItem` đặt `rotated = |b|/hypot(a,b) > 0,3` (≈ 17°) trên ma trận chữ trong hệ người dùng; `buildLines` tách mọi item `rotated` ra, **không dựng dòng/cột/bảng** cho chúng, và `layoutPage` nối chúng bằng
    `legacyJoin` (dấu cách, thứ tự gốc của content stream) vào **cuối trang**. Hệ quả suy ra: với trang `/Rotate 90|270` mà nội dung được vẽ "dọc" trong hệ chưa xoay (khổ ngang quét/xuất từ máy in) thì **toàn bộ chữ** có `b ≠ 0` ⇒ rơi vào nhánh `rotated` ⇒
    cả trang là một chuỗi nối thô, mất dòng/đoạn/cột/bảng. Trang `/Rotate 180` (chữ lộn ngược, `a<0`) không bị cờ `rotated` (b≈0) nhưng toạ độ/thứ tự đọc sai (đọc từ dưới lên). **Cần xác nhận bằng thí nghiệm pdf.js** (mục không xác minh).
15. **Test/fixture:** `make-pdf.ts` đã có `FixturePage.rotate?: 0|90` và ghi `/Rotate` vào dict trang, và `FixtureText.angle`; nhưng **không mẫu/test nào dùng `rotate`** (grep: chỉ `make-pdf.ts:28,160`). `rotatedPage` trong `samples.ts` là _chữ xoay 90° trên trang KHÔNG `/Rotate`_ (ghi chú bên lề) — kỳ vọng "Body…\n\nSIDE NOTE".
    `pdf-adapter.test.ts` kiểm `toLayoutItem` với ma trận xoay; chưa có test `page.rotate`.
16. **Locator không chứa toạ độ** (PDF/text: `{page,charStart,charEnd}`; chỉ ảnh có `bbox`) và viewer **không render trang PDF** (chỉ văn bản + mốc "Trang N") ⇒ xoay trang **chỉ ảnh hưởng thứ tự/nội dung văn bản trích**, không ảnh hưởng cách hiển thị trang hay toạ độ trích dẫn.
17. **PDF quét/OCR:** 112 đặt "PDF quét (OCR) ngoài phạm vi"; `ingestion/image/ocr.ts` chỉ cho nguồn ảnh (Tesseract), không dùng cho PDF. PDF thuần ảnh không có lớp chữ ⇒ không có item để xoay. "Scanned-rotated pages" của issue chỉ có nghĩa với PDF **đã có lớp chữ ẩn** (OCR sẵn từ máy quét) + `/Rotate`.

Nhóm D — (a) gạch nối cuối dòng:

18. **Nơi duy nhất xử lý:** `paragraphs.ts::appendLine(acc, next)` (khi hai dòng cùng đoạn: `l.y − prev.y ≤ 1,5·prev.h`): xét 2 ký tự cuối của `acc`:
    - U+00AD (soft hyphen) ⇒ bỏ dấu, **nối liền**;
    - `(\p{L})-` (ASCII `-` ngay sau một chữ cái) ⇒ nếu `next` bắt đầu bằng **chữ thường** (`\p{Ll}`) thì **bỏ gạch, nối liền** (đây là "longterm"); nếu chữ hoa/khác thì **giữ gạch, nối liền không dấu cách** ("Capital-Case", "COVID-19");
    - còn lại ⇒ `acc + " " + next`.
      `cleaning.ts::cleanText` KHÔNG đụng gạch nối (chỉ CRLF/khoảng trắng/dòng trống). Không có từ điển, không có thống kê theo tài liệu, không xét ngôn ngữ.
19. **Test hiện có ghim hành vi:** `tests/unit/pdf-layout-paragraphs.test.ts` — `hyphen-/ated ⇒ hyphenated`; `Capital-/Case ⇒ Capital-Case`; U+00AD; `"giá trị -"` đứng riêng không nối; **`"hợp-" + "đồng" ⇒ "hợpđồng"`** (tiếng Việt cũng bị nối — sai về ngôn ngữ nhưng đang được test ghim); và test "giới hạn đã biết" `long-/term ⇒ longterm`.
    Fixture `hyphenated()` mong đợi "hyphenated word … Capital-Case".
20. **Chưa xử lý:** (i) dấu gạch Unicode U+2010/U+2011 (pdf.js có thể xuất thay cho ASCII `-` tuỳ font — chưa xác minh) và en dash; (ii) gạch nối giữa **dòng cuối cột/trang** với đầu cột/trang kế (mỗi vùng/trang xử lý riêng, chunk không vắt trang); (iii) ô bảng nhiều dòng (`tables.ts` nối phần tiếp bằng dấu cách: `"long-" + " term"`);
    (iv) gạch treo "pre- and post-war" ("pre-" + "and…" ⇒ hiện thành "preand…" vì `and` là chữ thường); (v) `(\p{L})-` không bao gồm chữ số trước gạch ("2020-" + "2021" ⇒ có dấu cách).
21. **Tác động tìm kiếm (suy ra từ chú thích `fts-fold.ts`, plan xác nhận):** FTS5 dùng tokenizer `unicode61`; `buildFtsMatch` tách token theo `[\p{L}\p{N}]+` ⇒ dấu `-` là _ngăn cách_. "long-term" ⇒ 2 token (`long`,`term`) khớp truy vấn "long term"/"long-term"; "longterm" ⇒ 1 token, khớp truy vấn "longterm" nhưng KHÔNG khớp "long term".
    Ngược lại "hyphen-ated" (giữ gạch sai) ⇒ 2 token, KHÔNG khớp truy vấn "hyphenated". Vector embedding ít nhạy hơn. Văn bản chunk là chính tắc (locator tính trên văn bản đã nối) ⇒ **đổi quy tắc chỉ đổi nội dung chunk + offset sau khi Xử lý lại**, không làm lệch locator của dữ liệu cũ.

Nhóm E — phiên bản trích, xử lý lại, hiệu năng:

22. **`PDF_EXTRACTION_VERSION = 2`** (`src/shared/ipc/types.ts` ≈ 268); `source.extraction_version INTEGER NOT NULL DEFAULT 1` (migration #9 — đủ chứa 3, 4… **không cần migration mới**). Ghi ở `pipeline.ts` ≈ 358 (nạp mới) và ≈ 437–439 (`setExtractionVersion` sau xử lý lại / thử lại); `source-repo.replaceChunks` ghi version + `page_count` trong cùng transaction hoán đổi.
23. **Gợi ý "Xử lý lại để giữ bố cục"** (`SourceItem.tsx` ≈ 73–77): hiện khi `kind==="pdf" && status==="ready" && extractionVersion < PDF_EXTRACTION_VERSION && !reproc.running` — **thụ động, không tự chạy**. Chuỗi i18n `sources.item.reprocessHint` vi "Xử lý lại để giữ bố cục" / en "Reprocess to keep the layout" (và `reprocessAria`).
    Nếu chỉ tăng hằng số thành 3, MỌI PDF `ready` đang ở v2 (đã có bố cục) cũng hiện gợi ý với **câu chữ đã không còn đúng nghĩa** ("giữ bố cục" — chúng đã giữ). `tests/unit/ingestion-pdf-blocks.test.ts:109` đang `expect(PDF_EXTRACTION_VERSION).toBe(2)` (phải đổi).
24. **Cơ chế Xử lý lại (112, kế thừa):** người dùng bấm từng nguồn, hộp xác nhận nêu hệ quả với trích dẫn cũ; parse → chunk → embed trong RAM → thêm vector mới → `replaceChunks` một transaction → xoá vector cũ; lỗi/huỷ giữ bản cũ; **id chunk luôn mới** ⇒ chip `[n]` cũ trở thành "trích dẫn cũ" (mở nguồn, không tô sáng, có ghi chú). Quyết định 112 #10: **không** làm hàng loạt. Mọi lần tăng version đều bắt người dùng chịu hệ quả này cho từng nguồn họ chọn xử lý lại.
25. **Hiệu năng (SC-006, `tests/unit/pdf-parse-perf.test.ts`):** PDF tự sinh **50 trang** xen kẽ `twoColumns` / `borderlessTable`; so `parsePdf` (mới) với `legacyParse` (chỉ `getTextContent` + `join(" ")`) — **tốt nhất trong 3 lần chạy**, làm ấm pdf.js trước; `ratio = newMs/oldMs ≤ 2`. Assert chặt khi chạy local; trên CI (`process.env.CI`) chỉ log số trừ khi `PDF_PERF_STRICT=1`.
    112 ghi nhận ≈ 0,9–1,4× (thời gian chủ yếu ở pdf.js). Thêm: `LAYOUT_BUDGET_MS = 5000` tổng/tài liệu — hết ngân sách ⇒ các trang còn lại dùng `legacyJoin`; `MAX_LAYOUT_ITEMS_PER_PAGE = 5000` ⇒ trang đó dùng `legacyJoin`; mọi exception trong `layoutPage` ⇒ `legacyJoin` cho trang đó.
    Mẫu perf hiện tại **không có** bảng số, trang xoay hay gạch nối nên không bao phủ chi phí của 4 mục mới.
26. **Bộ đánh giá truy xuất (108):** `tests/eval/corpus/*.md` — **toàn Markdown, không có PDF** (112 SC-007 ghi vậy; 112 clarify #13 "thêm PDF vào bộ đánh giá ⇒ để sau"). ⇒ `npm run eval:retrieval` không đo được tác động của gạch nối/bảng lên PDF; cần cách đo khác (Ambiguities #25).
27. **Dự phòng hiện tại:** lỗi bất kỳ trong `layoutPage` ⇒ cả TRANG về `legacyJoin` (`fallback: true`); phân giải theo trang chứ không theo tính năng — một lỗi ở heuristic bảng số sẽ làm mất cả bố cục trang đó.

## Đã chốt / kế thừa — KHÔNG hỏi lại ở clarify

1. **Constitution II chi phối:** chunk text và locator (`page`, `charStart`, `charEnd`) tính trên văn bản chính tắc **sau** dựng bố cục + `cleanText`; `chunk.text === T.slice(charStart,charEnd)`; không chèn hàng tiêu đề giả; không ước lượng locator sau chunk. Mọi thay đổi trích chỉ có hiệu lực cho PDF nạp mới/Xử lý lại.
2. **Quy ước Markdown table (112 #3) và hành vi chunker với bảng (112 #4)** là đầu vào cố định của lưới: không căn lề bằng dấu cách, `| ô |` cách `|` đúng 1 dấu cách, hàng `|---|`, `\|` thoát, ô rỗng để trống, ô nhiều dòng nối bằng dấu cách.
3. **"Thà bỏ sót còn hơn nhận nhầm" (112 #5)** là nguyên tắc nhận diện bảng; tối thiểu 2 cột × 3 hàng; không chắc ⇒ văn bản dòng thường; lỗi một trang ⇒ cách nối cũ cho trang đó.
4. **Cơ chế phiên bản + Xử lý lại của 112 giữ nguyên** (112 #1, #2, #10, #11, #12): chủ động, có xác nhận, nguyên tử, nguồn cũ giữ `extraction_version` cũ + gợi ý thụ động, trích dẫn cũ mở nguồn không tô sáng + ghi chú, Studio/chat cũ giữ nguyên, **không** xử lý lại hàng loạt, **không** tự chạy nền. Muốn đổi bất kỳ điều nào ⇒ ADR thay thế, không hỏi lại như thể chưa có.
5. **Hiệu năng ≤ 2× (112 #14 / SC-006)** là ngân sách phải giữ, **đo trên bộ PDF mẫu** (issue); tiến độ theo trang + cho phép huỷ + ngân sách bố cục 5 s/tài liệu giữ nguyên.
6. **PDF mẫu tự sinh bằng mã** (112 #15, `tests/fixtures/pdf/make-pdf.ts`): không vướng bản quyền, tất định; fixture mới theo cùng khuôn (Helvetica + `/Differences` + `/ToUnicode` + `/Widths` cố định).
7. **Chữ xoay là best-effort (112 #9)** và **không xoá** đầu/chân trang, số trang (112 #8); **PDF quét (OCR) ngoài phạm vi** (112 #1).
8. **Viewer tái dựng từ chunk, không re-parse/re-fetch tệp** (019): không thêm đường đọc tệp gốc cho viewer; render bằng React node (không `innerHTML`) chống XSS từ nội dung nguồn.
9. **Không đổi:** thuật toán XY-cut cột, ngưỡng đoạn (1,5·h), kênh `source:reprocess`/`reprocessCancel`, cột DB, kho vector, Chat/Studio/tìm kiếm, `cleanText`; không thêm egress; không log nội dung (Constitution I, III).
10. **i18n 123:** mọi chuỗi UI mới (gợi ý xử lý lại, nhãn lưới/a11y) là khoá vi + en có kiểu, không chuỗi cứng; main không gửi văn bản hiển thị.
11. **Ngoài phạm vi theo issue/ADR:** các mục khác trong "Giới hạn" 112 không được chọn (ô gộp, bảng xoay, trang > 4 cột, chữ quanh hình, OCR); lưu bền cấu trúc bảng; render trang PDF dạng ảnh/canvas; xử lý lại hàng loạt; tìm kiếm trong viewer.

## Prompt for /speckit-specify

Cải thiện **chất lượng trích xuất và hiển thị PDF** của InsightVault theo bốn hạng mục mà chủ dự án đã chọn từ mục "Giới hạn" của ADR 112 (`docs/04-decisions/2026-10-07-pdf-layout.md`), giữ nguyên cam kết **trích dẫn kiểm chứng được**
(Constitution II): văn bản chunk và locator `{page, charStart, charEnd}` vẫn tính trên một văn bản chính tắc duy nhất, chip `[n]` vẫn mở đúng trang và tô sáng đúng đoạn. 112 đã dựng bố cục PDF có lớp chữ (dòng, thứ tự đọc nhiều cột, bảng Markdown
`| a | b |`) bằng các hàm thuần trong `src/main/services/ingestion/pdf-layout/` và adapter mỏng `parsers/pdf.ts`; feature này sửa bốn giới hạn còn lại của nó. KHÔNG thêm loại nguồn mới; KHÔNG làm OCR cho PDF thuần ảnh; KHÔNG đổi cách chunk theo trang,
locator, kênh IPC xử lý lại, lược đồ DB, Chat/Studio/tìm kiếm.

**Bốn hạng mục (nhãn theo issue):**

- **(b) Bảng có cột số căn phải (bảng tài chính).** Hiện bộ nhận diện bảng (`tables.ts`) neo theo **mép TRÁI** của ô (lấy mép trái của dòng đầu tiên làm vị trí cột, dung sai 0,5·cỡ chữ) nên cột số căn phải/căn theo dấu thập phân — mép trái đổi theo số chữ số, tiêu đề
  căn phải hoặc giữa — không được nhận là bảng và bị giữ thành văn bản dòng thường. Yêu cầu: nhận diện được các bảng mà cột số căn theo **mép phải** (hoặc dấu thập phân), gồm số có dấu phân cách hàng nghìn kiểu Việt/Anh, số âm trong ngoặc, phần trăm, tiền tệ,
  hàng tổng; **vẫn giữ nguyên nguyên tắc "thà bỏ sót còn hơn nhận nhầm"** — không biến mục lục không chấm dẫn, danh sách "nhãn … giá trị", đoạn văn căn đều hai bên hay khối địa chỉ/chữ ký thành bảng; các bảng đang nhận được (căn trái) không được đổi kết quả.
- **(e) Hiển thị bảng dạng lưới trong Trình xem nguồn.** Hiện bảng hiện là các dòng văn bản `| a | b |` (`white-space: pre-wrap`). Yêu cầu: hiển thị **lưới thật** (hàng, cột, ô, hàng tiêu đề) cho các bảng của PDF, **trong khi highlight trích dẫn vẫn chính xác theo ký tự**: vùng tô sáng
  `[charStart, charEnd)` (kể cả khi bắt đầu/kết thúc giữa một ô hay giữa hai hàng, kể cả sau điều chỉnh 157/159) phải ánh xạ đúng sang các ô/đoạn ô tương ứng, nhãn `[n]` và cuộn tới vùng tô vẫn hoạt động, trích dẫn cũ (không tô sáng) vẫn đúng. Lưới chỉ là lớp hiển thị: văn bản chunk, vector,
  FTS và prompt vẫn dùng Markdown như cũ; renderer vẫn render bằng React node (không `innerHTML`). Lưới phải có ngữ nghĩa trợ năng (bảng/tiêu đề cột), không tràn ở cột hẹp, và cột số căn phải để đọc được số liệu. Quyết định 112 #6 ("viewer giữ văn bản; bảng HTML để feature sau") được **thay thế một phần** bằng feature này.
- **(c) Trang có `/Rotate`.** Hiện tọa độ chữ lấy theo hệ **chưa xoay** của nội dung; trang xoay 90°/180°/270° (khổ ngang, PDF quét có lớp chữ ẩn bị xoay) bị coi là "chữ xoay" hoặc đọc sai hướng, mất dòng/đoạn/cột/bảng. Yêu cầu: áp xoay trang vào toạ độ trước khi dựng bố cục để một trang `/Rotate` cho văn bản
  **giống như** cùng nội dung ở trang không xoay (cùng dòng, đoạn, thứ tự đọc, bảng), vẫn xử lý riêng chữ thực sự xoay so với trang (ghi chú bên lề). Locator không chứa tọa độ và viewer không vẽ trang nên không thay đổi cách trích dẫn.
- **(a) Gạch nối cuối dòng.** Hiện `paragraphs.ts` bỏ gạch và nối liền khi dòng kết thúc bằng `chữ-` và dòng sau bắt đầu bằng chữ thường ("long-" + "term" → "longterm"). Yêu cầu: **giữ gạch** cho từ ghép thật khi có thể quyết định một cách an toàn (không dùng từ điển ngoài lớn; dựa vào bằng chứng
  cục bộ như dạng từ xuất hiện giữa dòng trong cùng tài liệu, quy tắc ngắt từ của in ấn, từ nối "and/or"…), **nối liền bỏ gạch** khi là ngắt từ thật, và **không đoán** khi không chắc (hành vi mặc định/dự phòng do clarify chốt). Tiếng Việt không ngắt từ bằng gạch nối nên không được bị nối ("hợp-" + "đồng" không thành "hợpđồng").
  Không đổi chuỗi sau `cleanText`; phải ghi rõ tác động lên tìm kiếm từ khoá (FTS5/BM25) và embedding.

**Ràng buộc chung (theo issue và 112):**

- **Trích dẫn kiểm chứng được:** mọi thay đổi trích xuất nằm TRƯỚC `cleanText`/chunker; `cleanText(text) === text`; `chunk.text === T.slice(charStart,charEnd)`; không ước lượng locator sau khi chunk. Lưới (e) chỉ dựa vào văn bản và offset đã có.
- **Phiên bản trích xuất + Xử lý lại:** thay đổi (b), (c), (a) làm đổi văn bản trích ⇒ phải xử lý `PDF_EXTRACTION_VERSION` (hiện 2) theo khuôn 112: PDF nạp mới/Xử lý lại ghi version mới; nguồn cũ giữ version cũ + gợi ý thụ động "Xử lý lại"; Xử lý lại vẫn chủ động, có xác nhận, nguyên tử, từng nguồn; trích dẫn cũ sau Xử lý lại
  mở nguồn nhưng không tô sáng. Câu chữ gợi ý phải đúng cho cả nguồn v1 lẫn v2. (e) thuần hiển thị nên **không** bắt buộc Xử lý lại: lưới phải hoạt động ngay trên PDF v2 đã nạp (đã có Markdown table).
- **Hiệu năng:** thời gian trích một PDF ≤ **2×** cách cũ (112 SC-006) và đo trên **bộ PDF mẫu** gồm các tình huống mới (bảng số căn phải, trang xoay, văn bản có gạch nối) ngoài các mẫu hiện có; ngân sách bố cục 5 s/tài liệu và `MAX_LAYOUT_ITEMS_PER_PAGE` giữ nguyên.
- **Dự phòng:** lỗi hoặc quá ngưỡng ⇒ hành vi an toàn đã có (trang dùng cách nối cũ); thiết kế không để lỗi một heuristic mới làm hỏng nhiều hơn mức cần thiết.
- **i18n 123 / a11y 091:** chuỗi mới qua khoá vi + en; lưới có ngữ nghĩa bảng, điều hướng bàn phím/cuộn ngang được, không dựa vào màu sắc để phân biệt vùng tô sáng.
- **Kiểm thử:** TDD, fixture PDF tự sinh (`make-pdf.ts`, mở rộng hỗ trợ xoay 180/270 nếu cần), coverage ≥ 80% business logic; cập nhật các test đang ghim hành vi cũ (`pdf-layout-paragraphs` — `longterm`/`hợpđồng`; `ingestion-pdf-blocks` — version; `pdf-parse-perf` — thêm mẫu; e2e `source-viewer`, `source-reprocess`).

**Tiêu chí chấp nhận (đề xuất theo issue, số ngưỡng chốt ở clarify):**

- Bộ PDF mẫu bảng số căn phải/thập phân (có tiêu đề căn giữa/phải, số âm ngoặc, hàng tổng, ≥ 2 kiểu dấu phân cách): 100% bảng mẫu thành bảng Markdown đúng ô; bộ mẫu âm tính (mục lục không chấm, danh sách nhãn–giá trị, đoạn căn đều, khối chữ ký) cho 0 bảng nhầm; kết quả trên các mẫu bảng căn trái hiện có không đổi.
- Viewer hiển thị bảng của PDF dạng lưới; 100% chip `[n]` trỏ vào chunk có bảng tô sáng đúng ô/đoạn ô (kiểm bằng test đơn vị ánh xạ offset→ô và e2e), cuộn tới đúng chỗ; trích dẫn cũ không tô sáng; nguồn không phải PDF không đổi.
- Trang `/Rotate` 90/180/270 có cùng nội dung với trang không xoay cho **văn bản trích giống hệt** (so với bản tham chiếu); chữ xoay thật trên trang xoay vẫn được xử lý riêng; không ảnh hưởng PDF không có `/Rotate`.
- Trên tập cặp từ gắn nhãn (ngắt từ thật vs từ ghép thật vs gạch treo, Anh + Việt): tỉ lệ quyết định đúng ≥ ngưỡng chốt ở clarify, và **0** trường hợp nối sai dù "không chắc" nếu clarify chọn mặc định bảo thủ; tiếng Việt không bị nối.
- `PDF_EXTRACTION_VERSION` tăng đúng quy ước; PDF cũ hiện gợi ý đúng nghĩa; Xử lý lại cho PDF mẫu cho văn bản mới và chip cũ thành "trích dẫn cũ".
- SC-006: tỉ lệ thời gian ≤ 2× trên bộ mẫu mở rộng (local assert, CI log); không thêm kết nối mạng; không log nội dung.

**Ngoài phạm vi:** OCR/PDF thuần ảnh; ô gộp, bảng xoay, trang > 4 cột, chữ bao quanh hình; render trang PDF dạng ảnh; lưu bền cấu trúc bảng/ô; xử lý lại hàng loạt hay tự động; đổi XY-cut/ngưỡng đoạn; tìm kiếm trong viewer; thêm PDF vào bộ đánh giá 108 (nếu clarify không chốt khác); chuẩn hoá từ ghép/chính tả tiếng Anh ngoài gạch nối cuối dòng.

## Ambiguities to raise in /speckit-clarify

Đã loại (đã có quyết định, xem "Đã chốt / kế thừa"): quy ước Markdown table; "thà bỏ sót"; cơ chế version/Xử lý lại/trích dẫn cũ của 112; hiệu năng ≤ 2×; fixture tự sinh; chữ xoay best-effort; OCR ngoài phạm vi; viewer không re-parse; i18n/a11y.
Còn lại — mỗi mục kèm phương án và **đề xuất**. Nhóm theo hạng mục của issue (b · e · c · a) rồi các vấn đề xuyên suốt.

### (b) Cột số căn phải

1. **Thuật toán nhận diện.** Dữ kiện #1–4. (A) **Đường phụ "căn phải/thập phân" chỉ chạy khi đường căn trái từ chối** cụm dòng: giữ nguyên `startRun/extendRun/alignCells`, thêm một lượt thứ hai trên cùng cụm dòng ≥ 2 segment liên tiếp, gom cột bằng **cụm mép phải** (`x+w`) hoặc vị trí dấu thập phân,
   yêu cầu cột số. Không có hồi quy cho bảng căn trái (chỉ thêm bảng mới). (B) **Chiếu dọc "dòng sông trắng"** (Tabula/stream): trên cả cụm dòng, tìm các dải x trống xuyên suốt ≥ ngưỡng ⇒ ranh giới cột; không cần anchor, hợp mọi kiểu căn lề — nhưng thay đổi cả đường căn trái, rủi ro nhận nhầm/đổi kết quả hiện có cao hơn.
   (C) Nới `alignCells` chấp nhận khớp mép trái **hoặc** mép phải **hoặc** giữa với anchor của dòng đầu — nhưng anchor từ dòng tiêu đề (căn khác số liệu) làm hỏng (xem sự kiện #2), cần lấy anchor từ cả cụm.
   **Đề xuất:** (A) — an toàn nhất với 112 #5, giữ test cũ nguyên, thêm đường mới có cổng "có cột số"; (B) để dành làm cải tiến sau nếu số đo trên bộ mẫu cho thấy (A) bỏ sót nhiều. Ghi vào plan: tách hàm thuần `detectRightAlignedTable(region)` để test riêng.
2. **Định nghĩa "cột số" và đo căn lề.** (a) mép phải (`x+w`) trong dung sai 0,5·h cho ≥ 90% ô của cột; (b) vị trí dấu thập phân (ước lượng theo tỉ lệ ký tự × `w`) cho cột có số chữ số thập phân khác nhau (1.234,5 / 12,75) — phông tỉ lệ nhưng chữ số thường đều (tabular), nhạy khi fixture 0,5 em;
   (c) cả hai (mép phải trước, thập phân sau). Regex "ô là số": Việt (`1.234.567`, `12,5`), Anh (`1,234.56`), khoảng trắng nghìn (`1 234 567`), `(1,234)` âm, `-12.5`, `12%`, tiền tệ trước/sau (`$`, `₫`, `VND`, `USD`), gạch `-`/`—`/`n/a` là ô trống-số; cột "đủ số" khi ≥ 80% ô không rỗng khớp.
   **Đề xuất:** (c) với regex nhận cả hai kiểu phân cách (không đoán locale, chỉ cần "trông như số"), dung sai mép phải 0,5·h (như `CELL_ALIGN_RATIO`) và thập phân khi mép phải không khớp; ngưỡng cột số 80%; bảng được nhận khi ≥ 1 cột số hợp lệ (xem #3) và cột còn lại (nhãn) căn trái nhất quán hoặc là cột số khác.
3. **Ngưỡng tối thiểu và chống dương tính giả.** Mẫu rủi ro: (i) mục lục không chấm dẫn (nhãn trái + số trang phải) — đúng hình dạng 2 cột × N hàng; (ii) danh sách nhãn–giá trị (hoá đơn tóm tắt, thông tin liên hệ); (iii) đoạn căn đều hai bên (mọi dòng cùng mép phải — nhưng 1 segment/dòng và có cổng `DENSE_COLUMN_RATIO`);
   (iv) khối chữ ký/ngày tháng; (v) chuỗi số lẻ rải rác trong văn xuôi. Phương án: (a) giữ ≥ 3 hàng × ≥ 2 cột; (b) tăng với đường phụ — ≥ 4 hàng, hoặc ≥ 2 cột số; (c) loại cột số "chỉ số nguyên đơn điệu tăng" (số trang); (d) yêu cầu hàng đầu là tiêu đề không phải số / hoặc ≥ 2 cột số.
   **Đề xuất:** (b)+(c): đường phụ yêu cầu **≥ 3 hàng dữ liệu và ≥ 2 cột** với (≥ 2 cột số HOẶC 1 cột số có ≥ 4 hàng, mép phải ≥ 90% khớp, không đơn điệu số nguyên); giữ nguyên các loại trừ hiện có (chấm dẫn, bullet, ô dài ≥ 25% bề rộng trang). Ngưỡng cuối chốt bằng số đo trên bộ mẫu dương/âm (#23), không đặt cứng trong spec.
4. **Cột sát nhau và hàng tiêu đề lệch.** (i) `CELL_GAP_RATIO = 1`·h gộp hai cột số sát nhau thành một segment (sự kiện #4); (ii) tiêu đề cột thường căn giữa/phải so với số, có thể rộng hơn số, có thể nhiều dòng. Phương án: (a) bỏ qua — chỉ nhận khi tách được segment như hiện nay; (b) trong đường phụ tách lại segment toàn số theo khoảng trắng khi ≥ 2 token số liền kề cách > 0,5·h
   và cùng mép phải với hàng khác; (c) đưa ngưỡng tách segment thành tham số theo kiểu ô. Hàng tiêu đề: (a) chấp nhận hàng đầu không khớp mép (lấy khớp theo khoảng chồng lấn x với cột số); (b) bỏ hàng đầu khỏi điều kiện căn lề.
   **Đề xuất:** (a) cho khe (best-effort, ghi "Giới hạn đã biết" cho bảng quá sát), tiêu đề: hàng đầu được gán cột theo **chồng lấn khoảng x với cột số** thay vì theo mép; tiêu đề nhiều dòng dùng quy tắc "phần tiếp của ô" hiện có (khe ≤ 1,25·h).
5. **Phạm vi hàng đặc biệt.** Hàng tổng (đường kẻ, in đậm — không có thông tin đậm từ pdf.js), ô trống thay bằng "-", số âm ngoặc, chú thích dưới bảng, ô gộp tiêu đề (ngoài phạm vi 112). Phương án: (a) hàng tổng/gạch là hàng thường; chú thích dưới bảng là văn bản (khe > 2,5·h hoặc ít ô); ô gộp ⇒ vẫn "best-effort, bỏ sót"; (b) cố nhận ô gộp.
   **Đề xuất:** (a); thêm fixture bảng tài chính nhỏ (4 cột số, hàng tổng, ngoặc âm, tiêu đề 2 dòng) vào bộ mẫu; ô gộp giữ trong "Giới hạn".

### (e) Lưới bảng trong Trình xem nguồn

6. **Nguồn dữ liệu cấu trúc bảng cho renderer.** Dữ kiện #7–8. (A) **Phân tích lại Markdown từ `content.text` ở renderer** bằng hàm thuần (`parseMarkdownTables(text) → [{start,end,rows:[{cells:[{start,end}]}]}]`, ngữ pháp nghiêm đúng với `renderTable`) — không đổi IPC, hoạt động ngay với PDF v2 đã nạp. (B) main trả thêm `tables: {start,end}[]`
   trong `SourceContent` bằng cùng hàm phân tích (đặt ở `src/shared/` hoặc main) — thêm trường IPC, renderer không phải tự dò; (C) **lưu `blocks`** (cột/bảng DB mới, migration) — chính xác nhất nhưng cần Xử lý lại cho dữ liệu cũ và migration, mâu thuẫn mong muốn "không bắt buộc Xử lý lại" cho (e).
   Rủi ro (A)/(B): đoạn văn thường có dòng trông như `| x | y |`. **Đề xuất:** (A) đặt hàm thuần ở `src/shared/pdf-tables.ts` (dùng được cả hai phía, test thuần), **cổng chặt**: `kind==="pdf"`, khối ≥ 3 dòng liên tiếp bắt đầu/kết thúc bằng `|`, dòng thứ 2 đúng `|---|…|`, số ô mọi dòng bằng nhau, khối nằm trong một trang (không vắt `pageBreaks`). Không đổi IPC, không migration. (B) là phương án dự phòng nếu cần cổng `extractionVersion ≥ 2` (khi đó thêm `extractionVersion` vào `SourceContent`).
7. **Phạm vi áp dụng.** (a) chỉ `pdf`; (b) cả `md`/`txt`/`docx` nếu có cú pháp bảng Markdown (nguồn Markdown tự có bảng); (c) chỉ PDF v≥2. Nguồn `docx` do mammoth→? (chưa xác minh cách đưa bảng vào văn bản).
   **Đề xuất:** (a) cho 147 (đúng issue "PDF layout"); ghi mở rộng sang `md` là việc sau; PDF v1 không bao giờ có bảng sinh ra nên cổng cú pháp chặt (#6) là đủ, không cần cờ version.
8. **Mô hình tô sáng trong lưới.** Dữ kiện #9–10. Vùng `[a,b)` có thể phủ: cả bảng; nhiều hàng; nửa hàng; đầu/cuối giữa ô. (A) **Theo ô:** ô nào giao với vùng thì tô cả ô (đơn giản, thô); (B) **Theo ký tự trong ô:** cắt văn bản từng ô theo giao với vùng (chính xác tuyệt đối, tái dùng `buildSegments` cho từng ô với offset ô);
   (C) hybrid — tô cả ô khi phủ hết văn bản ô, tô một phần khi chỉ phủ một phần. Nhãn `[n]`/`hltag` gắn vào mảnh tô ĐẦU TIÊN (có thể là trong ô — `position:absolute; top:-0.95em` bị cắt nếu vùng cuộn `overflow` — cần kiểm); `scrollIntoView` tới mark đầu như cũ; ký tự cấu trúc `|`, `\|`, hàng `---` không hiển thị
   nhưng nằm trong khoảng offset (không được làm "nhảy"). Ô rỗng `| |` và hàng phân cách: coi là không có chữ để tô.
   **Đề xuất:** (B)/(C): dùng chung mô hình `Piece {start,end,text}` — ô là đơn vị chứa 1 piece; `buildSegments` mở rộng để nhận các khoảng "khối bảng" và trả cây `plain | table(rows→cells→segments)`; tô theo ký tự trong ô (chính xác), tô cả ô khi vùng phủ hết ô; hàm thuần ánh xạ offset→ô có test thuộc tính (phủ ngẫu nhiên [a,b) ⇒ hợp các mảnh tô sau bỏ ký tự cấu trúc == giao với văn bản ô).
   `hltag` đặt trong ô đầu tiên được tô (hoặc trên `<table>` nếu vùng bắt đầu ở hàng đầu), CSS cho phép hiển thị trong vùng cuộn.
9. **Ngữ nghĩa trợ năng.** (a) `<table>` + `<thead>` + `<th scope="col">` cho hàng đầu + `<tbody>`; có `aria-label`/`<caption>` kiểu "Bảng, trang N" (khoá i18n mới) hay không; (b) hàng/ô tô sáng báo cho trình đọc màn hình ra sao (hiện `<mark>` có ngữ nghĩa "highlight" ngầm; đã có `viewer-hltag` văn bản `[n]`); (c) vùng cuộn ngang của bảng rộng cần `tabindex=0` + nhãn để dùng bàn phím;
   (d) hàng trống/ô rỗng. **Đề xuất:** (a) với caption ẩn trực quan (`visually-hidden`) "Bảng {i} — trang {page}" hay chỉ `aria-label`; (b) giữ `<mark>` + `[n]` hiện có, không thêm `role` thừa; (c) `tabindex=0` + `role="region"` + `aria-label` chỉ khi bảng thực sự tràn (kiểm bằng ref/ResizeObserver hoặc luôn bọc — chốt ở plan); test RTL (vai trò `table`, `columnheader`) + axe thủ công.
10. **Chọn và sao chép; xem dạng văn bản.** Chọn chữ trong `<table>` rồi copy cho ra tab/xuống dòng chứ không phải Markdown. (a) chấp nhận (hành vi bảng chuẩn); (b) thêm công tắc "Dạng văn bản/Dạng lưới" trên thanh viewer (lưu theo phiên) — giúp đối chiếu với cái chunk thực sự chứa và khi lưới hiển thị sai;
    (c) xử lý `copy` để xuất Markdown. **Đề xuất:** (a) cho v1 + (b) **nếu chi phí nhỏ** (state cục bộ `useState`, khoá i18n 2 chuỗi, test) vì nó là lối thoát khi phân tích bảng sai và giữ "kiểm chứng được" (người dùng thấy đúng văn bản chunk); không làm (c).
11. **Bố cục và kiểu lưới.** Cột hẹp/English dài, bảng nhiều cột (≤ ? cột), ô dài (xuống dòng trong ô, `word-break`), tràn ngang (bọc `overflow-x:auto`, `min-width` ô), căn phải ô số. Căn lề: (a) **render-time**: ô "trông như số" (regex #2) ⇒ `text-align:right` theo cột đa số, không đổi văn bản; (b) mã hoá trong hàng phân cách GFM `|---:|` do trích xuất — **đổi quy ước 112 #3** (hàng phân cách `|---|`), thêm bước SỬA ADR.
    Kiểu: đường kẻ ô mảnh, phông chữ như `.vtext`, hàng đầu đậm/nền nhẹ, không sticky v1; tái dùng biến CSS viewer; kiểm ảnh chụp với `--cite-bg` trên ô, chế độ sáng/tối (nếu có). **Đề xuất:** (a); không đổi `renderTable`; kích thước/khoảng đệm ô chốt ở plan bằng ảnh chụp 900 px; ngưỡng "bảng rộng" = tràn thì cuộn ngang, không thu nhỏ chữ.

### (c) Trang `/Rotate`

12. **Điểm áp dụng xoay và nguồn góc xoay.** Dữ kiện #13–14. (A) **Tại adapter** `parsers/pdf.ts`: hàm thuần `toDisplayItem(item, {rotate, view})` biến toạ độ/hướng của item sang hệ hiển thị (0/90/180/270), `PageGeometry` hoán đổi rộng↔cao với 90/270; `pdf-layout/` không biết `/Rotate`. (B) Truyền `rotate` vào `layoutPage` và xoay trong đó. (C) Dùng `page.getViewport({scale:1})` của pdf.js (`transform`, `width`, `height`) để chuyển điểm gốc item thay vì tự tính ma trận.
    **Đề xuất:** (A)+(C): adapter dùng viewport.transform của pdf.js (đã chuẩn hoá `/Rotate` thừa kế từ cây Pages và `view`/CropBox) để tính gốc hiển thị; hướng chữ = hướng trong hệ người dùng trừ góc trang; `layout` giữ thuần và không đổi API ngoài `PageGeometry`. Ghi vào plan thí nghiệm xác nhận (fixture `rotate` 90/180/270 với nội dung vẽ xoay ngược để hiển thị thẳng).
13. **Định nghĩa lại `rotated` và các góc.** Sau chuẩn hoá hệ hiển thị: góc ≈ 0 ⇒ chữ thường; ≈ 90/270 ⇒ chữ xoay (như hiện tại, nối cuối trang); ≈ 180 (lộn ngược sau khi áp `/Rotate`) ⇒ ? ; góc lẻ (nghiêng 17°–80°). Phương án: (a) 180° coi là xoay (nối thô cuối trang, không dựng); (b) 180° đảo toạ độ (xoay 180° rồi dựng) cho trang quét lộn ngược; (c) giữ ngưỡng sin > 0,3 của 112 cho góc lẻ.
    **Đề xuất:** (a)+(c) ở v1 (an toàn, phù hợp "best-effort" 112 #9) — chỉ trang `/Rotate` làm cho hướng hiển thị thẳng mới được dựng bố cục; nếu fixture/mẫu thật cho thấy 180° phổ biến thì (b) là mục mở rộng. Test: cùng nội dung ở trang 0/90/180/270 ⇒ văn bản trích bằng nhau.
14. **PDF quét có lớp chữ ẩn và PDF thuần ảnh.** Issue nhắc "scanned-rotated pages". (a) chỉ xử lý khi có lớp chữ (OCR sẵn); thuần ảnh vẫn "không có văn bản" như hiện nay (112 #1); (b) mở OCR cho PDF — ngoài phạm vi, kéo theo Tesseract/render trang.
    **Đề xuất:** (a); ghi rõ vào spec ở mục Ngoài phạm vi, kèm yêu cầu fixture mô phỏng "lớp chữ ẩn trên trang xoay" (chữ có `Tr 3` — chế độ vẽ ẩn — nếu `make-pdf` hỗ trợ; nếu không, thêm). Xác nhận cách hiểu của chủ dự án.
15. **Phạm vi phụ: lệch gốc `x0` (CropBox) và hiển thị.** Sự kiện #13: `x` không trừ `x0`; viewer không vẽ trang (sự kiện #16). (a) sửa luôn khi chuyển sang viewport (kết quả đúng tự nhiên, kèm test CropBox lệch gốc); (b) giữ nguyên; (c) thêm "trang xoay" nhãn trong viewer — không cần. **Đề xuất:** (a) nếu dùng viewport.transform thì tự đúng và có test; **không** đổi hiển thị viewer/locator cho (c). Ghi nhận trong ADR là thay đổi hành vi so với 112 (có thể làm đổi văn bản của PDF có CropBox lệch gốc — thuộc phạm vi version mới).

### (a) Gạch nối cuối dòng

16. **Cây quyết định "giữ gạch hay nối liền".** Dữ kiện #18–20. Mặc định hiện tại: chữ thường ⇒ nối bỏ gạch; chữ hoa/số ⇒ giữ gạch. Đề xuất các luật (thứ tự ưu tiên), mỗi luật dừng khi quyết định được:
    (1) **bằng chứng theo tài liệu** (#17); (2) **gạch treo** — từ đầu dòng sau là liên từ (`and`, `or`, `to`, `và`, `hoặc`, `hay`…) ⇒ giữ gạch **và dấu cách** ("pre- and post-war"); (3) **quy tắc ngắt từ in ấn** — phần cuối dòng < 2 chữ cái hoặc phần đầu dòng sau < 3 chữ cái ⇒ không phải ngắt từ ⇒ giữ gạch ("e-/mail", "X-/ray", "co-/op"); (4) **tiền tố ghép thường gặp** (`non`, `self`, `anti`, `semi`, `multi`… danh sách ngắn, cố định, Anh) ⇒ giữ gạch;
    (5) tiếng Việt (#18); (6) còn lại ⇒ **hành vi mặc định**. Phương án mặc định: (a) nối bỏ gạch (như hiện tại, giữ tương thích FR-002); (b) giữ gạch (bảo thủ: văn bản giữ đúng ký tự PDF, tìm "long term" vẫn khớp, nhưng "hyphenated" không khớp bằng BM25); (c) tách theo ngôn ngữ.
    **Đề xuất:** (1)(2)(3)(5) là luật "chắc"; (4) bỏ ở v1 trừ khi số đo trên tập cặp từ cho thấy cần (danh sách cố định dễ sai, tránh từ điển); mặc định (a) — đúng câu chữ issue "keep the hyphen … when it can be decided safely" (chỉ GIỮ khi quyết định an toàn, còn lại giữ hành vi cũ). Ghi vào ADR phép đo tỉ lệ đúng/sai trên tập cặp từ gắn nhãn (#23).
17. **Bằng chứng theo tài liệu — kiến trúc.** `layoutPage` hiện thuần theo TRANG (một trang không biết các trang khác). (A) **Tiền quét** toàn tài liệu trong `parsePdf` (đã duyệt mọi trang tuần tự — cần 2 lượt hoặc đệm các trang đã trích item trước khi dựng): lấy từ `LayoutItem.text` các từ giữa dòng (`\p{L}+-\p{L}+` và từ trơn), tạo `Lexicon {hyphenated:Set, plain:Set}` truyền xuống `joinParagraphs`; (B) lexicon **trượt** — chỉ từ các trang đã xử lý (một lượt, bằng chứng đến sau bị bỏ lỡ); (C) không dùng bằng chứng tài liệu.
    Chi phí bộ nhớ (giữ items nhiều trang, tài liệu 50 MB) và thời gian (ảnh hưởng SC-006). **Đề xuất:** (A) với giới hạn: chỉ lưu _tập từ_ (không lưu item), tiền quét lexicon bằng một lượt `getTextContent` thứ hai chỉ khi tài liệu có ít nhất một ngắt dòng bằng gạch (đếm khi dựng lượt 1) — hoặc (B) nếu đo thấy (A) vượt 2×; luật kiểm: nếu cả dạng nối và dạng gạch cùng có bằng chứng ⇒ coi là không chắc (mặc định).
18. **Tiếng Việt và ngôn ngữ khác.** Tiếng Việt viết từng âm tiết cách nhau, **không ngắt từ bằng gạch nối** (gạch cuối dòng là gạch thật: "Bà Rịa-Vũng Tàu", "Hà Nội–Hải Phòng"), thế mà test hiện ghim `hợp-/đồng ⇒ hợpđồng` (sự kiện #19). Phương án nhận diện: (a) token trước/sau có chữ cái tiếng Việt đặc trưng (ă â ê ô ơ ư đ + dấu thanh tổ hợp NFC/NFD); (b) ngôn ngữ tài liệu phát hiện bằng `detect-language` hiện có (`src/shared/i18n/detect-language.ts`) trên mẫu văn bản trang; (c) không phân biệt.
    Hành vi khi là tiếng Việt: giữ gạch, nối liền không dấu cách (như nhánh chữ hoa) hay có dấu cách? **Đề xuất:** (a) cấp token (an toàn, không phụ thuộc phát hiện ngôn ngữ cả tài liệu) ⇒ giữ gạch, nối liền không dấu cách ("hợp-đồng"); sửa test `hợpđồng` → `hợp-đồng` (thay đổi hành vi có chủ đích, ghi ADR); ngôn ngữ khác (Pháp, Đức…) chưa xử lý riêng — đi theo luật chung, ghi "Giới hạn".
19. **Phạm vi ký tự và vị trí áp dụng.** Mở rộng nhận U+2010, U+2011 (và ASCII `-`); không nhận en dash; gạch treo; số trước gạch (`2020-` / `2021`); ô bảng (#20.iii) và gạch nối vắt cột/trang (#20.ii). Phương án: (a) chỉ mở rộng U+2010/2011 + gạch treo + ô bảng; (b) thêm gạch vắt cột/trang (cần ghép giữa vùng/trang: chunk không vắt trang ⇒ không thể nối qua trang);
    (c) không mở rộng. **Đề xuất:** (a); vắt cột trong cùng trang nếu `orderRegions` cho thứ tự liền kề là ngoài phạm vi (ghi "Giới hạn"); vắt trang: không (locator đơn trang). Xác nhận bằng thí nghiệm pdf.js xem font nào xuất U+2010.
20. **Đo tác động tìm kiếm/embedding.** Sự kiện #21, #26. Cần chứng minh thay đổi không làm giảm truy xuất. (a) bộ cặp từ gắn nhãn Anh+Việt (đúng/sai quyết định) làm chuẩn chính; (b) thêm 1–2 PDF vào `tests/eval` (112 #13 đã hoãn) với câu hỏi chạm từ ghép/gạch nối — đụng thủ tục bộ đánh giá 108 (hold-out, `TARGET_*`);
    (c) test FTS đơn vị: chunk có "long-term" ⇒ khớp "long term" và "long-term". **Đề xuất:** (a)+(c) trong 147; (b) tách issue riêng ("thêm PDF vào bộ đánh giá"), ghi rõ SC-007 kiểu 112 (bộ đánh giá hiện không có PDF nên số liệu không đổi).

### Xuyên suốt

21. **Một lần tăng `PDF_EXTRACTION_VERSION` hay nhiều lần.** Dữ kiện #22–24. (a) **Một lần**, 2 → 3, cho cả (b)(c)(a) trong cùng bản phát hành ((e) không đụng version); (b) mỗi hạng mục một số (3, 4, 5) — nhiều gợi ý/lần Xử lý lại liên tiếp, mỗi lần làm trích dẫn cũ thành "trích dẫn cũ"; (c) không tăng (người dùng tự Xử lý lại nếu muốn) — vi phạm yêu cầu của issue "requires `PDF_EXTRACTION_VERSION` handling".
    Nếu giao theo nhiều PR (#25): hằng số đổi một lần ở PR trích xuất đầu tiên merge; PR sau cùng bản phát hành dùng lại số đó, **không** tăng tiếp trừ khi đã phát hành giữa chừng. **Đề xuất:** (a); quy tắc nêu rõ trong plan: _chỉ tăng khi kết quả trích xuất của cùng một PDF có thể đổi_; sửa test `ingestion-pdf-blocks` (2 → 3) và hằng trong `data-model` ADR mới.
22. **Gợi ý "Xử lý lại" khi lên v3 (UX).** Dữ kiện #23. (a) giữ một khoá `reprocessHint`, đổi câu chữ chung chung ("Xử lý lại để cập nhật cách đọc bảng/trang xoay/gạch nối") cho mọi `extractionVersion < 3`; (b) hai khoá theo phiên bản nguồn: v1 ⇒ "giữ bố cục" (như cũ), v2 ⇒ "cải thiện bảng, trang xoay và gạch nối"; (c) chỉ gợi ý khi nguồn _có thể_ hưởng lợi (cần cờ lúc nạp: có trang xoay/bảng số/ngắt dòng gạch nối) — thêm cột/metadata; (d) cho phép bỏ qua gợi ý.
    Quyết định 112 #10: **không** xử lý lại hàng loạt — giữ; hệ quả: người có nhiều PDF phải bấm từng nguồn. **Đề xuất:** (b), không thêm cột, không bỏ qua/ẩn gợi ý ở v1; ghi "Giới hạn đã biết" cho trường hợp nhiều PDF + issue riêng "Xử lý lại hàng loạt" (cần ADR thay thế 112 #10). Cập nhật `reprocessAria`, hộp xác nhận nêu rõ chunk/trích dẫn cũ như 112; e2e `source-reprocess`.
23. **Bộ PDF mẫu và chỉ tiêu số liệu.** Issue: "measured on a PDF sample set". Dữ kiện #5, #15, #25. Phương án: (a) chỉ fixture tự sinh (`make-pdf`, tất định, commit được) — mở rộng: `rightAlignedFinancialTable`, `decimalAlignedTable`, `rotatedPage90/180/270` (nội dung vẽ xoay để hiển thị thẳng + biến thể có ghi chú xoay thật), `hyphenCompounds`, mẫu âm tính (`tocNoLeader`, `keyValueList`, `justifiedParagraph`, `signatureBlock`);
    (b) thêm PDF thật không bản quyền (tài liệu công khai/tự soạn) vào `tests/fixtures`; (c) bộ PDF thật của chủ dự án chạy thủ công cục bộ (đường dẫn qua biến môi trường, không commit) để đo tỉ lệ nhận bảng/thời gian.
    Chỉ tiêu: bảng dương 100% đúng ô, âm 0 nhầm, xoay: văn bản == tham chiếu, gạch nối: ≥ X% đúng trên tập cặp từ + 0 nối sai ở nhóm "chắc". **Đề xuất:** (a) bắt buộc + (c) tuỳ chọn ghi số vào ADR; X chốt khi có tập cặp từ (gợi ý ≥ 95% nhóm "chắc", ≥ mặc định cũ trên toàn bộ).
24. **Ngân sách hiệu năng trên bộ mẫu mở rộng.** `pdf-parse-perf.test.ts` hiện chỉ trộn `twoColumns`/`borderlessTable` 50 trang. Phương án: (a) mở rộng mẫu perf thành hỗn hợp có đủ bảng số, trang xoay, gạch nối (50 trang, giữ ngưỡng ≤ 2×); (b) thêm bài đo riêng theo từng hạng mục; (c) đo trên PDF thật lớn (nhiều trang) thủ công.
    Quan tâm: tiền quét lexicon (#17) và chuyển viewport có thể thêm ≥ 1 lượt `getTextContent`/`getViewport`; giữ `LAYOUT_BUDGET_MS`. **Đề xuất:** (a)+(c): mẫu mới vào bộ perf (đổi số trang/tỉ lệ nếu cần, ghi số đo vào ADR như 112), assert chặt local, CI chỉ log (như hiện tại); nếu (A) của #17 vượt 2× ⇒ chuyển sang (B).
25. **Phân pha giao hàng.** (a) **Một PR/feature** gồm cả bốn; (b) tách: **PR1 = (e)** lưới (thuần renderer + hàm thuần dùng chung, **không** version, hoạt động ngay trên PDF v2 hiện có), **PR2 = (c)** xoay (adapter), **PR3 = (b)** bảng số, **PR4 = (a)** gạch nối — hằng số phiên bản tăng một lần theo #21, gợi ý "Xử lý lại" (#22) đi cùng PR trích xuất cuối trước phát hành; (c) tách theo issue riêng từng hạng mục.
    Phụ thuộc: (e) có lợi nhưng không phụ thuộc (b) (bảng căn phải mới xuất hiện sau (b) sẽ tự có lưới); (b)(c)(a) độc lập nhau về code nhưng cùng chạm `pdf-layout/` + cùng thay đổi version. Rủi ro (a): một PR lớn, review khó; ADR/spec nhiều. **Đề xuất:** (b) — thứ tự e → c → b → a (rủi ro/giá trị: e dễ kiểm chứng và độc lập version; c là sửa sai rõ ràng; b cần số đo nhiều nhất; a cần quyết định ngôn ngữ/bằng chứng nhiều nhất),
    phát hành MỘT bản có version 3 sau khi ba hạng mục trích xuất xong (hoặc chấp nhận ghi chú nếu phát hành giữa chừng). Chủ dự án xác nhận có muốn tách `/speckit-specify` thành nhiều spec con hay một spec nhiều user story ưu tiên P1…P4 (**đề xuất:** một spec, 4 user story độc lập kiểm thử được, ưu tiên e → c → b → a).
26. **Dự phòng theo tính năng (kill-switch).** Dữ kiện #27. (a) giữ dự phòng theo TRANG hiện tại (`legacyJoin`); (b) thêm dự phòng hạng mục: lỗi trong đường phụ bảng số ⇒ bỏ đường phụ, dùng kết quả trước đó của trang (bảng căn trái + văn bản), lỗi lexicon gạch nối ⇒ quy tắc mặc định, lỗi xoay ⇒ hệ chưa xoay; (c) cờ cấu hình ẩn tắt từng hạng mục.
    **Đề xuất:** (b) bằng `try/catch` cục bộ quanh từng hạng mục mới (không mở cờ cấu hình, không UI) + test chèn lỗi; ghi `logEvent` mã (không nội dung) khi dự phòng xảy ra nếu `logEvent` cho phép trường số đếm (chưa đọc `logging.ts`).
27. **Tương thích dữ liệu cũ và hiển thị lưới sau Xử lý lại.** Sau Xử lý lại v3 một số bảng mới xuất hiện (b) và lưới tự áp dụng; nguồn v2 chưa xử lý vẫn hiển thị lưới cho bảng cũ nhưng chưa có bảng số căn phải (hiển thị như văn bản). Có cần dấu hiệu "bảng này được nhận ở phiên bản mới" không? **Đề xuất:** không — gợi ý "Xử lý lại" (#22) đã đủ; không thêm UI.

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md` (đã tra các dòng 152–162 của 112: `text layer`, `page layout`, `reading order`, `Markdown table`, `reprocess`, `extraction version`, `stale citation`, `legacy join`, `text block`, `segment/line` đã có). Đề xuất append (không sửa term cũ; cột 日本語 để `—`):

| 日本語 | Tiếng Việt (đề xuất)                            | English (đề xuất, dùng trong code)                                        | Ghi chú                                                                                                                                       |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| —      | Cột số căn phải (bảng tài chính)                | right-aligned numeric column (`detectRightAlignedTable`, `isNumericCell`) | Cột mà các ô số thẳng hàng theo MÉP PHẢI (`x+w`) hoặc dấu thập phân thay vì mép trái; đường nhận diện phụ, chỉ thêm bảng mới — 147            |
| —      | Dạng lưới (hiển thị bảng trong Trình xem nguồn) | table grid view (`parseMarkdownTables`, `TableGrid`)                      | Lớp hiển thị từ Markdown table; văn bản/chunk/locator không đổi; tô sáng theo offset ký tự trong ô — 147 (thay thế một phần 112 #6)           |
| —      | Xoay trang hiển thị (`/Rotate`)                 | display rotation (`page.rotate`, `toDisplayItem`)                         | Áp góc xoay trang (0/90/180/270) vào toạ độ trước khi dựng bố cục; khác "chữ xoay" (`LayoutItem.rotated`) so với trang — 147                  |
| —      | Gạch nối cuối dòng / gạch treo                  | line-break hyphen / suspended hyphen (`appendLine`, `HyphenDecision`)     | Gạch ở cuối dòng: ngắt từ thật (nối bỏ gạch), từ ghép thật (giữ gạch) hoặc gạch treo "pre- and post-"; quyết định cục bộ, không từ điển — 147 |
| —      | Bằng chứng gạch nối theo tài liệu (lexicon)     | document hyphen lexicon (`HyphenLexicon`)                                 | Tập từ trơn/từ có gạch thấy GIỮA dòng trong cùng tài liệu để quyết định giữ/bỏ gạch cuối dòng (nếu clarify chọn) — 147                        |

Ghi chú: người phụ trách có thể gộp bớt dòng khi append trong branch feature (rule 5 `CLAUDE.md`: THÊM term được làm ngay). Không sửa/đổi tên `Markdown table`, `text block`, `segment/line`, `extraction version`, `page layout` (112). Nếu muốn bổ sung ngữ nghĩa (vd "extraction version = 3 …") — đó là SỬA term cũ ⇒ PR riêng được steward duyệt.

## Đối chiếu constitution

- **I (Local-first):** đạt — toàn bộ chạy ở main/renderer cục bộ, không từ điển tải về, không egress; hiển thị lưới không chạm mạng. Điểm canh: nếu chọn từ điển/danh sách ngôn ngữ cho gạch nối, phải nhúng sẵn trong bản đóng gói (không tải).
- **II (Kiểm chứng được):** **trọng tâm.** Thay đổi trích xuất đứng trước `cleanText`/chunker nên locator vẫn tính trên văn bản chính tắc; Xử lý lại sinh chunk id mới ⇒ chip cũ thành "trích dẫn cũ" (cơ chế 112). Lưới (e) KHÔNG được lệch vùng tô sáng: ánh xạ offset→ô phải có test thuộc tính; ký tự cấu trúc (`|`, `---`) không hiển thị nhưng vẫn nằm trong khoảng offset. Gạch nối (a): chunk phản ánh văn bản chính tắc đã nối — người dùng so với PDF thấy ký tự khác ở chỗ ngắt dòng (đã là như vậy từ 112); giữ gạch càng sát PDF.
- **III (Biên bảo mật):** không kênh IPC mới (nếu chọn #6 A); nếu chọn #6 B chỉ thêm trường dữ liệu vào `SourceContent` (offset, không nội dung thêm); render React node không `innerHTML` (chống XSS từ ô bảng); không log nội dung (dự phòng #26 chỉ log mã/số).
- **IV (Test-first):** hàm thuần mới (nhận diện cột số, `toDisplayItem`, quyết định gạch nối, `parseMarkdownTables`, ánh xạ offset→ô, `buildSegments` mở rộng) có test trước, coverage ≥ 80%; cập nhật test đang ghim hành vi cũ; fixture tự sinh; perf SC-006 mở rộng; wiring `parsePdf` (gọi pdf.js) theo quy ước kiểm bằng test tích hợp có PDF tự sinh.
- **V (Phased Delivery):** không vi phạm (hoàn thiện ingestion/source-viewer, Pha 1; không làm OCR/Pha 2).
- **Additional constraints:** i18n 123 (khoá vi + en cho hint/nhãn lưới/a11y; test vi↔en); source-of-truth (prototype không có bảng/lưới — ghi UI mới, không sửa prototype); terminology (glossary: thêm thuật ngữ trước khi đặt tên); không thêm dependency (nếu có đề xuất thêm thư viện từ điển/bảng ⇒ phải ghi ADR); ADR: ghi quyết định clarify vào
  `docs/04-decisions/2026-10-09-pdf-layout-147-clarify.md` + `2026-10-09-pdf-layout-147.md` (+ append `INDEX.md`), nêu rằng chúng **bổ sung/thay thế một phần** các dòng "Giới hạn" của `2026-10-07-pdf-layout.md` và 112 clarify #6, #7 (không sửa file cũ). Lưu ý tên file ADR cần tránh trùng `2026-10-07-pdf-layout*.md`.

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa đổi constitution phải qua PR riêng được steward duyệt, rule 5). Có thể cân nhắc về sau, không bắt buộc ở 147: một dòng ở "Additional Constraints" rằng _"mọi thay đổi làm đổi văn bản/chunk trích từ một loại nguồn MUST (1) tăng phiên bản trích xuất tương ứng, (2) giữ nguyên dữ liệu cũ cho đến khi người dùng chủ động xử lý lại, và (3) có phép đo trên bộ mẫu đại diện (độ đúng + thời gian) được ghi vào ADR"_ — để các lần cải tiến trích xuất sau (PDF, docx, URL) theo cùng một khuôn thay vì mỗi feature tự lập lại (112 → 147).
