# Tasks: Tách câu hỏi không có đáp án ở tầng truy xuất (109)

**Input**: `specs/20261008-194015-unanswerable-detection/` (plan, spec, research R1–R12, data-model, contracts/, quickstart)

**Tests**: BẮT BUỘC (Constitution IV — TDD): mọi hàm thuần viết test trước, chạy thấy FAIL rồi mới code.

**Quy ước**: không chạy prettier lên `docs/00-glossary.md`, `docs/04-decisions/INDEX.md`, `tests/eval/corpus/`, `tests/eval/questions.json`
(sửa bằng script, append dòng). Commit theo phase. `[P]` = khác tệp, không phụ thuộc task chưa xong.

**Cấu trúc hai pha có cổng** (plan): Phase 1–3 = Pha 0 thí nghiệm (hành vi app KHÔNG đổi — mọi thay đổi ở `src/` trong Pha 0 có mặc định tắt) →
**CỔNG T023** → Phase 4–6 chỉ khi ĐẠT → Phase 7 Polish. Nhánh KHÔNG ĐẠT: Phase 8 thay cho Phase 4–6.

> **Sửa sau `/speckit-analyze` (2026-10-08):** C1 thuật ngữ append glossary lên Phase 2 (T003, trước khi đặt tên); U1 hỗ trợ rerank trong `retrieve()` lên
> Phase 2 với mặc định `rerankCfg = null` để công cụ đo gọi ĐÚNG `retrieve()` của app; G1 ghi chú nhánh chọn hướng (b) ở T023; G2 ca tất định ở T007;
> G3 nhánh ngưỡng theo ngôn ngữ ở T021; I1 làm rõ timeout ≠ mục tiêu độ trễ (research R8).

---

## Phase 1: Setup

- [X] T001 Smoke-test nạp cross-encoder bằng `@huggingface/transformers` trong Node (script tạm ngoài repo hoặc bản nháp `tests/eval/lib/rerank.ts`):
      a1 `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` với `model_file_name` `model_qint8_arm64` + `dtype: "fp32"` qua `AutoModelForSequenceClassification`;
      a2 `onnx-community/gte-multilingual-reranker-base` `dtype: "q8"` qua `AutoModel` (research R2) — tokenizer cặp `text_pair`, `sigmoid(logits)`;
      ghi kết quả (nạp được? cần `token_type_ids`? điểm cặp liên quan > không liên quan cho 1 ví dụ vi + 1 en→vi) vào
      `specs/20261008-194015-unanswerable-detection/research.md` (mục R2 "Kết quả smoke-test"). Model không nạp được ⇒ ghi lý do, loại khỏi đo.
- [X] T002 [P] Đảm bảo `tests/eval/.cache/` đã gitignore và workflow `.github/workflows/eval-retrieval.yml` cache cả model reranker
      (khoá cache theo danh sách model).

---

## Phase 2: Foundational (dùng chung công cụ đo + app; mặc định tắt)

- [X] T003 Append thuật ngữ mới vào `docs/00-glossary.md` bằng script (KHÔNG prettier) TRƯỚC khi đặt tên trong code (Constitution — terminology
      fidelity): bộ chấm độ liên quan / reranker (cross-encoder), điểm rerank (`rerankScore`), cấu hình rerank (`RerankConfig`), áp rerank (`applyRerank`),
      câu không đáp án sát chủ đề (hard negative), trạng thái bộ chấm (`RerankerStatus`), bỏ qua bước chấm (fail-open, `onRerankSkip`).
- [X] T004 Viết test TRƯỚC `tests/unit/rerank-filter.test.ts` cho `validateRerankConfig` và `applyRerank` theo `contracts/rerank-filter.md`: ngưỡng
      tuyệt đối, tương đối (best − delta), cả hai; `reorder` false giữ thứ tự RRF / true sắp giảm dần + hoà giữ thứ tự RRF; id thiếu điểm bị loại; không id
      nào có điểm ⇒ rỗng; không mutate đầu vào; `ids ⊆ fused`; cấu hình ngoài miền ⇒ ném. Chạy thấy FAIL.
