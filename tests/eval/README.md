# Công cụ đo truy xuất (108, 177)

Đo chất lượng bước **chọn đoạn** của hỏi đáp có trích dẫn trên một bộ đánh giá công khai. Dev-only: không đóng gói
vào bản cài, không đọc/ghi dữ liệu người dùng. Quyết định và số liệu: `docs/04-decisions/2026-10-07-relevance-calibration.md`.

> **Giấy phép:** tài liệu trong `tests/eval/corpus/` theo giấy phép riêng của từng nguồn (bài Wikipedia: CC BY-SA 4.0;
> văn bản luật: không thuộc đối tượng bảo hộ quyền tác giả) — **không** theo giấy phép của repo. Xem `corpus/README.md`.

## Chạy

```bash
npm run eval:retrieval                    # quét lưới cấu hình (chọn trên dev, xác nhận trên hold-out)
EVAL_MODE=current npm run eval:retrieval  # chỉ đo cấu hình đang dùng + baseline, so với số liệu đã ghi
```

| Biến môi trường      | Mặc định                   | Ý nghĩa                                                                                                     |
| -------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `EVAL_MODE`          | `sweep`                    | `sweep` quét lưới · `current` đo cấu hình hiện hành (kiểm hồi quy)                                          |
| `EVAL_CONFIG`        | —                          | JSON một `RelevanceConfig` để đo riêng (ghi đè `EVAL_MODE`)                                                 |
| `EVAL_WITH_LLM`      | `0`                        | `1` = thêm phần end-to-end qua Ollama cục bộ (tham khảo, không xét ĐẠT)                                     |
| `EVAL_LLM_SAMPLE`    | (mặc định)                 | `unanswerable` = phần LLM chạy trên MỌI câu không đáp án vi + en (dev + hold-out), báo từng câu (205)       |
| `EVAL_LLM_REPEATS`   | `1`                        | số lần chạy lặp mỗi câu (tầng trả lời không tất định)                                                       |
| `EVAL_LLM_MODEL`     | model chat đầu tiên        | model Ollama cho phần LLM                                                                                   |
| `EVAL_CACHE_DIR`     | `tests/eval/.cache/models` | nơi tải mô hình e5 (~120MB, lần đầu cần Internet)                                                           |
| `EVAL_RERANK`        | —                          | 109: danh sách model bộ chấm độ liên quan (phẩy) ⇒ quét 96 cấu hình/model trên đúng `retrieve()` của app    |
| `EVAL_RERANK_TOPN`   | 20                         | 109: số ứng viên đầu (thứ tự RRF) được chấm (`maxCandidates`)                                               |
| `EVAL_RERANK_MAXLEN` | 512                        | 109: cắt mỗi cặp (câu hỏi, đoạn) ở số token này                                                             |
| `EVAL_RERANK_FILE`   | theo `process.arch`        | 109: tệp ONNX riêng (vd `model_qint8_arm64`)                                                                |
| `EVAL_DETAILS`       | `0`                        | 177: `1` = ghi kết quả TỪNG câu (`details.relevance` / `details.production` + `topSources`) vào report.json |

Báo cáo: `tests/eval/reports/<thời điểm>/report.{md,json}` (gitignore). Trên GitHub: Actions → `eval-retrieval` →
Run workflow ⇒ artifact `eval-report`. Job không chặn PR.

## Cách hoạt động

1. Kiểm dữ liệu: `corpus/manifest.json`, mọi trích đoạn đáp án phải có **nguyên văn** trong văn bản khi nạp của tài liệu
   (`lib/dataset.ts`) — với PDF là văn bản do **`parsePdf` của app** trích (177; trích dẫn không vắt qua ranh giới trang).
2. Dựng SQLite + FTS5 + LanceDB thật trên thư mục tạm, nạp mọi tài liệu (kể cả nhiễu) vào một notebook qua pipeline
   thật với mô hình e5 thật (`lib/harness.ts`); PDF đi đúng nhánh `kind: "pdf"` → `parsePdf` cấu hình mặc định như app.
