# Research — 109 tách câu hỏi không có đáp án ở tầng truy xuất

Nguồn quyết định: `docs/04-decisions/2026-10-08-unanswerable-detection-clarify.md` (12 mục). Kiểm chứng model: HF API
(`/api/models/<id>?blobs=true`, model card, `config.json`) + mã nguồn `@huggingface/transformers@4.3.1` (đọc trực tiếp, 2026-10-08).

## R1 — Ứng viên reranker (hướng a)

**Decision:** đo **hai** model, theo thứ tự:

| #   | Model                                                                                                       | Kiến trúc                                  | Tiếng Việt               | Giấy phép  | ONNX dùng                                                                                                        | Dung lượng |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| a1  | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`                                                                | XLM-R (mMiniLMv2) 12L×384, ~118M           | có (15 ngôn ngữ, mMARCO) | Apache-2.0 | repo gốc `onnx/model_qint8_arm64.onnx` (macOS arm64) / `onnx/model_quint8_avx2.onnx` (x64) — 119 MB; fp32 471 MB | ~119 MB    |
| a2  | `onnx-community/gte-multilingual-reranker-base` (bản ONNX của `Alibaba-NLP/gte-multilingual-reranker-base`) | GTE "NewModel" 12L×768, ~306M, ngữ cảnh 8k | có (75 ngôn ngữ)         | Apache-2.0 | `onnx/model_quantized.onnx` (q8)                                                                                 | 341 MB     |

Tham chiếu chất lượng (chỉ đo nếu a1, a2 đều không đạt, KHÔNG phải ứng viên phát hành vì vượt mốc dung lượng/độ trễ):
`onnx-community/bge-reranker-v2-m3-ONNX` int8 (571 MB, Apache-2.0).

**Rationale:** thoả cả bốn điều kiện clarify #11 (thương mại, có ONNX chạy được bằng transformers.js, đa ngôn ngữ có `vi`, cỡ nhỏ).
a1 nhỏ, kiến trúc được hỗ trợ sẵn (`xlm-roberta` → `XLMRobertaForSequenceClassification`); a2 mạnh hơn trên benchmark đa ngôn ngữ nhưng
nặng gấp ~3 và cần nạp qua `AutoModel` (xem R2).

**Alternatives considered (loại):** `jinaai/jina-reranker-v2-base-multilingual` — CC-BY-NC-4.0 (không thương mại); `BAAI/bge-reranker-base/large`
— chỉ zh/en; `mixedbread-ai/mxbai-rerank-*-v1` — chỉ English; `mxbai-rerank-base-v2` — Qwen CausalLM, không ONNX; `itdainb/PhoRanker` — cần tách
từ VnCoreNLP (Java/Python, không có bản JS), yếu với câu English; `namdp-ptit/ViRanker`, `AITeamVN/Vietnamese_Reranker` — ~568M, không ONNX
(phải tự chuyển, ~570 MB int8); model chỉ English (`ms-marco-MiniLM`, `jina-reranker-v1-turbo-en`, `granite-*-english`).

**Ghi chú giấy phép (đưa vào ADR):** trọng số a1/a2 là Apache-2.0; một phần dữ liệu huấn luyện là dẫn xuất MS MARCO (điều khoản gốc
phi thương mại) — vùng xám phổ biến, trọng số được phát hành Apache-2.0; ghi rõ là rủi ro đã biết.

## R2 — Chạy cross-encoder bằng transformers.js 4.x

**Decision:** dùng `AutoTokenizer` + `AutoModelForSequenceClassification` (a1) / `AutoModel` (a2); mã hoá cặp
`tokenizer(queries, { text_pair: passages, padding: true, truncation: true, max_length: 512 })`; `const { logits } = await model(inputs)`;
điểm = `sigmoid(logit)` ∈ (0, 1) (cả hai model có 1 logit). Chạy theo lô (toàn bộ ≤ 20 cặp/câu hỏi một lượt).

**Rationale:** đã xác minh trong mã nguồn 4.3.1: tokenizer hỗ trợ `text_pair` mảng; `pipeline("text-classification")` KHÔNG hỗ trợ cặp và áp
softmax lên 1 logit (luôn 1.0) ⇒ không dùng pipeline. Hậu tố dtype: `q8` → `_quantized`, `fp32` → không hậu tố; tên tệp riêng của a1 nạp bằng
`model_file_name` (vd `model_qint8_arm64`) + `dtype: "fp32"`. a2: `model_type: "new"` không có trong registry ⇒ `AutoModelForSequenceClassification`
ném lỗi; `AutoModel` rơi về `PreTrainedModel` chạy phiên ONNX thô và vẫn trả `logits` — **phải smoke-test** đầu pha 0 (task riêng), kèm kiểm
đồ thị có cần `token_type_ids` không.

**Alternatives:** pipeline text-classification (sai cho cặp); gọi onnxruntime-node trực tiếp (thêm việc tự tokenizer — không cần).

## R3 — Chọn tệp ONNX theo nền tảng (a1)