- [X] T005 Hiện thực `src/main/services/rag/rerank-filter.ts` (`RerankConfig`, `validateRerankConfig`, `applyRerank`) cho T004 xanh; thêm vào
      `coverage.include` nếu cấu hình coverage liệt kê tệp.
- [X] T006 [P] Thêm `rerankScore?: number` vào `ScoredChunk` trong `src/main/services/rag/rag-types.ts` (chú thích: chỉ có khi bước rerank chạy;
      `score` vẫn là cosine distance).
- [X] T007 Viết test TRƯỚC `tests/unit/retrieval-rerank.test.ts` (DI giả, không model): `rerankCfg` null hoặc thiếu `deps.rerank` ⇒ kết quả y hệt 108;
      rerank trả điểm ⇒ chỉ đoạn đạt vào MMR, có `rerankScore`, `score` giữ cosine distance, `locator` nguyên; không đoạn nào đạt ⇒ `[]`; `reorder` true ⇒
      thứ tự theo điểm trước MMR; câu đã viết lại (có lịch sử) được gửi rerank; `fused` rỗng ⇒ không gọi rerank; **tất định: gọi `retrieve()` 5 lần với cùng
      điểm ⇒ 5 kết quả giống hệt (SC-005)**; fail-open: rerank ném lỗi ⇒ hành vi 108 + `onRerankSkip("error")`, quá `timeoutMs` (fake timers) ⇒ 108 +
      `"timeout"`, ném `RerankNotReadyError` ⇒ 108 + `"notReady"`. Chạy thấy FAIL.
- [X] T008 Sửa `src/main/services/rag/retrieval.ts`: thêm `deps.rerank?`, `deps.onRerankSkip?`, tham số `rerankCfg` (mặc định
      `RELEVANCE_CALIBRATION.rerank?.config ?? null` — hiện chưa có trường `rerank` ⇒ null ⇒ app không đổi hành vi), bước rerank sau RRF/trước MMR theo
      `contracts/rerank-filter.md`, bọc timeout; export `RerankNotReadyError` (vd `src/main/services/rag/rerank-filter.ts`); T007 xanh;
      `tests/unit/retrieval.test.ts`, `tests/unit/retrieval-hybrid.test.ts` vẫn xanh không sửa kỳ vọng.

**Checkpoint**: `npm test` xanh; app không đổi hành vi (rerank tắt). Commit.

---

## Phase 3: User Story 3 — Chủ dự án chọn hướng bằng số đo (Priority: P1) 🎯 Pha 0

**Goal**: bộ đo v3 đủ tin cậy + công cụ đo so sánh a1/a2 (và b nếu cần) trên ĐÚNG `retrieve()` của app + kết luận cổng.

**Independent Test**: `EVAL_RERANK=<a1>,<a2> npm run eval:retrieval` ⇒ báo cáo có bảng theo model, CI95, độ trễ, dòng ĐẠT/ĐẠT SÀN/KHÔNG ĐẠT.

### Bộ đo v3

- [X] T009 [US3] Soạn 12 câu tiếng Việt `type: "unanswerable"` (8 `dev` + 4 `holdout`) và 3 câu `lang: "en"` `unanswerable` (`dev`), ưu tiên câu **sát chủ
      đề** (hỏi chi tiết không có về đúng chủ thể của tài liệu trong `tests/eval/corpus/`), mỗi câu kèm bằng chứng grep tài liệu không có đáp án; ghi bảng đề
      xuất (id, câu, nhóm, lý do, bằng chứng) vào `specs/20261008-194015-unanswerable-detection/eval-dataset-v3.md`.
- [X] T010 [US3] **DỪNG — chờ chủ dự án duyệt** bảng ở T009 (sửa/loại câu theo phản hồi). Không đi tiếp T011 khi chưa duyệt.
- [X] T011 [US3] Append các câu đã duyệt vào `tests/eval/questions.json` bằng script (KHÔNG prettier), `datasetVersion` "3", `reviewed`
      `{ by: "Hải", date: <ngày duyệt> }`; chạy `npx vitest run tests/unit/eval-dataset.test.ts` (validate) xanh.

### Logic thuần của công cụ đo

