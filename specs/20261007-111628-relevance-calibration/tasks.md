---
description: "Task list — 108 relevance-calibration"
---

# Tasks: Hiệu chuẩn bộ lọc độ liên quan của truy xuất

**Input**: `specs/20261007-111628-relevance-calibration/` — plan.md, spec.md, research.md, data-model.md, contracts/,
quickstart.md; quyết định `docs/04-decisions/2026-10-07-relevance-calibration-clarify.md`.

**Tests**: BẮT BUỘC (Constitution IV + yêu cầu người dùng): mọi hàm THUẦN viết test trước (RED → GREEN). Phần I/O của
công cụ đo (`tests/eval/lib/harness.ts`, `report.ts`, entry `.eval.ts`) không tính coverage, kiểm bằng chạy thật.

**Organization**: theo user story trong spec.md. US3 độc lập (MVP). US1/US2 cần bộ dữ liệu + công cụ đo của US4 và
**điểm DỪNG duyệt dữ liệu (T027)**.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

**Purpose**: khung thư mục + lệnh chạy công cụ đo (không đổi hành vi app)

- [X] T001 Tạo thư mục `tests/eval/corpus/`, `tests/eval/lib/`; thêm `tests/eval/.cache/` và `tests/eval/reports/` vào `.gitignore`
- [X] T002 [P] Tạo `vitest.eval.config.ts`: `include: ["tests/eval/**/*.eval.ts"]`, `environment: "node"`, `testTimeout`/`hookTimeout` 30 phút, alias `@shared` như `vitest.config.ts`, KHÔNG coverage
- [X] T003 [P] Thêm script `"eval:retrieval": "vitest run -c vitest.eval.config.ts"` vào `package.json` (không đụng script `test`)
- [X] T004 [P] Xác nhận `tests/eval/**/*.ts` nằm trong phạm vi `prettier --check "tests/**/*.ts"`, eslint và `tsconfig.node.json` (bổ sung `include` nếu thiếu) để lint/typecheck phủ công cụ đo

---

## Phase 2: Foundational (chặn mọi story)

**Purpose**: logic lọc thuần dùng chung app + công cụ đo; `retrieve()` nhận cấu hình nhưng hành vi MẶC ĐỊNH chưa đổi

