# Intake — 108-relevance-calibration

- Issue: #108
- Slug: `relevance-calibration`
- Ngày intake: 2026-10-07
- Loại: cải tiến chất lượng nội bộ (KHÔNG phải loại nguồn mới, KHÔNG có Figma, KHÔNG có basic/detail design
  của khách hàng — `docs/01-basic-design/` và `docs/02-detail-design/` chỉ có README). Hiệu chuẩn (calibrate)
  **ngưỡng liên quan + cổng lọc BM25** của retrieval RAG (013 → 055 → 059) bằng dữ liệu đo thật, kèm bộ
  **eval dataset + harness** để đo và chống hồi quy về sau.

## Input sources

- **GitHub issue #108** — brief chính, gồm 2 QUYẾT ĐỊNH NGƯỜI DÙNG đã chốt ngày 2026-10-07 (xem mục "Đã chốt").
  Lưu ý trung thực: phiên intake này KHÔNG chạy được `gh issue view 108` (Bash bị tắt trong subagent); nội dung
  issue lấy từ bản tóm tắt agent điều phối cung cấp trong yêu cầu. **Khuyến nghị:** người phụ trách đối chiếu lại
  với thân issue thật trước `/speckit-specify` (đặc biệt các con số 80/20, ≥90%, ≥85%).
- `docs/OVERVIEW.md` — 3 điểm bất biến (Local-first, Kiểm chứng được, Offline & tự chủ); "không bịa" là
  cam kết lõi của chế độ theo nguồn.
- `.specify/memory/constitution.md` (v1.0.0) — Principle I (local-first; harness dev-only không được kéo egress
  vào bản đóng gói), II (Verifiable Citations — "không có căn cứ ⇒ MUST báo không tìm thấy, không được bịa"),
  III (main process; không log nội dung tài liệu), IV (test-first, coverage ≥80% business logic), V (phased).
- `docs/04-decisions/INDEX.md` + các ADR liên quan (đã đọc):
  - `2026-07-11-rag-retrieval-strategy.md` (013) — **mục 1 ghi `RELEVANCE_MAX_DISTANCE = 0.75`: ĐÃ LỖI THỜI**
    (thực tế code = 0.5, xem "Sự kiện"). Cũng chốt: cosine distance, top-k=6, hậu kiểm citation, "0 hit ⇒ không
    tìm thấy", "không bịa" dựa thêm grounded prompt + ép `notFound`.
  - `2026-07-13-rag-enhance-clarify.md` (055) — hybrid vector + BM25 (FTS5) → RRF (k=60) → MMR (λ≈0.7);
    giữ ngưỡng 013 ở nhánh vector; clarify C1 (rewrite **chỉ khi có history**), C4 (FTS5 own-storage, fold
    tiếng Việt ở JS), fallback FTS lỗi ⇒ vector-only.
  - `2026-07-13-embed-in-process-clarify.md` (059) — e5-small in-process 384d, "khoảng cách cosine hẹp ⇒ **phải
    chỉnh lại** `RELEVANCE_MAX_DISTANCE`" (ADR không ghi con số mới; số 0.5 chỉ nằm trong comment code).
  - `2026-10-07-online-fallback-clarify.md` (098) — bản `local` của RagService chạy MỌI lệnh LLM bằng Ollama; cần
    nhớ khi eval có bước LLM.
  - `2026-07-11-sqlite-migrations.md` — chỉ liên quan nếu calibration cần đổi schema (hiện KHÔNG dự kiến).
- `docs/00-glossary.md` — đã tra: có `retrieval`, `top-k retrieval`, `hybrid search`, `BM25`, `FTS5`, `RRF`, `MMR`,
  `notFound`, `grounded mode`, `embedding model version`, `reindex`, `e5 prefix`, `content search`. **Chưa có**
  các thuật ngữ eval/calibration (xem mục thuật ngữ mới).
