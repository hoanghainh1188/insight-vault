# Intake — 187-reranker-near-topic

- Issue: #187 (repo `hoanghainh1188/insight-vault`) — "Bộ chấm độ liên quan (109) không từ chối câu không đáp án sát chủ đề PDF"
- Slug: `reranker-near-topic`
- Ngày intake: 2026-10-12
- Loại: **điều chỉnh chất lượng truy xuất** (bộ chấm độ liên quan 109). Khác 177 (chỉ công cụ dev-only): giải pháp khả dĩ có thể **chạm mã chạy của app**
  (`src/main/services/rag/{retrieval,rerank-filter,relevance-calibration}.ts`, `src/main/services/rerank/*`) cùng công cụ đo (`tests/eval/`).
  KHÔNG có UI, KHÔNG Figma, KHÔNG basic/detail design của khách hàng (`docs/01-basic-design/`, `docs/02-detail-design/` chỉ có README).
- Phát hiện khi làm #177 (thêm PDF vào bộ đánh giá, dataset v4). Là issue được **tách ra có chủ đích** từ 177 (clarify bổ sung 2026-10-12: "không đổi cấu hình trong #177").

## Input sources

- **Thân issue #187 + 1 comment bổ sung** (lưu nguyên văn): `/private/tmp/claude-501/.../scratchpad/issue-187.md` (q-176, q-179, q-162, số liệu, đề xuất hướng).
- ADR 109: `docs/04-decisions/2026-10-08-unanswerable-detection.md` + `-clarify.md` (bộ chấm cross-encoder `mmarco-mMiniLMv2`, cổng R6, lưới cấu hình, fail-open, ghim commit model, ngân sách độ trễ).
- ADR 177: `docs/04-decisions/2026-10-10-eval-pdf-clarify.md` (gồm bổ sung 2026-10-12) + `2026-10-12-eval-pdf.md` (số liệu v4, q-121, q-162, q-176, q-179, mục "Duyệt câu hỏi").
- ADR 108: `docs/04-decisions/2026-10-07-relevance-calibration.md` (chỉ tra dòng 50: FR-011 "không đạt ⇒ dừng, không tự hạ mục tiêu") + `-clarify.md` qua `INDEX.md`.
- Code đã đọc: `src/main/services/rag/{retrieval,rerank-filter,relevance-calibration}.ts`, `src/main/services/rerank/model-version.ts`, `tests/eval/lib/{rerank,rerank-grid}.ts`,
  `tests/eval/lib/metrics.ts` (chỉ hằng số `TARGET_*`), `tests/eval/README.md`, `tests/eval/questions.json` (q-121, q-162, q-170, q-171, q-176, q-179; `datasetVersion`, `reviewed`).
- `docs/00-glossary.md` (đã tra các dòng bộ chấm 109 / bộ đánh giá 108 / nhóm PDF 177), `docs/04-decisions/INDEX.md` (đã quét), `.specify/memory/constitution.md` (chỉ tiêu đề + MUST — xem "Đối chiếu constitution").
- Figma: không dùng. Design token: không có.
- **Không làm / không xác minh trong phiên này:** KHÔNG chạy `npm run eval:retrieval` hay `gh issue view` (mọi con số lấy từ thân issue, `RELEVANCE_CALIBRATION`, ADR 177). KHÔNG đọc toàn văn
  `tests/eval/retrieval.eval.ts`, `harness.ts`, `rerank-run.ts`, `relevance-filter.ts`, `src/main/services/rerank/{rerank-model,cache,status}.ts`, `tests/unit/relevance-calibration.test.ts`.
  **Điểm chấm (sigmoid) thực tế của q-176 / q-179 / q-162 chưa biết** — `report.json.details` hiện ghi hạng + `topSources`, chưa chắc có `rerankScore` (cần kiểm).
  Giả thuyết "cross-encoder chấm thấp đoạn dạng bảng" (comment của issue) **chưa được kiểm chứng**.

## Sự kiện cần ghi nhận (để spec không phải đoán)

1. **Cấu hình đang chạy (`RELEVANCE_CALIBRATION.rerank`):** model `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` (ONNX int8 ~119 MB, Apache-2.0, ghim commit `1427fd65…`), `minScore 0.6`, `relativeDelta null`,
   `reorder false`, `maxCandidates 12`, `maxTokens 256`, `timeoutMs 1500`; chấm 12 ứng viên đầu sau RRF, trước MMR; không đoạn nào ≥ 0,6 ⇒ `retrieve()` rỗng ⇒ "Không tìm thấy trong nguồn". Fail-open khi model chưa sẵn sàng/lỗi/quá giờ.