- [X] T005 [P] RED — `tests/unit/relevance-filter.test.ts`: theo `contracts/relevance-filter.md` — ngưỡng tuyệt đối; ngưỡng tương đối (min trên vHits TRƯỚC lọc); 4 chế độ `bm25Gate` (`none`/`requireVector`/`vectorWithin` thiếu distance ⇒ loại/`minScore`); giữ thứ tự, không thêm/đổi id; `validateRelevanceConfig` ném khi thiếu trường phụ / số không hữu hạn / âm (trừ `bm25MaxScore`)
- [X] T006 GREEN — `src/main/services/rag/relevance-filter.ts`: `RelevanceConfig`, `validateRelevanceConfig`, `selectRelevant` (thuần, không I/O)
- [X] T007 Tạo `src/main/services/rag/relevance-calibration.ts`: `RELEVANCE_CALIBRATION = { embeddingModelVersion: EMBEDDING_MODEL_VERSION, config: { maxDistance: 0.5, relativeDelta: null, bm25Gate: "none", bm25VectorMaxDistance: null, bm25MaxScore: null }, calibratedAt: null, datasetVersion: null, metrics: null }` (= hành vi hiện tại — BASELINE); export kiểu `RelevanceCalibration`
- [X] T008 RED — cập nhật `tests/unit/retrieval.test.ts` + `tests/unit/retrieval-hybrid.test.ts`: `retrieve()` nhận `cfg` tuỳ chọn; cfg baseline ⇒ kết quả như trước; `requireVector` ⇒ hit chỉ-BM25 bị loại; `vectorWithin` dùng distance tính từ vector của `getVectorsByIds` + vector câu hỏi; MMR vẫn dùng cùng `vecMap` (một lần gọi `getVectorsByIds`); (C1) hit chỉ-BM25 (gate `none`/`minScore`) có `score` = cosine distance thật, thiếu vector ⇒ `cfg.maxDistance`; (E2/FR-018) keyword search ném lỗi với gate `requireVector`/`vectorWithin` ⇒ vẫn trả kết quả vector đã lọc, không ném; có `history` ⇒ cfg áp lên câu đã viết lại; rewrite lỗi ⇒ dùng câu gốc và vẫn áp cfg
- [X] T009 GREEN — `src/main/services/rag/retrieval.ts`: thay lọc `h.score <= RELEVANCE_MAX_DISTANCE` bằng `selectRelevant(…, cfg ?? RELEVANCE_CALIBRATION.config)`; tính cosine distance cho `vectorWithin` từ vector đã lấy (gọi `getVectorsByIds` MỘT lần cho hợp tập vector ∪ BM25, dùng lại cho MMR); thay fallback `vScore.get(id) ?? RELEVANCE_MAX_DISTANCE` cho hit chỉ-BM25 bằng distance thật tính từ `getVectorsByIds`, thiếu vector ⇒ `cfg.maxDistance`; giữ nguyên nhánh `catch` của keyword search và rewrite; giữ chữ ký với `rag-service` (tham số cfg cuối, tuỳ chọn)
- [X] T010 Xoá `RELEVANCE_MAX_DISTANCE` khỏi `src/main/services/rag/constants.ts`; sửa mọi import (grep toàn repo) — một nguồn sự thật là `RELEVANCE_CALIBRATION`

**Checkpoint**: `npm test` xanh, hành vi app y nguyên (cfg baseline).

---

## Phase 3: User Story 3 — Câu trả lời không trích dẫn được thì không trình bày như có căn cứ (P1) 🎯 MVP

**Goal**: chế độ theo nguồn: không `[n]` hợp lệ ⇒ "Không tìm thấy" + gợi ý; mọi nhánh not-found hiển thị gợi ý (FR-015, FR-016)

**Independent Test**: giả lập mô hình trả lời không `[n]` ở chế độ theo nguồn ⇒ `notFound: true`, `citations: []`, câu hiển thị có gợi ý; chế độ Mở rộng không đổi

- [X] T011 [P] [US3] RED — `tests/unit/rag-service.test.ts`: (a) grounded + mô hình trả lời không `[n]` hợp lệ, không chứa "không tìm thấy" ⇒ `{ answer: NOT_FOUND_DISPLAY, citations: [], notFound: true }` (trước đây: `citationsFromMap`); (b) grounded + retrieval rỗng ⇒ `NOT_FOUND_DISPLAY`; (c) mô hình tự trả "Không tìm thấy trong nguồn." ⇒ `NOT_FOUND_DISPLAY`; (d) grounded có `[n]` hợp lệ ⇒ không đổi; (e) open ⇒ không đổi; (f) `saveTurn` nhận đúng `NOT_FOUND_DISPLAY` + `notFound: true`; (g) stream (`askStream`) cùng hành vi; (h) chế độ Mở rộng + `retrieve()` trả `[]` ⇒ VẪN gọi chat, không trả `NOT_FOUND_DISPLAY` (FR-014)
- [X] T012 [P] [US3] RED — `tests/unit/rag-prompt.test.ts`: prompt grounded vẫn yêu cầu nguyên văn `NOT_FOUND_ANSWER` (không chứa gợi ý)
- [X] T013 [US3] GREEN — `src/main/services/rag/constants.ts`: thêm `NOT_FOUND_HINT = "Thử hỏi cụ thể hơn, hoặc chuyển sang chế độ Mở rộng nếu chấp nhận nội dung ngoài tài liệu."` và `NOT_FOUND_DISPLAY = \`${NOT_FOUND_ANSWER} ${NOT_FOUND_HINT}\``; GIỮ `NOT_FOUND_ANSWER` cho prompt/nhận diện (research R7)
- [X] T014 [US3] GREEN — `src/main/services/rag/rag-service.ts`: mọi nhánh trả người dùng not-found dùng `NOT_FOUND_DISPLAY`; thay nhánh `citationsFromMap(built.map)` ở grounded bằng not-found (gỡ import nếu không còn dùng)
- [X] T015 [US3] Rà renderer/E2E có so khớp chuỗi "Không tìm thấy trong nguồn" (grep `src/renderer`, `tests/e2e`) — cập nhật kỳ vọng nếu cần (khớp tiền tố). Câu đọc a11y "Không tìm thấy thông tin trong nguồn." ở `src/renderer/shared/a11y/messages.ts` CỐ Ý giữ nguyên (FR-016 chỉ áp cho câu hiển thị)

