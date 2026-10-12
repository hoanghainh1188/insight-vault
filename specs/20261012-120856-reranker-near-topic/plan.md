# Implementation Plan: Bộ chấm độ liên quan — câu sát chủ đề và đoạn bảng

**Branch**: `187-reranker-near-topic` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: `specs/20261012-120856-reranker-near-topic/spec.md` · Quyết định: `docs/04-decisions/2026-10-12-reranker-near-topic-clarify.md`

## Summary

Hai PR theo clarify #5. **PR 1 (chỉ `tests/eval/`, không đổi mã chạy app):** (a) công cụ chẩn đoán — ghi, cho từng câu, điểm bộ chấm của
MỌI ứng viên (kể cả câu bị từ chối, vốn không có `rerankScore` trong kết quả `retrieve()`), cờ đoạn có chứa trích dẫn đáp án, cờ **trích
dẫn có nằm trong cửa sổ token sau khi cắt** (giả thuyết mới: đoạn bảng dài bị cắt ở `maxTokens` 256 nên dòng đáp án của q-162 có thể không
bao giờ tới bộ chấm), và mục "Chẩn đoán bộ chấm" trong báo cáo; (b) bộ câu hỏi **v5** (~20 câu không đáp án sát chủ đề cho mọi tài liệu
thật + 2–3 câu đáp án-trong-bảng), `datasetVersion` "5", `reviewed: null`; (c) báo cáo chẩn đoán trên v5 trong ADR. **PR 2 (sau khi v5 được
duyệt):** bước 1 quét lưới cấu hình bộ chấm mở rộng trên v5 (chọn trên dev, loại theo bộ kiểm bảng, ngân sách, tiếng Anh); nếu chẩn đoán
xác nhận vấn đề đoạn bảng thì sửa cách đưa đoạn vào bộ chấm (chỉ cho bước chấm); bước 2 (chỉ khi bước 1 không đạt) đánh giá model khác;
cập nhật `RELEVANCE_CALIBRATION` + ADR thực thi; không đạt ⇒ giữ cấu hình, ADR giới hạn, giữ #187 mở + issue mới.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node của Electron (vitest)

**Primary Dependencies**: có sẵn — `@huggingface/transformers` (cross-encoder ONNX `mmarco-mMiniLMv2-L12-H384-v1`, int8), vitest, `pdfjs-dist`;
**không thêm dependency** (bước 2 đổi model dùng cùng runtime, chỉ đổi model id + revision).

**Storage**: `tests/eval/` (questions.json v5, báo cáo `tests/eval/reports/` gitignore); `src/main/services/rag/relevance-calibration.ts` (PR 2)

**Testing**: `npm test` (unit, coverage ≥ 80% phần logic, không mô hình); `npm run eval:retrieval` (bấm tay, cần cache mô hình)

**Target Platform**: macOS arm64 (máy tham chiếu độ trễ) + Windows x64 (không đo độ trễ thật, như 109)

**Project Type**: app desktop Electron — công cụ dev-only (PR 1) + tầng truy xuất ở main process (PR 2)

**Performance Goals**: bước chấm p50 ≤ 400 ms, p95 ≤ 800 ms (ngân sách 109, giữ nguyên); nếu đổi model: tải ≤ 150 MB, RAM +≤ 200 MB

**Constraints**: local-first, không egress mặc định, fail-open, chunk / locator / chip `[n]` không đổi; không đổi nhãn / split / trích dẫn câu
hiện có; không hạ `TARGET_*` / Wilson; chọn trên dev

**Scale/Scope**: 183 câu (v4) → ~205 câu (v5); 13 tài liệu; lưới quét mở rộng (minScore × relativeDelta × reorder × maxCandidates × maxTokens)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                         | Đánh giá                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| I. Local-first & No Default Egress | ✅ Bộ chấm chạy cục bộ; model mới (nếu có) ghim revision, tải một lần vào data dir như 109; không provider online.                     |
| II. Verifiable Citations           | ✅ Chunk / locator / chip giữ nguyên; trình bày lại đoạn bảng (nếu làm) CHỈ cho chuỗi đưa vào bộ chấm, không cho chunk lưu / hiển thị. |
| III. Desktop Security Boundary     | ✅ Không đổi renderer / preload / IPC.                                                                                                 |
| IV. Test-First & Coverage          | ✅ Hàm thuần mới (chẩn đoán, lưới mở rộng, trình bày bảng) có unit test trước.                                                         |
| V. Phased Delivery                 | ✅ Chất lượng lõi hỏi đáp Pha 1.                                                                                                       |