- [X] T012 [P] [US3] Viết test TRƯỚC `tests/unit/eval-rerank-grid.test.ts`: sinh lưới R7 (12 `minScore` × 4 `relativeDelta` × 2 `reorder` = 96, cấu hình
      hợp lệ theo `validateRerankConfig`); chọn trên dev (lọc CR ≥ 0,9 ∧ R@6 ≥ 0,85 → max R@6 → max CR → `minScore` nhỏ nhất); Pareto khi không có; kết luận
      cổng R6 (`ĐẠT` / `ĐẠT SÀN` / `KHÔNG ĐẠT`: CR hold-out ≥ 0,9, R@6 hold-out ≥ 0,85 hoặc sàn 0,75, Wilson cận dưới vi dev+hold-out ≥ 0,75, English không
      tụt so với mốc); báo chênh lệch vi/en của cấu hình chọn (cho T021). Chạy thấy FAIL.
- [X] T013 [US3] Hiện thực `tests/eval/lib/rerank-grid.ts` cho T012 xanh; thêm vào `coverage.include` như `tests/eval/lib/metrics.ts` của 108.

### I/O công cụ đo

- [X] T014 [US3] Hiện thực `tests/eval/lib/rerank.ts` (I/O, không coverage): nạp model theo kết quả T001 (`EVAL_RERANK_FILE` hoặc tự chọn theo
      `process.arch` — research R3), `score(query, passages)` theo lô (`chunk.text`), cache điểm theo (câu, id, model), đo nạp nguội, p50/p95 chấm/câu, RSS
      tăng, event loop p99 (`perf_hooks.monitorEventLoopDelay`); model lỗi ⇒ ghi lỗi, đo tiếp model khác.
- [X] T015 [US3] Mở rộng `tests/eval/lib/harness.ts` + `tests/eval/retrieval.eval.ts`: chế độ `EVAL_RERANK` — gọi **ĐÚNG `retrieve()` của app** với
      `deps.rerank` = scorer có cache (T014) và `rerankCfg` = từng cấu hình lưới (T013) trên nền cấu hình 108 hiện hành; tính chỉ số qua
      `tests/eval/lib/metrics.ts` theo nhóm vi dev / vi hold-out / en. Không thêm đường truy xuất riêng trong công cụ đo.
- [X] T016 [US3] Mở rộng `tests/eval/lib/report.ts`: mục `rerank` theo model (bảng cấu hình, cấu hình chọn, CI95, độ trễ/RAM/event loop, kết luận) +
      mốc English cùng lượt (theo `contracts/eval-rerank-cli.md`).
- [X] T017 (BỎ QUA — a1 ĐẠT cổng, không cần hướng b) [P] [US3] (chỉ dùng nếu cần ở T022) Hiện thực `tests/eval/lib/judge.ts` + chế độ `EVAL_JUDGE=llm` (research R5): một lượt `EVAL_LLM_MODEL` cục
      bộ/câu, lời nhắc English liệt kê đoạn đánh số, trả JSON số đoạn; hàm parse thuần có test `tests/unit/eval-judge-parse.test.ts` viết TRƯỚC.

### Chạy đo

- [X] T018 [US3] Chạy `EVAL_MODE=current npm run eval:retrieval` trên bộ đo v3 ⇒ mốc (vi dev/hold-out, en) của cấu hình hiện hành; lưu số liệu vào
      `specs/20261008-194015-unanswerable-detection/eval-baseline-v3.md`.
- [X] T019 [US3] Chạy `EVAL_RERANK=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 npm run eval:retrieval` ⇒ ghi kết quả a1 vào
      `specs/20261008-194015-unanswerable-detection/eval-rerank.md`.
- [X] T020 [US3] Chạy `EVAL_RERANK=onnx-community/gte-multilingual-reranker-base npm run eval:retrieval` ⇒ ghi kết quả a2 vào cùng tệp.
- [X] T021 [US3] So sánh a1/a2 theo quy tắc clarify #1 (tất định & không cần Ollama > trễ ấm > dung lượng > đơn giản) + SC-003 (p50 ≤ 300 ms) + SC-004
      (English) ⇒ đề xuất model + cấu hình trong `eval-rerank.md`. **Nếu cấu hình chọn chênh lệch vi/en đáng kể (FR-011)** ⇒ ghi rõ và đưa vào câu hỏi ở cổng
      T023 (tách ngưỡng theo ngôn ngữ hay chấp nhận) — KHÔNG tự tách.