**Checkpoint**: US3 hoàn chỉnh, test xanh — có thể merge riêng.

---

## Phase 4: User Story 4 — Bộ đánh giá + công cụ đo (P2, tiền đề cho US1/US2)

**Goal**: một lệnh đo Recall@k, MRR, từ chối đúng/nhầm, histogram, dev/hold-out/en (FR-001..FR-009)

**Independent Test**: `EVAL_MODE=current npm run eval:retrieval` trên máy sạch ⇒ báo cáo đủ chỉ số; chạy lại cho kết quả truy xuất giống hệt

### Tests (RED trước)

- [X] T016 [P] [US4] RED — `tests/unit/eval-dataset.test.ts` (dữ liệu giả nhỏ trong test): `normalizeForMatch` (NFC + gộp khoảng trắng + trim); `chunkContainsAnyQuote`; `validateManifest` (id trùng, thiếu giấy phép, < `MIN_CORPUS_DOCS` tài liệu thật / < `MIN_NOISE_DOCS` nhiễu — test import hằng số, không ghi số cứng); `validateQuestions` (answerable phải có ≥1 trích đoạn ≤ 200 ký tự có NGUYÊN VĂN trong tài liệu nêu ở `docIds`; unanswerable không có trích đoạn; `lang`, `type`, `split` hợp lệ; id trùng); `isReviewed`
- [X] T017 [P] [US4] RED — `tests/unit/eval-metrics.test.ts`: `recallAtK(k=1,3,6)`, `mrr` (0 khi không trúng trong top-6), `correctRejectionRate`, `falseRejectionRate`, `wilson95`, `histogram` (20 bucket), `chooseConfig` theo FR-011/012 (lọc từ chối đúng ≥ 0.9 trên dev → Recall@6 cao nhất; ≥ 0.85 thì ưu tiên ít tham số rồi biên lớn nhất; < 0.75 ⇒ `null` + lý do; CHỈ đọc số liệu dev), `configComplexity`, `confirmOnHoldout(metrics) → { pass, reasons[] }` (pass ⇔ từ chối đúng ≥ 0.9 VÀ Recall@6 ≥ 0.75; mỗi điều kiện trượt ⇒ 1 lý do)
- [X] T018 [P] [US4] RED — trong `tests/unit/eval-metrics.test.ts`: mọi cấu hình của `buildGrid()` vượt `validateRelevanceConfig`; lưới chứa cấu hình baseline

### Implementation

