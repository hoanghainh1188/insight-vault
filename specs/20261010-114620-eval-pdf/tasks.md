# Tasks: Thêm PDF vào bộ đánh giá truy xuất (177)

**Input**: `specs/20261010-114620-eval-pdf/` (plan.md, spec.md, research.md R1–R9, data-model.md, contracts/manifest.md, contracts/report.md,
quickstart.md) · Quyết định: `docs/04-decisions/2026-10-10-eval-pdf-clarify.md`

**Tests**: BẮT BUỘC (Constitution IV + FR-014) — viết test TRƯỚC, chạy thấy FAIL, rồi mới hiện thực.

**Organization**: theo user story của spec — US1 (P1) đo trên PDF, US2 (P1) dữ liệu PDF hợp lệ + nguồn gốc, US3 (P2) hiệu chuẩn + trước /
sau. US1 và US2 cùng P1; US1 cần ít nhất PDF fixture của US2 để có số liệu thật.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác tệp, không phụ thuộc task chưa xong)
- Mọi đường dẫn tính từ gốc repo.

---

## Phase 1: Setup

- [X] T001 Append thuật ngữ mới bằng script (KHÔNG chạy prettier lên glossary): định dạng tài liệu đánh giá (`format`, `file`, `sha256`),
      PDF fixture đánh giá (`buildEvalFixturePdf`, `pdf-fixture.ts`), nhóm số liệu theo định dạng (`byFormat`), cảnh báo nhóm PDF
      (`PdfWarning`, `pdfWarnings`), `topic: "pdf"`, giấy phép `CC0-1.0` — `docs/00-glossary.md`.
- [X] T002 Lấy số liệu MỐC trước thay đổi: chạy `EVAL_MODE=current npm run eval:retrieval` (có `EVAL_RERANK` như bản ghi) **ngay trên
      branch `177-eval-pdf`, TRƯỚC T003** — lúc này branch chưa đổi gì ở `tests/eval/` hay corpus nên tương đương dataset v3 của `main`
      (worktree không checkout được `main`). Xác nhận bằng `git diff --stat origin/main -- tests/eval src/main` rỗng trước khi chạy. Lưu
      `report.json` / `report.md` vào thư mục tạm ngoài repo (ghi đường dẫn vào ghi chú PR) — cần cho bảng trước / sau (US3). Nếu máy chưa
      có cache mô hình thì báo người dùng (lần đầu cần mạng).

---

## Phase 2: Foundational (chặn mọi story) — manifest + loader

**Purpose**: manifest có định dạng / tệp / dấu vân tay; loader bất đồng bộ trích PDF bằng `parsePdf` thật (research R2).

