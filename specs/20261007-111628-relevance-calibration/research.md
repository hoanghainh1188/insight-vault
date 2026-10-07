# Research — 108 relevance-calibration

Nguồn: spec.md, `docs/04-decisions/2026-10-07-relevance-calibration-clarify.md`, khảo sát code 2026-10-07.

## R1. Công cụ đo chạy ngoài Electron được không?

- **Decision:** Chạy bằng **vitest** (đã có, node environment) với một config riêng `vitest.eval.config.ts`, lệnh
  `npm run eval:retrieval` = `vitest run -c vitest.eval.config.ts`. Ghép trực tiếp các thành phần thật: `createSourceRepo`
  - `runMigrations` (node:sqlite), `createVectorStore` (LanceDB native), `createKeywordStore` (FTS5),
    `createIngestionPipeline` (chunker + cleaning + parser `md`), `createEmbedder` (transformers.js e5 thật) — KHÔNG dùng
    composition root `ingestion.ts` (phụ thuộc `electron.app`).
- **Rationale:** Khảo sát: trong các module cần dùng chỉ `embedding/embed-model.ts` import `electron`, và chỉ chạm
  `app.isPackaged` khi `IV_EMBED_FAKE === "1"` (short-circuit) ⇒ chạy được trong Node khi KHÔNG đặt biến đó. Không cần
  thêm `tsx` (vitest đã biên dịch TS); không phải dựng Electron.
- **Alternatives:** `tsx` script (thêm dependency, không có lợi thêm); chạy trong Electron headless (nặng, khó CI).

## R2. Thư mục cache mô hình cho công cụ đo

- **Decision:** `tests/eval/.cache/models` (gitignore), truyền làm `cacheDir` của `createEmbedder`. CI cache thư mục này
  bằng `actions/cache` với key theo `EMBEDDING_MODEL` + `EMBEDDING_MODEL_VERSION`.
- **Rationale:** Không đụng data dir của người dùng (FR-005); tải ~120MB một lần.

## R3. Bộ lọc độ liên quan — phương án quét

Hiện trạng (`retrieval.ts`): vector top-10 lọc `distance ≤ 0.5`; BM25 top-10 KHÔNG lọc (OR mọi token, không stopword);
RRF hợp nhất → MMR → top-6. `retrieve()` gần như không bao giờ rỗng.

- **Decision:** Tách logic lọc thành hàm THUẦN `selectRelevant(vHits, kHits, cfg)` (file mới
  `src/main/services/rag/relevance-filter.ts`), cấu hình `RelevanceConfig`:
  - `maxDistance` — ngưỡng tuyệt đối nhánh vector.
  - `relativeDelta | null` — loại hit vector có `distance > best + delta`.
  - `bm25Gate`: `"none"` (hành vi cũ) | `"requireVector"` (chỉ giữ hit BM25 nếu cùng chunk nằm trong tập vector đã
    lọc) | `"vectorWithin"` (giữ hit BM25 nếu chunk đó có distance ≤ `bm25VectorMaxDistance`, nới hơn `maxDistance`) |
    `"minScore"` (giữ hit BM25 nếu điểm bm25 ≤ `bm25MaxScore`; FTS5 `bm25()` âm, càng nhỏ càng liên quan).
  - `vectorWithin` cần distance của chunk BM25 không có trong top-10 vector ⇒ dùng `getVectorsByIds` (đã có) + cosine với
    vector câu hỏi — tính trong hàm thuần từ vector đã có, không truy vấn thêm DB.
- **Rationale:** Hàm thuần ⇒ unit test test-first (Constitution IV) và công cụ đo gọi CÙNG hàm với app (không lệch).
  `retrieve()` giữ chữ ký; chỉ thay đoạn lọc bằng `selectRelevant(…, RELEVANCE_CALIBRATION.config)`.
- **Alternatives:** chuẩn hoá điểm BM25 về 0..1 theo max trong truy vấn (phụ thuộc kích thước corpus, khó hiệu chuẩn) —
  để ngoài; reranker/cross-encoder — ngoài phạm vi (spec).

## R4. Chọn cấu hình

- **Decision:** Lưới quét (dev): `maxDistance ∈ {0.14 … 0.30, bước 0.01}` × `relativeDelta ∈ {null, 0.01, 0.02, 0.03,
0.05}` × `bm25Gate ∈ {none, requireVector, vectorWithin(+0.02/+0.04 so với maxDistance)}` (+ `minScore` vài mốc theo
  phân vị điểm đo được). Tiêu chí (FR-011/012): lọc cấu hình có từ chối đúng ≥ 90% (dev, VN) → lấy Recall@6 cao nhất; nếu
  ≥ 85% chọn cấu hình ít tham số nhất (gate `none`/`requireVector` < `vectorWithin` < `minScore`; `relativeDelta=null`
  đơn giản hơn), hoà thì biên lớn nhất; xác nhận trên hold-out; nếu không có cấu hình ≥ 75% ⇒ dừng, báo lại.
- **Rationale:** Khoảng cách e5 nén hẹp (~0.14 liên quan / ~0.20 khác chủ đề theo 059) ⇒ lưới mịn 0.01 quanh vùng đó;
  histogram sẽ xác nhận vùng thật.

## R5. Định nghĩa chỉ số