**Decision:** `process.arch === "arm64"` ⇒ `model_qint8_arm64`; còn lại ⇒ `model_quint8_avx2` (Windows x64). Nếu nạp tệp lượng tử lỗi ⇒ không tự
lùi về fp32 471 MB (quá to) mà fail-open (R8). Cả hai tệp được đo độ trễ/độ chính xác trên máy tham chiếu (arm64) — biến thể avx2 đo ở CI ubuntu x64
(chỉ báo cáo).

**Rationale:** hai tệp cùng trọng số, khác phép lượng tử theo tập lệnh CPU; dùng sai tập lệnh có thể chậm hoặc lỗi.

## R4 — Điểm chèn và quyết định (thuần)

**Decision:** trong `retrieve()`, sau RRF (`fused`, ≤ 2 × `HYBRID_BRANCH_TOPK` = 20 id) và TRƯỚC MMR:

1. Lấy chunk của `fused` (đã cần cho bước 6) → cặp (câu truy vấn đã viết lại nếu có, `chunk.text`).
2. `deps.rerank(q, passages)` → `Map<id, score>` (có timeout, xem R8).
3. Hàm THUẦN `applyRerank(fused, scores, cfg)` → `{ ids, scoreOf }`: giữ id có `score ≥ minScore` VÀ (nếu `relativeDelta` khác null)
   `score ≥ best − relativeDelta`; nếu `reorder` ⇒ sắp theo điểm giảm dần (hoà ⇒ giữ thứ tự RRF), không ⇒ giữ thứ tự RRF.
4. `ids` rỗng ⇒ `retrieve()` trả `[]` (→ "không tìm thấy" 108). Không rỗng ⇒ MMR trên `ids` như cũ.
5. `ScoredChunk.rerankScore?: number` (tuỳ chọn, trường mới); `score` giữ nghĩa cosine distance.

**Rationale:** clarify #6. Chấm trên tập hợp nhất (không chỉ top-6 sau MMR) để không bỏ lỡ đoạn đúng bị MMR loại; tiền lọc 0,5 của 108 giữ nguyên.
Hàm quyết định thuần ⇒ test tất định, công cụ đo dùng chung.

**Alternatives:** chấm sau MMR (rẻ hơn nhưng mất đoạn); thay hẳn điểm khoảng cách (phá nghĩa `score` mà công cụ đo/108 đang dùng).

## R5 — Hướng b (LLM chấm) — chỉ trong công cụ đo