- [X] T019 [US4] GREEN — `tests/eval/lib/dataset.ts`: nạp `corpus/manifest.json` + tệp `.md` + `questions.json`, các hàm ở T016; export `MIN_CORPUS_DOCS = 8`, `MIN_NOISE_DOCS = 2`
- [X] T020 [US4] GREEN — `tests/eval/lib/metrics.ts`: các hàm ở T017
- [X] T021 [US4] GREEN — `tests/eval/lib/grid.ts`: `buildGrid()` theo research R4 + baseline `{0.5, null, "none"}`
- [X] T022 [US4] `tests/eval/lib/harness.ts` (I/O): thư mục tạm `os.tmpdir()/iv-eval-*`; `openDatabase` + `runMigrations`; `createSourceRepo`, `createVectorStore`, `createKeywordStore`, `createIngestionPipeline` (parser md) + `createEmbedder({ cacheDir: EVAL_CACHE_DIR })`; nạp MỌI tài liệu (kể cả nhiễu) vào 1 notebook; với mỗi câu embed + tìm MỘT lần (cache deps) rồi gọi `retrieve(question, nb, cachedDeps, [], cfg)` cho từng cấu hình; đo thời gian `retrieve()`; xoá thư mục tạm
- [X] T023 [US4] `tests/eval/lib/report.ts`: bảng console + `tests/eval/reports/<YYYYMMDD-HHmmss>/report.{json,md}` theo `data-model.md` (EvalReport), gồm baseline, cấu hình được chọn, histogram, `avgRetrieveMs`, cảnh báo `reviewed = null`
- [X] T024 [US4] `tests/eval/retrieval.eval.ts`: đọc `EVAL_MODE` / `EVAL_CONFIG` / `EVAL_WITH_LLM` / `EVAL_LLM_MODEL` / `EVAL_CACHE_DIR` (contracts/eval-retrieval-cli.md); validate dữ liệu (lỗi ⇒ fail kèm danh sách); chạy harness; ghi báo cáo
- [X] T025 [P] [US4] Nhánh `EVAL_WITH_LLM=1` trong `tests/eval/lib/harness.ts`: `createOllamaClient` + `createRagService` thật, chế độ theo nguồn trên câu hold-out, đếm `notFound`; Ollama không chạy ⇒ bỏ qua kèm cảnh báo (research R9)
- [X] T026 [P] [US4] `.github/workflows/eval-retrieval.yml`: chỉ `workflow_dispatch`; ubuntu-latest, Node 24, `npm ci`, `actions/cache` cho `tests/eval/.cache/models` (key theo `EMBEDDING_MODEL_VERSION`), `npm run eval:retrieval`, upload `tests/eval/reports/**` artifact `eval-report`; KHÔNG thêm vào required checks
- [X] T027 [US4] Soạn `tests/eval/corpus/`: `README.md` (nguồn + giấy phép từng tài liệu, ghi CC BY-SA 4.0 cho Wikipedia), `manifest.json`, 8–12 tài liệu `.md` toàn văn (văn bản pháp luật VN + bài Wikipedia tiếng Việt, đa chủ đề) + 2–3 tài liệu nhiễu
- [X] T028 [US4] Soạn `tests/eval/questions.json`: ~80 `answerable/vi` (trích đoạn nguyên văn ngắn), ~20 `unanswerable/vi` (gần chủ đề nhưng tài liệu không có — gồm câu trùng từ thông dụng), ~10 `en` tham khảo; chia dev/hold-out ~70/30 trong từng loại; `datasetVersion: "1"`, `reviewed: null`
- [X] T029 [US4] Chạy `EVAL_MODE=current npm run eval:retrieval` để kiểm dữ liệu (mọi trích đoạn khớp, nạp được) và tính tất định (chạy 2 lần so sánh); sửa dữ liệu đến khi sạch
- [X] T030 [US4] ⛔ **DỪNG — NGƯỜI DÙNG DUYỆT** danh sách tài liệu (nguồn, giấy phép) + toàn bộ bộ câu hỏi (FR-003). Chỉ sau khi người dùng đồng ý mới ghi `reviewed: { by, date }` vào `tests/eval/questions.json`. **KHÔNG chạy T031 trở đi trước khi xong bước này.**

**Checkpoint**: công cụ đo chạy được, dữ liệu đã duyệt.

---

## Phase 5: User Story 1 — Hỏi điều tài liệu không có ⇒ "Không tìm thấy", không bị bịa (P1)

