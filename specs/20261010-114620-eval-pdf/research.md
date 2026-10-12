# Research — Thêm PDF vào bộ đánh giá truy xuất (177)

Mọi quyết định bám `docs/04-decisions/2026-10-10-eval-pdf-clarify.md`.

## R1 — Nạp PDF trong harness qua đúng đường của app

- **Decision**: `harness.ts` truyền `kind = doc.format` vào `pipeline.add` và `filePath = corpus/<doc.file>`; `parseFile(kind, bytes)`
  ⇒ `pdf` gọi **`parsePdf(bytes)` không truyền `opts`** (giữ `LAYOUT_BUDGET_MS`, `HYPHEN_RETAIN_MAX_ITEMS` mặc định — y hệt
  `ingestion.ts:132`), `md` giữ `parseText`. Chia đoạn / nhúng / chỉ mục / `retrieve()` không đổi.
- **Rationale**: đo đúng nhánh mà người dùng gặp; không dựng đường riêng (bài học 108).
- **Alternatives**: dùng `createIngestion` đầy đủ (kéo theo transcriber/OCR, nặng, không cần); trích trước rồi nạp như `.md` (không
  đi qua `kind: "pdf"`, mất locator trang) — bác.

## R2 — Loader bất đồng bộ + nguồn chân lý của trích dẫn

- **Decision**: `loadDataset(dir)` → `Promise<Dataset>`; với mỗi tài liệu: `md` đọc UTF-8 như cũ; `pdf` đọc bytes, kiểm `sha256` khớp
  manifest (lệch ⇒ `loadErrors`), rồi `texts.set(id, (await parsePdf(bytes)).text)`. `validateQuestions` giữ nguyên (đã nhận
  `texts`). `retrieval.eval.ts` `await`. Tách phần thuần: `extOf(format)`, `fileOf(doc)`, `sha256Hex(bytes)`.
- **Rationale**: clarify #2 — không bản chụp, luôn khớp `parsePdf` thật; trích đổi ⇒ fail ở bước kiểm dữ liệu (tín hiệu hồi quy).
- **Alternatives**: bản chụp `.expected.md` (có thể lệch) — bác ở clarify.

## R3 — Văn bản của PDF đi vào `texts` có giống văn bản đã chunk không

- **Decision**: dùng `ParseResult.text` (văn bản ghép của mọi trang — đúng đầu vào chunker). Trích dẫn kiểm sau `normalizeForMatch`
  (NFC + gộp khoảng trắng) như cũ ⇒ ngắt trang / dòng không làm lệch. Trích dẫn không vắt qua ranh giới trang (chunk không vắt trang)
  — quy tắc soạn câu hỏi.
- **Rationale**: chấm "đúng" = đoạn chứa trích dẫn; trích dẫn phải nằm trọn trong một trang để có đoạn chứa nó.

## R4 — PDF fixture trong giới hạn của `make-pdf.ts`

- **Decision**: `tests/eval/lib/pdf-fixture.ts` export `buildEvalFixturePdf(): Uint8Array` thuần, tất định, dùng `makePdf` +
  `rotateForDisplay` sẵn có. Thêm vào `make-pdf.ts` **chỉ** một helper thuần `layoutParagraph(text, {x, y, width, size, leading})
→ FixtureText[]` (ngắt dòng theo `CHAR_WIDTH`, tuỳ chọn ngắt bằng gạch nối tại vị trí chỉ định) — không đổi `makePdf` / bảng mã.
  Nội dung **tự soạn** tiếng Việt (chủ đề mới, không trùng corpus), viết chữ thường là chính để số grapheme ngoài ASCII khác nhau
  ≤ 128 (giới hạn hiện có ném lỗi ⇒ test bắt sớm). Trang: (1) văn xuôi + đoạn có gạch nối cuối dòng (`hợp-đồng`, `long-term`) + đáp án
  sát cuối trang; (2) **hai cột**; (3) **bảng số căn phải** (có đường kẻ như mẫu 147); (4) **trang khổ ngang** (`/Rotate 90`).
- **Rationale**: kiểm soát đúng các đặc trưng 112/147; miễn bản quyền; tệp nhỏ (~10–30 KB).
- **Alternatives**: nhiều font / mở rộng bảng mã (đổi hành vi dùng chung bởi 7 test) — chỉ làm nếu nội dung không vừa 128, và chỉ
  theo kiểu thêm tuỳ chọn.

