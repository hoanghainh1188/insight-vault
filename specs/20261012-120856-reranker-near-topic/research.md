# Research — Bộ chấm độ liên quan: câu sát chủ đề và đoạn bảng (187)

Bám `docs/04-decisions/2026-10-12-reranker-near-topic-clarify.md`.

## R1 — Ghi điểm của MỌI ứng viên (kể cả câu bị từ chối)

- **Sự thật:** `retrieve()` chỉ gắn `rerankScore` cho đoạn GIỮ LẠI; câu bị từ chối trả rỗng ⇒ không biết vì sao.
- **Decision:** bọc `RerankRun.score` trong harness: mỗi lượt gọi `(query, passages)` ⇒ ghi `Map<query, {id, score}[]>` (đúng thứ tự RRF đã cắt
  `maxCandidates` mà app chấm). `evaluateConfig` gắn vào `QuestionOutcome.rerankCandidates` (top ≤ 12: `chunkId`, `source`, `score`, `hit`,
  `quoteInWindow`). Chỉ ghi vào report khi `EVAL_DETAILS=1`.
- **Rationale:** đo đúng đường app; không đổi `retrieve()`.

## R2 — Giả thuyết "cắt cửa sổ token" cho đoạn bảng

- **Sự thật:** app cắt cặp (câu hỏi, đoạn) ở `maxTokens` = 256 (`rerank-model.ts`, `truncation: true`); câu hỏi chiếm ~20–40 token ⇒ đoạn
  chỉ còn ~220 token. Đoạn bảng của `tuyen-2a-ha-noi.pdf` (bảng nhà ga, nhiều cột, nhiều số tuyến buýt) dài ⇒ dòng "T2A 04 | Láng" có thể nằm
  sau điểm cắt.
- **Decision:** scorer của eval lộ `windowText(query, passageText, maxLength)` = giải mã phần đoạn còn lại sau khi tokenizer cắt (cùng
  tokenizer / cùng `max_length`); cờ `quoteInWindow` = `chunkContainsAnyQuote(windowText, quotes)`. Chẩn đoán phân biệt: (a) đáp án bị cắt
  khỏi cửa sổ ⇒ vấn đề trình bày / độ dài; (b) đáp án trong cửa sổ nhưng điểm thấp ⇒ vấn đề model chấm bảng.
- **Alternatives:** suy độ dài theo ký tự (không chính xác với tokenizer SentencePiece) — bác.

## R3 — Tóm tắt chẩn đoán

- **Decision:** hàm thuần `diagnoseRerank(outcomes, questions)` ⇒ cho từng câu trong danh sách quan tâm (q-176, q-179, 2 câu không đáp án cũ
  lọt ở dev, q-162, q-170, q-171 + mọi câu v5 bị lọt / từ chối nhầm): điểm cao nhất, điểm của đoạn đúng (nếu có), hạng RRF của đoạn đúng,
  `quoteInWindow`, khoảng cách tới `minScore`. Phân loại nguyên nhân: `cutOff` / `lowScoreInWindow` / `nearTopicHighScore` / `ok`.
- **Rationale:** quyết định PR 2 có căn cứ (clarify specify #2).

## R4 — Bộ câu hỏi v5

- **Decision:** ~2 câu không đáp án sát chủ đề cho mỗi tài liệu thật (8 `.md` thật + 2 PDF = 10 tài liệu ⇒ ~20 câu), tiếng Việt, 70/30 trong từng
  loại, có `topic: "pdf"` cho câu sát chủ đề PDF; 2–3 câu đáp án-trong-bảng nếu tài liệu có bảng (PDF fixture / PDF Wikipedia / bảng trong
  `.md` nếu có). Kiểm "không có đáp án" bằng grep từ khoá + đồng nghĩa trên văn bản khi nạp (như 177). `datasetVersion` "5",
  `reviewed: null`. Không thêm câu tiếng Anh (clarify #4).
- **Lưu ý:** đổi bộ dữ liệu ⇒ `RELEVANCE_CALIBRATION.datasetVersion` phải "5" (test canh giữ) ⇒ PR 1 cập nhật SỐ LIỆU của cấu hình hiện
  hành trên v5 (không đổi cấu hình) — đúng thủ tục 177.

## R5 — Lưới quét mở rộng (PR 2)

- **Decision:** `buildRerankGrid` thêm trục `maxCandidates ∈ {8, 12, 16}` và `maxTokens ∈ {256, 384, 512}` (đo lại cửa sổ — mỗi `maxTokens` cần
  một lượt chấm vì scorer cắt khi chấm) + `minScore` dày hơn quanh 0,5–0,8. Bộ lọc loại TRƯỚC khi chọn: bộ kiểm bảng (q-162/170/171 không bị
  từ chối), ngân sách độ trễ (đo p50/p95 theo `maxTokens` × `maxCandidates`), tiếng Anh (R@6 ≥ 72,7%, từ chối đúng ≥ 83,3%). Chọn trên dev
  bằng `chooseRerankConfig`; xác nhận `gateVerdict` trên hold-out.
- **Rationale:** độ trễ tỉ lệ ~ `maxCandidates × maxTokens` — phải đo, không suy.

## R6 — Trình bày đoạn bảng cho bộ chấm (PR 2, có điều kiện)

- **Decision (nếu R2 cho thấy `cutOff` là nguyên nhân):** hàm thuần `rerankInput(chunkText, query)` trong `src/main/services/rag/rerank-input.ts`:
  với đoạn bảng Markdown, ưu tiên dòng có trùng từ khoá với câu hỏi + dòng tiêu đề, cắt bớt cột / dòng còn lại để vừa cửa sổ; đoạn không phải
  bảng ⇒ giữ nguyên. Chỉ dùng cho chuỗi gửi bộ chấm; chunk lưu / hiển thị / locator không đổi.
- **Alternatives:** chia nhỏ chunk bảng (đổi chunker ⇒ đổi locator, `PDF_EXTRACTION_VERSION` — bác, ngoài phạm vi).

## R7 — Bước 2: model khác (chỉ khi bước 1 không đạt)

- **Decision:** ứng viên phải: giấy phép cho phép thương mại, có ONNX int8 chạy bằng `@huggingface/transformers`, đa ngôn ngữ (vi + en), tải
  ≤ 150 MB, RAM +≤ 200 MB; ghim revision; đo cùng lưới. Danh sách ứng viên cụ thể chốt ở PR 2 (cần tra Hugging Face — thao tác mạng, hỏi chủ
  dự án trước).

## R8 — Không đạt

- **Decision:** giữ cấu hình hiện hành; ADR "giới hạn đã biết" kèm bảng số liệu + chẩn đoán; giữ #187 mở; mở issue mới cho hướng tiếp (clarify
  specify #3).