3. Gọi đúng `retrieve()` của app với từng cấu hình; embed/tìm kiếm của mỗi câu chỉ chạy một lần (cache).
4. Tính Recall@1/3/6, MRR, từ chối đúng/nhầm (+ khoảng tin cậy Wilson 95%), phân bố khoảng cách (`lib/metrics.ts`).
5. (177) Khi corpus có PDF: mục **"Nhóm PDF (tham khảo — không vào tiêu chí ĐẠT)"** — câu tiếng Việt theo định dạng md / pdf ×
   dev / hold-out, đo trên cấu hình như app đang chạy (cấu hình 108 + bộ chấm 109 đã ghi), kèm `PDF_EXTRACTION_VERSION`. Cảnh báo
   khi cận trên Wilson 95% Recall@6 nhóm PDF thấp hơn Recall@6 nhóm Markdown (riêng dev / hold-out); cảnh báo không làm eval fail.
   Phần này nạp mô hình bộ chấm 109 đã ghi (cần cache — lần đầu cần mạng); không nạp được ⇒ đo không bộ chấm + cảnh báo trong báo cáo.

## Thêm câu hỏi / tài liệu

- Câu có đáp án: `type: "answerable"`, `quotes` = 1 câu ngắn (≤ 200 ký tự) chép **nguyên văn** từ tài liệu, `docIds`.
- Câu không có đáp án: `type: "unanswerable"`, `quotes: []`, `docIds: []` — kiểm (grep) chắc tài liệu không có đáp án.
- Chia `split` ~70% `dev` / 30% `holdout` trong từng loại. Đổi bộ dữ liệu ⇒ tăng `datasetVersion`, đặt
  `reviewed: null` và nhờ chủ dự án duyệt lại (FR-003).
- Tài liệu mới: chỉ nguồn được phép tái phân phối; ghi nguồn + giấy phép vào `corpus/manifest.json` và
  `corpus/README.md`.
- Tài liệu PDF (177): `format: "pdf"`, `file`, `sha256`; trích dẫn chép từ **văn bản `parsePdf`** (bảng dạng `| ô | ô |`, tiếng
  Việt giữ gạch nối `hợp-đồng`), nằm trọn trong một trang. Câu không đáp án sát chủ đề PDF thêm `topic: "pdf"` để vào nhóm PDF.
  `npm test` (`tests/unit/eval-pdf-corpus.test.ts`) kiểm sha256, trích tất định ≤ 1000 ms, tổng ≤ 1 MiB, metadata, mọi trích dẫn —
  không cần mô hình.
- (187, v5) Câu không đáp án **sát chủ đề** một tài liệu thật: thêm `topicDocId` = id tài liệu đó (chỉ ở `unanswerable`, không trỏ tài
  liệu nhiễu); mỗi tài liệu thật có ≥ 2 câu như vậy (`tests/unit/eval-dataset-v5.test.ts`).
- PDF fixture: `UPDATE_EVAL_FIXTURE=1 npx vitest run tests/unit/eval-pdf-fixture.test.ts` ghi lại tệp (phải trùng từng byte).
- **Khi `PDF_EXTRACTION_VERSION` / cách trích PDF đổi:** trích dẫn PDF có thể ngừng khớp ⇒ kiểm dữ liệu fail (đây là tín hiệu
  hồi quy mong muốn). Xử lý: cập nhật trích dẫn theo văn bản mới, tăng `datasetVersion`, đo lại `RELEVANCE_CALIBRATION`.

## Bộ chấm độ liên quan (109)

```bash
EVAL_MODE=current npm run eval:retrieval   # đo lại cấu hình 108 + bộ chấm đã ghi (RELEVANCE_CALIBRATION.rerank), so số liệu
EVAL_MODE=current EVAL_RERANK=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 EVAL_RERANK_TOPN=12 EVAL_RERANK_MAXLEN=256 npm run eval:retrieval
```

Báo cáo có mục "Bộ chấm độ liên quan": kết luận cổng (từ chối đúng hold-out ≥ 90%, Recall@6 ≥ 85% / sàn 75%, cận dưới Wilson vi gộp
≥ 0,75, English không tụt so với mốc cùng lượt), cấu hình chọn trên dev, Pareto, độ trễ p50/p95, RSS, event loop. Đổi model bộ chấm ⇒ đổi
`RERANK_MODEL_VERSION` (`src/main/services/rerank/model-version.ts`) ⇒ test canh giữ fail cho tới khi đo lại và cập nhật
`RELEVANCE_CALIBRATION.rerank`. Kết quả + quyết định: `docs/04-decisions/2026-10-08-unanswerable-detection.md`.

### Chẩn đoán bộ chấm (187)