- Recall@k: tỉ lệ câu CÓ đáp án mà ≥ 1 đoạn trong top-k (sau lọc + RRF + MMR) chứa một trích đoạn đáp án (k = 1, 3, 6).
- MRR: trung bình 1/rank của đoạn trúng đầu tiên (0 nếu không có trong top-6).
- Từ chối đúng: tỉ lệ câu KHÔNG có đáp án mà `retrieve()` trả rỗng. Từ chối nhầm: tỉ lệ câu CÓ đáp án mà `retrieve()` rỗng.
- Báo kèm khoảng tin cậy Wilson 95% cho các tỉ lệ (20 câu ⇒ 90% = 18/20 rất thô — spec Assumptions).
- Histogram distance: vector distance của (a) đoạn trúng tốt nhất của câu có đáp án, (b) hit vector tốt nhất KHÔNG trúng,
  (c) hit vector tốt nhất của câu không có đáp án; 20 bucket.

## R6. Khớp trích đoạn đáp án

- **Decision:** Chuẩn hoá cả nội dung chunk lẫn trích đoạn: `normalize("NFC")` + gộp mọi khoảng trắng thành 1 dấu cách +
  trim; "trúng" khi `chunkText.includes(quote)`. Trích đoạn chọn ngắn (1 câu, ≤ 200 ký tự) để không bị cắt ngang ranh
  giới chunk (chunk ~1000 ký tự, overlap 150). Công cụ đo kiểm trước: mọi trích đoạn PHẢI xuất hiện nguyên văn trong tài
  liệu nguồn (sau chuẩn hoá) — sai thì báo lỗi dữ liệu, không chạy đo.
- **Rationale:** Không phụ thuộc chunker (quyết định #2).

## R7. Siết "đường bịa" + câu "Không tìm thấy"

- Hiện trạng (`rag-service.ts`): grounded, LLM trả lời không có `[n]` hợp lệ và không chứa "không tìm thấy" ⇒ trả
  `citationsFromMap(built.map)` (MỌI đoạn ngữ cảnh làm trích dẫn).
- **Decision:** nhánh đó ⇒ trả `notFound: true` + câu hiển thị không-tìm-thấy (FR-015). `NOT_FOUND_ANSWER` hiện được dùng
  ở 2 vai: (1) câu prompt grounded yêu cầu LLM lặp nguyên văn khi không có căn cứ, (2) câu hiển thị. Tách: giữ
  `NOT_FOUND_ANSWER` cho prompt/nhận diện; thêm `NOT_FOUND_DISPLAY = NOT_FOUND_ANSWER + " " + NOT_FOUND_HINT` cho mọi nhánh
  trả về người dùng (retrieval rỗng, LLM tự từ chối, không có `[n]`) (FR-016). Lịch sử lưu đúng `NOT_FOUND_DISPLAY`.
- Streaming: token đã hiện được thay bằng câu cuối khi hoàn tất (hành vi sẵn có của `useChat`) — chấp nhận.
- **Alternatives:** đổi thẳng `NOT_FOUND_ANSWER` (làm đổi prompt + phá nhận diện câu LLM tự từ chối) — loại.

## R8. Bản ghi hiệu chuẩn + test canh giữ (FR-019)

- **Decision:** `src/main/services/rag/relevance-calibration.ts` export `RELEVANCE_CALIBRATION = { embeddingModelVersion,
config: RelevanceConfig, calibratedAt, datasetVersion, metrics: { dev, holdout } }`. Test `relevance-calibration.test.ts`:
  `RELEVANCE_CALIBRATION.embeddingModelVersion === EMBEDDING_MODEL_VERSION`, thông báo lỗi nêu `npm run eval:retrieval`.
  `RELEVANCE_MAX_DISTANCE` trong `constants.ts` bỏ (thay bằng bản ghi) để không còn 2 nguồn sự thật.
- **Rationale:** dữ liệu số liệu đo nằm cạnh cấu hình ⇒ review PR thấy ngay; guard rẻ, tất định.

## R9. `--with-llm` (tham khảo)

- **Decision:** biến môi trường `EVAL_WITH_LLM=1` (+ `EVAL_LLM_MODEL`): dựng `createOllamaClient` (localhost) + `createRagService`
  thật, chạy chế độ theo nguồn cho câu hold-out, đếm `notFound` end-to-end; Ollama không chạy ⇒ bỏ phần này kèm cảnh báo.
  Không ảnh hưởng tiêu chí ĐẠT.

## R10. CI

- **Decision:** `.github/workflows/eval-retrieval.yml`: chỉ `workflow_dispatch`; ubuntu-latest, Node 24, `npm ci`,
  `actions/cache` thư mục mô hình, `npm run eval:retrieval`, upload `tests/eval/reports/*` làm artifact. KHÔNG thêm vào
  required checks.
- **Note:** `pipeline-config-check` (check-template.py) kiểm link docs — đặt link trong report/ADR đúng đường dẫn.

## R11. Hiệu năng (SC-006)

- `selectRelevant` xử lý ≤ 20 hit + tối đa ~10 cosine 384 chiều ⇒ không đáng kể so với embed câu hỏi + truy vấn
  LanceDB/FTS. `vectorWithin` cần `getVectorsByIds` — đã được gọi cho MMR ⇒ dùng chung kết quả (một lần truy vấn).
  Đo: unit benchmark nhẹ không cần; công cụ đo in thời gian trung bình `retrieve()` trước/sau làm tham khảo.

## R12. Tài liệu & giấy phép

- Văn bản quy phạm pháp luật VN: không thuộc đối tượng bảo hộ quyền tác giả (Luật SHTT, Điều 15). Wikipedia tiếng Việt:
  CC BY-SA 4.0 — ghi tiêu đề, URL, ngày lấy, "CC BY-SA 4.0" trong manifest + README của `tests/eval/corpus/`.
- Tài liệu nhiễu: 2–3 bài Wikipedia khác chủ đề (vd thể thao, ẩm thực, thiên văn) — không có câu hỏi nào trỏ tới.
- Danh sách tài liệu cụ thể trình người dùng duyệt cùng bộ câu hỏi (FR-003).