- Code hiện có (chỉ để mô tả điểm tích hợp, KHÔNG phải thiết kế mới):
  - `src/main/services/rag/constants.ts` — `RETRIEVAL_TOP_K=6`, `RELEVANCE_MAX_DISTANCE=0.5` (comment: "ngưỡng
    THÔ… cần tinh chỉnh thêm bằng dữ liệu thật (calibration, research R5)"), `HYBRID_BRANCH_TOPK=10`,
    `RRF_K=60`, `MMR_LAMBDA=0.7`, `NOT_FOUND_ANSWER`.
  - `src/main/services/rag/retrieval.ts` — `retrieve()`: (rewrite nếu có history) → embed → `search` top-10 →
    **chỉ lọc nhánh vector** theo `h.score <= RELEVANCE_MAX_DISTANCE` → `searchBm25` top-10 **không lọc** →
    RRF → MMR chọn ≤6 → `ScoredChunk`. Chunk BM25-only nhận `score = RELEVANCE_MAX_DISTANCE` (giá trị giả).
  - `src/main/services/rag/fusion.ts` — `reciprocalRankFusion`, `mmrSelect` (thuần).
  - `src/main/services/rag/rag-service.ts` — `compute()`: `scored.length===0` & grounded ⇒ `NOT_FOUND_ANSWER`
    (không gọi LLM); ngược lại LLM + `postprocessCitations`; nếu câu trả lời không có `[n]` hợp lệ và không chứa
    "không tìm thấy" ⇒ **gắn toàn bộ chunk trong context làm citation** (`citationsFromMap`) — xem ambiguity #5.
  - `src/main/services/rag/prompt.ts` — grounded prompt yêu cầu trả đúng một câu "Không tìm thấy trong nguồn."
    khi các đoạn không chứa câu trả lời.
  - `src/main/services/ingestion/keyword-store.ts` + `fts-fold.ts` — `searchBm25` trả `bm25()` (nhỏ = liên quan
    hơn); `buildFtsMatch` nối **mọi token bằng OR** (lenient, không bỏ stopword) ⇒ hầu như câu hỏi nào cũng
    khớp ≥1 chunk.
  - `src/main/index.ts` (≈dòng 341–398, 423–428) — `searchBm25` được dùng bởi **cả RagService (chat) lẫn
    content-search (073)**; Studio (`createStudioService`) KHÔNG dùng `retrieve` (gom all-chunks/round-robin/
    map-reduce).
  - `src/main/services/embedding/*` — embedder e5-small in-process, `withE5Prefix`, `EMBEDDING_MODEL_VERSION`.
  - `tests/unit/retrieval.test.ts`, `tests/unit/retrieval-hybrid.test.ts` — unit test hiện có dùng DI mock
    (không có LanceDB/FTS/e5 thật).
  - `package.json` scripts hiện có: `build`, `lint`, `test` (`vitest run --coverage`), `test:watch` — **chưa
    có** script `eval:*`.
- Figma: không dùng. Design token: không đổi.

## Sự kiện cần ghi nhận (từ issue + code, để spec không phải đoán)

1. **Khoảng cách e5 bị nén hẹp:** theo comment 059 (VERIFY lúc đó) đoạn liên quan ≈ 0.14, khác chủ đề ≈ 0.20
   ⇒ ngưỡng 0.5 gần như không lọc gì (cả hai đều ≪ 0.5). Đây là số liệu thăm dò nhỏ lẻ, **chưa có phân bố
   thật** — harness (A) phải đo (histogram) rồi mới kết luận.
2. **Ngưỡng chỉ áp cho nhánh vector; hit BM25 luôn được giữ** (và BM25 dùng OR trên mọi token) ⇒ `retrieve()`
   gần như không bao giờ trả `[]` ⇒ nhánh "Không tìm thấy trong nguồn" ở tầng retrieval hiếm khi kích hoạt;
   việc từ chối phụ thuộc gần hết vào LLM tuân thủ prompt.
3. **ADR/code drift:** ADR 013 nói 0.75, code là 0.5 (đổi ở 059, comment trong code, KHÔNG có ADR ghi con số).
   Cần ADR mới thay thế phát biểu 0.75 (theo tiền lệ `2026-07-15-studio-balanced-context` "supersede §1").
4. **Không có eval harness** nào: mọi ngưỡng hiện tại là ước lượng tay.

## Đã chốt (USER DECISIONS 2026-10-07) — KHÔNG hỏi lại ở clarify

1. **Eval dataset tự soạn từ tài liệu CÔNG KHAI tiếng Việt:** ~8–12 tài liệu, ~80 câu hỏi CÓ đáp án (gắn nhãn
   chunk đáp án) + ~20 câu KHÔNG có đáp án (unanswerable); **commit vào repo**; **người dùng review bộ câu hỏi
   trước khi dùng**.
2. **Ưu tiên đánh đổi = "KHÔNG BỊA trước":** từ chối đúng câu unanswerable (trả "Không tìm thấy trong nguồn")
   **≥ 90%**, trong khi **Recall@6 ≥ 85%** cho câu có đáp án.

## Prompt for /speckit-specify

Hiệu chuẩn (calibrate) bộ lọc độ liên quan của truy xuất (retrieval) trong tính năng hỏi đáp có trích dẫn
(013-rag-qa, nâng ở 055-rag-enhance và 059-embed-in-process) của InsightVault, để chế độ theo nguồn
(`grounded mode`) báo "Không tìm thấy trong nguồn" đúng khi tài liệu không có câu trả lời, mà không làm mất các
đoạn liên quan thật. KHÔNG thêm loại nguồn mới, KHÔNG đổi model embedding, KHÔNG đổi provider online, KHÔNG đổi
UI (trừ khi trải nghiệm "không tìm thấy" cần chỉnh câu chữ — nếu có thì chỉ ở mức copy).

**Vấn đề hiện tại (đã quan sát):**

- Sau 059, embedding chạy in-process bằng `Xenova/multilingual-e5-small` (384 chiều, vector chuẩn hoá L2). Khoảng
  cách cosine của e5 bị **nén hẹp**: đoạn liên quan khoảng 0.14, đoạn khác chủ đề khoảng 0.20. Ngưỡng
  `RELEVANCE_MAX_DISTANCE = 0.5` vì vậy gần như không loại được gì.
- Trong `retrieve()`, ngưỡng này **chỉ áp cho nhánh vector**; các hit từ nhánh từ khoá (BM25 qua SQLite FTS5)
  **luôn được giữ**, và truy vấn BM25 nối mọi token bằng OR nên gần như luôn có kết quả. Hệ quả: danh sách chunk
  trả về hầu như không bao giờ rỗng, nên nhánh "Không tìm thấy trong nguồn" ở tầng truy xuất rất hiếm khi được
  kích hoạt và việc từ chối phụ thuộc gần hết vào việc LLM tự tuân thủ prompt.
- ADR 013 (`2026-07-11-rag-retrieval-strategy.md`) vẫn ghi `RELEVANCE_MAX_DISTANCE = 0.75` trong khi code là 0.5
  (ADR và code lệch nhau), và chưa có bất kỳ cơ chế đo nào để biết ngưỡng đúng là bao nhiêu.

**Phạm vi — gồm 3 phần:**

**(A) Bộ dữ liệu đánh giá (eval dataset) + harness đo.**

- Bộ dữ liệu tự soạn từ tài liệu **công khai** tiếng Việt: khoảng 8–12 tài liệu, khoảng 80 câu hỏi **có đáp án**
  (mỗi câu gắn nhãn các đoạn `chunk` chứa đáp án) và khoảng 20 câu hỏi **không có đáp án** (unanswerable). Được
  commit vào repo. Người dùng review bộ câu hỏi trước khi bộ dữ liệu được dùng để hiệu chuẩn.
- Một harness chỉ dành cho phát triển (dev-only), chạy bằng lệnh `npm run eval:retrieval`, **không đóng gói**
  vào bản cài. Harness dùng **embedder e5 thật** và **LanceDB + FTS5 thật** trên một thư mục tạm (temp dir), nạp
  bộ tài liệu qua pipeline chunk/embed hiện có rồi chạy `retrieve()` cho từng câu hỏi.
- Chỉ số báo cáo: **Recall@k** (cho câu có đáp án), **MRR**, **độ chính xác (precision) và độ phủ (recall) của
  việc từ chối câu unanswerable**, và **histogram khoảng cách** (phân bố distance của hit đúng / hit sai / câu
  unanswerable) để nhìn thấy mức chồng lấn.
- Harness được giữ lại sau feature để chạy hồi quy khi đổi chunker, model embedding, hoặc tham số retrieval.

**(B) Hiệu chuẩn (calibration).** Quét (sweep) các phương án và chọn theo chỉ số đo được:

- Ngưỡng khoảng cách cho nhánh vector (thay cho 0.5).
- Cách **gác (gate) nhánh BM25**: (i) chỉ giữ hit BM25 khi có **hỗ trợ từ vector** (chunk cũng nằm trong tập vector
  liên quan), hoặc (ii) đặt **ngưỡng điểm BM25**.
- **Ngưỡng tương đối** so với hit tốt nhất (ví dụ loại hit có distance > best + δ) thay vì/ngoài ngưỡng tuyệt đối.
- Mục tiêu theo quyết định đã chốt: ưu tiên "KHÔNG BỊA trước" — từ chối đúng câu unanswerable ≥ 90% và
  Recall@6 ≥ 85% cho câu có đáp án.

**(C) Áp dụng + ghi lại.** Cập nhật hằng số/logic trong `src/main/services/rag/` theo kết quả hiệu chuẩn; viết
**ADR mới thay thế (supersede)** phát biểu `RELEVANCE_MAX_DISTANCE = 0.75` của ADR 013 (kèm số liệu đo, phương án
đã quét, lý do chọn) và append vào `docs/04-decisions/INDEX.md`; bổ sung unit test cho logic lọc/gác mới (hàm thuần,
test-first theo Constitution IV); giữ harness cho hồi quy tương lai.

**Ràng buộc bất biến phải giữ (Constitution):**

- **II — Kiểm chứng được (NON-NEGOTIABLE):** thay đổi chỉ ảnh hưởng **chunk NÀO được chọn vào ngữ cảnh**; mỗi chunk
  giữ nguyên `locator` gốc, chip `[n]` vẫn map chính xác về nguồn + vị trí; chế độ theo nguồn khi không có căn cứ
  phải trả `notFound` và KHÔNG bịa.
- **I — Local-first:** harness và hiệu chuẩn không được thêm network egress vào ứng dụng đóng gói. Riêng harness
  dev có thể cần tải model e5 (~120MB, một lần) — đây là hành vi của môi trường phát triển, không phải của app.
- **III:** không log nội dung câu hỏi/tài liệu người dùng trong code app (tài liệu công khai trong eval dataset là
  dữ liệu của repo, không phải dữ liệu người dùng); mọi truy cập DB/model ở main process.
- **IV:** logic mới (lọc, gác, tính chỉ số) có test trước, coverage ≥80% phần business logic; phần I/O của harness
  (model thật, LanceDB thật) loại khỏi coverage như quy ước hiện có.

**Ngoài phạm vi:** đổi model embedding; thay đổi UI (trừ copy của trạng thái "không tìm thấy" nếu cần); provider
online (008/031); thay đổi chunker; LLM-rerank/cross-encoder.

**Kế thừa, không phá vỡ:** `retrieve()` giữ chữ ký/hợp đồng với `rag-service`; fallback đã có (rewrite lỗi ⇒ câu
gốc; FTS lỗi ⇒ vector-only) giữ nguyên; rewrite vẫn chỉ chạy khi có lịch sử hội thoại (055 C1); `content-search`
(073) và Studio không được thay đổi hành vi ngoài chủ đích.

## Ambiguities to raise in /speckit-clarify

> **ĐÃ CHỐT TOÀN BỘ (2026-10-07)** — người dùng trả lời 12 câu dạng hỏi đáp trước bước specify; xem
> `docs/04-decisions/2026-10-07-relevance-calibration-clarify.md`. `/speckit-clarify` chỉ cần ghi các quyết định
> đó vào spec, KHÔNG hỏi lại. Danh sách gốc giữ bên dưới để đối chiếu.

Đã loại các mục có quyết định trong `docs/04-decisions/INDEX.md` (ví dụ: rewrite chỉ khi có history; fallback
FTS/rewrite; fold tiếng Việt; không toggle Settings) và 2 quyết định người dùng ngày 2026-10-07. Mâu thuẫn
ADR↔code (0.75 vs 0.5) đã là một phần của scope (C), không liệt kê lại. Còn lại:

1. **Vị trí và định dạng eval dataset, và giấy phép tài liệu công khai.** `docs/01-03` là nguồn sự thật GỐC (agent
   không sửa) nên dataset không nên đặt ở đó — đặt ở đâu (ví dụ `tests/eval/` hay `eval/`)? Commit **toàn văn tài
   liệu** hay chỉ URL + hash + script tải? Tài liệu nào được phép tái phân phối trong repo (giấy phép/điều kiện
   sử dụng của từng nguồn) — cần người dùng xác nhận danh sách tài liệu và điều kiện chứ không tự giả định "công
   khai = được phép commit".
2. **Cách gắn nhãn "đoạn đáp án" bền vững.** `chunk.id` phụ thuộc chunker (ADR chunking ~1000 ký tự + overlap 150);
   đổi chunker làm nhãn lệch. Gắn nhãn theo `chunk id`, theo khoảng ký tự gốc (`charStart/charEnd`), hay theo
   đoạn trích đáp án (quote) rồi so khớp? Một câu hỏi có nhiều đoạn đáp án hợp lệ thì tính trúng khi nào?
3. **Chạy harness thủ công hay trong CI.** Cần tải model e5 (~120MB) và chạy embed thật — chỉ chạy thủ công
   (`npm run eval:retrieval`), hay có job CI/định kỳ? Có đặt ngưỡng **fail** (gate hồi quy) khi chỉ số tụt dưới
   mục tiêu không, hay chỉ báo cáo? Có cache model giữa các lần chạy không?
4. **Định nghĩa chính xác chỉ số và ngưỡng đạt.** (a) Recall@6 = tỷ lệ câu có **ít nhất một** đoạn đáp án nằm trong 6
   kết quả cuối (sau RRF+MMR) hay tỷ lệ đoạn đáp án được lấy lại? (b) "Từ chối đúng" ≥ 90% đo ở **tầng retrieval**
   (`retrieve()` trả `[]`) hay **end-to-end** (câu trả lời cuối là `notFound`)? Với 20 câu unanswerable, 90% = 18/20
   rất thô — có cần mở rộng số câu hoặc báo khoảng tin cậy? (c) Nếu **không thể đạt đồng thời** cả hai mục tiêu
   (≥90% từ chối và ≥85% Recall@6), sàn Recall tối thiểu chấp nhận được là bao nhiêu — "KHÔNG BỊA trước" đã nêu thứ tự
   ưu tiên nhưng chưa nêu mức sàn của vế sau. (d) Tiêu chí chọn giữa các cấu hình cùng đạt mục tiêu (đơn giản nhất?
   biên an toàn lớn nhất?).
5. **Câu "không có đáp án" được quyết định thế nào end-to-end.** Hai tầng: retrieval rỗng ⇒ `NOT_FOUND_ANSWER` (không
   gọi LLM) và LLM tự từ chối theo prompt. Hiện còn một đường có thể gây "bịa": nếu LLM trả lời **không có `[n]` hợp lệ
   và không chứa cụm "không tìm thấy"** thì `rag-service` gắn **toàn bộ chunk trong context làm citation**
   (`citationsFromMap`). Feature này chỉ hiệu chuẩn tầng retrieval, hay cũng đo/siết đường này? Harness có gọi LLM
   (Ollama, không tất định, cần máy có model) hay chỉ đo retrieval?
6. **Phạm vi áp dụng của việc gác lọc.** `searchBm25` dùng chung cho chat (RAG) và `content-search` (073); Studio không
   dùng `retrieve`. Xác nhận: việc gác/ngưỡng mới chỉ đặt trong `retrieve()` (chat), **không** đổi `keyword-store`
   nên 073 (tìm toàn văn, cần liệt kê rộng) và Studio giữ nguyên? Với chế độ mở rộng (`open mode`), khi retrieval sau
   gác trả rỗng thì hành vi mong muốn là gì (hiện `open` vẫn gọi LLM kể cả khi rỗng)?
7. **Hội thoại nhiều lượt/viết lại câu hỏi trong eval.** Rewrite chỉ chạy khi có history và dùng LLM. Dataset có gồm
   câu nối tiếp (đại từ tham chiếu) không? Nếu có, harness cần LLM cho bước rewrite (không tất định) hay chỉ dùng câu
   đã viết sẵn? Ngưỡng/gác được hiệu chuẩn trên câu độc lập có tự động đúng cho câu đã viết lại không?
8. **Ngôn ngữ của câu hỏi/tài liệu.** Quyết định nêu tài liệu tiếng Việt; chưa nêu câu hỏi tiếng Anh, tài liệu tiếng
   Anh hoặc tài liệu trộn ngôn ngữ (e5 là multilingual, phân bố distance có thể khác). Có đưa nhóm câu EN vào
   dataset/hiệu chuẩn không, hay ghi rõ phạm vi "tiếng Việt" và để EN ngoài phạm vi?
9. **Chống quá khớp (overfit) và độ tổng quát.** Hiệu chuẩn và báo cáo trên cùng ~100 câu dễ quá khớp. Có tách tập
   (ví dụ chia dev/hold-out) không? Ngoài ra phân bố distance phụ thuộc **kích thước/độ đa dạng của notebook** (eval:
   8–12 tài liệu; người dùng thật có thể hàng trăm) — ngưỡng tuyệt đối vs tương đối có cần thử trên notebook lớn hơn
   (ghép thêm tài liệu nhiễu) không?
10. **Gắn ngưỡng với `EMBEDDING_MODEL_VERSION`.** Ngưỡng hiệu chuẩn chỉ đúng cho e5-small-384. Có ràng buộc "đổi
    `EMBEDDING_MODEL_VERSION` ⇒ bắt buộc chạy lại eval trước khi merge" (ví dụ một test/guard hoặc ghi trong ADR) hay
    chỉ ghi chú?
11. **Trải nghiệm "không tìm thấy" sau khi gác chặt hơn.** Khi từ chối nhiều hơn, người dùng có thể thấy tăng số lần
    "Không tìm thấy trong nguồn" cho câu thực ra có đáp án (false rejection). Có cần chỉnh copy (ví dụ gợi ý đổi cách
    hỏi) không — hay giữ nguyên `NOT_FOUND_ANSWER` và coi UI là ngoài phạm vi?

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md`. Đề xuất append (không sửa term cũ; cột 日本語 để `—`). Tên English dùng làm
tên hàm/type/script chuẩn trong code:

| 日本語 | Tiếng Việt (đề xuất)                                                  | English (đề xuất, dùng trong code)      | Ghi chú                                                                                               |
| ------ | --------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| —      | Bộ dữ liệu đánh giá (câu hỏi + nhãn đoạn đáp án, commit repo)         | eval dataset                            | ~8–12 tài liệu công khai VN, ~80 câu có đáp án + ~20 không có; người dùng review trước khi dùng — 108 |
| —      | Câu hỏi có đáp án trong nguồn                                         | answerable question                     | Có ≥1 đoạn đáp án được gắn nhãn — 108                                                                 |
| —      | Câu hỏi không có đáp án trong nguồn                                   | unanswerable question                   | Kỳ vọng hệ thống trả "Không tìm thấy trong nguồn" — 108                                               |
| —      | Đoạn đáp án (đoạn được gắn nhãn chứa đáp án)                          | answer chunk (labeled)                  | Cơ sở tính Recall/MRR — 108                                                                           |
| —      | Độ phủ top-k (tỷ lệ câu có đáp án mà đoạn đáp án nằm trong k kết quả) | Recall@k (`recallAtK`)                  | Định nghĩa chính xác chốt ở clarify (xem ambiguity #4) — 108                                          |
| —      | Thứ hạng nghịch đảo trung bình                                        | MRR (Mean Reciprocal Rank)              | Trung bình 1/rank của đoạn đáp án đầu tiên — 108                                                      |
| —      | Chính xác/độ phủ của việc từ chối                                     | rejection precision / rejection recall  | Đo việc báo "không tìm thấy" đúng/sai trên answerable vs unanswerable — 108                           |
| —      | Biểu đồ phân bố khoảng cách                                           | distance histogram                      | Phân bố cosine distance của hit đúng/sai/unanswerable — 108                                           |
| —      | Harness đánh giá truy xuất (dev-only, không đóng gói)                 | eval harness (`npm run eval:retrieval`) | e5 thật + LanceDB/FTS thật trên temp dir — 108                                                        |
| —      | Hiệu chuẩn (ngưỡng/gác) bằng dữ liệu đo                               | calibration                             | Quét ngưỡng vector, gác BM25, ngưỡng tương đối — 108                                                  |
| —      | Gác (cổng lọc) nhánh BM25                                             | BM25 gating                             | Giữ hit BM25 chỉ khi có hỗ trợ vector hoặc vượt ngưỡng điểm BM25 — 108                                |
| —      | Ngưỡng tương đối (so với hit tốt nhất)                                | relative threshold                      | Loại hit có distance > best + δ — 108                                                                 |

Ghi chú: Recall@k/MRR là thuật ngữ chuẩn ngành IR, giữ nguyên tiếng Anh; cột Tiếng Việt chỉ giải nghĩa. Người phụ
trách có thể gộp bớt dòng (ví dụ answerable/unanswerable) khi append trong branch feature (rule 5 `CLAUDE.md`: THÊM
term được làm ngay trong branch).

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa đổi constitution phải qua PR riêng được steward duyệt, rule 5). Có thể cân nhắc
về sau, không bắt buộc ở 108: một dòng tường minh trong Principle II/IV rằng "mọi thay đổi **tham số hoặc thuật toán
truy xuất** ảnh hưởng tới quyết định 'không tìm thấy trong nguồn' (ngưỡng liên quan, gác BM25, đổi model embedding,
đổi chunker) MUST được đo lại bằng eval harness và ghi số liệu vào ADR trước khi merge" — nhằm tránh lặp lại tình
trạng ngưỡng bị đổi ở 059 mà ADR không ghi con số và không có dữ liệu đo.