`EVAL_DETAILS=1` ⇒ phần đo đường app (cấu hình 108 + bộ chấm đã ghi) ghi, cho từng câu, điểm của **mọi** ứng viên được chấm
(`details.production[].rerankCandidates`: `chunkId`, `source`, `score`, `hit`, `quoteInWindow` — kể cả câu bị từ chối, vốn không có
`rerankScore` trong kết quả `retrieve()`). `quoteInWindow` = trích dẫn đáp án còn nằm trong phần đoạn sau khi tokenizer cắt cặp
(câu hỏi, đoạn) ở `maxTokens` (`windowText` của scorer, `lib/rerank.ts`). report.md thêm mục **"Chẩn đoán bộ chấm"**
(`lib/rerank-diagnose.ts`): mỗi câu có vấn đề + bộ kiểm hồi quy đáp án-trong-bảng (q-162, q-170, q-171) và q-176 / q-179, nguyên nhân
`cutOff` (đáp án bị cắt khỏi cửa sổ) / `lowScoreInWindow` (trong cửa sổ nhưng điểm < `minScore`) / `rankedOut` (đủ điểm nhưng vẫn
rơi khỏi top 6) / `nearTopicHighScore` (câu không đáp
án lọt) / `notRetrieved` (đoạn đúng không có trong ứng viên). Chỉ in id / điểm, không in nội dung đoạn. Không đổi số liệu / cổng.
`rerankCandidates` ghi tiêu đề nguồn (như `topSources`) — chỉ dùng `EVAL_DETAILS=1` với corpus của bộ đánh giá, không trỏ vào tài liệu
người dùng rồi chia sẻ report.json.

```bash
EVAL_DETAILS=1 EVAL_MODE=current npm run eval:retrieval
```

### Quét lưới bộ chấm mở rộng (187 PR 2)

`rerank-sweep.eval.ts` (bỏ qua nếu thiếu `EVAL_RERANK_SWEEP=1`) quét ứng viên {8, 12, 16} × maxTokens {256, 384, 512} × minScore ×
relativeDelta trên ĐÚNG `retrieve()` của app. Mỗi (ứng viên, maxTokens) dùng một scorer riêng: lượt ấm đo p50 / p95 thật rồi các cấu hình
khác chỉ lọc lại trên điểm đã chấm. Loại cấu hình (`eligibleRerankConfigs`) để lọt q-176 / q-179, làm hỏng bộ kiểm bảng (q-162 / q-170 /
q-171 bị từ chối hoặc hạng > 6), dưới sàn tiếng Anh (số đo của cấu hình hiện hành) hoặc vượt p50 400 / p95 800 ms; chọn trên dev
(`chooseRerankConfig`), cổng hold-out (`gateVerdict`), so từng câu với cấu hình hiện hành (`compareOutcomes`). report.md có phễu loại dần,
Pareto dev, cấu hình được chọn hoặc gần đạt nhất, điểm các câu quan tâm. `table` = trình bày đoạn bảng bằng `lib/rerank-input.ts` chỉ ở chuỗi
gửi bộ chấm. Một lượt khoảng 15–30 phút (model hiện hành); model lớn hơn lâu hơn — test có timeout riêng 3 giờ.

```bash
EVAL_RERANK_SWEEP=1 npm run eval:retrieval -- tests/eval/rerank-sweep.eval.ts
# model thí nghiệm (ghim commit), so với report.json của lượt quét model hiện hành:
EVAL_RERANK_SWEEP=1 EVAL_SWEEP_MODEL=<repo> EVAL_SWEEP_REVISION=<commit> EVAL_RERANK_FILE=<tệp onnx> \
  EVAL_SWEEP_BASE_REPORT=<report.json> EVAL_SWEEP_PRESENT=plain npm run eval:retrieval -- tests/eval/rerank-sweep.eval.ts
```

Biến khác: `EVAL_SWEEP_PRESENT` (`plain,table`), `EVAL_SWEEP_SPEC` (JSON một phần của lưới, vd `{"minScores":[0.01,0.1]}`),
`EVAL_SWEEP_OUT` (thư mục ghi). Kết quả + quyết định: `docs/04-decisions/2026-10-14-reranker-near-topic.md`.

## Khi đổi mô hình embedding hoặc cách chia đoạn

`tests/unit/relevance-calibration.test.ts` sẽ fail khi `EMBEDDING_MODEL_VERSION` khác phiên bản trong
`RELEVANCE_CALIBRATION`. Khi đó: chạy `npm run eval:retrieval`, chọn lại cấu hình, cập nhật
`src/main/services/rag/relevance-calibration.ts` (cấu hình + số liệu dev/hold-out) và ADR.