Không vi phạm ⇒ không cần Complexity Tracking. **Re-check sau Phase 1**: ✅.

## Project Structure

### Documentation (this feature)

```text
specs/20261012-120856-reranker-near-topic/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/
│   ├── diagnostics.md      # báo cáo chẩn đoán + details mở rộng (PR 1)
│   └── rerank-input.md     # trình bày đoạn cho bộ chấm (PR 2, có điều kiện)
└── tasks.md
```

### Source Code (repository root)

```text
PR 1 — tests/eval/ (không đổi src/)
tests/eval/lib/rerank-diagnose.ts   # MỚI (thuần): gom điểm ứng viên theo câu, cờ hit, cờ trích-dẫn-trong-cửa-sổ, tóm tắt
tests/eval/lib/harness.ts           # SỬA (I/O): RerankRun có `record` ⇒ ghi điểm mọi ứng viên của lượt
tests/eval/lib/rerank.ts            # SỬA (I/O): scorer lộ `windowText(query, passage, maxLength)` (giải mã phần đoạn còn lại sau cắt)
tests/eval/lib/report.ts            # SỬA: mục "Chẩn đoán bộ chấm" (renderRerankDiagnosis)
tests/eval/retrieval.eval.ts        # SỬA: EVAL_DETAILS=1 ⇒ details.production[].rerankCandidates + mục chẩn đoán
tests/eval/questions.json           # SỬA: +~22 câu v5, datasetVersion "5", reviewed null
src/main/services/rag/relevance-calibration.ts  # SỬA CHỈ datasetVersion "5" + số liệu (cấu hình KHÔNG đổi) — để test canh giữ đúng

PR 2 — có điều kiện theo chẩn đoán
tests/eval/lib/rerank-grid.ts       # SỬA: lưới mở rộng (maxCandidates, maxTokens) + loại theo bộ kiểm bảng / ngân sách / tiếng Anh
src/main/services/rag/rerank-input.ts   # MỚI (nếu chẩn đoán xác nhận): trình bày đoạn bảng cho bộ chấm (thuần)
src/main/services/rag/retrieval.ts      # SỬA (nếu có rerank-input): dùng chuỗi trình bày khi gọi deps.rerank
src/main/services/rag/relevance-calibration.ts  # SỬA: cấu hình + số liệu mới
src/main/services/rerank/{model-version.ts,rerank-model.ts}  # SỬA chỉ ở bước 2 (đổi model)
docs/04-decisions/2026-10-1x-reranker-near-topic.md  # ADR thực thi + INDEX
```

**Structure Decision**: bám cấu trúc 108/109/177; logic mới là hàm thuần có test; I/O ở harness / eval runner; thay đổi app (PR 2) nhỏ, có
điều kiện.

## Phase 0 — Research

[research.md](research.md) R1–R8.

## Phase 1 — Design

[data-model.md](data-model.md), [contracts/diagnostics.md](contracts/diagnostics.md), [contracts/rerank-input.md](contracts/rerank-input.md),
[quickstart.md](quickstart.md).

## Thứ tự triển khai

**PR 1:** glossary → test trước `rerank-diagnose.ts` → hiện thực → harness / scorer ghi điểm + cửa sổ → báo cáo → chạy chẩn đoán trên v4
(mốc) → soạn ~22 câu v5 (grep chắc không đáp án) → test corpus xanh → đo v5 hiện hành, cập nhật số liệu `RELEVANCE_CALIBRATION` (chỉ số
liệu + `datasetVersion` "5") → báo cáo chẩn đoán vào ADR "chẩn đoán" → review → PR 1 → chủ dự án duyệt v5.

**PR 2:** dựa trên chẩn đoán: (nếu cửa sổ cắt mất đáp án / bảng chấm thấp) `rerank-input` + test → lưới mở rộng + bộ lọc loại → quét trên
v5 (dev) → xác nhận hold-out + bộ kiểm bảng + tiếng Anh + ngân sách → đạt ⇒ cập nhật cấu hình + ADR; không đạt bước 1 ⇒ bước 2 (model
khác) ⇒ không đạt ⇒ ADR giới hạn + issue mới.

## Complexity Tracking

Không có.