2. **Số liệu v4 (đường app 108 + 109), bản ghi `calibratedAt 2026-10-12`:**

   | Nhóm                                   | Câu có đáp án / không đáp án | Từ chối đúng                              | Từ chối nhầm | Recall@6      | MRR           |
   | -------------------------------------- | ---------------------------- | ----------------------------------------- | ------------ | ------------- | ------------- |
   | vi dev                                 | 76 / 28                      | **85,7% (24/28)** (CI Wilson 0,685–0,943) | 6,58%        | 93,4%         | 0,844         |
   | vi hold-out                            | 33 / 12                      | 100% (12/12)                              | 3,03%        | 93,9%         | 0,909         |
   | en                                     | 22 / 12                      | 83,3%                                     | 9,09%        | 72,7%         | 0,640         |
   | Mốc 108 (không bộ chấm) dev / hold-out |                              | 0% / 0%                                   |              | 97,4% / 97,0% | 0,847 / 0,894 |

   Độ trễ ghi nhận: p50 340 ms, p95 438 ms (ngân sách 109: p50 ≤ 400, p95 ≤ 800).

3. **Hai nguồn lọt "sát chủ đề":** q-176 "Mỗi ga của Tuyến 2A có bao nhiêu thang máy?" và q-179 "Mức lương của lái tàu Tuyến 2A là bao nhiêu?" (cả hai `unanswerable`, `split dev`, `topic "pdf"`); mỗi câu giữ lại **1 đoạn**
   `tuyen-2a-ha-noi.pdf` sau bộ chấm (đã grep: không tài liệu nào nói về thang máy / lương lái tàu). 6 câu `topic "pdf"` còn lại (4 dev + 2 hold-out) bị từ chối đúng.
4. **Từ chối đúng dev 85,7% gồm 4 câu lọt, không chỉ 2:** dev có 28 câu không đáp án = 22 cũ (v3: 20/22 = 90,9%, tức đã có **2 câu cũ lọt** từ trước) + 6 PDF (4/6). (Suy ra từ số liệu: để dev ≥ 90% cần ≥ 26/28 ⇒ từ chối
   thêm **≥ 2 trong 4 câu đang lọt**; chỉ cứu q-176 + q-179 là đủ — 26/28 = 92,9%. Id của 2 câu cũ đang lọt: chưa xác định trong intake.)
5. **`chooseRerankConfig` (`tests/eval/lib/rerank-grid.ts`) chọn CHỈ trên dev**, yêu cầu từ chối đúng dev ≥ `TARGET_REJECTION` 0,9 (rồi Recall@6 ≥ `TARGET_RECALL` 0,85, sàn `FLOOR_RECALL` 0,75). Trên v4 **không cấu hình nào của lưới
   (96 cấu hình × `maxCandidates` cố định) giữ được ≥ 90% trên dev** (v3: 16 cấu hình). Lưới: `minScore` ∈ {0.01…0.8} (12 mức), `relativeDelta` ∈ {null, 0.2, 0.4, 0.6}, `reorder` ∈ {false, true}.
6. **`gateVerdict` (cổng R6 109) của cấu hình đã ghi vẫn ĐẠT:** hold-out từ chối đúng 100% ≥ 90%, Recall@6 hold-out ≥ sàn, cận dưới Wilson vi gộp **0,769 ≥ 0,75** (36/40), English không tụt so với mốc. **Biên rất mỏng:** nếu thêm 1 câu lọt
   (35/40) cận dưới Wilson ≈ 0,739 < 0,75 ⇒ cổng KHÔNG ĐẠT (tính từ công thức Wilson 95% trong `metrics.ts`; cần xác nhận lại khi đo). Mọi thay đổi làm tụt từ chối đúng đều có nguy cơ rớt cổng.
7. **q-162 (comment bổ sung):** "Theo bảng danh sách nhà ga, ga Láng thuộc phường nào?" (`answerable`, `split holdout`); đáp án là 1 dòng bảng Markdown của PDF thật `| T2A 04 | Láng | Lang | | 9B, 16, 24, 27, 161, 88 | 1,0 | 2,8 | Đống Đa |`.
   108 không bộ chấm: đoạn chứa đáp án hạng 1; 108 + 109: **từ chối cả câu**. Hệ quả: Recall@6 nhóm PDF hold-out 100% → 88,9% (8/9); hold-out tổng 93,9% (31/33).
   Cảnh báo: q-162 nằm ở **hold-out** — nếu chỉnh bộ chấm để cứu q-162 mà quét/chọn trên dev thì q-162 chỉ là tín hiệu xác nhận; nếu nhìn kết quả q-162 để chọn tham số thì hold-out mất tính độc lập.
8. **Câu đáp án trong bảng khác còn qua bộ chấm:** q-170 "| Quý 3 | 1.250 | 87,5 |" (hold-out) và q-171 "| Cả năm | 4.800 | 336,0 |" (dev), PDF fixture `hop-dong-thue-kho` (bảng số căn phải có đường kẻ, ~10 KB). Đoạn bảng ở q-162 (PDF Wikipedia thật,
   cột "T2A 04" / "Lang" / số tuyến xe buýt) khác về cấu trúc → cần đo tách riêng hai kiểu bảng.
9. **Điểm bất biến của app về chunk:** `retrieve()` chỉ **chọn/sắp id** sau khi chấm; `chunk`/`locator` không đổi (Constitution II). `applyRerank` là hàm thuần dùng chung app + công cụ đo; `scoreWithin` có timeout, lỗi ⇒ fail-open.
   Đổi **văn bản đưa vào bộ chấm** (nếu chọn) nằm ở bước dựng `passages` trong `retrieval.ts` (`textOf.get(id)`), không đổi chunk lưu trữ.
