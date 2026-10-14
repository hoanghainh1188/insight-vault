# Tasks: Bộ chấm độ liên quan — câu sát chủ đề và đoạn bảng (187)

**Input**: `specs/20261012-120856-reranker-near-topic/` (spec.md, plan.md, research.md R1–R8, data-model.md, contracts/diagnostics.md,
contracts/rerank-input.md, quickstart.md) · Quyết định: `docs/04-decisions/2026-10-12-reranker-near-topic-clarify.md`

**Tests**: BẮT BUỘC (Constitution IV, FR-012) — viết test TRƯỚC, chạy thấy FAIL, rồi mới hiện thực.

**Giao theo 2 PR (clarify #5):** **PR 1** = Phase 1–2 + Phase 6 phần PR 1 (chỉ `tests/eval/` + số liệu `RELEVANCE_CALIBRATION`); dừng chờ chủ
dự án duyệt v5. **PR 2** = Phase 3–5 + Phase 6 phần PR 2. US1 / US2 dùng chung nền chẩn đoán + v5 (Phase 2).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (PR 1)

- [X] T001 Append thuật ngữ mới bằng script (KHÔNG prettier lên glossary): ứng viên bộ chấm (`RerankCandidate`, `rerankCandidates`), chẩn đoán bộ
      chấm (`RerankDiagnosis`, `diagnoseRerank`, nguyên nhân `cutOff` / `lowScoreInWindow` / `nearTopicHighScore` / `notRetrieved`), cửa sổ token
      (`windowText`, `quoteInWindow`), bộ kiểm hồi quy đáp án-trong-bảng — `docs/00-glossary.md`.
- [X] T002 Lấy MỐC v4 có chi tiết: `EVAL_DETAILS=1 EVAL_MODE=current EVAL_RERANK=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 EVAL_RERANK_TOPN=12
    EVAL_RERANK_MAXLEN=256 npm run eval:retrieval` TRƯỚC khi đổi `tests/eval/`; lưu report.json / report.md vào scratchpad (ngoài repo) — mốc
      "trước" cho so từng câu (FR-005).

---

## Phase 2: Foundational — chẩn đoán + bộ câu hỏi v5 (PR 1, chặn US1 / US2)

### Chẩn đoán (FR-001)

- [X] T003 [P] Viết test TRƯỚC `tests/unit/eval-rerank-diagnose.test.ts` cho `diagnoseRerank(outcomes, questions, minScore)`
      (`tests/eval/lib/rerank-diagnose.ts`): câu có đáp án bị từ chối với đoạn đúng `quoteInWindow: false` ⇒ `cutOff`; trong cửa sổ nhưng điểm
      < minScore ⇒ `lowScoreInWindow`; không có đoạn đúng trong ứng viên ⇒ `notRetrieved`; câu không đáp án không bị từ chối ⇒
      `nearTopicHighScore` kèm `bestScore`; còn lại ⇒ `ok`; `answerRrfRank` 1-based; thiếu `rerankCandidates` ⇒ bỏ qua câu; không mutate; danh sách
      quan tâm (q-176, q-179, q-162, q-170, q-171) luôn có mặt kể cả `ok`. Chạy ⇒ FAIL.
- [X] T004 Hiện thực `tests/eval/lib/rerank-diagnose.ts` (+ kiểu `RerankCandidate`, `RerankDiagnosis` theo data-model); thêm vào `coverage.include`
      của `vitest.config.ts`. T003 xanh.
- [X] T005 Sửa `tests/eval/lib/rerank.ts` (I/O): scorer lộ `windowText(query, passageText): string` — tokenizer cùng `max_length` của scorer,
      giải mã phần ĐOẠN còn lại sau khi cắt cặp (câu hỏi, đoạn); kiểm tay trên 1 cặp ngắn (giữ nguyên) và 1 đoạn bảng dài (bị cắt).
- [X] T006 Sửa `tests/eval/lib/harness.ts` (I/O): `RerankRun` thêm `record?: true` ⇒ bọc `score` để ghi `(query → [{id, score}])` theo thứ tự app
      gửi; `evaluateConfig` gắn `QuestionOutcome.rerankCandidates` (≤ `maxCandidates`: `chunkId`, `source`, `score`, `hit` qua
      `chunkContainsAnyQuote`, `quoteInWindow` qua `windowText` cho đoạn hit); `QuestionOutcome.rerankCandidates?` thêm vào `tests/eval/lib/metrics.ts`.
- [X] T007 [P] Viết test TRƯỚC trong `tests/unit/eval-report.test.ts` cho `renderRerankDiagnosis(report)` (contracts/diagnostics.md): không có
      `rerankDiagnosis` ⇒ rỗng; có ⇒ bảng (câu, loại, tập, nguyên nhân, điểm cao nhất, điểm đoạn đúng, hạng RRF, đáp án trong cửa sổ) + dòng tổng
      theo nguyên nhân; không in nội dung đoạn. Chạy ⇒ FAIL; hiện thực trong `tests/eval/lib/report.ts` (+ `EvalReport.rerankDiagnosis?`). Xanh.
- [X] T008 Sửa `tests/eval/retrieval.eval.ts`: khi `EVAL_DETAILS=1`, phần đo đường app (cấu hình 108 + bộ chấm đã ghi) chạy với `record` ⇒
      `details.production[].rerankCandidates` + `rerankDiagnosis` (`diagnoseRerank`) vào báo cáo; không đổi số liệu / cổng.
- [X] T009 Chạy chẩn đoán trên v4 (lệnh T002, nay có mục chẩn đoán) — ghi kết quả (nguyên nhân của q-162, q-176, q-179, 2 câu không đáp án cũ lọt
      ở dev; `quoteInWindow` của q-162 / q-170 / q-171) vào ghi chú cho ADR (T014).

### Bộ câu hỏi v5 (FR-013)

- [X] T010 [P] Viết test TRƯỚC bổ sung `tests/unit/eval-pdf-corpus.test.ts` (hoặc file mới `tests/unit/eval-dataset-v5.test.ts`): `datasetVersion`
      "5"; mỗi tài liệu thật (không nhiễu) có ≥ 2 câu `unanswerable` gắn với nó (trường mới tuỳ chọn `topicDocId` = id tài liệu thật, chỉ ở câu
      `unanswerable`; câu về PDF giữ thêm `topic: "pdf"` — data-model); có ≥ 2 câu có đáp án mà trích dẫn bắt đầu bằng `|` (dòng bảng) ngoài q-162 / q-170 / q-171 nếu corpus có
      bảng; câu mới đều tiếng Việt; tỉ lệ dev / hold-out mỗi loại trong [60%, 80%]. Chạy ⇒ FAIL.
- [X] T011 Soạn ~20 câu không đáp án sát chủ đề (≈ 2 / tài liệu thật, 10 tài liệu) + 2–3 câu đáp án-trong-bảng trong `tests/eval/questions.json`;
      với mỗi câu không đáp án: grep từ khoá + đồng nghĩa trên văn bản khi nạp (dump `parsePdf` cho PDF + `.md`) để CHẮC không có đáp án; trích dẫn
      bảng chép từ văn bản `parsePdf`; `datasetVersion` "5", `reviewed: null`; KHÔNG đổi câu hiện có. T010 + `eval-pdf-corpus` + `eval-dataset` xanh.
      `topicDocId` phải được validate trong `tests/eval/lib/dataset.ts` (chỉ ở `unanswerable`, id tồn tại, không phải tài liệu nhiễu) — test
      trước trong `tests/unit/eval-dataset.test.ts`.
- [X] T012 Đo v5 với cấu hình HIỆN HÀNH (lệnh T002); cập nhật CHỈ số liệu + `datasetVersion` "5" + `calibratedAt` trong
      `src/main/services/rag/relevance-calibration.ts` (cấu hình không đổi; kiểm diff); `tests/unit/relevance-calibration.test.ts` xanh. Ghi số liệu
      v5 hiện hành (mốc "trước" cho PR 2) + chẩn đoán v5.
- [X] T013 [P] Cập nhật `tests/eval/README.md` (mục chẩn đoán bộ chấm, `rerankCandidates`, `quoteInWindow`) và `tests/eval/corpus/README.md` nếu
      thêm tài liệu (không dự kiến).
- [X] T014 ADR chẩn đoán `docs/04-decisions/2026-10-1x-reranker-diagnosis.md` (kết quả T009 + T012, nguyên nhân từng câu, kết luận "cutOff hay
      model") + dòng `INDEX.md` bằng script.

**Checkpoint PR 1**: cổng review (code-reviewer, glossary-steward, security-reviewer) → test gate (lint, test, build, e2e) → mở PR 1 → **chủ dự án
duyệt v5** (`reviewed`) — PR 2 không bắt đầu trước khi v5 được duyệt.

---

> **Ghi chú thực thi PR 2 (2026-10-14, ADR `docs/04-decisions/2026-10-14-reranker-near-topic.md`):** không giải pháp nào đạt ⇒ đi
> nhánh T022 → T023 → T025. T017 hiện thực ở tệp mới `tests/eval/lib/rerank-sweep.ts` + `tests/eval/rerank-sweep.eval.ts` (không sửa
> `rerank-run.ts` / `retrieval.eval.ts`). T019–T021 làm theo điều kiện của clarify (đoạn bảng bị chấm thấp), không theo `cutOff`;
> `rerankInput` ở `tests/eval/lib/rerank-input.ts` (test `tests/unit/eval-rerank-input.test.ts`), T020 phần nối vào `retrieve()` KHÔNG làm
> vì không cứu được q-162. T022 / T023 đánh dấu xong = đã đo và kết luận KHÔNG ĐẠT (T023: `Xenova/bge-reranker-base`, chủ dự án cho nới trần
> tải chỉ để đo). T025: issue tiếp #205, #206, #207.

## Phase 3: User Story 1 — Câu sát chủ đề bị từ chối (P1, PR 2) 🎯

**Goal**: từ chối đúng tiếng Việt trên dev v5 ≥ 90%, gồm q-176, q-179.

**Independent Test**: lượt quét trên v5 ⇒ cấu hình chọn có từ chối đúng dev ≥ 90%, q-176 / q-179 `rejected`.

- [X] T015 [P] [US1] Viết test TRƯỚC trong `tests/unit/eval-rerank-grid.test.ts`: `buildRerankGrid({ maxCandidates: [8,12,16], maxTokens:
    [256,384,512], minScores, deltas })` sinh đủ tổ hợp, tất định, cấu hình hợp lệ (`validateRerankConfig`); `eligibleRerankConfigs(results,
    { tableGuardIds, enFloor }, latency })` loại cấu hình: làm một câu bộ kiểm bảng bị từ chối HOẶC có `hitRank > 6`
      (FR-004 — trong top 6), tiếng Anh dưới sàn (`enFloor` = số liệu tiếng Anh
      đo ở T012 — cấu hình hiện hành trên v5; nếu khác 72,7% / 83,3% thì báo lại), p50 > 400 / p95 > 800 ms. Chạy ⇒ FAIL.
- [X] T016 [US1] Hiện thực trong `tests/eval/lib/rerank-grid.ts` (lưới mở rộng + `eligibleRerankConfigs`); giữ `buildRerankGrid()` cũ tương
      thích. T015 xanh.
- [X] T017 [US1] Sửa `tests/eval/lib/rerank-run.ts` + `tests/eval/retrieval.eval.ts`: quét theo `maxTokens` (mỗi giá trị một scorer / một lượt
      ấm, đo p50/p95 riêng), lọc `eligibleRerankConfigs` TRƯỚC `chooseRerankConfig` (dev), rồi `gateVerdict` (hold-out); báo cáo lý do loại.
- [X] T018 [US1] Chạy quét trên v5 (đã duyệt): ghi cấu hình chọn / lý do không chọn được; so từng câu với mốc v5 hiện hành (T012).

---

## Phase 4: User Story 2 — Câu có đáp án trong bảng không bị từ chối nhầm (P1, PR 2, CÓ ĐIỀU KIỆN)

**Goal**: q-162, q-170, q-171 (+ câu bảng v5) không bị từ chối; đoạn đúng trong top 6.

**Điều kiện**: chỉ làm T019–T021 nếu chẩn đoán (T009 / T012) cho thấy `cutOff` là nguyên nhân chính của câu bảng bị từ chối VÀ T018 không cứu
được bằng `maxTokens` lớn hơn trong ngân sách. Ngược lại: đánh dấu "không cần" kèm số liệu.

- [X] T019 [P] [US2] Viết test TRƯỚC `tests/unit/rerank-input.test.ts` cho `rerankInput(chunkText, query, budgetChars)`
      (`src/main/services/rag/rerank-input.ts`, contracts/rerank-input.md): đoạn không bảng ⇒ nguyên văn; đoạn bảng ⇒ giữ tiêu đề + phân cách, ưu
      tiên dòng trùng từ với câu hỏi (NFC, bỏ dấu câu), rồi các dòng còn lại theo thứ tự, ≤ `budgetChars`; tất định; không mutate. Chạy ⇒ FAIL.
- [~] T020 [US2] Hiện thực `src/main/services/rag/rerank-input.ts`; `src/main/services/rag/retrieval.ts` dùng `rerankInput` cho `passages[].text` — KHÔNG ÁP DỤNG: không cấu hình nào đạt (ADR 2026-10-14-reranker-near-topic)
      gửi `deps.rerank` (chunk / locator / `ScoredChunk` không đổi); test `tests/unit/retrieval-rerank.test.ts` thêm ca: chuỗi gửi bộ chấm là bản
      trình bày, kết quả trả về vẫn là chunk gốc; fail-open giữ nguyên. Thêm `src/main/services/rag/rerank-input.ts` vào `coverage.include` của `vitest.config.ts`.
- [X] T021 [US2] Quét lại (T018) với `rerankInput`; so bộ kiểm bảng + câu v5.

---

## Phase 5: User Story 3 — Không tụt, cổng ĐẠT, bản ghi + ADR (P2, PR 2)

- [X] T022 [US3] Với cấu hình / giải pháp chọn: so TỪNG câu với mốc (v5 hiện hành) theo đường app — không câu hiện có nào tụt (R@6, MRR, từ chối
      đúng — vi dev / vi hold-out / en); `gateVerdict` ĐẠT; tiếng Anh ≥ 72,7% / 83,3%; p50 ≤ 400, p95 ≤ 800 ms. **Không đạt ⇒ bước 2 (T023); bước 2
      không đạt ⇒ T025 (giới hạn).**
- [X] T023 [US3] (Chỉ khi T022 không đạt) Bước 2 — model khác: **hỏi chủ dự án trước khi tra / tải model (thao tác mạng)**; tiêu chí: cho phép thương
      mại, ONNX int8 chạy bằng `@huggingface/transformers`, đa ngôn ngữ, tải ≤ 150 MB, RAM +≤ 200 MB; ghim revision; đo cùng lưới + T022.
- [~] T024 [US3] Đạt ⇒ cập nhật `src/main/services/rag/relevance-calibration.ts` (cấu hình + số liệu + `maxTokens`; `RERANK_MODEL_VERSION` / — KHÔNG ÁP DỤNG: không cấu hình nào đạt (ADR 2026-10-14-reranker-near-topic)
      `src/main/services/rerank/model-version.ts` nếu đổi model); test canh giữ xanh; ADR thực thi `docs/04-decisions/2026-10-1x-reranker-near-topic.md`
      (bảng trước / sau so mốc v4 và v5) + `INDEX.md`; đóng #187.
- [X] T025 [US3] Không đạt ⇒ giữ cấu hình; ADR "giới hạn đã biết" kèm số liệu + chẩn đoán; giữ #187 mở; mở issue mới (hướng tiếp: thêm dữ liệu / model
      lớn hơn) — hỏi chủ dự án trước khi tạo issue.

---

## Phase 6: Polish & cổng (mỗi PR)

- [X] T026 Cổng review PR 1: gọi song song code-reviewer, glossary-steward, security-reviewer; sửa Blocking (test trước).
- [X] T027 Test gate PR 1: `npm run lint && npm run test && npm run build && npx playwright test`; mở PR 1 (Part of #187); chờ duyệt v5.
- [X] T028 Cổng review PR 2 (security-reviewer BẮT BUỘC nếu đổi `src/main` hoặc model); sửa Blocking.
- [X] T029 Test gate PR 2 + eval xác nhận (quickstart PR 2); mở PR 2 (Closes #187 nếu đạt, Part of #187 nếu không).

---

> T005, T006, T008 là I/O (scorer / harness / eval runner) — ngoài coverage như 108 / 177; phần thuần (T003–T004, T007) có test trước.

## Dependencies & Execution Order

- T002 (mốc v4) trước mọi thay đổi `tests/eval/`. T003 → T004 → T006 → T008 → T009; T005 trước T006.
- T010 → T011 → T012 (đổi `datasetVersion` làm `relevance-calibration.test.ts` đỏ cho tới T012 — làm liền mạch).
- PR 2 (Phase 3–5) chỉ bắt đầu sau khi PR 1 merge VÀ v5 được duyệt. T019–T021 có điều kiện (theo chẩn đoán). T023 chỉ khi T022 không đạt.

## Parallel Opportunities

- T003 ‖ T007 ‖ T010 (khác tệp test). T013 ‖ T014.
- PR 2: T015 ‖ T019 (khác tệp).

## Implementation Strategy

- **PR 1 (MVP chẩn đoán)**: biết chính xác vì sao q-162 bị từ chối và q-176 / q-179 lọt, có bộ v5 đủ cỡ mẫu — chưa đổi hành vi app.
- **PR 2**: thay đổi nhỏ nhất đủ đạt FR-003…FR-005 (cấu hình trước, trình bày bảng nếu chẩn đoán đòi, model chỉ khi cần).