**Goal**: chọn + áp dụng cấu hình đạt từ chối đúng ≥ 90% trên hold-out (FR-010..FR-014, SC-001)

**Independent Test**: `EVAL_MODE=current npm run eval:retrieval` ⇒ hold-out VN: từ chối đúng ≥ 90%

- [ ] T031 [US1] Đo baseline (`EVAL_MODE=current`, cấu hình 0.5/none) — lưu báo cáo làm mốc SC-001 (ghi số vào ghi chú cho ADR)
- [ ] T032 [US1] Quét lưới (`npm run eval:retrieval`): chọn trên dev theo `chooseConfig`, xác nhận trên hold-out bằng `confirmOnHoldout`. Nếu không cấu hình nào đạt sàn Recall@6 ≥ 75% với từ chối đúng ≥ 90% trên dev, HOẶC cấu hình được chọn trượt `confirmOnHoldout` ⇒ **DỪNG, báo người dùng kèm số liệu** (không tự hạ mục tiêu, KHÔNG chọn lại cấu hình dựa trên hold-out)
- [ ] T033 [US1] Áp dụng: cập nhật `RELEVANCE_CALIBRATION` trong `src/main/services/rag/relevance-calibration.ts` (config, `calibratedAt`, `datasetVersion: "1"`, `metrics.dev`, `metrics.holdout`)
- [ ] T034 [US1] Test theo cấu hình mới trong `tests/unit/retrieval-hybrid.test.ts`: câu chỉ trùng từ thông dụng, không có hỗ trợ ngữ nghĩa ⇒ `retrieve()` trả `[]`; `rag-service` grounded + retrieval rỗng ⇒ không gọi chat
- [ ] T035 [US1] Kiểm hồi quy: `EVAL_MODE=current npm run eval:retrieval` khớp `RELEVANCE_CALIBRATION.metrics`; (SC-006) so `avgRetrieveMs` cấu hình mới với baseline trong CÙNG lần chạy — tăng > 10% ⇒ báo người dùng + ghi vào ADR (T041)

---

## Phase 6: User Story 2 — Hỏi điều tài liệu có ⇒ vẫn có câu trả lời + trích dẫn đúng (P1)

**Goal**: Recall@6 hold-out ≥ 85% (sàn 75%) với cấu hình đã chọn; không làm hỏng tìm toàn văn/Studio (SC-002, SC-005)

**Independent Test**: báo cáo hold-out VN Recall@6 ≥ 85%; `content-search` + Studio test không đổi

- [ ] T036 [P] [US2] Test trong `tests/unit/retrieval-hybrid.test.ts` với cấu hình đã chọn: câu đồng nghĩa (chỉ có hỗ trợ vector) vẫn giữ đoạn đúng; thuật ngữ hiếm có hỗ trợ ngữ nghĩa vẫn giữ; notebook 1 tài liệu ngắn — ngưỡng tương đối không loại đoạn đúng duy nhất (edge case)
- [ ] T037 [US2] Ghi danh sách câu bị từ chối nhầm (hold-out) từ báo cáo vào ghi chú ADR (minh bạch đánh đổi)
- [ ] T038 [P] [US2] Xác nhận không đổi hành vi ngoài phạm vi: `tests/unit/content-search.test.ts`, `tests/unit/keyword-store.test.ts`, `tests/unit/studio-*.test.ts` xanh không sửa; grep đảm bảo `relevance-filter` chỉ được import bởi `retrieval.ts` (+ công cụ đo)

---

## Phase 7: User Story 5 — Đổi mô hình embedding thì bị nhắc hiệu chuẩn lại (P3)

**Goal**: FR-019, SC-007

**Independent Test**: đổi `EMBEDDING_MODEL_VERSION` tạm thời ⇒ test fail với thông báo rõ