- [X] T003 Viết test TRƯỚC trong `tests/unit/eval-dataset.test.ts` cho `validateManifest` mở rộng (contracts/manifest.md M1–M5): `format`
      sai; `file` có `/`, `\`, `..`; PDF thiếu / sai `sha256` (không phải 64 hex thường); `license` `CC0-1.0` hợp lệ, giá trị lạ lỗi;
      `noise: true` + PDF ⇒ lỗi; tài liệu cũ không có `format` / `file` vẫn hợp lệ. Cho `validateQuestions` (Q1, Q3): `docIds` trộn md + pdf
      ⇒ lỗi; `topic: "pdf"` chỉ hợp lệ ở câu `unanswerable`, giá trị khác ⇒ lỗi. Cho hàm thuần mới `docFormat(doc)` (thiếu ⇒ `"md"`),
      `docFile(doc)` (thiếu ⇒ `<id>.<format>`), `sha256Hex(bytes)` (vector cố định). Chạy ⇒ FAIL.
- [X] T004 Viết test TRƯỚC (cùng tệp) cho `loadDataset` bất đồng bộ: thư mục tạm có 1 `.md` + 1 PDF sinh bằng `makePdf`
      (`tests/fixtures/pdf/make-pdf.ts`) ⇒ `texts` của PDF = văn bản `parsePdf`; `sha256` lệch ⇒ `loadErrors` có "sha256 lệch"; thiếu tệp
      PDF ⇒ lỗi; PDF không ra chữ ⇒ "rỗng". Sửa ca test `loadDataset` cũ sang `await`. Chạy ⇒ FAIL.
- [X] T005 Hiện thực trong `tests/eval/lib/dataset.ts`: `EvalLicense` + `"CC0-1.0"`; `EvalDocument` + `format?`, `file?`, `sha256?`,
      `revisionId?`, `generator?`; `EvalQuestion` + `topic?: "pdf"`; `docFormat`, `docFile`, `sha256Hex` (`node:crypto`); quy tắc M1–M5, Q1,
      Q3; `loadDataset(dir): Promise<Dataset>` (md đọc UTF-8; pdf đọc bytes → kiểm sha256 → `(await parsePdf(bytes)).text`, cấu hình mặc
      định). T003–T004 xanh; mọi test eval cũ xanh.
- [X] T006 Sửa `tests/eval/retrieval.eval.ts`: `await loadDataset(EVAL_DIR)`; không đổi logic khác. `npx tsc --noEmit -p tsconfig.node.json`
      sạch (kiểm `tsconfig` bao `tests/eval`).

**Checkpoint**: dữ liệu cũ (chỉ `.md`) tải + kiểm như trước; `npm test` xanh.

---

## Phase 3: User Story 2 — Dữ liệu PDF hợp lệ và có nguồn gốc rõ ràng (P1)

**Goal**: 2 PDF (fixture + Wikipedia) trong corpus, dấu vân tay, giấy phép, câu hỏi PDF có trích dẫn khớp văn bản `parsePdf`.

**Independent Test**: `npx vitest run tests/unit/eval-pdf-corpus.test.ts tests/unit/eval-pdf-fixture.test.ts` xanh; sửa 1 chữ trong một
trích dẫn PDF ⇒ đỏ, nêu id câu + tài liệu.

### PDF fixture

- [X] T007 [P] [US2] Viết test TRƯỚC trong `tests/unit/make-pdf-layout.test.ts` cho helper mới `layoutParagraph(text, {x, y, width, size,
      leading, hyphenateAt?})` của `tests/fixtures/pdf/make-pdf.ts`: ngắt dòng theo `CHAR_WIDTH` không vượt `width`; tất định; `hyphenateAt`
      chèn dòng kết thúc bằng `-` đúng vị trí; trả `FixtureText[]` mới (không mutate). Chạy ⇒ FAIL.
- [X] T008 [US2] Hiện thực `layoutParagraph` trong `tests/fixtures/pdf/make-pdf.ts` — CHỈ THÊM, không đổi `makePdf` / bảng mã / hành vi cũ.
      T007 xanh; mọi test đang dùng `make-pdf.ts` (`grep -rl make-pdf tests`) vẫn xanh.
- [X] T009 [US2] Viết test TRƯỚC `tests/unit/eval-pdf-fixture.test.ts` cho `buildEvalFixturePdf()` (`tests/eval/lib/pdf-fixture.ts`): hai lần
      gọi cho bytes giống hệt; `parsePdf` của kết quả có: bảng Markdown với cột số căn phải (dòng `| … |`), trang khổ ngang (`/Rotate 90`) có
      chữ đọc được, từ ghép giữ gạch nối tiếng Việt (`hợp-đồng`) và tiếng Anh (`long-term`) theo quy ước 147, đoạn hai cột không trộn
      dòng, một câu nằm ở cuối trang 1; `sha256(buildEvalFixturePdf())` = `sha256` trong manifest; `UPDATE_EVAL_FIXTURE=1` ⇒ ghi tệp
      `tests/eval/corpus/<fixture-id>.pdf` (chỉ khi biến bật). Chạy ⇒ FAIL.
- [X] T010 [US2] Hiện thực `tests/eval/lib/pdf-fixture.ts`: nội dung TIẾNG VIỆT TỰ SOẠN (chủ đề mới, không trùng 11 tài liệu hiện có; chữ
      thường là chính để ≤ 128 grapheme ngoài ASCII — vượt thì `makePdf` ném), 4 trang theo research R4 (văn xuôi + gạch nối + đáp án cuối
      trang · hai cột · bảng số căn phải có đường kẻ · trang ngang qua `rotateForDisplay`). Chạy `UPDATE_EVAL_FIXTURE=1 npx vitest run
      tests/unit/eval-pdf-fixture.test.ts` sinh tệp; thêm mục manifest (`format: "pdf"`, `license: "CC0-1.0"`, `sha256`, `generator`,
      `sourceUrl` = đường dẫn generator) vào `tests/eval/corpus/manifest.json`. T009 xanh. Thêm `tests/eval/lib/pdf-fixture.ts` vào
      `coverage.include` của `vitest.config.ts`.

### PDF Wikipedia

- [X] T011 [US2] Chọn một bài vi.wikipedia CHƯA có trong corpus, ngắn, có bảng + số liệu, không trùng chủ đề 11 tài liệu (research R6). **Xin
      phép người dùng trước khi tải** (thao tác ra mạng): tải bản "Tải về dạng PDF" (`Special:DownloadAsPdf`) đúng `revisionId`; kiểm có lớp
      chữ, ≤ ~500 KB, `parsePdf` ≤ 1000 ms; lưu `tests/eval/corpus/<wiki-id>.pdf`; thêm mục manifest (`format: "pdf"`, `license: "CC BY-SA
      4.0"`, `sourceUrl`, `revisionId`, `retrievedAt`, `sha256`). Tổng dung lượng 2 PDF ≤ ~1 MB.
