# Intake — 177-eval-pdf

- Issue: #177 (repo `hoanghainh1188/insight-vault`) — "Thêm PDF vào bộ đánh giá truy xuất (eval:retrieval)"
- Slug: `eval-pdf`
- Ngày intake: 2026-10-10
- Loại: mở rộng **công cụ dev-only** (`tests/eval/`, `npm run eval:retrieval`). KHÔNG có UI, KHÔNG có Figma, KHÔNG có basic/detail design của khách hàng
  (`docs/01-basic-design/`, `docs/02-detail-design/` chỉ có README). Không đổi hành vi app / IPC / DB / bản cài (`tests/eval/` không được đóng gói).
  Là issue được **tách ra có chủ đích** từ 112 (clarify #13) và 147 (clarify #20): "thêm PDF vào bộ đánh giá truy xuất ⇒ issue riêng".

## Input sources

- **Brief của agent điều phối** (nội dung issue #177: bối cảnh, đề xuất phạm vi, 3 câu clarify, tiêu chí hoàn thành). **Phiên intake này KHÔNG có Bash nên không chạy được
  `gh issue view 177`; không có thân issue trong repo (grep `#177` = 0 kết quả).** 3 câu clarify của issue được lấy từ brief — **người phụ trách đối chiếu với thân issue thật
  trước `/speckit-specify`** (đặc biệt "đề xuất phạm vi" và "tiêu chí hoàn thành" của issue: intake này không bịa chúng).
- `docs/OVERVIEW.md`: không tra riêng (không có yêu cầu sản phẩm; đây là hạ tầng đo). 3 điểm bất biến liên quan: Offline & tự chủ (eval không tải mạng khi chạy — ngoại lệ có sẵn:
  tải mô hình e5/reranker vào cache lần đầu), Local-first.
- Bộ đánh giá (đã đọc): `tests/eval/README.md`, `tests/eval/corpus/README.md`, `tests/eval/corpus/manifest.json` (11 tài liệu: 8 thật + 3 nhiễu, tất cả `.md`),
  `tests/eval/questions.json` (`datasetVersion "3"`, `reviewed` = Hải 2026-10-08, 148 câu), `tests/eval/retrieval.eval.ts`, `tests/eval/lib/{dataset,harness,metrics}.ts`
  (`grid.ts`, `report.ts`, `rerank*.ts` chỉ tra tham chiếu), `vitest.eval.config.ts`, `.github/workflows/eval-retrieval.yml`, `vitest.config.ts` (coverage include `tests/eval/lib/{dataset,metrics,grid,rerank-grid}.ts`),
  `.prettierignore` (bỏ qua `corpus/` và `questions.json`), `.gitignore` (`tests/eval/.cache/`, `tests/eval/reports/`).
- Bản ghi hiệu chuẩn: `src/main/services/rag/relevance-calibration.ts` (`RELEVANCE_CALIBRATION`: `datasetVersion "3"`, số liệu dev 58+22 / hold-out 24+10 / en 22+12, `rerank` 109) và
  `tests/unit/relevance-calibration.test.ts` (dòng 28–44: canh giữ `datasetVersion` khớp `questions.json`).
- Đường nạp PDF thật của app: `src/main/services/ingestion/parsers/pdf.ts` (`parsePdf`, `LAYOUT_BUDGET_MS = 5000`, `HYPHEN_RETAIN_MAX_ITEMS`), `ingestion.ts:131–132`
  (`parseFile: kind === "pdf" → parsePdf`), `pipeline.ts` (ghi `extractionVersion: PDF_EXTRACTION_VERSION`), `src/shared/ipc/types.ts:268` (**`PDF_EXTRACTION_VERSION = 3`**),
  `size-limits.ts` (PDF ≤ 50 MB), `parsers/index.ts` (`EXT_KIND`), `pdf-layout/*` (dòng/cột/đoạn/bảng/gạch nối/`numeric.ts`).
- Fixture PDF tự sinh: `tests/fixtures/pdf/make-pdf.ts` (`makePdf`, `rotateForDisplay`), `samples.ts`, `hyphen-pairs.ts`; unit test dùng `parsePdf` + `makePdf`: `pdf-parse-layout`, `pdf-parse-perf`, `pdf-parse-hyphen-relayout`, `pdf-fixture`…
- ADR đã đọc (kế thừa — xem "Đã chốt"): `2026-10-07-relevance-calibration{,-clarify}.md` (108), `2026-10-07-pdf-layout{,-clarify}.md` (112, clarify #13 #15),
  `2026-10-09-pdf-layout-2{,-clarify}.md` (147, clarify #20 #23 #24), `2026-07-11-chunking-strategy.md` (+ ghi chú 112 về bảng). `2026-10-08-unanswerable-detection{,-clarify}.md` (109) chỉ tra qua `INDEX.md` + `RELEVANCE_CALIBRATION.rerank`
  (**chưa đọc toàn văn** — người phụ trách đọc phần "cổng" của bộ chấm trước khi chốt Ambiguity B2).
- `docs/00-glossary.md`: đã tra các dòng 137–151 (bộ đánh giá truy xuất, dev/holdout, `RELEVANCE_CALIBRATION`, `eval harness`, `TARGET_*`) — xem "Thuật ngữ mới".
- `docs/04-decisions/INDEX.md`: đã quét; không có quyết định nào về PDF trong eval ngoài hai dòng "hoãn" của 112 #13 và 147 #20 (→ issue này).
- Figma: không dùng. Design token: không có.
- **Không đọc/xác minh trong phiên này:** thân issue #177; `tests/eval/lib/{grid,report,rerank*,llm-metrics}.ts` đầy đủ; thân các ADR 109; nội dung 11 tệp corpus và 148 câu hỏi (chỉ đọc đầu `questions.json`);
  `.gitattributes` (có/không đánh dấu nhị phân); khả năng tải/giấy phép của bất kỳ PDF công khai cụ thể nào (không có truy cập mạng/Bash).

## Sự kiện cần ghi nhận (từ code hiện tại, để spec không phải đoán)

Nhóm A — cách bộ đánh giá nạp tài liệu (hiện chỉ Markdown)

1. **Harness bỏ qua parser thật.** `harness.ts:163–164`: `parseFile: async (_kind, bytes) => parseText(decode(bytes))` cho MỌI loại; `harness.ts:168–173`: `pipeline.add({ kind: "md", filePath: <id>.md })`
   cứng. Trong app: `ingestion.ts:131–132` gọi `parsePdf(bytes, onProgress)` cho `kind === "pdf"`. ⇒ PDF vào eval cần (i) `kind: "pdf"` + đường dẫn `.pdf`, (ii) `parseFile` điều phối `pdf → parsePdf` (đi qua ĐÚNG hàm app dùng —
   bài học 108/109: "không dựng đường truy xuất riêng").
2. **Dataset gắn cứng đuôi `.md`.** `dataset.ts:160–180` (`loadDataset`) đọc `corpus/<id>.md`; `EvalDocument` (`dataset.ts:14–21`) không có trường định dạng/tệp; `EvalLicense` chỉ gồm `"public-domain-vn-law" | "CC BY-SA 4.0"`.
   `manifest.json` có `revisionId` nhưng kiểu `EvalDocument` không khai báo trường này. `loadDataset` là hàm **đồng bộ**.
3. **Trích đoạn đáp án kiểm trên văn bản thô của tệp `.md`.** `dataset.ts:127–136`: mọi `quote` phải có **nguyên văn** (sau `normalizeForMatch`: NFC + gộp khoảng trắng) trong `texts.get(docId)`. Chunk "trúng" khi chứa quote (`chunkContainsAnyQuote`).
   Với PDF, "văn bản" là **kết quả trích xuất của `parsePdf`** (phụ thuộc `PDF_EXTRACTION_VERSION`), không phải tệp nguồn: dòng được nối bằng dấu cách, đoạn tách `\n\n`, bảng thành Markdown `| a | b |`, tiếng Việt giữ gạch nối liền (`hợp-đồng`, 147 #18).
4. **Nhóm chỉ số chỉ theo `lang` + `split`.** `metrics.ts:114–124` `groupOutcomes` → `dev` (vi) / `holdout` (vi) / `en`. Câu hỏi không mang thông tin "tài liệu đích là PDF hay MD" (có `docIds`, nhưng loại tài liệu chỉ suy được từ manifest — hiện chưa có trường). Không có chỉ số riêng cho PDF.
5. **Tiêu chí ĐẠT / chọn cấu hình** tính trên câu **tiếng Việt**: `TARGET_REJECTION 0.9`, `TARGET_RECALL 0.85`, `FLOOR_RECALL 0.75` (`metrics.ts:7–9`), `chooseConfig` chỉ trên dev, `confirmOnHoldout`; 109 thêm cổng bộ chấm (hold-out từ chối đúng ≥ 90%, Recall@6 ≥ 85%/sàn 75%, cận dưới Wilson vi gộp ≥ 0,75, English không tụt).
   Số liệu đã ghi (`RELEVANCE_CALIBRATION`): cấu hình 108 dev Recall@6 96,55% / hold-out 95,83%; bộ chấm 109 dev 87,93% (từ chối đúng 95,45%) / hold-out 95,83% (100%) / en 68,18% (75%).
6. **Kiểm hồi quy và canh giữ:** `retrieval.eval.ts:170–193` (`EVAL_MODE=current`): lệch > 0,001 so với bản ghi ⇒ cảnh báo "cần hiệu chuẩn lại"; `tests/unit/relevance-calibration.test.ts:42–44`: `RELEVANCE_CALIBRATION.datasetVersion` phải bằng `questions.datasetVersion`.
   README: "Đổi bộ dữ liệu ⇒ tăng `datasetVersion`, đặt `reviewed: null` và nhờ chủ dự án duyệt lại (FR-003)"; khi `reviewed = null`, chế độ sweep **không chọn** cấu hình.
7. **Kết quả eval được coi là tất định** (ADR 108: "hai lần chạy giống hệt"). **Rủi ro mới với PDF:** `parsePdf` có ngân sách thời gian đo bằng đồng hồ (`LAYOUT_BUDGET_MS = 5000`; hết ngân sách ⇒ trang còn lại dùng `legacyJoin`, và dựng lại gạch nối bị bỏ) ⇒ với PDF lớn trên máy chậm/CI, văn bản trích **có thể khác** giữa các máy (ảnh hưởng quote + so sánh số liệu).

Nhóm B — nguồn PDF

8. **Quy tắc tài liệu eval (108 clarify #1):** toàn văn trong repo, CHỈ nguồn được tái phân phối (văn bản quy phạm pháp luật VN — Luật SHTT Điều 15; Wikipedia tiếng Việt — CC BY-SA 4.0, ghi công + "thay đổi đã làm"), mỗi tệp kèm nguồn + giấy phép trong `manifest.json` + `corpus/README.md`; **chạy offline**.
   `README` eval: "Tài liệu mới: chỉ nguồn được phép tái phân phối".
9. **Phạm vi PDF của app:** chỉ PDF **có lớp chữ**; PDF thuần ảnh/quét (OCR) **ngoài phạm vi** (112, 147 #14) ⇒ PDF quét không dùng được cho eval này.
10. **Fixture tự sinh hiện có** (`make-pdf.ts`): thuần TS, tất định, **một font** Helvetica không nhúng với `/Widths` cố định 0,5 em + `/ToUnicode`; vị trí từng dòng chữ đặt **tay** (`FixtureText {x, y, size, text}`), **không** có xuống dòng tự động/phân trang;
    **tối đa 128 ký tự ngoài ASCII trong toàn tài liệu** (`make-pdf.ts:89–91` ném `"make-pdf: quá 128 ký tự ngoài ASCII"`). Tiếng Việt có ~134 chữ cái có dấu dựng sẵn (hoa + thường) chưa kể dấu câu `– — “ ” ’`, nên một bài Wikipedia tiếng Việt dài **có thể vượt giới hạn** (chưa đếm trên corpus thực).
    Mục đích gốc: kiểm thử đơn vị bố cục (112 clarify #15), không phải mô phỏng PDF thật (font nhúng subset/CID, ligature, NFD, dấu cách ngầm).
11. **Kích thước:** giới hạn nạp PDF của app 50 MB; repo hiện chỉ chứa `.md` (corpus 11 tệp). Không có ngân sách dung lượng nào ghi cho `tests/eval/corpus/` (`.prettierignore` đã loại trừ `corpus/`; chưa biết `.gitattributes`).

Nhóm C — CI và coverage

12. Workflow `eval-retrieval` **chỉ `workflow_dispatch`**, `timeout-minutes: 60`, không chặn PR, không thuộc `npm test`. Thêm PDF **không** làm eval chạy trong PR; chỉ phần thuần ở `tests/eval/lib/{dataset,metrics,grid,rerank-grid}.ts` nằm trong coverage (≥ 80% logic nghiệp vụ, Constitution IV) —
    code mới thuần (validate manifest có định dạng, nhóm chỉ số theo định dạng…) phải có unit test; `harness.ts` không tính coverage.

## Đã chốt / kế thừa — KHÔNG hỏi lại ở clarify

1. **PDF vào eval là việc tách riêng, chưa làm** (112 clarify #13: "thêm PDF vào bộ đánh giá ⇒ để sau"; 147 clarify #20: "⇒ **issue riêng**"). Issue này chính là việc đó.
2. **Chỉ nguồn được tái phân phối; toàn văn trong repo; chạy offline** (108 clarify #1) — áp cho cả PDF.
3. **Nhãn đáp án = trích đoạn nguyên văn (quote), "trúng" khi chunk chứa quote; không lệch khi đổi chunker** (108 clarify #2) — giữ cho PDF; nhãn không dựa vào số chunk/offset.
4. **Đo ở tầng truy xuất = gọi ĐÚNG `retrieve()` của app** (108 clarify #5, 109): không dựng đường truy xuất riêng; phần end-to-end LLM chỉ tham khảo.
5. **Chia dev 70% / hold-out 30% theo từng loại câu; chọn cấu hình CHỈ trên dev, xác nhận trên hold-out; tài liệu nhiễu trong cùng notebook** (108 clarify #10).
6. **Đổi bộ dữ liệu ⇒ tăng `datasetVersion`, `reviewed: null`, chủ dự án duyệt lại** (README eval, FR-003); **dừng và báo lại thay vì tự hạ mục tiêu** khi không đạt (108 quyết định #1, FR-011).
7. **Test canh giữ phiên bản** (108 clarify #11: `EMBEDDING_MODEL_VERSION`; 109: `RERANK_MODEL_VERSION`) — mẫu để cân nhắc cho `PDF_EXTRACTION_VERSION` (xem B7), chưa phải quyết định.
8. **Eval không chặn PR, không đóng gói vào bản cài; CI chỉ báo cáo bằng artifact** (108 clarify #3, 109 clarify).
9. **Bảng PDF dạng Markdown, đoạn nối bằng dấu cách, tiếng Việt giữ gạch nối liền, đầu/chân trang giữ nguyên, PDF quét ngoài phạm vi** (112 clarify #3 #7 #8, 147 clarify #14 #18) — quy ước văn bản trích mà quote của PDF phải khớp.
10. **Fixture PDF tự sinh, tất định, commit được, không vướng bản quyền** (112 clarify #15, 147 clarify #23) — đã quyết cho **kiểm thử đơn vị**; việc dùng lại cho eval chưa được quyết (Ambiguity A2).
11. **Ngôn ngữ tài liệu/thuật ngữ:** tiếng Việt; cột 日本語 trong glossary để `—`.

## Thân issue #177 (đối chiếu sau intake — điều phối viên bổ sung từ `gh issue view 177`)

- **Đề xuất phạm vi:** thêm **1–2 PDF** (bản quyền phù hợp, ưu tiên văn bản pháp luật / tài liệu công) vào `tests/eval/corpus/` + `manifest.json`, đi qua đường nạp PDF thật (`PDF_EXTRACTION_VERSION` hiện tại); thêm câu hỏi chạm vào **bảng (số căn phải)**, **từ ghép có gạch nối** ("long-term" / "hợp-đồng"), **trang khổ ngang**; tuân thủ thủ tục #108 (dev / hold-out, tăng `datasetVersion`, đo lại baseline + `TARGET_*` và guard `RELEVANCE_CALIBRATION`).
- **3 câu clarify của issue** = A1, A2, A3 bên dưới (khớp).
- **Tiêu chí hoàn thành:** `npm run eval:retrieval` có **số liệu riêng cho câu hỏi PDF**; **báo cáo trước/sau trong PR**; **không giảm Recall@6 / MRR của các tập hiện có**.
- Lệch nhỏ cần clarify chốt: issue nói 1–2 PDF, A1 của intake đề xuất 2–3.

## Prompt for /speckit-specify

Mở rộng **bộ đánh giá truy xuất** của InsightVault (`npm run eval:retrieval`, thư mục `tests/eval/`, công cụ dev-only, không đóng gói vào bản cài, không đổi hành vi của app) để **bộ tài liệu đánh giá có thêm tài liệu PDF**, nhờ đó chất lượng truy xuất được đo cả trên văn bản do **trình trích PDF thật của app** tạo ra chứ không chỉ trên Markdown thuần như hiện nay. Bối cảnh: bộ đánh giá của feature 108/109 hiện chỉ nạp 11 tài liệu `.md` (8 tài liệu thật + 3 tài liệu nhiễu; Wikipedia tiếng Việt CC BY-SA 4.0 và văn bản luật Việt Nam), `datasetVersion "3"`, 148 câu hỏi chia dev/hold-out ~70/30 (tiêu chí ĐẠT tính trên câu tiếng Việt, câu tiếng Anh chỉ tham khảo); harness (`tests/eval/lib/harness.ts`) nạp mọi tài liệu qua pipeline thật với `kind: "md"` và `parseText`, nên toàn bộ nhánh PDF (`parsePdf`: dựng dòng, cột, đoạn, bảng Markdown, bảng số căn phải, trang xoay, gạch nối — `PDF_EXTRACTION_VERSION` hiện là 3) chưa được đo bằng bộ đánh giá truy xuất. Các feature 112 và 147 đã chủ ý hoãn việc này sang một issue riêng; đây là issue đó.

Yêu cầu mong muốn (chỉ những gì tài liệu nguồn đã nêu; các chỗ còn mở được liệt kê ở phần làm rõ, KHÔNG tự chọn):

1. **Nạp PDF qua đường của app.** Harness phải nạp tài liệu PDF bằng `kind: "pdf"` và bộ phân tích PDF mà app dùng (`parsePdf`), thay vì `parseText`, rồi chia đoạn, nhúng, lập chỉ mục bằng pipeline thật như các tài liệu `.md`; câu hỏi vẫn gọi đúng `retrieve()` của app. Việc nạp phải chạy hoàn toàn offline (không tải gì khi chạy ngoài việc đã có là cache mô hình e5/bộ chấm ở lần chạy đầu), tất định giữa các lần chạy, và không đọc/ghi dữ liệu người dùng.
2. **Dữ liệu.** Manifest tài liệu cho phép khai báo định dạng/tệp của từng tài liệu (không còn cứng `.md`), vẫn ghi nguồn, giấy phép, ngày lấy, và cho phép giấy phép phù hợp với tài liệu PDF được chọn; trình kiểm tra dữ liệu (`lib/dataset.ts`) vẫn bắt buộc mọi trích đoạn đáp án (`quotes`, ≤ 200 ký tự) có nguyên văn trong **văn bản mà tài liệu đó thực sự cho ra khi được nạp**, kể cả với PDF (văn bản trích xuất, theo quy ước đã chốt ở 112/147: đoạn nối bằng dấu cách, bảng Markdown, tiếng Việt giữ gạch nối). Câu hỏi PDF có đáp án (`answerable`) và câu không có đáp án (`unanswerable`) tuân quy tắc hiện hành của bộ đánh giá (kiểm chắc tài liệu không chứa đáp án), chia dev/hold-out theo cách chốt ở phần làm rõ, tăng `datasetVersion`, đặt `reviewed: null` và nhờ chủ dự án duyệt lại trước khi dùng để chọn cấu hình.
3. **Báo cáo.** Báo cáo (`report.md`/`report.json`) ghi rõ phiên bản trích xuất PDF đã dùng và cho thấy kết quả của nhóm câu hỏi trỏ vào tài liệu PDF; cách tính, ngưỡng và có đưa vào tiêu chí ĐẠT/cổng 108–109 hay chỉ tham khảo thì chốt ở phần làm rõ.
4. **Hiệu chuẩn hiện có không được âm thầm lệch.** Thay đổi bộ dữ liệu làm đổi con số nền (baseline) và bản ghi `RELEVANCE_CALIBRATION` (số liệu dev/hold-out/en, bộ chấm 109, `datasetVersion`); test canh giữ `relevance-calibration.test.ts` phải tiếp tục đúng, số liệu đo lại và ghi lại, và nếu cấu hình hiện hành không còn đạt thì dừng và báo lại (theo FR-011), không tự hạ mục tiêu hay tự đổi cấu hình trong issue này.
5. **Tài liệu và nguồn gốc.** Cập nhật `tests/eval/README.md`, `tests/eval/corpus/README.md` (nguồn, giấy phép, ghi công + "thay đổi đã làm" nếu có, cách tái tạo/xác minh tệp), ghi ADR mới + dòng `INDEX.md` (đánh dấu hoàn thành mục "PDF vào eval" của 112 #13 và 147 #20) và thuật ngữ mới vào glossary; kích thước thêm vào repo nhỏ và có ngân sách rõ ràng.

Tiêu chí hoàn thành (issue #177): `npm run eval:retrieval` có số liệu riêng cho câu hỏi PDF; PR kèm báo cáo trước/sau; Recall@6 / MRR của các tập hiện có không giảm.

Ràng buộc: không đổi `parsePdf`, `PDF_EXTRACTION_VERSION`, chunker, `retrieve()`, rerank hay bất kỳ mã chạy của app; không thêm egress; không thêm dependency; không đóng gói tài liệu eval vào bản cài (`out/**` mới được đóng gói); CI `eval-retrieval` vẫn chỉ chạy bấm tay và không chặn PR; mã thuần mới nằm trong `tests/eval/lib/` phải có unit test (test-first, coverage ≥ 80% phần logic) và `npm test` hiện có tiếp tục xanh.

Các câu cần `/speckit-clarify` chốt trước khi lập kế hoạch: nguồn/giấy phép/kích thước PDF; PDF thật hay sinh từ fixture; câu PDF vào dev, hold-out hay cả hai; nguồn chân lý của quote PDF; chỉ số và cổng riêng cho PDF; xử lý baseline/`RELEVANCE_CALIBRATION`; tính tất định (ngân sách thời gian bố cục); có canh giữ theo `PDF_EXTRACTION_VERSION` không; CI.

## Ambiguities to raise in /speckit-clarify

Đã loại (đã có quyết định ở "Đã chốt / kế thừa"): có làm PDF eval hay không (đã tách thành issue này); chỉ nguồn tái phân phối + offline; nhãn bằng quote; đo bằng `retrieve()` thật; dev/hold-out 70/30; tăng `datasetVersion` + duyệt lại; CI bấm tay không chặn PR; PDF quét/OCR ngoài phạm vi; quy ước văn bản trích PDF.

### 3 câu của issue #177 (từ brief — đối chiếu với thân issue)

**A1. Chọn PDF nào — nguồn / giấy phép / kích thước repo?**
Dữ kiện: 108 #1 (chỉ tái phân phối được; kèm nguồn + giấy phép); `EvalLicense` hiện 2 giá trị; app giới hạn PDF 50 MB nhưng repo chưa có ngân sách cho corpus; PDF phải **có lớp chữ**. Cần chốt: số PDF (vd 1–3), số trang/dung lượng mỗi tệp và tổng (ngân sách repo, vd ≤ 1–2 MB tổng — con số này là ĐỀ XUẤT của intake, không có trong tài liệu gốc), `.gitattributes` đánh dấu nhị phân, có Git LFS không (đề xuất: không), ghi `sha256` + nguồn + giấy phép trong manifest.
**Đề xuất:** 2–3 PDF nhỏ (≤ ~200 KB mỗi tệp, tổng ≤ ~1 MB), có `sha256` trong manifest, không LFS.

**A2. PDF thật hay sinh từ `tests/fixtures/pdf/make-pdf.ts`?**
Dữ kiện: fixture sinh được tất định, miễn bản quyền, commit nhỏ, kiểm soát được bố cục (bảng, xoay, gạch nối) — nhưng chỉ có **một font Helvetica không nhúng, độ rộng ký tự cố định, không xuống dòng/phân trang tự động, tối đa 128 ký tự ngoài ASCII** (sự kiện 10) và không phản ánh lỗi trích của PDF thật (font nhúng subset/CID, ligature, NFD, dấu cách ngầm, nhiều cột thật, đầu/chân trang). PDF thật phản ánh đúng người dùng nhưng khó tìm nguồn đủ điều kiện (A4) và phụ thuộc nhà sản xuất PDF.
Phương án: (i) chỉ sinh từ fixture (mở rộng generator: xuống dòng, phân trang, đếm ký tự); (ii) chỉ PDF thật; (iii) **lai**: 1 PDF sinh (kiểm soát bảng/xoay/gạch nối) + 1–2 PDF thật (tiếng Việt thật); (iv) dựng PDF bằng trình in của trình duyệt headless từ chính HTML/Markdown corpus đã có (font nhúng thật; nội dung kế thừa giấy phép CC BY-SA; tệp commit một lần, không cần tất định khi tái tạo — chỉ tệp nhị phân là chuẩn).
**Đề xuất:** (iii), nhưng quyết định thuộc chủ dự án.

**A3. Câu hỏi PDF vào dev, hold-out hay cả hai?**
Dữ kiện: quy tắc chia ~70/30 **trong từng loại** (README); chọn cấu hình chỉ trên dev, hold-out xác nhận; hiện hold-out vi chỉ có 24 câu có đáp án + 10 không đáp án (khoảng tin cậy Wilson đã rộng). Nếu PDF chỉ có ~10–20 câu, phần hold-out PDF chỉ ~3–6 câu ⇒ số liệu riêng cho PDF gần như không có ý nghĩa thống kê. Phương án: (i) cả hai theo 70/30; (ii) toàn bộ vào hold-out (không dùng chọn cấu hình, chỉ kiểm tra chéo — nhưng hold-out hiện được dùng trong cổng 109); (iii) toàn bộ vào dev. Phụ: PDF `unanswerable` (câu sát chủ đề PDF nhưng không có đáp án trong mọi tài liệu); số câu mục tiêu.

### Mơ hồ / mâu thuẫn phát hiện thêm — đánh dấu **[PHÁT HIỆN THÊM]**

**A4 [PHÁT HIỆN THÊM] Nguồn PDF tiếng Việt công khai đủ điều kiện — chưa xác minh được ứng viên cụ thể.** Phiên intake không có truy cập mạng/Bash nên **không khẳng định** tệp nào đủ điều kiện. Các nhóm ứng viên, theo tiêu chí 108 #1 + "có lớp chữ" (112): (1) bản PDF/văn bản số của văn bản quy phạm pháp luật Việt Nam (Luật SHTT Điều 15 — không phải đối tượng quyền tác giả) — nhiều bản đăng công báo/cổng chính phủ là **ảnh quét** (không dùng được); cần bản có lớp chữ; (2) PDF xuất từ chính bài Wikipedia tiếng Việt đã có trong corpus (CC BY-SA 4.0; `revisionId` đã ghi) — phải ghi công + "thay đổi đã làm"; (3) tài liệu công khai khác có giấy phép tự do (CC0/CC BY/CC BY-SA/phạm vi công cộng) — cần xác minh từng tệp. Cần: người phụ trách xác minh giấy phép + lớp chữ + dung lượng của từng tệp cụ thể trước khi plan; kiểm metadata PDF (Author/Producer/đường dẫn máy) không chứa thông tin cá nhân.

**A5 [PHÁT HIỆN THÊM] PDF cần có những đặc trưng nào để việc đo có ý nghĩa?** Mục đích của việc thêm PDF là đo tác động của trích xuất PDF lên truy xuất. Cần chốt tập đặc trưng tối thiểu cho bộ PDF: (a) **bảng** (112: Markdown; 147: bảng số căn phải/thập phân) — câu hỏi có đáp án nằm trong ô bảng, quote dạng `| ô | ô |`; (b) **trang xoay/ngang** (147 c, `/Rotate`); (c) **gạch nối cuối dòng** (147 a: tiếng Việt giữ `hợp-đồng`; nhiều quote có thể nằm đúng chỗ ngắt dòng); (d) **nhiều cột**; (e) chunk **không vắt trang** và **không cắt bảng ngắn** (câu trả lời nằm sát ranh giới trang); (f) đầu/chân trang giữ nguyên (nhiễu truy xuất). Câu hỏi: bắt buộc đủ (a)–(f) hay chỉ một số? Một PDF chung hay mỗi đặc trưng một PDF nhỏ? Có câu hỏi "bẫy" cố ý cho từng đặc trưng không?

**A6 [PHÁT HIỆN THÊM] PDF "song sinh" của tài liệu `.md` đã có, hay tài liệu mới?** Nếu PDF mang **cùng nội dung** với một `.md` đã có trong notebook eval (vd cùng bài Wikipedia), mọi đoạn đáp án xuất hiện **hai lần** (khác `content_hash` nên không bị dedup) ⇒ nhiễu top-k/MMR, làm lệch Recall của câu hỏi hiện có. Nếu không song sinh, mất khả năng đối chứng A/B (md vs pdf cùng nội dung). Phương án: (i) tài liệu mới, không trùng nội dung; (ii) song sinh nhưng **thay thế** bản `.md` tương ứng (đổi baseline); (iii) song sinh trong **notebook/chỉ mục eval thứ hai** (đòi sửa `buildIndex`/`warmUp`/báo cáo — phạm vi lớn hơn); (iv) song sinh với quote chỉ gán `docIds` tới bản PDF và coi bản `.md` song sinh là nhiễu (hiện validate cấm `docIds` trỏ tài liệu nhiễu _và_ câu hỏi hiện có trỏ bản `.md`).

**A7 [PHÁT HIỆN THÊM] Nguồn chân lý của `quotes` cho PDF và độ gắn kết với `PDF_EXTRACTION_VERSION`.** `loadDataset` đọc `.md` đồng bộ (sự kiện 2–3); với PDF, văn bản để kiểm quote chỉ có sau khi chạy `parsePdf` (bất đồng bộ). Phương án: (i) `loadDataset`/validate chạy `parsePdf` thật (đổi chữ ký sang async; chạy được trong `npm test` vì không cần mô hình e5 — kiểm quote sớm); (ii) lưu **bản chụp văn bản trích kỳ vọng** (`<id>.expected.md`, sinh bằng script, không sửa tay) cạnh PDF rồi kiểm quote trên bản chụp — nhưng bản chụp có thể lệch khỏi `parsePdf` thật nếu quên cập nhật; (iii) với PDF sinh từ fixture, dùng chính văn bản đầu vào của fixture (kèm kiểm bằng `parsePdf` trong unit test). Hệ quả cần chốt: khi `PDF_EXTRACTION_VERSION` tăng hoặc `pdf-layout` đổi, quote trên PDF có thể ngừng khớp ⇒ eval `fail` ngay ở bước kiểm dữ liệu (tốt: bắt hồi quy trích xuất; xấu: coupling) — chấp nhận như một tín hiệu mong muốn hay tách "lỗi dữ liệu" khỏi "trích xuất đổi"? Tiếng Việt: quote phải theo dạng **giữ gạch nối** (`hợp-đồng`), không phải dạng nối dính cũ.

**A8 [PHÁT HIỆN THÊM] Chỉ số báo cáo riêng cho PDF và vai trò trong cổng ĐẠT.** `groupOutcomes` chỉ có dev/holdout/en. Cần: thêm nhóm theo **định dạng tài liệu đích** (suy từ manifest qua `docIds`) — Recall@1/3/6, MRR, (câu không đáp án thuộc nhóm nào?), khoảng tin cậy Wilson; hiển thị trong `report.md`/`report.json` (đổi cấu trúc báo cáo → kiểm tương thích `EvalReport`). Câu hỏi: nhóm PDF **tham khảo** (như `en`) hay **vào cổng** (`TARGET_RECALL`, cổng hold-out 109)? Với cỡ mẫu nhỏ (A3), đề xuất của intake: **tham khảo + hiển thị khoảng tin cậy**, chỉ cảnh báo khi Recall@6 PDF thấp hơn nhóm `.md` quá một ngưỡng (ngưỡng do clarify chốt) — đây là đề xuất, không phải quyết định.

**A9 [PHÁT HIỆN THÊM] Ảnh hưởng tới baseline, `TARGET_*`, `RELEVANCE_CALIBRATION` và cổng 109.** Thêm câu hỏi/tài liệu làm đổi mọi con số đã ghi: `datasetVersion "3"` → mới (test canh giữ `relevance-calibration.test.ts:42–44` fail cho tới khi cập nhật), số liệu `metrics.dev/holdout` (hiện 58+22 / 24+10) và `rerank.metrics.{dev,holdout,en}`, `latency`. Cần chốt: (i) sau khi thêm PDF, **đo lại** cấu hình 108 và bộ chấm 109 trên bộ mới và **ghi lại** `RELEVANCE_CALIBRATION` (cập nhật số liệu + `datasetVersion` + `calibratedAt`) trong cùng PR hay PR riêng (blast radius: file nằm trong `src/main`); (ii) nếu bộ chấm/cấu hình 108 **không còn đạt** cổng khi có PDF (chẳng hạn trích PDF làm Recall tụt hoặc câu không đáp án sát chủ đề PDF lọt) ⇒ làm gì: theo 108 FR-011 là **dừng và báo lại** (đề xuất giữ), tách issue chỉnh cấu hình/ trích PDF; (iii) `TARGET_REJECTION/RECALL/FLOOR_RECALL` giữ nguyên (đề xuất); (iv) bộ dữ liệu mới `reviewed: null` ⇒ sweep không chọn cấu hình — ai duyệt và khi nào (chủ dự án); (v) so trước/sau (112 #13): giữ lại số liệu v3 trong ADR như mốc.

**A10 [PHÁT HIỆN THÊM] Có cần canh giữ theo `PDF_EXTRACTION_VERSION` (giống `EMBEDDING_MODEL_VERSION`/`RERANK_MODEL_VERSION`) và ghi vào báo cáo?** Hiện `RELEVANCE_CALIBRATION` chỉ canh phiên bản embedding + rerank; số liệu PDF sẽ trôi khi trích xuất đổi (147 vừa tăng 2→3). Phương án: (i) chỉ ghi `PDF_EXTRACTION_VERSION` vào `report.json` (không canh giữ); (ii) thêm trường `pdfExtractionVersion` vào `RELEVANCE_CALIBRATION` + test fail khi lệch (đổi cấu trúc bản ghi → đụng `src/main`); (iii) không làm gì. Đề xuất: (i) tối thiểu; (ii) nếu A8 cho PDF vào cổng.

**A11 [PHÁT HIỆN THÊM] Tất định và ngân sách thời gian của `parsePdf`.** `LAYOUT_BUDGET_MS = 5000` + ngân sách dựng lại gạch nối (sự kiện 7): PDF nhỏ (đề xuất ở A1) hầu như không chạm ngân sách, nhưng trên máy chậm/CI một PDF lớn có thể rơi về `legacyJoin` ⇒ văn bản khác ⇒ quote không khớp/số liệu khác. Phương án: (i) giữ PDF đủ nhỏ để không bao giờ chạm ngân sách (kèm test/kiểm tra thời gian trích trong eval, cảnh báo khi hết ngân sách — cần `parsePdf` lộ tín hiệu, hiện KHÔNG lộ; chỉ phát hiện gián tiếp); (ii) harness truyền `opts.layoutBudgetMs` rất lớn (khác mặc định production: eval không còn đi đúng 100% cấu hình app, nhưng ổn định); (iii) chấp nhận. Chốt kèm: có kiểm "hai lần chạy giống hệt" cho PDF (unit test trích hai lần, so văn bản) không.

**A12 [PHÁT HIỆN THÊM] CI và kiểm tự động nhẹ trong `npm test`.** Eval chỉ chạy bấm tay (đã chốt). Câu hỏi mới: có thêm một **unit test nhanh, không cần mô hình e5** (chạy `parsePdf` trên PDF của eval, kiểm mọi quote PDF có nguyên văn trong văn bản trích) vào `npm test` để hồi quy trích xuất (147-kiểu) bắt lỗi _trước khi_ ai chạy eval không? (Lợi: bắt sớm; chi phí: thêm thời gian test, coupling với A7.) Có đặt giới hạn thời gian/độ lớn tệp PDF trong test không? `eval-retrieval.yml` có cần chỉnh (timeout 60 phút, cache) — không dự kiến.

**A13 [PHÁT HIỆN THÊM] Nếu sinh từ fixture: giới hạn của `make-pdf.ts`.** (1) 128 ký tự ngoài ASCII (sự kiện 10) — cần đếm trên văn bản dự kiến, hoặc mở rộng generator (nhiều bảng mã/font) — chạm `tests/fixtures/pdf/make-pdf.ts` dùng chung với ≥ 9 test ⇒ rủi ro phá test cũ (đề xuất: chỉ thêm, không đổi hành vi hiện có); (2) cần bộ dàn trang (xuống dòng theo `CHAR_WIDTH`, phân trang) vì `FixtureText` đặt tay; (3) NFC vs NFD; (4) nội dung fixture lấy từ đâu (đoạn Wikipedia CC BY-SA ⇒ kế thừa giấy phép) hay văn bản tự viết (miễn giấy phép, mất tính "thật"); (5) tệp PDF được commit hay sinh lúc chạy (đề xuất: **commit tệp** + test xác nhận trích đúng; sinh lúc chạy làm eval phụ thuộc generator).

**A14 [PHÁT HIỆN THÊM] Có đo thêm "trang trích dẫn đúng" (locator.page) không?** Nhãn hiện chỉ dựa vào chunk chứa quote (108 #2). Với PDF, giá trị riêng là chip `[n]` trỏ đúng **trang** (Constitution II, chunk không vắt trang). Mở rộng tuỳ chọn: câu PDF mang `expectedPage` và báo cáo "trang đúng" (đòi đổi `EvalQuestion`, `QuestionOutcome`, metrics, báo cáo). Nằm trong hay ngoài phạm vi issue này? (Đề xuất: ngoài — để issue sau; chỉ ghi nhận.)

**A15 [PHÁT HIỆN THÊM] Giấy phép/nguồn gốc dữ liệu & `EvalLicense`.** Kiểu `EvalLicense` và `validateManifest` chỉ cho 2 giá trị; thêm loại giấy phép mới (hoặc PDF tạo từ nội dung CC BY-SA ⇒ vẫn "CC BY-SA 4.0" + ghi công + "thay đổi đã làm: chuyển sang PDF") cần cập nhật kiểu + test + `corpus/README.md` (bảng nguồn/giấy phép, mục "Ghi công"). Manifest cần thêm: định dạng/tệp, `sha256`, cách tái tạo (nếu dựng bằng công cụ). `corpus/README.md` hiện nói "Không sửa tay nội dung tài liệu" — với tệp nhị phân phát biểu thay bằng "không thay tệp mà không tăng `datasetVersion`". Kiểm metadata PDF không chứa dữ liệu cá nhân.

**A16 [PHÁT HIỆN THÊM] Tài liệu nhiễu dạng PDF, hằng số `MIN_CORPUS_DOCS`/`MIN_NOISE_DOCS`.** Hiện tối thiểu 8 tài liệu thật + 2 nhiễu; PDF có tính vào "thật" không; có cần ít nhất một PDF **nhiễu** (để mô phỏng notebook lẫn định dạng, chunk PDF cạnh tranh top-k)? Đổi hằng số hay giữ.

**A17 [PHÁT HIỆN THÊM] Câu tiếng Anh/PDF.** Câu English hiện chỉ tham khảo (nhóm `en`). Nếu PDF có nội dung song ngữ hay câu hỏi English về PDF, nó thuộc nhóm `en` hay nhóm PDF? (Đề xuất: PDF đều tiếng Việt, không thêm câu English cho PDF; xác nhận.)

**A18 [PHÁT HIỆN THÊM] Phạm vi tài liệu/ADR.** (1) ADR mới `docs/04-decisions/2026-10-<ngày>-eval-pdf*.md` + dòng `INDEX.md` ghi rõ **bổ sung/hoàn thành** 112 #13 và 147 #20 (không sửa file ADR cũ); (2) cập nhật `tests/eval/README.md` ("Cách hoạt động" bước 2, "Thêm câu hỏi / tài liệu" cho PDF); (3) dòng glossary 137/148 nay lỗi thời ("tài liệu `.md`", "`datasetVersion` hiện là 3") — **SỬA term cũ ⇒ PR riêng được steward duyệt** (rule 5), khác với THÊM term mới.

## Thuật ngữ mới (append vào glossary)

Đề xuất append (rule 5: THÊM được làm ngay trong branch feature); tên chính thức chờ clarify A1–A8. Cột 日本語 để `—`.

| 日本語 | Tiếng Việt (đề xuất)                            | English (đề xuất, dùng trong code)            | Ghi chú                                                                                            |
| ------ | ----------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| —      | Tài liệu PDF của bộ đánh giá                    | eval PDF document (manifest: định dạng `pdf`) | PDF có lớp chữ, được nạp qua `parsePdf` của app; quote đáp án kiểm trên văn bản trích xuất — 177   |
| —      | Định dạng tài liệu đích (nhóm chỉ số theo PDF)  | eval document format / PDF metrics group      | Nhóm câu hỏi trỏ vào tài liệu PDF; báo cáo riêng, vai trò (tham khảo/cổng) chốt ở clarify A8 — 177 |
| —      | Bản chụp văn bản trích kỳ vọng (nếu chọn A7-ii) | expected extraction snapshot                  | Chỉ nếu clarify chọn phương án lưu bản chụp; sinh bằng script, không sửa tay — 177                 |

Không đổi tên term đã có: `eval dataset`, `dev / holdout`, `relevance calibration`, `eval harness`, `PDF_EXTRACTION_VERSION`.

## Đối chiếu constitution

(Nội dung constitution không đọc trực tiếp trong phiên này; đối chiếu theo các nguyên tắc I–V mà các intake trước trích dẫn — người phụ trách kiểm lại.)

- **I (Local-first / offline):** eval không thêm egress; PDF commit trong repo, không tải khi chạy; tải mô hình lần đầu là ngoại lệ đã có (108). Cân nhắc tệp PDF tải từ nguồn công khai chỉ ở bước **chuẩn bị dữ liệu thủ công**, không ở bước chạy.
- **II (Kiểm chứng được):** eval giúp đo chất lượng bước chọn đoạn để câu trả lời có `[n]` đúng nguồn; PDF mở rộng độ phủ cho định dạng chính. Trang trích dẫn (A14) là mở rộng tuỳ chọn.
- **III (Biên bảo mật):** không đổi app/IPC; kiểm metadata PDF (thông tin cá nhân) và giấy phép trước khi commit.
- **IV (Test-first):** mã thuần mới ở `tests/eval/lib/` (validate manifest có định dạng, nhóm chỉ số theo định dạng, kiểm quote PDF…) viết test trước; coverage ≥ 80% logic; `harness.ts` ngoài coverage nhưng phải chạy tay xác nhận (hai lần chạy giống hệt).
- **V (Phased Delivery):** hạ tầng đo, không thêm tính năng người dùng.
- **Additional constraints:** i18n không liên quan (dev-only; thông điệp bằng tiếng Việt như eval hiện hành); source-of-truth: không có prototype/Figma; không thêm dependency; không migration; ADR bắt buộc (A18).

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa đổi constitution qua PR riêng được steward duyệt, rule 5). Chỉ ghi nhận để cân nhắc về sau, không bắt buộc ở #177: một dòng ở "Additional Constraints" rằng "**mọi định dạng nguồn mà app nạp (md/txt/pdf/docx/url…) MUST có ít nhất một tài liệu đại diện trong bộ đánh giá truy xuất, nạp qua đúng parser của app**" — để khoảng trống kiểu "eval chỉ đo Markdown" (112/147 đã hoãn) không lặp lại cho `docx`/`url`. Hiện bộ đánh giá còn thiếu docx/url/audio/image — nằm ngoài issue này.