- [ ] T039 [P] [US5] RED — `tests/unit/relevance-calibration.test.ts`: `RELEVANCE_CALIBRATION.embeddingModelVersion === EMBEDDING_MODEL_VERSION` với thông báo "Đổi mô hình embedding ⇒ chạy `npm run eval:retrieval` và cập nhật relevance-calibration.ts"; `validateRelevanceConfig(RELEVANCE_CALIBRATION.config)` không ném; `metrics` có `dev`/`holdout` sau khi hiệu chuẩn
- [ ] T040 [US5] GREEN — điều chỉnh `src/main/services/rag/relevance-calibration.ts` nếu cần để test đạt; thử đổi tạm phiên bản để xác nhận test fail rồi hoàn nguyên

---

## Phase 8: Polish & Cross-Cutting

- [ ] T041 ADR `docs/04-decisions/2026-10-<dd>-relevance-calibration.md`: số liệu baseline vs cấu hình chọn (dev/hold-out/en, khoảng tin cậy), các phương án đã quét, lý do chọn, câu bị từ chối nhầm, giới hạn (~100 câu); ghi rõ THAY THẾ phát biểu `RELEVANCE_MAX_DISTANCE = 0.75` của `2026-07-11-rag-retrieval-strategy.md` (thêm dòng "Superseded" vào ADR cũ); append `docs/04-decisions/INDEX.md`
- [ ] T042 [P] Append thuật ngữ mới vào `docs/00-glossary.md` (bộ đánh giá, câu không có đáp án, trích đoạn đáp án, Recall@k, MRR, từ chối đúng/nhầm, chặn BM25, ngưỡng tương đối, bản ghi hiệu chuẩn, dev/hold-out, tài liệu nhiễu) — theo mục "Thuật ngữ mới" của intake
- [ ] T043 [P] Thêm `tests/eval/lib/dataset.ts`, `tests/eval/lib/metrics.ts`, `tests/eval/lib/grid.ts` vào `coverage.include` của `vitest.config.ts` (`relevance-filter.ts`/`relevance-calibration.ts` đã nằm trong `src/main/services/**`)
- [ ] T044 [P] `tests/eval/README.md`: cách chạy, biến môi trường, cách thêm câu hỏi, quy trình khi đổi mô hình/chunker (trỏ quickstart.md)
- [ ] T045 Gate: `npm run lint && npm test && npm run build && npx playwright test` xanh, coverage ≥ 80%; chạy kịch bản `quickstart.md` mục 5 trên app (`npm run dev`)

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2)** → mọi story.
- **US3** chỉ cần Foundational — làm trước (MVP), có thể merge riêng.
- **US4** cần Foundational; **T030 DỪNG duyệt** chặn US1/US2.
- **US1** cần US4 (đã duyệt). **US2** cần US1 (cùng cấu hình đã chọn). **US5** cần US1 (bản ghi có metrics).
- **Polish** sau US1/US2/US5.

```text
Setup → Foundational ─┬─ US3 (MVP)
                      └─ US4 ─⛔T030─ US1 ─ US2
                                        └─ US5 ─ Polish
```

## Parallel Opportunities

- Setup: T002, T003, T004 song song.
- Foundational: T005 song song với T007.
- US3: T011, T012 song song (khác tệp test).
- US4: T016, T017, T018 (test) song song; T025, T026 song song với T027/T028 (dữ liệu).
- US2: T036, T038 song song.
- Polish: T042, T043, T044 song song.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US3 ⇒ đã chặn đường "bịa" lớn nhất ở tầng trả lời (không cần dữ liệu).
2. **Đo lường**: US4 (công cụ + dữ liệu) ⇒ ⛔ người dùng duyệt (T030).
3. **Hiệu chuẩn**: US1 → US2 (cùng một lần quét, hai góc kiểm) ⇒ áp dụng cấu hình.
4. **Bảo vệ về sau**: US5 guard.
5. **Polish**: ADR, glossary, README, gate.