- [X] T022 (BỎ QUA — a1 ĐẠT cổng, không cần hướng b) [US3] Chỉ khi a1 và a2 đều KHÔNG ĐẠT: chạy `EVAL_JUDGE=llm EVAL_LLM_MODEL=qwen2.5:7b npm run eval:retrieval` (hướng b) và ghi kết quả; vẫn không
      đạt ⇒ ghi đề xuất hướng c (đổi embedding) cho chủ dự án, KHÔNG tự làm.
- [X] T023 [US3] **CỔNG — DỪNG trình số liệu cho chủ dự án** (bảng từ `eval-rerank.md`): reranker ĐẠT ⇒ Phase 4–6; KHÔNG ĐẠT ⇒ Phase 8. **Nếu hướng được
      chọn là (b) LLM chấm** ⇒ Phase 4–5 hiện tại không áp dụng (viết cho reranker in-process): chạy lại `/speckit-tasks` cho phần tích hợp (b) (FR-012: luôn
      cục bộ, không có Ollama ⇒ bỏ qua) trước khi code. Ghi quyết định vào `docs/04-decisions/2026-10-08-unanswerable-detection-clarify.md` (mục bổ sung)
      theo rule 2.

**Checkpoint Pha 0**: app chưa đổi hành vi; `npm test` xanh; commit.

---

## Phase 4: User Story 1 + 2 — Chặn câu không đáp án, giữ câu có đáp án (Priority: P1) — chỉ khi reranker ĐẠT

**Goal**: bật bước rerank trong app qua bản ghi hiệu chuẩn; rỗng ⇒ notFound (Theo nguồn) / ngữ cảnh rỗng (Mở rộng).

**Independent Test**: `EVAL_MODE=current npm run eval:retrieval` báo cấu hình rerank khớp số liệu ghi (hồi quy OK); unit xanh.

- [X] T024 [P] [US1] Test hồi quy `tests/unit/rag-service.test.ts`: `retrieve()` rỗng ở chế độ `grounded` ⇒ `notFound`, không gọi chat; ở `extended` ⇒ gọi
      chat với ngữ cảnh rỗng (hành vi 108, thêm ca nếu chưa có).
- [X] T025 [US2] Viết test TRƯỚC trong `tests/unit/relevance-calibration.test.ts`: `RELEVANCE_CALIBRATION.datasetVersion` === `datasetVersion` của
      `tests/eval/questions.json`; nếu `rerank` khác null thì `rerank.modelVersion === RERANK_MODEL_VERSION` và `validateRerankConfig(rerank.config)` không ném.
      Chạy thấy FAIL.
- [X] T026 [US2] Tạo `src/main/services/rerank/model-version.ts` (`RERANK_MODEL`, `RERANK_MODEL_FILE` theo arch, `RERANK_MODEL_VERSION`) và mở rộng
      `src/main/services/rag/relevance-calibration.ts` (`rerank: RerankCalibration | null`, cấu hình + số liệu dev/hold-out/en + độ trễ từ T021, `datasetVersion`
      "3", số liệu 108 đo lại trên v3 từ T018); T025 xanh. Từ đây `retrieve()` mặc định bật rerank khi có `deps.rerank`.

---

## Phase 5: User Story 4 — Tải nền, trạng thái, fail-open trong app (Priority: P2) — chỉ khi reranker ĐẠT

**Goal**: model tải một lần ở nền (badge `model`), trạng thái ở Cài đặt, hỏi đáp không bao giờ bị chặn vì bước mới.

**Independent Test**: e2e `IV_RERANK_FAKE=1`: Cài đặt hiện trạng thái; câu không đáp án ⇒ notFound không gọi chat; lỗi rerank ⇒ hỏi đáp vẫn chạy.