## R5 — Tái tạo và dấu vân tay tệp PDF

- **Decision**: commit cả hai PDF; manifest có `sha256`. Unit test `eval-pdf-fixture.test.ts` so `sha256(buildEvalFixturePdf())` với
  manifest; tái tạo bằng `UPDATE_EVAL_FIXTURE=1 npx vitest run tests/unit/eval-pdf-fixture.test.ts` (ghi tệp rồi người phụ trách cập
  nhật trích dẫn + `datasetVersion`). PDF Wikipedia không tái tạo được ⇒ chỉ kiểm `sha256` + ghi `sourceUrl`, `revisionId`, ngày tải.
- **Rationale**: tệp nhị phân là chuẩn; đổi tệp mà không đổi manifest ⇒ fail.

## R6 — PDF Wikipedia tiếng Việt

- **Decision**: chọn một bài vi.wikipedia **chưa có** trong corpus, ngắn (PDF ≤ ~500 KB, ≤ ~6 trang), có **bảng** và số liệu, không
  trùng chủ đề với 11 tài liệu hiện có (tránh câu hỏi cũ bị nhiễu). Tải bằng chức năng "Tải về dạng PDF"
  (`Special:DownloadAsPdf`) cho đúng `revisionId`; **thao tác ra mạng — xin phép chủ dự án trước khi tải** (một lần, lúc soạn dữ liệu).
  Kiểm: có lớp chữ (`parsePdf` ra văn bản dài), dung lượng, metadata (Info: Title/Producer; không Author / đường dẫn máy cá nhân —
  unit test đọc metadata bằng pdfjs và từ chối trường cá nhân). Ghi công CC BY-SA 4.0 + "thay đổi đã làm: xuất PDF bằng chức năng
  của Wikipedia, không chỉnh sửa".
- **Rationale**: clarify #1 — trình tạo PDF bên thứ ba (font nhúng thật).
- **Rủi ro**: PDF lớn ⇒ `parsePdf` > 1000 ms ⇒ chọn bài ngắn hơn (test chặn).

## R7 — Nhóm số liệu theo định dạng

- **Decision**: `QuestionOutcome` thêm `format: "md" | "pdf" | null` (null = câu không đáp án không gắn tài liệu; câu không đáp án sát chủ đề PDF gắn trường tuỳ chọn `topic: "pdf"` — xem data-model). `docFormatOf(q, docs)` thuần: câu có đáp án ⇒ định dạng của
  `docIds[0]` (mọi `docIds` của một câu PDF phải cùng định dạng — validate). `groupOutcomes` trả thêm `pdf: {dev, holdout}` và
  `md: {dev, holdout}` (vi). Nhóm cũ (dev/holdout/en tổng) **không đổi** ⇒ cổng 108–109 không đổi.
- **Rationale**: FR-008 — PDF tham khảo, không vào cổng.

## R8 — Cảnh báo nhóm PDF

- **Decision**: `pdfWarnings(groups): PdfWarning[]` thuần: với từng split, cảnh báo khi `wilson95(hitsPdf, nPdf)[1] < recallAt6(md)`;
  `nPdf = 0` ⇒ không cảnh báo, ghi "không có câu PDF". Báo cáo hiện cảnh báo, eval **không fail** vì nó.
- **Rationale**: clarify #4.

## R9 — Đo lại hiệu chuẩn, trước / sau

- **Decision**: chạy eval trên `main` (v3) và branch (v4) với cùng cấu hình (`EVAL_MODE=current`, và `EVAL_RERANK` như bản ghi) ⇒ bảng
  trước / sau trong PR + ADR thực thi: trên **đúng các câu cũ** (lọc id) Recall@6 / MRR không giảm (SC-004 — các câu cũ không đổi, tài
  liệu thêm có thể làm nhiễu); cập nhật `RELEVANCE_CALIBRATION` (metrics dev/holdout/en, rerank.metrics, `datasetVersion` "4",
  `calibratedAt`). Cổng 108/109 không còn đạt, hoặc câu cũ tụt ⇒ **dừng**, báo, mở issue.
- **Rationale**: clarify #3.