- [X] T012 [US2] Thêm `*.pdf binary` cho `tests/eval/corpus/` vào `.gitattributes` (tạo nếu chưa có); xác nhận `electron-builder` /
      `files` chỉ đóng gói `out/**` (không đụng `tests/`).

### Kiểm corpus PDF + câu hỏi

- [X] T013 [US2] Viết test `tests/unit/eval-pdf-corpus.test.ts` (không mô hình, không mạng) — viết TRƯỚC khi soạn câu hỏi: với mọi tài liệu
      `format: "pdf"` trong manifest: `sha256` khớp; **trích một lần làm nóng** (pdfjs nạp động lần đầu — không tính giờ), rồi trích **2 lần
      có đo giờ** bằng `parsePdf` ⇒ văn bản 2 lần giống hệt nhau (và giống lần làm nóng); **thời gian NHỎ NHẤT của 2 lần ≤ 1000 ms** (chống
      dao động khi `npm test` chạy song song + coverage — bài học `pdf-parse-perf` PR #182); **tổng bytes mọi PDF trong manifest ≤ 1 048 576**
      (SC-005); metadata (`getMetadata` của pdfjs) không có `Author` / đường dẫn máy cá nhân; `validateQuestions` trên dataset thật
      (`await loadDataset`) không lỗi. Chạy ⇒ FAIL tới khi có câu hỏi hợp lệ (hoặc đỏ ở metadata / dung lượng ⇒ quay lại T011).
- [X] T014 [US2] Soạn câu hỏi PDF tiếng Việt trong `tests/eval/questions.json`: ~20–30 câu `answerable` (≥ 1 câu cho mỗi đặc trưng: bảng
      số căn phải, gạch nối, trang ngang, hai cột, cuối trang; còn lại cho PDF Wikipedia), trích dẫn ≤ 200 ký tự viết theo VĂN BẢN TRÍCH
      (bảng `| ô | ô |`, giữ `hợp-đồng`), nằm trọn trong một trang; ~6–10 câu `unanswerable` sát chủ đề PDF có `topic: "pdf"` (kiểm chắc
      không tài liệu nào chứa đáp án); chia dev / hold-out ~70/30 trong từng loại; `datasetVersion: "4"`, `reviewed: null`. T013 xanh.

**Checkpoint**: `npm test` xanh với corpus 13 tài liệu; US2 hoàn tất độc lập.

---

## Phase 4: User Story 1 — Đo chất lượng truy xuất trên tài liệu PDF (P1) 🎯 MVP

**Goal**: harness nạp PDF qua `parsePdf` của app; báo cáo có nhóm md / pdf × dev / hold-out, phiên bản trích xuất, cảnh báo Wilson.

**Independent Test**: `EVAL_MODE=current npm run eval:retrieval` ⇒ `report.md` có mục "Nhóm PDF (tham khảo)" + "Phiên bản trích xuất PDF: 3";
chạy lần 2 ⇒ số liệu nhóm PDF giống hệt.

- [X] T015 [P] [US1] Viết test TRƯỚC trong `tests/unit/eval-metrics.test.ts`: `outcomeFormat(q, docs)` (câu có đáp án ⇒ định dạng
      `docIds[0]`; `unanswerable` + `topic: "pdf"` ⇒ `"pdf"`; còn lại ⇒ `null`); `groupOutcomes` trả thêm `byFormat.{md,pdf}.{dev,holdout}`
      chỉ câu `vi`, nhóm cũ `dev` / `holdout` / `en` GIỮ NGUYÊN giá trị (so snapshot với đầu vào cũ); `pdfWarnings`: cận trên Wilson 95% PDF <
      Recall@6 md ⇒ 1 cảnh báo đúng trường; bằng / lớn hơn ⇒ không; `nPdf = 0` ⇒ không; tính riêng dev / hold-out. Chạy ⇒ FAIL.
- [X] T016 [US1] Hiện thực trong `tests/eval/lib/metrics.ts`: `QuestionOutcome.format`, `outcomeFormat`, `groupOutcomes.byFormat`,
      `PdfWarning`, `pdfWarnings` (dùng `wilson95` sẵn có). T015 xanh.
- [X] T017 [P] [US1] Viết test TRƯỚC `tests/unit/eval-report.test.ts` cho `renderMarkdown` (contracts/report.md): có dòng "Phiên bản trích
      xuất PDF: <n>", bảng 4 dòng md / pdf × dev / hold-out, dòng "⚠️ Cảnh báo" chỉ khi `pdfWarnings` khác rỗng, ghi chú cỡ mẫu nhỏ; báo
      cáo không có `byFormat` (dữ liệu cũ) vẫn render như trước. Chạy ⇒ FAIL.
- [X] T018 [US1] Hiện thực trong `tests/eval/lib/report.ts`: `EvalReport` + `pdfExtractionVersion`, `byFormat?`, `pdfWarnings?`; mục
      "Nhóm PDF (tham khảo — không vào tiêu chí ĐẠT)". T017 xanh. Thêm `tests/eval/lib/report.ts` vào `coverage.include` nếu phần thuần
      đạt ≥ 80% (không thì giữ ngoài như 108 và ghi lý do).
- [X] T019 [US1] Sửa `tests/eval/lib/harness.ts` (I/O): `pipeline.add({ kind: docFormat(d), filePath: join(corpusDir, docFile(d)) })`;
      `parseFile(kind, bytes)` ⇒ `pdf`: `parsePdf(bytes)` KHÔNG truyền `opts` (y hệt `src/main/services/ingestion/ingestion.ts:132`), `md`:
      `parseText` như cũ; `evaluateConfig` gắn `format` vào mỗi `QuestionOutcome` (qua `outcomeFormat`).
- [X] T020 [US1] Sửa `tests/eval/retrieval.eval.ts`: điền `pdfExtractionVersion` (`PDF_EXTRACTION_VERSION` từ `src/shared/ipc/types.ts`),
      `byFormat`, `pdfWarnings` cho cấu hình được báo cáo (hiện hành / chọn, có bộ chấm nếu bật); cảnh báo KHÔNG đổi mã thoát.
- [X] T021 [US1] Chạy `EVAL_MODE=current npm run eval:retrieval` hai lần; xác nhận mục PDF có mặt và số liệu nhóm PDF giống hệt giữa 2 lần
      (SC-001, SC-003). Ghi số liệu vào ghi chú cho T024.

**Checkpoint**: US1 + US2 xong — có số liệu PDF thật.

---

## Phase 5: User Story 3 — Hiệu chuẩn không âm thầm lệch, có số liệu trước / sau (P2)

**Goal**: đo lại `RELEVANCE_CALIBRATION` trên dataset v4 trong cùng PR; câu cũ không tụt; không đạt ⇒ dừng.

**Independent Test**: `npx vitest run tests/unit/relevance-calibration.test.ts` xanh với `datasetVersion: "4"`; bảng trước / sau trong PR.

- [X] T022 [US3] So báo cáo MỐC (T002, v3) với v4 trên ĐÚNG các câu cũ (lọc theo id): Recall@6 / MRR dev, hold-out, en **không giảm — so
      sánh tuyệt đối, KHÔNG dung sai** (SC-004, FR-010; chủ ý: thêm tài liệu không được đẩy tụt dù chỉ 1 câu cũ); cổng 108 (`confirmOnHoldout`,
      Wilson) và 109 (bộ chấm) vẫn đạt. Có tụt ⇒ liệt kê từng câu cũ bị tụt (id, hạng trước → sau, tài liệu PDF nào chiếm chỗ) rồi **DỪNG, báo
      người dùng, mở issue riêng; không đổi mục tiêu / cấu hình, không sửa câu hỏi cũ để "vá" số liệu.**
      _Kết quả 2026-10-12: dừng + điều tra từng câu (q-121 tụt ở 108 không bộ chấm; q-176 / q-179 lọt bộ chấm) ⇒ chủ dự án chốt đo trên
      đường app thật (108 + 109, không câu cũ nào tụt) + mở issue riêng — xem spec Clarifications 2026-10-12._
- [X] T023 [US3] Cập nhật CHỈ số liệu trong `src/main/services/rag/relevance-calibration.ts`: `datasetVersion: "4"`, `calibratedAt`,
      `metrics.{dev,holdout}`, `rerank.metrics.{dev,holdout,en}` từ lượt đo v4 (theo hướng dẫn trong thông báo của
      `tests/unit/relevance-calibration.test.ts`). Test canh giữ xanh. Không đổi cấu hình / cấu trúc.
- [X] T024 [US3] Soạn bảng trước / sau (câu cũ v3 vs v4 + nhóm PDF mới) cho mô tả PR và ADR thực thi.

---

## Phase 6: Polish & tài liệu

- [X] T025 [P] Cập nhật `tests/eval/README.md`: tài liệu PDF, trường manifest mới, nhóm PDF + cảnh báo, tái tạo fixture
      (`UPDATE_EVAL_FIXTURE=1`), quy trình khi `PDF_EXTRACTION_VERSION` đổi (cập nhật trích dẫn + tăng `datasetVersion`).
- [X] T026 [P] Cập nhật `tests/eval/corpus/README.md`: bảng nguồn / giấy phép (+ 2 PDF), ghi công CC BY-SA 4.0 cho PDF Wikipedia ("thay đổi đã
      làm: xuất PDF bằng chức năng của Wikipedia, không chỉnh sửa"), PDF fixture `CC0-1.0` tự soạn, cách xác minh sha256, thay câu "không sửa
      tay nội dung" bằng "không thay tệp mà không tăng `datasetVersion`".
- [X] T027 ADR thực thi `docs/04-decisions/2026-10-12-eval-pdf.md` (bảng trước / sau, số liệu v3 làm mốc, đánh dấu hoàn thành 112 #13 và
      147 #20) + một dòng `docs/04-decisions/INDEX.md` bằng script (KHÔNG prettier lên INDEX).
- [X] T028 Cổng review: gọi song song **code-reviewer**, **glossary-steward**, **security-reviewer** (dữ liệu bên thứ ba, metadata cá nhân, đường
      dẫn `file`); sửa Blocking (test trước).
- [X] T029 Test gate: `npm run lint && npm run test && npm run build` (coverage ≥ 80% phần logic mới); kiểm `out/**` không chứa
      `tests/eval/corpus`; mở PR (Closes #177) kèm bảng trước / sau.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (chặn mọi story) → US2 (cần dữ liệu) và US1 (T015–T018 song song được với US2; T019–T021 cần ít nhất PDF fixture T010 +
  câu hỏi T014) → US3 (cần T021) → Polish.
- T002 (mốc v3) phải chạy TRƯỚC T003 — trên chính branch khi `tests/eval/` + corpus còn y như `main`.
- T008 trước T010 (fixture dùng `layoutParagraph`); T010 + T011 trước T013–T014.
- `relevance-calibration.test.ts` sẽ ĐỎ từ lúc `datasetVersion` thành "4" (T014) tới T023 — làm T014 → T021 → T022 → T023 liền mạch, không
  commit lưng chừng lên PR.

## Parallel Opportunities

- T007 ‖ T015 ‖ T017 (khác tệp test).
- T025 ‖ T026.
- US1 phần thuần (T015–T018) ‖ US2 PDF fixture (T007–T010).

## Implementation Strategy

- **MVP**: Phase 1–2 + US2 (chỉ PDF fixture T007–T010 + câu hỏi của nó) + US1 ⇒ đã có số liệu PDF thật; PDF Wikipedia (T011) thêm sau trong
  cùng PR.
- Mọi hàm thuần mới: test trước (RED) → hiện thực (GREEN) → refactor; harness / eval runner là I/O (ngoài coverage như 108).