- [X] T027 [US4] Viết test TRƯỚC `tests/unit/reranker-status.test.ts` cho máy trạng thái thuần `src/main/services/rerank/status.ts`
      (`idle → downloading → ready`, `downloading → error`, `error → downloading`, sự kiện lặp idempotent). Chạy thấy FAIL.
- [X] T028 [US4] Hiện thực `src/main/services/rerank/status.ts` cho T027 xanh.
- [X] T029 [US4] Hiện thực `src/main/services/rerank/rerank-model.ts` (I/O, loại coverage) theo `contracts/reranker-service.md`: `createReranker` (nạp như T001,
      `env.cacheDir`, `setOnline(true/false, "model")`, `logEvent` chỉ tên model), `prefetch()` idempotent, `score()` lô + hàng đợi tuần tự, ném
      `RerankNotReadyError` khi chưa sẵn sàng, seam `IV_RERANK_FAKE=1` chỉ khi `!app.isPackaged` (điểm tất định theo trùng từ khoá).
- [X] T030 [US4] Wiring ở main (`src/main/index.ts` / nơi dựng `rag-service`, `src/main/services/ingestion/ingestion.ts` cho sự kiện nguồn `ready`): tạo
      reranker khi `RELEVANCE_CALIBRATION.rerank !== null` với `<dataDir>/models`; truyền `deps.rerank` + `onRerankSkip` (→ `logEvent("rerank.skip", { reason })`)
      cho `retrieve()`; `prefetch()` khi nguồn đầu tiên `ready` trong phiên.
- [X] T031 [US4] Viết test TRƯỚC: thêm `ai:getRerankerStatus` vào kỳ vọng whitelist `tests/unit/ai-ipc-whitelist.test.ts` (và `tests/unit/ipc-whitelist.test.ts`
      nếu liệt kê toàn bộ). Chạy thấy FAIL.
- [X] T032 [US4] Thêm kênh `ai:getRerankerStatus` (chỉ đọc, không tham số) vào `src/shared/ipc/channels.ts`, kiểu `RerankerStatus` vào
      `src/shared/ipc/types.ts`, handler ở `src/main/ipc/register.ts`, `getRerankerStatus()` ở `src/preload/index.ts`; T031 xanh.
- [X] T033 [P] [US4] Thêm khoá `ai.reranker.title` + `ai.reranker.status.{unavailable,idle,downloading,ready,error}` vi/en trong
      `src/shared/i18n/domains/ai.ts` (test catalog + quét chuỗi cứng tự kiểm).
- [X] T034 [US4] Viết test TRƯỚC (jsdom) `tests/unit/settings-reranker-status.test.ts`: Cài đặt › AI hiện dòng trạng thái theo IPC (vi/en), `unavailable` ⇒ ẩn
      dòng, `downloading` ⇒ làm mới định kỳ; rồi hiện thực trong `src/renderer/features/ai-runtime/SettingsAiSection.tsx` (+ hook nhỏ
      `src/renderer/features/ai-runtime/useRerankerStatus.ts`).
- [X] T035 [US4] E2E `tests/e2e/rerank.spec.ts` (`IV_RERANK_FAKE=1`, `IV_EMBED_FAKE=1`): notebook + nguồn md ⇒ Cài đặt hiện "sẵn sàng"; câu không trùng từ khoá
      nào (fake rerank chấm 0) ở Theo nguồn ⇒ "Không tìm thấy trong nguồn" mà không gọi chat; câu khớp ⇒ không bị lọc (bị chặn bởi runtime chat như cũ là đủ
      chứng minh). Chạy `npx electron-vite build && npx playwright test tests/e2e/rerank.spec.ts`.

---

## Phase 6: User Story 5 — English không tệ đi (Priority: P3) — chỉ khi reranker ĐẠT

- [X] T036 [US5] Xác nhận từ T019–T021: nhóm en (CR, R@6) của cấu hình chọn ≥ mốc T018; nếu thấp hơn ⇒ ghi giới hạn đã biết + cân nhắc ở ADR (T038), và thêm
      câu en tiêu biểu vào quickstart thủ công (`specs/20261008-194015-unanswerable-detection/quickstart.md` mục 3).

