# Intake — 109-unanswerable-detection

- Issue: #109 (repo `hoanghainh1188/insight-vault`) — "Tách câu hỏi không có đáp án ở tầng truy xuất (reranker / LLM chấm độ liên quan)"
- Slug: `unanswerable-detection`
- Ngày intake: 2026-10-08
- Loại: cải tiến chất lượng nội bộ, tiếp nối trực tiếp #108 (relevance-calibration). KHÔNG phải loại nguồn mới, KHÔNG có
  Figma, KHÔNG có basic/detail design của khách hàng (`docs/01-basic-design/` và `docs/02-detail-design/` chỉ có README).
  Mục tiêu: tách câu hỏi **không có đáp án** (unanswerable) khỏi câu có đáp án **ngay ở tầng truy xuất (`retrieve()`)**
  mà không làm mất đoạn đúng — việc mà ngưỡng khoảng cách + gác BM25 của 108 đã chứng minh là không làm được với e5-small.

## Input sources

- **GitHub issue #109** — brief chính. Phiên intake này KHÔNG chạy được `gh issue view 109` (không có Bash trong subagent);
  nội dung issue lấy từ bản tóm tắt agent điều phối cung cấp. **Khuyến nghị:** người phụ trách đối chiếu lại với thân issue
  thật trước `/speckit-specify` (đặc biệt các con số ≥ 90% / ≥ 85% / sàn 75% và danh sách 3 hướng ứng viên).
- `docs/OVERVIEW.md` — 3 điểm bất biến (Local-first, Kiểm chứng được, Offline & tự chủ); "không bịa" là cam kết lõi của
  chế độ theo nguồn.
- `.specify/memory/constitution.md` (v1.0.0) — Principle I (local-first, không egress mặc định; chỉ báo riêng tư luôn đúng),
  II (chunk giữ locator; không có căn cứ ⇒ "không tìm thấy", không bịa), III (suy luận model ở main; không log nội dung),
  IV (test-first, coverage ≥ 80% business logic), V (phased).