**Decision:** chỉ chạy khi a1, a2 không đạt (clarify #1). Một lượt gọi `qwen2.5:7b` cục bộ mỗi câu hỏi: lời nhắc English liệt kê các đoạn đánh số, yêu cầu trả
JSON danh sách số đoạn trả lời được câu hỏi (rỗng nếu không đoạn nào); temperature 0. Áp như bộ lọc (không xếp lại). Đo bằng `EVAL_JUDGE=llm`.

**Rationale:** 20 lượt gọi/câu (từng cặp) quá chậm trên CPU; một lượt liệt kê cho phép đo khả thi. Không cần Ollama cho a ⇒ (a) được ưu tiên về
kiến trúc (clarify #8). Nếu (b) được chọn ⇒ tích hợp với fail-open khi không có Ollama.

## R6 — Bộ đo: mở rộng và tiêu chí thống kê

**Decision:**

- Hiện có (v2): vi unanswerable 14 dev + 6 hold-out = 20; en unanswerable 4 dev + 5 hold-out = 9.
- Thêm **12 câu vi không có đáp án** (8 dev + 4 hold-out ⇒ 22 / 10 = 32) và **3 câu en** (dev ⇒ 7 / 5 = 12). Ưu tiên câu **sát chủ đề**
  (hỏi chi tiết không có trong tài liệu về đúng chủ thể của tài liệu — "hard negative"), vì đây là loại 108 thất bại; mỗi câu kèm grep chứng minh
  tài liệu không có đáp án.
- `datasetVersion` "3", `reviewed: null` cho tới khi chủ dự án duyệt (**DỪNG**); `RELEVANCE_CALIBRATION.datasetVersion` cập nhật cùng lần hiệu
  chuẩn (đồng thời đo lại số liệu cấu hình hiện hành trên v3 làm mốc).
- **Tiêu chí ĐẠT (cổng tích hợp):** trên vi hold-out: từ chối đúng ≥ 90% (≥ 9/10) VÀ Recall@6 ≥ 85% (sàn 75%); VÀ cận dưới Wilson 95% của
  từ chối đúng trên vi dev + hold-out gộp (32 câu) **≥ 0,75** (mốc clarify #2 — 30/32 ⇒ ~0,80; 29/32 ⇒ ~0,76).
- English: tỉ lệ từ chối đúng và Recall@6 của nhóm en ≥ mốc cấu hình hiện hành đo cùng lượt (sàn không tụt, clarify #4).

**Rationale:** 6 câu hold-out ⇒ 1 câu sai = 83% (không phân biệt được ăn may); 32 câu gộp cho khoảng tin cậy dùng được.

## R7 — Quét ngưỡng và chọn

**Decision:** mỗi model: `minScore` ∈ {0,01; 0,02; 0,05; 0,1; 0,15; 0,2; 0,3; 0,4; 0,5; 0,6; 0,7; 0,8} × `relativeDelta` ∈ {null; 0,2; 0,4; 0,6}
× `reorder` ∈ {false, true} = 96 cấu hình/model, trên nền cấu hình 108 hiện hành. Điểm chấm của mỗi (câu, đoạn) tính MỘT lần (cache) ⇒ quét chỉ
lọc lại. Chọn trên dev: lọc cấu hình đạt (CR ≥ 0,9, R@6 ≥ 0,85) → max R@6 → max CR → `minScore` nhỏ nhất (ít rủi ro từ chối nhầm); không có
⇒ báo đường đánh đổi (Pareto). Xác nhận trên hold-out + điều kiện Wilson + English. Quy tắc giữa các model/hướng: clarify #1.

## R8 — Fail-open, timeout, đồng thời

**Decision:** `deps.rerank` bọc timeout (giá trị trong bản ghi hiệu chuẩn, mốc khởi đầu **1500 ms** cho lần ấm — đây là **ngưỡng an toàn** để fail-open, KHÔNG phải mục tiêu độ trễ (mục tiêu p50 ≤ 300 ms: SC-003/R11); lần nạp nguội không áp vào hỏi đáp
vì model nạp nền — R9); lỗi/timeout/chưa sẵn sàng ⇒ `applyRerank` không chạy, `retrieve()` đi tiếp như 108 (fail-open), `logEvent("rerank.skip",
{ reason })` với `reason ∈ notReady | timeout | error` (không nội dung). Một phiên ONNX dùng chung, gọi tuần tự (hàng đợi) — tránh tranh CPU với
embedder. Không dùng worker ở v1 nếu đo cho thấy event loop không bị chặn đáng kể (onnxruntime-node chạy suy luận trên luồng riêng); đo `eventLoopDelay`
trong công cụ đo để xác nhận.

## R9 — Tải model và trạng thái

**Decision:** service `src/main/services/rerank/` theo khuôn `embed-model.ts`: `env.cacheDir = <dataDir>/models`, `setOnline(true, "model")` khi tải,
`logEvent("rerank.model.load", { model })`. Trạng thái `RerankerStatus = "idle" | "downloading" | "ready" | "error"` (+ `unavailable` khi tích hợp không
bật). **Tải nền** khi có nguồn đầu tiên chuyển `ready` (sự kiện tiến độ nạp nguồn đã có) hoặc khi hỏi đáp gọi rerank lần đầu (trong lúc đang tải ⇒
fail-open). Tệp tải dở: transformers.js ghi cache theo tệp; lỗi nạp ⇒ trạng thái `error`, lần sau thử lại (không dùng tệp hỏng: nạp lỗi ⇒ không có
phiên). Seam e2e: `IV_RERANK_FAKE=1` (chỉ khi chưa đóng gói, như `IV_EMBED_FAKE`) ⇒ scorer tất định không tải model.
Kênh IPC whitelist mới `ai:getRerankerStatus` (chỉ đọc) + Cài đặt hiện một dòng (khoá i18n `ai.reranker.*` vi/en).

## R10 — Bản ghi hiệu chuẩn, canh giữ, ADR, CI

**Decision:** `RelevanceCalibration` thêm `rerank: RerankCalibration | null` gồm `{ model, modelFile?, modelVersion, config: RerankConfig, metrics }`
và `RERANK_MODEL_VERSION` hằng; test canh giữ: (1) `rerank.modelVersion === RERANK_MODEL_VERSION`; (2) `datasetVersion` khớp `questions.json`.
`rerank: null` ⇒ `retrieve()` không gọi rerank (giữ 108). ADR mới `docs/04-decisions/2026-10-xx-unanswerable-detection.md` thay một phần 055
(mục không rerank), ghi số đo mọi hướng, giấy phép/dung lượng/RAM, giới hạn đã biết. Job CI `eval-retrieval` cache thêm `tests/eval/.cache/models`
(đã cache e5) — chỉ báo cáo.

## R11 — Độ trễ và tài nguyên đo được

**Decision:** công cụ đo ghi cho mỗi model: thời gian nạp nguội (tải không tính — đo khi đã có cache), p50/p95 thời gian chấm/câu (ấm), RSS tăng sau
nạp, `eventLoopDelay` p99 trong lúc chấm. Mốc (clarify #3): p50 ≤ 300 ms; vượt ⇒ ghi ADR và cân nhắc a1 (nhỏ hơn) hoặc giảm số ứng viên (top 12).

## R12 — Phạm vi không đổi

`rag-service` (prompt, hậu kiểm `[n]`, notFound, reindexing, online provider), Studio, tìm toàn văn, chunker/locator — không đổi. Mở rộng
(`extended`) với `retrieve()` rỗng: hành vi 108 sẵn có (ngữ cảnh rỗng, nhãn ngoài nguồn) — chỉ thêm test hồi quy.