10. **Canh giữ hiệu chuẩn:** `RERANK_MODEL_VERSION` (gồm commit) và `RELEVANCE_CALIBRATION.datasetVersion` có test canh giữ (`tests/unit/relevance-calibration.test.ts`); `EVAL_MODE=current` so lại số liệu (lệch > 0,001 ⇒ cảnh báo).
    Đổi cấu hình/model bộ chấm ⇒ phải đo lại và ghi `RELEVANCE_CALIBRATION.rerank` (file trong `src/main`).
11. **Bộ dữ liệu v4 đã duyệt:** `questions.json` có `datasetVersion "4"`, `reviewed: { by: Hải, date: 2026-10-12 }` (commit `835edee`). ADR `2026-10-12-eval-pdf.md` còn ghi "Bộ dữ liệu v4 chưa duyệt" — **lỗi thời** (ADR cũ không sửa; ADR của 187 ghi trạng thái hiện tại).
    ⇒ sweep trên v4 **được phép chọn cấu hình** (điều kiện mà thân issue đặt ra đã thoả).
12. **Công cụ đo đã có:** `EVAL_DETAILS=1 EVAL_MODE=current EVAL_RERANK=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 EVAL_RERANK_TOPN=12 EVAL_RERANK_MAXLEN=256 npm run eval:retrieval` → `report.json` → `details.production`;
    `EVAL_RERANK=<model,…>` quét 96 cấu hình/model. Cần cache model (lần đầu có mạng).

## Đã chốt / kế thừa — KHÔNG hỏi lại ở clarify