- `docs/04-decisions/INDEX.md` + ADR đã đọc (kế thừa, KHÔNG hỏi lại — xem "Đã chốt / kế thừa"):
  - `2026-10-07-relevance-calibration.md` (108) — số liệu quét 392 cấu hình; quyết định #4: "reranker cross-encoder, bước LLM
    chấm độ liên quan, hoặc mô hình embedding khác ⇒ tách issue riêng (#109), dùng chính bộ đánh giá làm thước đo".
  - `2026-10-07-relevance-calibration-clarify.md` (108) — 12 quyết định (đo ở tầng truy xuất; Recall@6 định nghĩa; sàn 75%;
    dev/hold-out 70/30; chỉ áp cho `retrieve()` hỏi đáp; Mở rộng vẫn gọi LLM khi rỗng; guard theo `EMBEDDING_MODEL_VERSION`).
  - `2026-10-08-i18n.md` (123) — lời nhắc English + chỉ dẫn "không tìm thấy" **lai theo số đo** (vi: câu cố định; en: mềm);
    bộ đo v2 (+21 câu English); câu hỏi English xuyên ngôn ngữ trên nguồn tiếng Việt bị từ chối nhầm nếu ép câu cố định.
  - `2026-07-13-embed-in-process-clarify.md` (059) — e5-small in-process, model tải một lần về data dir + badge egress `model`;
    embed không còn cần Ollama. `2026-07-13-rag-enhance-clarify.md` (055) — hybrid vector + BM25 → RRF → MMR; **"KHÔNG LLM-rerank/
    cross-encoder (giữ nhanh)"** — quyết định 055 này nay được #109 xem xét lại có chủ đích (xem ambiguity #1 và #12).
  - `2026-10-07-online-fallback-clarify.md` (098) — bản `local` của RagService chạy MỌI lệnh LLM bằng Ollama; bản `active`
    theo provider đang bật (có thể online). `2026-10-07-privacy-badge-clarify.md` (103) — badge 3 trạng thái, `egressKind` gồm `model`.
- `docs/00-glossary.md` — đã tra: có `retrieval`, `top-k retrieval`, `hybrid search`, `MMR`, `notFound`, `embedding in-process`,
  `embedding model version`, `relevance calibration (RELEVANCE_CALIBRATION)`, `eval harness`, `Recall@k`, `not-found display`,
  `sending / egress kind`, `TARGET_REJECTION/TARGET_RECALL/FLOOR_RECALL`. **Chưa có** thuật ngữ reranker / cross-encoder / rerank
  score / LLM chấm độ liên quan (xem mục thuật ngữ mới).
- Code đã đọc (chỉ để mô tả điểm tích hợp, KHÔNG phải thiết kế mới):
  - `src/main/services/rag/retrieval.ts` — `retrieve()`: (rewrite nếu có history) → embed → vector top-10 ∥ BM25 top-10 →
    `selectRelevant` (cfg) → RRF → (đọc vector chunk) → MMR chọn ≤ 6 → `ScoredChunk{chunk, sourceTitle, score}`;
    `fused.length === 0` ⇒ `[]`. Có sẵn tham số `cfg: RelevanceConfig` cuối hàm để công cụ đo truyền cấu hình.
  - `src/main/services/rag/relevance-filter.ts` — hàm thuần `selectRelevant`; `RelevanceConfig {maxDistance, relativeDelta,
bm25Gate, bm25VectorMaxDistance, bm25MaxScore}`.
  - `src/main/services/rag/relevance-calibration.ts` — `RELEVANCE_CALIBRATION` (`maxDistance 0.5`, không gác BM25,
    `embeddingModelVersion = e5-small-384`, **`datasetVersion: "1"`**, số liệu dev/hold-out).
  - `src/main/services/rag/rag-service.ts` — `compute()`: grounded + `scored.length === 0` ⇒ `notFoundResult()` (không gọi model);
    ngược lại LLM + `postprocessCitations`; grounded mà không có `[n]` hợp lệ ⇒ `notFoundResult()` (108 FR-015). Chế độ `open`
    vẫn gọi LLM kể cả khi rỗng. `deps.relevanceConfig` chỉ công cụ đo đặt.
  - `src/main/index.ts` (≈ 384–441) — `makeRagService(target)`: `embed` dùng chung embedder in-process; `rewrite`/`chat`/`chatStream`
    qua `pickProvider(target)` (provider đang bật có thể là online, hoặc Ollama khi `target = "local"`); hai instance
    `ragServices.active` / `ragServices.local`.
  - `src/main/services/embedding/embed-model.ts` — mẫu tải model lần đầu: `@huggingface/transformers` `pipeline(...)`,
    `env.cacheDir = <data dir>`, `opts.setOnline?.(true, "model")` trước khi tải và `finally(... false, "model")` (badge
    `sending` loại `model`), `logEvent("embed.model.load", {model})` (chỉ tên model, không nội dung); seam e2e `IV_EMBED_FAKE=1`
    chỉ khi `!app.isPackaged`. Whisper (045) và OCR (053) cùng mẫu. ⇒ **đã có tiền lệ** "tải weight lần đầu qua HF Hub vào data
    dir, sau đó chạy offline, badge báo egress `model`" (xem ambiguity #5).
  - `tests/eval/` — `retrieval.eval.ts`, `lib/{dataset,harness,metrics,grid,report,llm-metrics}.ts`, `questions.json`
    (**`datasetVersion: "2"`**, mỗi câu có `lang`, `split`, `type`), `corpus/` (8 tài liệu + 3 nhiễu), `README.md` (biến
    `EVAL_MODE`, `EVAL_CONFIG`, `EVAL_WITH_LLM`, `EVAL_LLM_MODEL`, `EVAL_CACHE_DIR`). Báo cáo đã có `avgRetrieveMs` /
    `coldRetrieveMs` và khối `latency` (so cấu hình ứng viên với mốc) — nền cho yêu cầu đo độ trễ.
- Figma: không dùng. Design token: không đổi. UI: dự kiến KHÔNG đổi (trừ câu chữ trạng thái tải model nếu cần — xem ambiguity #5).
- **Không đọc/xác minh trong phiên này:** `prompt.ts`, `studio/*`, `harness.ts`/`llm-metrics.ts` chi tiết, số câu English
  answerable/unanswerable chính xác của bộ đo v2 — cần xác minh ở plan.

## Sự kiện cần ghi nhận (từ issue + code, để spec không phải đoán)

1. **Vì sao ngưỡng khoảng cách thất bại (108):** với e5-small, khoảng cách của đoạn trúng ~0,06–0,16 và của câu không có đáp
   án ~0,10–0,14 ⇒ hai vùng chồng nhau. Đường đánh đổi trên dev: d ≤ 0,10 ⇒ từ chối 100% / Recall@6 41%; d ≤ 0,13 ⇒ 50% / 81%;
   hiện hành 0,5 ⇒ 0% / 97%. Không cấu hình nào (392) đạt từ chối ≥ 90% với Recall@6 ≥ 75%.
2. **Hiện "không bịa" dựa vào tầng trả lời**, không phải tầng truy xuất: `retrieve()` gần như không bao giờ rỗng (BM25 nối OR,
   ngưỡng 0,5 không loại gì); an toàn đến từ (i) lời nhắc grounded và (ii) hậu kiểm "không có `[n]` hợp lệ ⇒ notFound" (108 FR-015).
   Đo end-to-end 108 (`gpt-oss:20b`): 4,2% câu có đáp án bị trả "không tìm thấy" (model quên `[n]`). Số đo 123
   (`qwen2.5:7b`, lời nhắc mới): từ chối đúng câu vi không đáp án dao động 5/6–6/6 giữa các lượt (q-098: nêu sự thật có trong
   nguồn kèm `[n]` nhưng không trả lời câu hỏi). ⇒ **tầng trả lời không tất định và phụ thuộc model chat**; #109 muốn thêm một
   chốt **tất định hơn, độc lập model chat** ở tầng truy xuất.
3. **Bộ đo đã sẵn sàng làm thước đo:** v2 = 112 câu của 108 + 21 câu English (q-113..q-133) ⇒ khoảng 133 câu; nhóm `dev`/
   `holdout` ~70/30; câu English (`lang: "en"`) hỏi tài liệu tiếng Việt là **báo cáo tham khảo** theo 108 clarify #9 (chưa là
   tiêu chí ĐẠT). Hold-out của 108 chỉ có **6 câu unanswerable** (dev: 14) ⇒ "≥ 90%" ở hold-out đồng nghĩa **6/6** (5/6 = 83%);
   khoảng tin cậy rộng. Số liệu `RELEVANCE_CALIBRATION.metrics` ghi theo `datasetVersion "1"` trong khi `questions.json` đã là
   `"2"` — cần xác nhận ở plan (nhóm vi dev/hold-out có đổi giữa v1→v2 không; `EVAL_MODE=current` đang báo "hồi quy OK" ở lượt đo 123).
4. **Ba hướng ứng viên là ba cơ chế khác bản chất** (cần so bằng số, không chọn trước):
   - (a) _Cross-encoder reranker cục bộ_ (transformers.js / onnxruntime — hạ tầng đã có từ 045/059): chấm cặp (câu hỏi, đoạn) ⇒
     ngưỡng trên điểm rerank. Tất định, không cần Ollama, chạy in-process; chi phí = một model ONNX nữa (kích thước/độ trễ chưa đo)
     và phải **đa ngôn ngữ** (vi + en xuyên ngôn ngữ).
   - (b) _Bước LLM cục bộ chấm "đoạn này có trả lời được câu hỏi không"_ trước khi sinh: không tải model mới nhưng **không
     tất định**, tốn thêm lượt LLM mỗi câu hỏi (độ trễ lớn trên CPU), và **cần Ollama** — mà từ 059 embedding không còn cần Ollama,
     nên người chỉ dùng AI online có thể không có Ollama (xem ambiguity #8). Đo bằng `EVAL_WITH_LLM=1`.
   - (c) _Model embedding khác/lớn hơn_: kéo theo re-embed toàn bộ (cơ chế reindex 059 có sẵn), hiệu chuẩn lại, bump
     `EMBEDDING_MODEL_VERSION`, test canh giữ sẽ fail có chủ đích; ảnh hưởng dung lượng đĩa/thời gian nạp nguồn. Chi phí vận hành
     lớn nhất ⇒ hợp lý là phương án cuối nếu (a)/(b) không đạt.
5. **Tiền lệ tải model lần đầu** (xem Input sources, `embed-model.ts`): badge chuyển `sending/model` trong lúc tải, sau đó offline
   hoàn toàn. Một reranker ONNX tải theo cùng khuôn là _nhất quán về kiến trúc_, nhưng Constitution I yêu cầu lõi "chạy offline" —
   e5 là điều kiện bắt buộc để app hoạt động, còn reranker là _cải tiến_ ⇒ cần chốt cách xử lý lần chạy đầu khi chưa tải được
   (ambiguity #5, #10).
6. **Điểm chèn tự nhiên trong pipeline:** sau RRF (tập ứng viên ≤ ~20 id hợp nhất hai nhánh), trước/sau MMR. `retrieve()` đã có
   tham số `cfg` và công cụ đo đã gọi đúng `retrieve()` ⇒ mở rộng hợp đồng cấu hình (vd trường rerank) là đường ít xáo trộn nhất.
   `ScoredChunk.score` hiện mang nghĩa _cosine distance_ (nhỏ = gần); điểm rerank có chiều/thang khác ⇒ không nên nhồi vào cùng
   field (ambiguity #7).
7. **`retrieve()` chỉ phục vụ hỏi đáp** (RagService); Studio (gom all-chunks/round-robin/map-reduce) và tìm toàn văn (073,
   `searchBm25` trực tiếp) **không** dùng ⇒ giữ nguyên theo 108 clarify #8.
8. **Streaming chat (039):** bước chấm/rerank nằm _trước_ khi bắt đầu stream ⇒ cộng thẳng vào thời gian tới token đầu tiên; câu
   "không tìm thấy" nay có thể trả _ngay_ (không gọi model) cho nhiều câu hơn ⇒ nhanh hơn cho nhóm này.

## Đã chốt / kế thừa — KHÔNG hỏi lại ở clarify

Từ `docs/04-decisions/` và issue #109:

1. **Thước đo = bộ đánh giá 108** (`tests/eval/`, `npm run eval:retrieval`; kèm `EVAL_WITH_LLM=1` để đo end-to-end). Đo ở **tầng
   truy xuất** là chuẩn ĐẠT (108 clarify #5): "từ chối đúng" = câu không có đáp án mà `retrieve()` rỗng. Recall@6 = tỉ lệ câu có
   đáp án có ≥ 1 đoạn chứa trích đoạn đáp án trong 6 đoạn cuối (108 clarify #4). Chia dev/hold-out, chọn trên dev, xác nhận hold-out.
2. **Mục tiêu (issue #109, giống SC-001/SC-002 của 108):** trên hold-out tiếng Việt, từ chối đúng **≥ 90%** với Recall@6 **≥ 85%**;
   **sàn Recall@6 ≥ 75%** (dưới sàn ⇒ dừng, báo lại, không tự hạ mục tiêu — 108 FR-011).
3. **Ràng buộc bất biến của issue:** local-first, không egress mới (Constitution I); không đổi chunk/locator (Constitution II);
   độ trễ tăng _có kiểm soát_ và **được đo trong báo cáo**.
4. **Phạm vi áp dụng:** chỉ `retrieve()` của hỏi đáp; Studio và tìm toàn văn (073) giữ nguyên; chế độ Mở rộng khi không có đoạn
   liên quan vẫn gọi LLM (108 clarify #8).
5. **Tầng trả lời giữ nguyên:** grounded không có `[n]` hợp lệ ⇒ `notFound` + gợi ý (108 FR-015/016); lời nhắc hybrid "không tìm thấy"
   của 123. Bước mới là _chốt bổ sung_ ở tầng truy xuất, không thay thế tầng trả lời.
6. **Guard theo phiên bản model (108 clarify #11):** thành phần mới phải có bản ghi hiệu chuẩn gắn phiên bản và test canh giữ;
   đổi `EMBEDDING_MODEL_VERSION` mà không đo lại ⇒ test fail (có sẵn).
7. **Không toggle trong Cài đặt cho tham số hiệu chuẩn** (tiền lệ 055/108: tham số là hằng đã hiệu chuẩn). Mọi chuỗi giao diện mới
   (nếu có) đi qua khung i18n 123 (vi + en, khoá có kiểu).
8. **ADR:** kết quả phải ghi ADR mới trong `docs/04-decisions/` (+ append `INDEX.md`), kèm số liệu và các phương án đã đo; ADR này
   **bổ sung/thay thế** quyết định "KHÔNG LLM-rerank/cross-encoder" của 055 nếu chọn hướng (a)/(b).

## Prompt for /speckit-specify

Tách các câu hỏi **không có đáp án trong nguồn** (unanswerable question) ra khỏi câu hỏi có đáp án **ngay ở tầng truy xuất
(retrieval)** của tính năng hỏi đáp có trích dẫn trong InsightVault, sao cho ở chế độ theo nguồn (`grounded mode`) hệ thống báo
"Không tìm thấy trong nguồn" **đúng và tất định hơn**, mà **không làm mất các đoạn liên quan thật**. Đây là phần việc 108
(relevance-calibration) đã chủ động tách ra: ngưỡng khoảng cách và cổng lọc BM25 không đủ vì với model embedding `Xenova/
multilingual-e5-small` (384 chiều), khoảng cách cosine của câu không có đáp án (~0,10–0,14) chồng lên khoảng cách của đoạn trúng
(~0,06–0,16). KHÔNG thêm loại nguồn mới; KHÔNG đổi chunk hay `locator`; KHÔNG đổi UI (trừ câu chữ liên quan trạng thái tải model nếu
cần); KHÔNG thay đổi hành vi của Studio và tìm toàn văn nội dung nguồn.

**Vấn đề hiện tại (đã đo, 108):**

- Quét 392 cấu hình lọc (ngưỡng khoảng cách tuyệt đối/tương đối × cổng BM25) trên bộ đánh giá `tests/eval/`: **không cấu hình nào**
  đạt từ chối đúng ≥ 90% mà vẫn giữ Recall@6 ≥ 75%. Đường đánh đổi (dev): khoảng cách ≤ 0,10 ⇒ từ chối đúng 100% nhưng Recall@6
  chỉ 41%; ≤ 0,13 ⇒ 50% / 81%; cấu hình hiện hành (≤ 0,5) ⇒ 0% / 97%.
- Vì vậy `retrieve()` hầu như không bao giờ trả danh sách rỗng; việc "không bịa" hiện dựa vào tầng trả lời — lời nhắc grounded và hậu
  kiểm "câu trả lời không có `[n]` hợp lệ ⇒ không tìm thấy". Tầng này phụ thuộc model chat (không tất định): số đo 123 cho thấy
  từ chối đúng câu tiếng Việt không đáp án dao động 5/6–6/6 giữa các lượt; số đo 108 cho thấy 4,2% câu có đáp án bị trả "không tìm
  thấy" khi model quên `[n]`.

**Mục tiêu:** bổ sung một bước **ở tầng truy xuất** có khả năng phân biệt "đoạn này có trả lời được câu hỏi này không" tốt hơn
khoảng cách embedding, đo bằng chính bộ đánh giá 108 (`npm run eval:retrieval`, kèm `EVAL_WITH_LLM=1` cho phần end-to-end).

**Các hướng ứng viên — phải được so sánh bằng số đo trước khi chọn (spec KHÔNG chọn trước):**

- (a) **Reranker cross-encoder chạy cục bộ** (transformers.js / onnxruntime): chấm điểm từng cặp (câu hỏi, đoạn) rồi áp ngưỡng trên
  điểm rerank. Model phải xử lý tiếng Việt và câu hỏi tiếng Anh trên nguồn tiếng Việt (xuyên ngôn ngữ).
- (b) **Bước LLM cục bộ chấm độ liên quan** trước khi sinh câu trả lời: hỏi model "đoạn này có trả lời câu hỏi không". Đo bằng
  `EVAL_WITH_LLM=1`.
- (c) **Model embedding khác/lớn hơn**: kéo theo nhúng lại toàn bộ dữ liệu (reindex), hiệu chuẩn lại ngưỡng, và test canh giữ theo
  `EMBEDDING_MODEL_VERSION` sẽ báo cần đo lại.

Kết quả đo của từng hướng được đưa vào báo cáo và ADR cùng quy tắc chọn (đã chốt ở bước clarify); phương án được chọn phải áp dụng
trong `src/main/services/rag/` với `retrieve()` giữ nguyên hợp đồng với `rag-service`.

**Tiêu chí thành công (đo trên nhóm hold-out tiếng Việt của bộ đánh giá, giống SC-001/SC-002 của 108):**

- Từ chối đúng câu không có đáp án **≥ 90%** (ở tầng truy xuất: `retrieve()` rỗng ⇒ "Không tìm thấy trong nguồn").
- Recall@6 cho câu có đáp án **≥ 85%**, **sàn 75%**. Nếu không đạt đồng thời ⇒ dừng và báo lại, không tự hạ mục tiêu.
- **Độ trễ tăng có kiểm soát** và được đo, báo cáo trong cùng báo cáo của công cụ đo (độ trễ mỗi câu hỏi, lần chạy nguội và
  lần chạy ấm; so với mốc hiện tại). Giới hạn cụ thể chốt ở bước clarify.
- Nhóm câu hỏi tiếng Anh hỏi tài liệu tiếng Việt (xuyên ngôn ngữ) **được đo và báo cáo**; không được tụt đáng kể so với mốc hiện tại
  (mức chấp nhận chốt ở clarify).

**Ràng buộc bất biến phải giữ (Constitution):**

- **I — Local-first:** mọi bước chấm điểm/lọc chạy cục bộ; **không thêm network egress** vào luồng hỏi đáp. Nếu cần tải thêm model,
  tải một lần vào data dir theo đúng khuôn của embedding/Whisper hiện có (chỉ báo riêng tư chuyển sang `sending` loại `model` trong
  lúc tải), sau đó chạy offline; cách xử lý khi chưa tải được (lần chạy đầu offline) chốt ở clarify. Chỉ báo riêng tư luôn đúng
  trạng thái, kể cả khi dùng AI online.
- **II — Kiểm chứng được:** chỉ ảnh hưởng _đoạn nào_ được đưa vào ngữ cảnh; mỗi đoạn giữ nguyên `locator`; chip `[n]` map xác định về
  nguồn; chế độ theo nguồn không có căn cứ ⇒ `notFound`, không bịa; không dịch/viết lại nội dung đoạn nguồn.
- **III — Biên bảo mật:** chạy model ở main process; không thêm đường FS/mạng cho renderer; không log nội dung câu hỏi/đoạn nguồn
  (chỉ mã sự kiện và tên model).
- **IV — Test-first:** logic mới (ngưỡng rerank, chọn đoạn sau chấm điểm, tổng hợp kết quả chấm, hàm quyết định) là hàm thuần có test
  trước, coverage ≥ 80%; phần I/O model thật nằm trong công cụ đo/loại khỏi coverage như quy ước hiện có; bản ghi hiệu chuẩn gắn
  phiên bản model mới và test canh giữ tương ứng.

**Kế thừa, không phá vỡ:** `retrieve()` giữ chữ ký/hợp đồng với `rag-service`; fallback đã có (rewrite lỗi ⇒ câu gốc; FTS lỗi ⇒
vector-only) giữ nguyên; rewrite vẫn chỉ chạy khi có lịch sử hội thoại; tầng trả lời của 108/123 (không có `[n]` hợp lệ ⇒ không tìm
thấy, lời nhắc hybrid) giữ nguyên; Studio và tìm toàn văn không đổi; chế độ Mở rộng vẫn gọi model khi không có đoạn liên quan; khung
i18n 123 áp dụng cho mọi chuỗi mới; bộ đánh giá và công cụ đo giữ nguyên là thước đo (có thể bổ sung câu hỏi nếu cần tăng độ tin cậy,
kèm tăng `datasetVersion` và duyệt lại).

**Ngoài phạm vi:** đổi chunker hoặc `locator`; thay đổi UI ngoài câu chữ trạng thái tải model; provider online (008/031) ngoài việc
xác định cách tương tác với bước chấm; thay đổi hành vi Studio hoặc tìm toàn văn; hiệu chuẩn lại ngưỡng khoảng cách của 108
(chỉ làm nếu hướng được chọn đòi hỏi).

## Ambiguities to raise in /speckit-clarify

Đã loại (đã có quyết định, xem "Đã chốt / kế thừa"): thước đo = bộ đánh giá 108; đo ở tầng truy xuất; định nghĩa Recall@6; dev/hold-out;
chỉ áp `retrieve()` hỏi đáp (Studio/073 không đổi); Mở rộng vẫn gọi LLM khi rỗng; guard theo phiên bản model; không toggle Cài đặt cho
tham số hiệu chuẩn; i18n cho chuỗi mới. Còn lại — mỗi mục kèm phương án và **đề xuất** (con số là điểm khởi đầu, chốt bằng số đo):

1. **Thứ tự thử các hướng và quy tắc chọn.** Phương án: (i) đo cả (a)(b)(c) song song trong cùng harness rồi chọn; (ii) tuần tự
   (a) → (b) → (c), dừng ngay khi một hướng đạt; (iii) chỉ (a) trước. Quy tắc chọn khi nhiều hướng cùng đạt: độ trễ nhỏ nhất? dung lượng
   tải nhỏ nhất? ít phụ thuộc nhất (không cần Ollama)? Có chấp nhận hướng _lai_ (reranker + LLM chấm chỉ cho ca "mờ") không?
   Lưu ý (c) kéo reindex toàn bộ dữ liệu người dùng.
   **Đề xuất:** (ii) làm _thí nghiệm chỉ trong harness_ (chưa tích hợp app) cho (a) với ≥ 2 model đa ngôn ngữ cỡ nhỏ, rồi (b) với
   model chat mặc định; (c) chỉ khi (a),(b) không đạt sàn. Quy tắc: đạt SC trên hold-out **và** dev ⇒ ưu tiên (1) tất định và không cần
   Ollama, (2) độ trễ ấm thấp nhất, (3) dung lượng tải nhỏ nhất, (4) đơn giản nhất.
2. **Độ tin cậy thống kê của tiêu chí.** Hold-out hiện chỉ có 6 câu unanswerable (≥ 90% ⇒ 6/6; một câu sai = 83%); dev có 14. Với
   khoảng tin cậy Wilson rộng, một cấu hình "đạt" có thể là ăn may. Mở rộng tập unanswerable (và English unanswerable) trước khi chọn?
   Bao nhiêu câu? Ai duyệt (108 yêu cầu chủ dự án duyệt bộ câu hỏi)? Tiêu chí ĐẠT tính trên hold-out _một mình_ hay hold-out + dev
   (cùng ≥ 90%)? Chấp nhận khoảng tin cậy nào? Khi tăng bộ dữ liệu lên `datasetVersion 3`, `RELEVANCE_CALIBRATION.datasetVersion` hiện ghi
   `"1"` — đồng bộ ra sao?
   **Đề xuất:** mở rộng lên ≥ 30 câu unanswerable tiếng Việt (tách dev/hold-out ~70/30 ⇒ ≥ 9 hold-out) + ≥ 10 English unanswerable,
   bump `datasetVersion`, chủ dự án duyệt; tiêu chí ĐẠT: ≥ 90% trên hold-out **và** cận dưới CI95 trên dev+hold-out gộp không thấp hơn
   mốc đã quy định ở plan; cập nhật `RELEVANCE_CALIBRATION.datasetVersion` cùng lúc.
3. **Hạn ngạch độ trễ mỗi câu hỏi.** Mốc hiện tại có từ báo cáo harness (`avgRetrieveMs`, `coldRetrieveMs`), nhưng chưa có ngân sách.
   Cần: (i) tăng tối đa ở lần chạy ấm (ms, trên CPU nào — máy phát triển macOS hay máy Windows tham chiếu?); (ii) chi phí lần chạy nguội
   (nạp model vào RAM); (iii) với (b), thêm _một lượt LLM_ mỗi câu hỏi (hoặc mỗi đoạn?) — chấp nhận được không; (iv) có hiển thị trạng
   thái "đang chọn nguồn…" trước khi stream không (039); (v) bước chấm có chặn event loop của main process không (embedder đã chạy
   in-process) — dùng worker?
   **Đề xuất:** đặt ngân sách sau khi đo (không bịa số trước): đề xuất khởi đầu _tăng ≤ 300 ms ở lần chạy ấm với ≤ 20 ứng viên trên CPU_
   và _nạp nguội ≤ vài giây, chỉ một lần mỗi phiên_, (b) chỉ chấp nhận nếu tổng thêm ≲ vài giây; báo p50/p95 trong báo cáo; ghi nhận
   rủi ro chặn event loop để plan quyết định worker. Không cần thêm UI trạng thái nếu nằm trong ngân sách.
4. **Mục tiêu cho tiếng Anh / xuyên ngôn ngữ.** Tiêu chí ĐẠT chỉ tính trên _tiếng Việt_ (issue + 108 clarify #9), nhưng 123 đã thêm
   câu hỏi English và UI English. Phương án: (i) English chỉ báo cáo (như 108); (ii) English có _sàn không tụt_ (không giảm Recall@6/từ
   chối so với mốc đo cùng lượt); (iii) English là tiêu chí ĐẠT riêng (vd Recall@6 ≥ 75%, từ chối ≥ 80%). Lưu ý rủi ro: reranker một
   ngôn ngữ/ít đa ngữ có thể làm câu English trên nguồn Việt bị từ chối nhầm (đúng loại lỗi 123 đã gặp với câu cố định).
   **Đề xuất:** (ii) — không chặn khi English tốt hơn/bằng mốc; dưới mốc ⇒ phải ghi trong ADR là giới hạn đã biết và cân nhắc loại
   hướng đó. Giữ tiêu chí cứng cho tiếng Việt.
5. **Tải model lần đầu: chấp nhận được không và hiển thị thế nào.** Tiền lệ có sẵn (e5 ~120 MB, Whisper, OCR traineddata): tải qua HF
   Hub vào data dir, badge `sending/model`. Reranker ước tính ~100–300 MB (cần xác minh theo model cụ thể). Câu hỏi: (i) coi là _cùng khuôn
   được phép_ (một lần, theo yêu cầu, hiển thị badge) hay cần _xin phép người dùng tường minh_ vì không bắt buộc cho lõi; (ii) thời
   điểm tải: lười (lần hỏi đáp đầu tiên), nền sau khi nạp nguồn đầu tiên, hay đóng gói sẵn trong bộ cài (to hơn, không cần mạng, nhưng
   phải xử lý `asarUnpack`/dung lượng dmg/nsis, giấy phép phân phối); (iii) có cần thông báo tiến độ trong UI (khoá i18n vi/en) hay chỉ
   badge; (iv) mirror/tải thủ công cho môi trường kín mạng?
   **Đề xuất:** coi là cùng khuôn với e5/Whisper (tải một lần vào data dir, badge `sending/model`, không hỏi riêng), tải **nền** sau khi
   notebook đầu tiên có nguồn `ready` hoặc ngay khi cần, tuỳ đo; _không_ đóng gói sẵn ở v1; hiển thị tiến độ ở mức badge đã có + dòng
   trạng thái ngắn ở Cài đặt (nếu thêm thì qua i18n). Cần ADR ghi lại để khớp Constitution I ("lõi chạy offline" được giữ vì reranker là
   tăng cường, không phải điều kiện hoạt động).
6. **Điểm chèn, số ứng viên, ngưỡng và ngữ nghĩa điểm.** (i) Rerank trên tập hợp nhất sau RRF (≤ ~20) rồi MMR, hay chỉ rerank top-N sau
   MMR; (ii) ngưỡng _tuyệt đối_ trên điểm rerank, _tương đối_ so với điểm tốt nhất, hay kết hợp với `RELEVANCE_CALIBRATION.config` hiện
   có (giữ gate vector 0,5 như tiền lọc); (iii) điểm rerank có _thay_ thứ tự RRF/MMR (có thể tăng Recall@1/MRR) hay chỉ dùng để _lọc_;
   (iv) `ScoredChunk.score` đang là cosine distance — thêm trường mới (`rerankScore?`) hay đổi nghĩa; (v) cách mở rộng
   `RelevanceConfig`/công cụ đo (`grid.ts`) để quét ngưỡng rerank theo cùng quy trình dev/hold-out.
   **Đề xuất:** tập hợp nhất sau RRF, giữ gate 0,5 làm tiền lọc rẻ; ngưỡng tuyệt đối + tương đối quét như 108; điểm rerank dùng để lọc
   _và_ sắp xếp lại _trước_ MMR nếu số đo cho thấy lợi (ghi rõ); thêm trường mới, không đổi nghĩa `score`.
7. **Ngưỡng theo ngôn ngữ.** Điểm của reranker đa ngữ có thể lệch thang giữa vi và en. Một ngưỡng chung, hay ngưỡng theo ngôn ngữ câu
   hỏi (dùng `detectQuestionLanguage` của 123, trả vi/en/không rõ)? Ngôn ngữ đoạn nguồn cũng có thể khác ngôn ngữ câu hỏi.
   **Đề xuất:** ngưỡng _chung_ trước; chỉ tách theo ngôn ngữ nếu số đo cho thấy chênh lệch đáng kể, và khi đó chỉ cho `vi`/`en` chắc
   chắn (còn lại dùng ngưỡng chung) — ghi trong ADR.
8. **Hướng (b) và AI online / Ollama.** (i) Bước chấm LLM chạy _luôn cục bộ_ (Ollama) bất kể provider đang bật — giữ dữ liệu không rời
   máy nhưng người chỉ dùng AI online có thể **không có Ollama** (embedding đã in-process từ 059) ⇒ bước chấm không chạy được; (ii) chạy
   _theo provider đang bật_ (`target`) — thêm lượt gọi online, tốn token/tiền API key của người dùng, thêm egress (badge phải đúng) và độ
   trễ mạng; (iii) bước chấm cho phép bỏ qua khi không có LLM cục bộ (fail-open). Với (a) vấn đề này không phát sinh.
   **Đề xuất:** nếu (b) được chọn: chấm _luôn cục bộ_, bỏ qua (fail-open, kèm `logEvent`) khi không có LLM cục bộ; **không** chuyển bước
   chấm sang provider online ở v1. Ghi rõ đây là lý do (a) được ưu tiên về kiến trúc.
9. **Hành vi khi bước chấm kết luận "không có đáp án".** Chế độ Theo nguồn: `retrieve()` rỗng ⇒ `notFound` không gọi model (theo 108).
   Chế độ Mở rộng: 108 chốt "vẫn gọi LLM khi rỗng" — vậy ngữ cảnh gửi model là _rỗng_ (như hiện tại khi rỗng) hay _giữ các đoạn bị
   đánh giá không liên quan nhưng gắn nhãn_? Với chat có lịch sử (rewrite) có khác không? Chỉ báo/gợi ý trong UI có đổi (tăng số lần
   "Không tìm thấy" ⇒ có cần chỉnh `chat.notFoundHint`)?
   **Đề xuất:** Theo nguồn ⇒ rỗng ⇒ `notFound` (không gọi model); Mở rộng ⇒ ngữ cảnh rỗng (nhất quán với 108), model trả lời kèm nhãn
   "ngoài nguồn" như hiện nay; không đổi `chat.notFoundHint` trừ khi số đo false-rejection tăng đáng kể (xử lý như 108 clarify #12).
10. **Dự phòng khi bước mới không chạy được** (model chưa tải, tải lỗi, máy offline lần đầu, lỗi suy luận, hết thời gian chờ). _Fail-open_
    (giữ hành vi 108 hiện hành: không lọc thêm, tầng trả lời vẫn chặn bịa) hay _fail-closed_ (từ chối)? Có cần báo người dùng (chỉ báo/
    trạng thái ở Cài đặt) rằng chất lượng "tách câu không đáp án" đang ở chế độ thường? Có timeout cho mỗi lần chấm không?
    **Đề xuất:** _fail-open_ + `logEvent` mã lỗi (không nội dung) + timeout; không chặn hỏi đáp; trạng thái "chưa sẵn sàng" chỉ hiện ở
    Cài đặt (nếu thêm thì qua i18n). Lý do: tầng trả lời (108 FR-015) đã giữ "không bịa", fail-closed gây từ chối nhầm hàng loạt khi
    model chưa tải.
11. **Giấy phép, dung lượng và nguồn của model mới.** App có kế hoạch freemium về sau (CLAUDE.md) ⇒ giấy phép model reranker phải cho phép
    dùng thương mại và phân phối lại trọng số/chạy trong app; kiểm cả giấy phép tập dữ liệu huấn luyện nếu model nêu hạn chế. Có
    giới hạn kích thước (RAM khi nạp cùng Ollama + embedder + Whisper)? Có tải từ HF Hub mặc định hay phải mirror ổn định?
    **Đề xuất:** điều kiện loại: giấy phép không cho dùng thương mại ⇒ loại; ghi giấy phép + kích thước + RAM đo được vào ADR; chỉ xét
    model đã có bản ONNX chạy được bằng `@huggingface/transformers` (cần xác minh, không giả định có sẵn).
12. **Quan hệ với quyết định 055 ("KHÔNG LLM-rerank/cross-encoder") và 108.** Xác nhận rằng 055 chốt vì lý do tốc độ (giữ nhanh), nay
    được xem lại _có chủ đích_ bằng số đo; ADR mới sẽ _bổ sung/thay thế_ mục đó của 055 chứ không sửa file cũ; `RELEVANCE_CALIBRATION`
    mở rộng (thêm bản ghi hiệu chuẩn bước mới + phiên bản model reranker + test canh giữ) hay tách bản ghi riêng; harness: job CI
    `eval-retrieval` cache thêm model reranker; có đặt cổng hồi quy (fail khi tụt dưới mục tiêu) hay chỉ báo cáo (như 108)?
    **Đề xuất:** ADR mới ghi rõ "supersede một phần 055 mục LLM-rerank"; thêm trường (vd `rerank`) vào `RELEVANCE_CALIBRATION` kèm
    `rerankModelVersion` và test canh giữ song song với `embeddingModelVersion`; CI chỉ báo cáo, không chặn PR (như 108).

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md` (đã tra: chỉ có `retrieval`, `hybrid search`, `MMR`, `relevance calibration`, `eval harness`,
`Recall@k`, `notFound`, `egress kind`, …). Đề xuất append (không sửa term cũ; cột 日本語 để `—`). Tên English dùng làm tên
module/type/hằng/script chuẩn:

| 日本語 | Tiếng Việt (đề xuất)                                               | English (đề xuất, dùng trong code)               | Ghi chú                                                                                                  |
| ------ | ------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| —      | Bộ xếp hạng lại (chấm cặp câu hỏi–đoạn bằng mô hình cross-encoder) | reranker (cross-encoder reranker)                | Bước sau RRF, trước MMR (đề xuất); chạy cục bộ; chọn/loại đoạn theo điểm rerank — 109                    |
| —      | Điểm xếp hạng lại (độ liên quan của cặp câu hỏi–đoạn)              | rerank score (`rerankScore`)                     | KHÁC `ScoredChunk.score` (cosine distance, nhỏ = gần) — 109                                              |
| —      | Ngưỡng điểm xếp hạng lại                                           | rerank threshold                                 | Tuyệt đối và/hoặc tương đối; hiệu chuẩn bằng bộ đánh giá 108 — 109                                       |
| —      | Bước LLM chấm "đoạn có trả lời được câu hỏi không"                 | LLM relevance judge (`relevanceJudge`)           | Hướng (b); không tất định, cần Ollama; đo bằng `EVAL_WITH_LLM=1` — 109                                   |
| —      | Tập ứng viên (các đoạn đưa vào bước chấm/xếp hạng lại)             | candidate set                                    | Kết quả hợp nhất RRF của hai nhánh (≤ ~20 id) — 109                                                      |
| —      | Chốt phát hiện câu không có đáp án ở tầng truy xuất                | unanswerable detection (`unanswerableDetection`) | Làm `retrieve()` rỗng ⇒ `notFound` mà không gọi model; bổ sung (không thay) hậu kiểm `[n]` của 108 — 109 |
| —      | Mở khi lỗi / đóng khi lỗi                                          | fail-open / fail-closed                          | Hành vi khi bước mới không chạy được (đề xuất fail-open) — 109                                           |

Ghi chú: "reranker", "cross-encoder" là thuật ngữ chuẩn ngành IR, giữ nguyên tiếng Anh; cột Tiếng Việt chỉ giải nghĩa. Người phụ
trách có thể gộp bớt dòng khi append trong branch feature (rule 5 `CLAUDE.md`: THÊM term được làm ngay trong branch). Không sửa/đổi
tên term đã có.

## Đối chiếu constitution

- **I (Local-first):** đạt nếu bước mới chạy cục bộ, không thêm egress vào luồng hỏi đáp; tải model một lần theo khuôn e5/Whisper có
  badge `sending/model`. Điểm cần canh: (b) với provider online (ambiguity #8) không được tạo egress thêm mà badge không phản ánh;
  lần chạy đầu offline không được làm hỏng hỏi đáp (ambiguity #10).
- **II (Kiểm chứng được):** không đổi chunk/locator/`postprocessCitations`; thay đổi chỉ _loại bớt_ đoạn đưa vào ngữ cảnh; "không có căn
  cứ ⇒ không tìm thấy" được củng cố ở tầng truy xuất. Rủi ro đối ngược: loại nhầm đoạn đúng (false rejection) — kiểm bằng Recall@6.
- **III (Biên bảo mật):** suy luận ở main process; không thêm IPC mới trừ khi cần trạng thái model ở Cài đặt (khi đó whitelist ở
  `preload`); không log nội dung (chỉ `logEvent` mã/tên model).
- **IV (Test-first):** hàm thuần (ngưỡng rerank, quyết định, tổng hợp điểm) có test trước; I/O model thật ở harness/loại khỏi coverage;
  test canh giữ phiên bản model mới.
- **V (Phased Delivery):** không vi phạm (cải tiến lõi Pha 1).
- **Additional constraints:** ADR-governed stack — thêm model/dependency mới (nếu có) phải ghi ADR, không sửa lén CLAUDE.md; terminology
  fidelity — thuật ngữ mới ở bảng trên; source-of-truth — không có tài liệu khách hàng, mâu thuẫn duy nhất là 055 ("không rerank") đã
  nêu ở ambiguity #12.

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa đổi constitution phải qua PR riêng được steward duyệt, rule 5). Có thể cân nhắc về sau, không
bắt buộc ở 109: (1) lặp lại gợi ý của 108/123 — một dòng ở Principle II/IV rằng "mọi thay đổi tham số/thuật toán/model ảnh hưởng quyết định
'không tìm thấy trong nguồn' (ngưỡng, gác BM25, đổi embedding, reranker, lời nhắc) MUST được đo lại bằng eval harness và ghi số liệu vào
ADR trước khi merge"; (2) một dòng ở Principle I làm rõ rằng "thành phần AI _tăng cường_ (không bắt buộc cho lõi) MAY tải weight lần đầu
vào data dir theo khuôn đã có, MUST có đường dự phòng chạy được khi chưa tải và MUST hiển thị chỉ báo riêng tư đúng trong lúc tải" — để
việc thêm model (reranker, và các model tương tự về sau) không phải tranh luận lại cách diễn giải "lõi chạy offline".