---

## Phase 7: Polish & Cross-Cutting

- [X] T037 [P] Cập nhật `tests/eval/README.md` (biến `EVAL_RERANK`, `EVAL_RERANK_FILE`, `EVAL_JUDGE`, mục báo cáo mới, khi đổi model reranker).
- [X] T038 ADR `docs/04-decisions/2026-10-08-unanswerable-detection.md`: bối cảnh, số liệu mọi hướng đã đo (mốc, a1, a2, b nếu có), quy tắc + hướng chọn,
      giấy phép/dung lượng/RAM, ghi chú MS MARCO, độ trễ p50/p95 + nạp nguội, giới hạn đã biết (English, fail-open, lần đầu offline), **thay thế một phần 055**
      (mục "không LLM-rerank/cross-encoder"); append một dòng `docs/04-decisions/INDEX.md` bằng script (KHÔNG prettier).
- [X] T039 [P] Rà lại `docs/00-glossary.md`: thuật ngữ phát sinh thêm trong lúc làm (ngoài T003) ⇒ append bằng script (KHÔNG prettier).
- [X] T040 Cập nhật `README.md` + `README.vi.md` nếu hành vi người dùng thấy đổi (tải thêm model lần đầu, "Không tìm thấy" nhanh/ổn định hơn).
- [X] T041 Test gate: `npm run lint`, `npm test` (coverage ≥ 80%), `npx electron-vite build`, `npx playwright test`; rồi `EVAL_MODE=current npm run eval:retrieval`
      (hồi quy OK) và `EVAL_MODE=current EVAL_WITH_LLM=1 EVAL_LLM_MODEL=qwen2.5:7b npm run eval:retrieval` (tham khảo, ghi vào ADR).

---

## Phase 8: Nhánh KHÔNG ĐẠT (thay Phase 4–6)

- [X] T042 (KHÔNG ÁP DỤNG — cổng ĐẠT) Giữ bộ đo v3 + công cụ đo mở rộng + `rerank-filter.ts` + hỗ trợ rerank trong `retrieve()` (tắt); `src/main/services/rag/relevance-calibration.ts`:
      `datasetVersion` "3" + số liệu 108 đo lại (T018), không thêm `rerank` (hoặc `rerank: null`); test canh giữ datasetVersion (phần datasetVersion của T025)
      viết trước rồi xanh.
- [X] T043 (KHÔNG ÁP DỤNG — cổng ĐẠT) ADR ghi KHÔNG ĐẠT + số liệu + đề xuất bước kế tiếp (hướng c / model lớn hơn); T037, T039, T041 như Polish (bỏ phần app).

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (T003 trước T004–T008; T004 → T005; T007 → T008, T008 cần T005) → Phase 3.
- Phase 3: T009 → **T010 DỪNG** → T011; T012–T017 song song với T009–T011; T018–T022 cần T011 + T013–T016 → **T023 CỔNG**.
- Reranker ĐẠT: Phase 4 (T024–T026) → Phase 5 (T027–T035; T030 cần T026 + T029) → Phase 6 → Phase 7.
- Chọn (b): dừng sau T023, chạy lại `/speckit-tasks` cho phần tích hợp (b).
- KHÔNG ĐẠT: Phase 8 → T037, T039, T041.

## Parallel Examples

- Phase 2: T006 ∥ T004.
- Pha 0: T012/T013 (lưới thuần) ∥ T009 (soạn câu) ∥ T001 (smoke-test).
- Phase 5: T033 (i18n) ∥ T027–T028 (trạng thái) ∥ T031 (test whitelist).
- Polish: T037 ∥ T039.

## Implementation Strategy

MVP = Pha 0 + cổng (US3): có số đo đáng tin để quyết định, đo trên đúng `retrieve()` của app (rerank tắt mặc định). Nếu ĐẠT, US1+US2 (Phase 4) là giá trị cốt
lõi, US4 làm cho nó an toàn khi phát hành (fail-open, tải nền, trạng thái), US5 là xác nhận. Commit theo phase; không bật rerank trong app trước khi chủ dự án
chốt ở T023.