1. **Chỉ báo cáo cấu hình đạt khi vượt `TARGET_*`; không tự hạ mục tiêu; không đạt ⇒ dừng và báo lại** (108 FR-011 / quyết định #1; 177 clarify #3 "không đạt ⇒ dừng, báo lại, mở issue riêng"). Issue này chính là issue riêng đó.
2. **Chọn cấu hình CHỈ trên dev, xác nhận trên hold-out; thứ tự chọn: R@6 cao → từ chối đúng cao → `minScore` nhỏ → đơn giản nhất** (108 clarify #10; 109 R6/R7; `chooseRerankConfig`). Tiêu chí cổng 109: hold-out từ chối đúng ≥ 90%, Recall@6 ≥ 85% (sàn 75%), cận dưới Wilson vi gộp ≥ 0,75, English không tụt.
3. **Ngưỡng chung vi/en**; chỉ tách ngưỡng khi `detectQuestionLanguage` chắc chắn **và** số đo cho thấy chênh lệch đáng kể, ghi ADR (109 clarify #7, #15).
4. **Model bộ chấm:** chạy **cục bộ**, ONNX chạy được bằng `@huggingface/transformers`, **giấy phép cho phép thương mại**, ghi giấy phép + dung lượng + RAM vào ADR (109 clarify #11); **không** chuyển bước chấm sang provider online (109 clarify #8);
   tải **một lần** vào data dir, chỉ báo riêng tư `sending / model`, không đóng gói trong bộ cài v1, lõi vẫn chạy offline (109 clarify #5, ADR). Ghim commit Hugging Face; đổi model/commit ⇒ đổi `RERANK_MODEL_VERSION` ⇒ đo lại.
   Đã loại: a2 `gte-multilingual-reranker-base` (English Recall@6 31,8%, chậm), bge-reranker-v2-m3 / ViRanker / Vietnamese_Reranker (quá lớn), jina-reranker-v2 (giấy phép), PhoRanker (Java/Python), model chỉ-English (ADR 109 "Phương án đã cân nhắc").
5. **Fail-open + timeout 1500 ms; không dồn hàng đợi (tối đa 1 đang chạy + 1 chờ); lỗi/chưa sẵn sàng ⇒ hành vi 108** (109 ADR). **Rỗng ⇒ "Không tìm thấy" (Theo nguồn, không gọi model) / ngữ cảnh rỗng (Mở rộng)** (109 clarify #9).
6. **Ngân sách độ trễ của 109:** p50 ≤ 400 ms, p95 ≤ 800 ms trên máy tham chiếu (macOS arm64); lý do giới hạn `maxCandidates 12` + `maxTokens 256` (109 clarify #14). `reorder` không đổi số liệu ⇒ không bật.
7. **`retrieve()` chỉ lọc/sắp id; `ScoredChunk.score` = cosine distance giữ nguyên, thêm trường riêng `rerankScore`; chunk/locator không đổi** (109 clarify #6; Constitution II).
8. **Đổi bộ dữ liệu ⇒ tăng `datasetVersion`, `reviewed: null`, chủ dự án duyệt lại** (README eval, FR-003) và **đồng bộ `RELEVANCE_CALIBRATION.datasetVersion`** (test canh giữ).
9. **Nhóm PDF chỉ tham khảo, không vào cổng 108–109** (177 clarify #3); báo cáo cảnh báo khi cận trên Wilson 95% Recall@6 PDF < Markdown. Câu PDF chỉ tiếng Việt (177 A17). Câu cũ "không tụt" đo trên **đường app thật** (108 + 109) (177 bổ sung 2026-10-12).
10. **q-121 tụt ở 108 không bộ chấm = quan sát, không chặn** (177, chủ dự án chốt 2026-10-12) — không thuộc phạm vi 187.
11. **CI `eval-retrieval` chỉ bấm tay, không chặn PR; eval không đóng gói vào bản cài** (108 clarify #3, 109 clarify #12).
12. **Quy tắc đánh giá không được đổi để "vá" số liệu:** không đổi nhãn/`split`/`quotes` của câu hiện có (q-176, q-179, q-162…), không bỏ câu khó khỏi bộ, không nới `TARGET_*`/`FLOOR_RECALL`/`WILSON_FLOOR`, không đổi định nghĩa "từ chối đúng"
    (ràng buộc của yêu cầu giao việc; nền tảng: 108/109 quy tắc đo). Thêm câu mới thì theo thủ tục mục 8.
13. **Ngôn ngữ / thuật ngữ:** tiếng Việt; cột 日本語 trong glossary để `—`. Term đã có (không đổi tên): "Câu không có đáp án sát chủ đề (hard negative)", "Bộ chấm độ liên quan (cross-encoder reranker)", "Từ chối đúng / từ chối nhầm", "Cấu hình rerank", "Đường app thật".

## Prompt for /speckit-specify

Cải thiện khả năng của **bộ chấm độ liên quan** (cross-encoder reranker, feature 109) trong việc **từ chối câu hỏi không có đáp án nhưng cùng chủ đề** (hard negative, near-topic) với tài liệu PDF, mà **không làm bộ chấm từ chối nhầm câu có đáp án nằm trong đoạn dạng bảng**, trên ứng dụng desktop InsightVault (hỏi đáp có trích dẫn kiểm chứng được, local-first, chạy offline).

Bối cảnh và số liệu hiện tại (đường app thật = cấu hình 108 + bộ chấm 109 đã ghi trong `RELEVANCE_CALIBRATION`, đo trên bộ đánh giá truy xuất `datasetVersion "4"`, đã được chủ dự án duyệt ngày 2026-10-12): bộ chấm là model `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` (ONNX int8 ~119 MB, Apache-2.0, chạy cục bộ trong main process), chấm 12 ứng viên đầu sau RRF (cắt 256 token), giữ đoạn có điểm ≥ 0,6, không đoạn nào đạt thì kết quả truy xuất rỗng và hỏi đáp trả "Không tìm thấy trong nguồn". Khi #177 thêm PDF vào bộ đánh giá, phát hiện hai vấn đề:

1. **Câu không đáp án sát chủ đề PDF lọt qua bộ chấm.** Hai câu tiếng Việt thuộc tập dev — q-176 "Mỗi ga của Tuyến 2A có bao nhiêu thang máy?" và q-179 "Mức lương của lái tàu Tuyến 2A là bao nhiêu?" — không có đáp án trong bất kỳ tài liệu nào (đã grep), nhưng bộ chấm vẫn giữ lại 1 đoạn của `tuyen-2a-ha-noi.pdf` cho mỗi câu, nên không bị từ chối; 6 câu không đáp án PDF còn lại đều bị từ chối đúng. Hệ quả: từ chối đúng trên dev của cấu hình đã ghi giảm từ 90,9% (v3) xuống **85,7% (24/28)**, dưới mục tiêu 90% (`TARGET_REJECTION`); trên bộ v4, hàm chọn cấu hình bộ chấm (`chooseRerankConfig`, chọn trên dev) không còn cấu hình nào của lưới hiện có giữ được từ chối đúng ≥ 90% trên dev (bộ v3 có 16 cấu hình). Cổng xác nhận (`gateVerdict`) của cấu hình đã ghi vẫn ĐẠT (hold-out từ chối đúng 100%, cận dưới Wilson 95% của từ chối đúng tiếng Việt gộp dev + hold-out = 0,769 ≥ 0,75, không câu cũ nào tụt theo đường app thật), nhưng biên này mỏng. Người dùng có nguy cơ nhận câu trả lời "có nguồn" cho câu hỏi mà tài liệu không thực sự trả lời khi câu hỏi cùng chủ đề.
2. **Bộ chấm từ chối nhầm câu có đáp án nằm trong dòng bảng.** Câu q-162 (hold-out) "Theo bảng danh sách nhà ga, ga Láng thuộc phường nào?" có đáp án là một dòng bảng Markdown của `tuyen-2a-ha-noi.pdf` (`| T2A 04 | Láng | Lang | | 9B, 16, 24, 27, 161, 88 | 1,0 | 2,8 | Đống Đa |`): khi không dùng bộ chấm, đoạn chứa đáp án ở hạng 1; khi dùng bộ chấm 109, cả câu bị từ chối. Recall@6 nhóm PDF hold-out vì thế giảm từ 100% xuống 88,9% (8/9). Giả thuyết (chưa kiểm chứng) là cross-encoder chấm thấp cặp (câu hỏi tự nhiên, đoạn dạng bảng Markdown); hai câu đáp án-trong-bảng của PDF fixture (q-170, q-171) hiện vẫn qua bộ chấm và cần được đo riêng cùng q-162.

Mục tiêu: tìm và áp dụng một thay đổi cho bộ chấm độ liên quan (hoặc cho cách đưa đoạn vào bộ chấm) sao cho, đo bằng bộ đánh giá truy xuất v4 qua `retrieve()` thật của app (`EVAL_MODE=current EVAL_RERANK=… npm run eval:retrieval`, báo cáo `report.json` có `details` từng câu): (a) từ chối đúng trên dev đạt lại ≥ 90% (`TARGET_REJECTION`) — cụ thể cần từ chối thêm ít nhất 2 trong 4 câu không đáp án đang lọt, trong đó có q-176 và q-179; (b) câu có đáp án trong bảng, kể cả q-162, q-170, q-171, không bị từ chối nhầm; (c) cổng R6 của 109 (hold-out từ chối đúng ≥ 90%, Recall@6 ≥ 85% với sàn 75%, cận dưới Wilson vi gộp ≥ 0,75, English không tụt so với mốc cùng lượt) tiếp tục ĐẠT, và không câu hiện có nào bị tụt theo đường app thật (Recall@6, MRR, từ chối đúng của vi dev / vi hold-out / en). Các hướng ứng viên mà issue nêu (không tự chọn giữa chúng trong spec; phần chọn thuộc làm rõ): quét lại lưới cấu hình bộ chấm (`minScore`, `relativeDelta`, `maxCandidates`, `maxTokens`) trên bộ v4 đã duyệt; xử lý đoạn dạng bảng trước khi đưa vào bộ chấm; thử model bộ chấm khác hoặc tín hiệu bổ sung cho câu "sát chủ đề nhưng không có đáp án"; thêm câu không đáp án sát chủ đề cho các tài liệu khác để có cỡ mẫu đo đủ (bộ v5, cần chủ dự án duyệt).

Ràng buộc bất biến: local-first và không có egress mặc định (bộ chấm luôn chạy cục bộ; không chuyển sang provider online; model nếu đổi phải cho phép dùng thương mại, có bản ONNX chạy được bằng `@huggingface/transformers`, ghim commit, tải một lần vào data dir, không đóng gói trong bộ cài v1, lõi vẫn chạy offline); fail-open (model chưa sẵn sàng / lỗi / quá 1500 ms ⇒ hành vi 108, không chặn hỏi đáp); trích dẫn kiểm chứng được (chunk và locator không đổi, chip `[n]` vẫn map về đúng nguồn; `ScoredChunk.score` giữ nghĩa cosine distance, điểm chấm ở trường `rerankScore`); không dùng thay đổi nào làm lệch cách đo — không đổi nhãn, `split`, trích dẫn của câu hiện có, không hạ `TARGET_REJECTION` / `TARGET_RECALL` / `FLOOR_RECALL` / ngưỡng Wilson, không đổi định nghĩa "từ chối đúng" để làm đẹp số liệu; chọn cấu hình chỉ trên dev và xác nhận trên hold-out; ngân sách độ trễ của 109 (p50 ≤ 400 ms, p95 ≤ 800 ms trên máy tham chiếu) và mức RAM đã chốt không được vượt nếu chưa có quyết định mới; nếu không có cấu hình nào đạt thì theo FR-011 của 108: dừng, báo lại bằng số liệu, không tự hạ mục tiêu. Mã thuần mới đi theo test-first (Constitution IV); đổi cấu hình/model bộ chấm phải đo lại và cập nhật `RELEVANCE_CALIBRATION.rerank` (cùng `datasetVersion`, `calibratedAt`, `RERANK_MODEL_VERSION` nếu đổi model) để test canh giữ vẫn đúng; ghi ADR mới + dòng `INDEX.md`, không sửa ADR cũ.

Các điểm cần `/speckit-clarify` chốt trước khi lập kế hoạch: mục tiêu thành công cụ thể (đo trên dev hay cổng hold-out, ngưỡng tối thiểu, mức tụt chấp nhận được); có đổi model hay chỉ đổi cấu hình / tín hiệu; có được đổi cách đưa đoạn bảng vào bộ chấm (chạm mã chạy app); có mở rộng bộ câu hỏi (v5) trước hay sau khi chỉnh; độ trễ / RAM / kích thước tải cho phép; phạm vi tiếng Anh; việc phải làm nếu không cấu hình nào đạt.

## Ambiguities to raise in /speckit-clarify

Đã loại (đã có quyết định, xem "Đã chốt / kế thừa"): không tự hạ mục tiêu / không đạt ⇒ dừng (108 FR-011, 177 clarify #3); chọn trên dev, xác nhận hold-out; ngưỡng chung vi/en; điều kiện giấy phép + ONNX + cục bộ + ghim commit của model; không chuyển bước chấm sang online; fail-open + timeout; ngân sách độ trễ 109; chunk/locator không đổi; nhóm PDF tham khảo; q-121 chỉ quan sát; CI bấm tay; đổi bộ dữ liệu ⇒ tăng `datasetVersion` + `reviewed: null`.

**B1. Mục tiêu thành công đo thế nào, và cái nào bắt buộc?**
Dữ kiện: sự kiện 2–6. Có ít nhất 4 thước đo khác nhau: (i) `chooseRerankConfig` trên dev: từ chối đúng ≥ 90% (hiện 85,7%); (ii) `gateVerdict` (hold-out + Wilson ≥ 0,75 + English không tụt) — hiện ĐẠT, biên mỏng; (iii) hai câu cụ thể q-176 / q-179 bị từ chối; (iv) q-162 và câu đáp án-trong-bảng không bị từ chối nhầm, Recall@6 PDF hold-out trở lại 100%; (v) không câu cũ nào tụt theo từng câu. Cần chốt: (i)+(ii)+(v) là điều kiện cứng, còn (iii)/(iv) là kiểm tra theo ca hay cũng cứng? Mức tụt tổng thể chấp nhận (dev Recall@6 hiện 93,4% so với mục tiêu 85%: được đánh đổi tới đâu để đổi lấy từ chối đúng — 109 đã chấp nhận từ chối nhầm 10,3% dev)?
**Đề xuất:** (i) + (ii) cứng; (iii) là tiêu chí kiểm; (iv) Recall@6 PDF hold-out không thấp hơn 8/9; (v) không câu có đáp án nào đang được trả lời đúng bị từ chối nhầm thêm.

**B2. Chống "học vẹt" theo vài câu: quét/chọn trên tập nào, q-162 ở hold-out xử lý ra sao?**
Dữ kiện: sự kiện 4, 7. Dev chỉ có 28 câu không đáp án, trong đó 2 hard negative PDF (q-176, q-179) là lý do của issue; q-162 nằm ở hold-out. Chọn cấu hình CHỈ trên dev (đã chốt) nhưng nếu cấu hình được chọn vì nhìn kết quả q-162 thì hold-out không còn độc lập. Phương án: (i) tuân thủ nghiêm: chọn trên dev, q-162 chỉ xác nhận; (ii) coi q-162/q-170/q-171 là "bộ kiểm hồi quy đáp án-trong-bảng" riêng (đo, không dùng chọn); (iii) sau khi mở rộng bộ (B3) chia lại theo thủ tục. Không đổi `split` của câu hiện có để cứu số liệu (đã chốt mục 12).

**B3. Có mở rộng bộ câu hỏi (v5) không, trước hay sau khi chỉnh bộ chấm?**
Dữ kiện: thân issue đề xuất "thêm câu không đáp án sát chủ đề cho các tài liệu khác để có cỡ mẫu đo đủ"; hiện chỉ 8 hard negative PDF (6 dev + 2 hold-out), 10 hold-out cũ; Wilson vi gộp đã sát ngưỡng. Cần chốt: có làm không; nếu có thì bao nhiêu câu (không đáp án sát chủ đề cho từng tài liệu thật `.md` + PDF; thêm câu đáp án-trong-bảng cho PDF thật và cho bảng của tài liệu khác nếu có), tiếng Anh có thêm không, ai duyệt (chủ dự án, `reviewed: null` ⇒ sweep không chọn cho tới khi duyệt), và là cùng PR hay PR trước (khuyến nghị để tránh chỉnh theo 2 câu). Hệ quả: tăng `datasetVersion` (4 → 5), đo lại mốc 108/109 và `RELEVANCE_CALIBRATION`, ghi số liệu v4 làm mốc trước/sau trong ADR.
**Đề xuất:** thêm câu (v5) và chủ dự án duyệt TRƯỚC khi quét lại; quyết định số câu mục tiêu ở clarify.

**B4. Được đổi model bộ chấm không?**
Dữ kiện: ràng buộc đã chốt (mục 4): cục bộ, ONNX/transformers.js, thương mại được, ghim commit, đã loại a2 và các model lớn/giấy phép/yêu cầu Java-Python. Thứ tự 109 clarify #1 là (a) reranker → (b) LLM chấm → (c) đổi embedding "chỉ khi (a),(b) không đạt sàn"; ADR 109 ghi hướng b, c "không cần đo". Chưa rõ: issue này có **mở lại (b)/(c)** không, hay chỉ cho phép (a) với model/cấu hình khác? Nếu đổi model: ngân sách dung lượng tải, RAM (+~200 MB hiện tại), độ trễ (p50 ≤ 400 ms), Windows x64 (`model_quint8_avx2`) chưa đo trên máy thật. Có cần phương án bảo vệ "tải lại model" cho người đã tải bản cũ (migration cache) không.

**B5. Có được đổi cách đưa đoạn dạng bảng vào bộ chấm (chạm mã chạy của app)?**
Dữ kiện: giả thuyết bảng chưa kiểm (có thể do ký hiệu `|`, ô rỗng, số tuyến xe buýt chiếm token, hoặc cắt 256 token). Phương án khả dĩ, mỗi cái là thay đổi mã chạy trong `retrieval.ts` (bước dựng `passages`) và phải đo bằng đúng đường app: (i) chuyển bảng Markdown → văn bản phẳng "cột: giá trị" CHỈ làm đầu vào bộ chấm (chunk/locator/hiển thị không đổi); (ii) kèm hàng tiêu đề / tiêu đề trang cho đoạn bảng; (iii) tăng `maxTokens` chỉ cho đoạn bảng; (iv) **miễn chấm** đoạn bảng (rủi ro: hard negative dạng bảng lọt, mở lỗ hổng). Cần chốt: được phép hay không; phương án nào bị loại ngay (đề xuất loại (iv)); có tách thành PR/issue riêng nếu chẩn đoán xác nhận nguyên nhân là bảng; hàm nhận diện đoạn dạng bảng nằm ở đâu (hàm thuần dùng chung app + công cụ đo, test-first).

**B6. Có được thêm tín hiệu ngoài lưới hiện có không?**
Dữ kiện: lưới hiện có chỉ `minScore`, `relativeDelta`, `reorder` (cố định `maxCandidates`, `maxTokens`). Tín hiệu bổ sung có thể (nếu được phép): độ phủ từ khoá câu hỏi trong đoạn, khoảng cách điểm top-1 và top-2 của bộ chấm, điểm BM25 hay cosine distance kết hợp với `rerankScore`. Mỗi cái thêm tham số vào `RerankConfig`/`applyRerank` và vào bản ghi hiệu chuẩn (rủi ro quá khớp với cỡ mẫu nhỏ — nối B2/B3). Cần chốt: chỉ quét lại lưới (kể cả `maxCandidates`/`maxTokens` làm trục quét) hay cho thêm tín hiệu; nếu thêm, ngưỡng bao nhiêu tham số tối đa.

**B7. Chẩn đoán trước khi chọn giải pháp: có đưa vào phạm vi không?**
Dữ kiện: điểm chấm của q-176 / q-179 / q-162 / q-170 / q-171 chưa biết; `details` hiện chưa chắc ghi `rerankScore`. Cần chốt: có thêm bước đầu "báo cáo điểm chấm từng câu + từng đoạn (dev-only, `EVAL_DETAILS=1`)" làm mốc để chọn giải pháp không (đề xuất: có — là thay đổi công cụ đo thuần, không đụng app); và mốc "nguyên nhân thuộc về (bảng | token | ngưỡng | model)" cần ghi vào ADR.

**B8. Độ trễ, RAM, kích thước cho phép?**
Dữ kiện: bản ghi p50 340 ms / p95 438 ms; ngân sách chốt p50 ≤ 400, p95 ≤ 800; `maxCandidates 12` và `maxTokens 256` được chọn đúng để giữ độ trễ (109 clarify #14). Quét lại có thể muốn tăng hai tham số này → độ trễ tăng. Giữ nguyên ngân sách hay nới (và nới tới đâu)? Windows x64 chưa đo thật. Có chấp nhận đo độ trễ ở CI ubuntu x64 (workflow `eval-retrieval`) như 109?

**B9. Phạm vi tiếng Anh.**
Dữ kiện: English hiện từ chối đúng 83,3%, Recall@6 72,7% (mốc 108 KHÔNG bộ chấm: 68,2% ở v3 → 63,6% ở v4 — q-121 tụt do 2 đoạn PDF chen vào); cổng 109 yêu cầu English không tụt so với mốc cùng lượt; ngưỡng chung đã chốt, tách theo ngôn ngữ chỉ khi số đo cho thấy khác biệt đáng kể. Cần chốt: thay đổi có thể làm tụt English (hiện đang trên mốc) tới đâu; nếu cải thiện tiếng Việt cần thay đổi làm English tụt thì dừng, hay mở nhánh ngưỡng theo ngôn ngữ (đã cho phép có điều kiện ở 109 #7); có thêm câu English hard negative / English trên PDF không (177 đã chốt câu PDF chỉ tiếng Việt).

**B10. Nếu không cấu hình / giải pháp nào đạt thì kết quả của issue là gì?**
Dữ kiện: 108 FR-011 + 177 #3: dừng, báo lại, không tự hạ mục tiêu. Chưa rõ sản phẩm cuối: (i) ADR "giới hạn đã biết" ghi rõ số liệu + giữ cấu hình hiện hành + đóng issue; (ii) giữ issue mở và tách issue mới (thêm dữ liệu / model); (iii) chủ dự án quyết định hạ mục tiêu bằng ADR riêng qua PR steward (đổi `TARGET_*` là thay đổi hằng số của công cụ đo, không tự làm trong 187). Ngoài ra: nếu tìm được cấu hình đạt dev nhưng làm `gateVerdict` KHÔNG ĐẠT (Wilson tụt dưới 0,75), ưu tiên cổng nào.

**B11. Cập nhật bản ghi hiệu chuẩn và cách chia PR.**
Dữ kiện: sự kiện 10. `RELEVANCE_CALIBRATION` nằm trong `src/main` (blast radius lớn hơn `tests/eval`). Cần chốt: một PR hay chia (PR1: công cụ đo + chẩn đoán + mở rộng bộ câu hỏi; PR2: thay đổi cấu hình/mã app + `RELEVANCE_CALIBRATION`); chủ dự án có muốn xem số liệu trước/sau (v4 mốc) trong thân PR; thêm test canh giữ nào mới (vd test cho hàm nhận diện đoạn bảng, test `applyRerank` với trục mới).

## Thuật ngữ mới (append vào glossary)

Đa số khái niệm đã có (hard negative, bộ chấm, từ chối đúng/nhầm, cấu hình rerank, đường app thật, nhóm PDF) — **dùng lại, không đặt term mới**. Chỉ khi clarify chọn các hướng tương ứng mới cần append (rule 5: THÊM được làm ngay trong branch):

| 日本語 | Tiếng Việt (đề xuất)                             | English (đề xuất, dùng trong code)             | Ghi chú                                                                                       |
| ------ | ------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| —      | Đoạn dạng bảng (đoạn chứa bảng Markdown của PDF) | table passage (`isTablePassage` — nếu chọn B5) | Đoạn có dòng bảng `\| ô \| ô \|` do `parsePdf` sinh; chỉ cần term khi có hàm nhận diện — 187  |
| —      | Văn bản đưa vào bộ chấm                          | rerank input text (nếu chọn B5)                | Văn bản dùng để chấm, có thể khác `chunk.text` hiển thị/lưu; chunk và locator không đổi — 187 |
| —      | Câu đáp án-trong-bảng (bộ kiểm hồi quy)          | table-answer question (q-162, q-170, q-171…)   | Nhóm câu có đáp án nằm trong dòng bảng; đo từ chối nhầm riêng — 187 (nếu chọn B2-ii)          |

Không đổi tên term đã có. Dòng glossary 137/147/148/150 (bộ đánh giá `datasetVersion`, `RELEVANCE_CALIBRATION`) nếu `datasetVersion` đổi sang 5 trở nên lỗi thời ⇒ **SỬA term cũ ⇒ PR glossary riêng** được steward duyệt (rule 5).

## Đối chiếu constitution

(Chỉ đọc tiêu đề + dòng MUST của `.specify/memory/constitution.md`; người phụ trách đối chiếu lại toàn văn.)

- **I (Local-first / no default egress):** bộ chấm cục bộ; model nếu đổi tải một lần với chỉ báo `sending/model` như 109; không thêm egress; lõi hỏi đáp vẫn chạy offline khi chưa có model (fail-open).
- **II (Verifiable Citations):** thay đổi chỉ ở bước chọn/lọc id (và có thể văn bản đưa vào bộ chấm); chunk/locator/chip `[n]` không đổi. **Rủi ro cần kiểm:** làm lỏng bộ chấm (hạ ngưỡng, miễn chấm bảng) có thể tăng nguy cơ câu trả lời "có nguồn" cho câu không có đáp án; làm chặt có thể tăng từ chối nhầm — "không tìm thấy trong nguồn" không được bịa (Principle II: không `[n]` hợp lệ ⇒ báo không tìm thấy).
- **III (Security Boundary):** bộ chấm ở main process; không log nội dung câu hỏi/đoạn (chỉ mã sự kiện `rerank.skip`, tên model); đổi model ⇒ tải qua cơ chế đã có, ghim commit.
- **IV (Test-First & Coverage):** hàm thuần mới (nhận diện đoạn bảng, dựng văn bản chấm, trục lưới/tín hiệu mới) viết test trước, coverage ≥ 80%; `tests/eval/lib/{dataset,metrics,grid,rerank-grid}.ts` nằm trong coverage; `harness.ts`/`rerank.ts` I/O ngoài coverage nhưng phải chạy tay.
- **V (Phased Delivery):** không thêm tính năng người dùng; cải thiện chất lượng truy xuất đã có.
- **Additional constraints:** i18n không liên quan (không chuỗi UI mới; nếu thêm chuỗi trạng thái thì qua i18n 123); ADR bắt buộc; glossary tra trước; mâu thuẫn tài liệu ⇒ clarify (xem B1–B11); không thêm dependency trừ khi đổi model qua thư viện đã có.

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa constitution qua PR riêng được steward duyệt, rule 5). Chỉ ghi nhận để cân nhắc về sau: một dòng ở "Additional Constraints" rằng "**mọi thay đổi bộ chấm độ liên quan / ngưỡng lọc phải được đo trên cả nhóm câu không đáp án sát chủ đề (hard negative) lẫn nhóm câu có đáp án nằm trong bảng, qua đường app thật, trước khi cập nhật `RELEVANCE_CALIBRATION`**" — để khoảng trống kiểu "bộ chấm chỉ được hiệu chuẩn trên Markdown" (phát hiện bởi #177) không lặp lại khi thêm định dạng nguồn mới.
