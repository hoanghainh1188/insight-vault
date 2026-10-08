# Implementation Plan: Tách câu hỏi không có đáp án ở tầng truy xuất

**Branch**: `109-unanswerable-detection` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/20261008-194015-unanswerable-detection/spec.md`; quyết định `docs/04-decisions/2026-10-08-unanswerable-detection-clarify.md`;
intake `docs/intake/109-unanswerable-detection.md`.

## Summary

Ngưỡng khoảng cách e5 không tách được câu không có đáp án (108). Kế hoạch hai pha có cổng:

- **Pha 0 — thí nghiệm (không đổi app):** mở rộng bộ đánh giá (v3: +12 câu vi, +3 câu en không có đáp án — **DỪNG chờ chủ dự án duyệt**); thêm vào
  công cụ đo bước chấm cross-encoder cục bộ cho hai model đa ngôn ngữ giấy phép Apache-2.0 có ONNX — a1 `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`
  (~119 MB int8) và a2 `onnx-community/gte-multilingual-reranker-base` (~341 MB q8) — quét ngưỡng tuyệt đối/tương đối × xếp lại, đo độ trễ/RAM;
  hướng b (qwen2.5:7b chấm) chỉ khi a không đạt; c chỉ khi a, b không đạt. **Cổng:** đạt R6 ⇒ Pha 1; không ⇒ dừng, ADR ghi kết quả (FR-005).
- **Pha 1 — tích hợp (chỉ khi ĐẠT):** hàm thuần `applyRerank` chèn sau RRF/trước MMR trong `retrieve()`; service reranker ở main (khuôn
  `embed-model.ts`: tải nền một lần vào data dir, badge `model`, fail-open + timeout, seam `IV_RERANK_FAKE`); `RELEVANCE_CALIBRATION.rerank` +
  `RERANK_MODEL_VERSION` + test canh giữ + đồng bộ `datasetVersion`; IPC chỉ đọc `ai:getRerankerStatus` + một dòng ở Cài đặt (i18n vi/en);
  ADR mới thay một phần 055.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 24 (dev/CI), Electron 43

**Primary Dependencies**: có sẵn — `@huggingface/transformers` ^4.2 (cross-encoder qua `AutoTokenizer` + `AutoModelForSequenceClassification`/
`AutoModel`, research R2), `@lancedb/lancedb`, `node:sqlite` FTS5, vitest 4, Playwright. **Không thêm dependency.**

**Storage**: không đổi schema. Model reranker tải vào `<dataDir>/models` (app) / `tests/eval/.cache/models` (công cụ đo).

**Testing**: vitest unit (hàm thuần: `applyRerank`, `validateRerankConfig`, trạng thái reranker, chỉ số/lưới mới, guard hiệu chuẩn); công cụ đo
`vitest.eval.config.ts` (I/O, không coverage); e2e Playwright với `IV_RERANK_FAKE=1` (trạng thái Cài đặt, không đáp án ⇒ notFound, fail-open).

**Target Platform**: macOS arm64 + Windows x64 (a1 có tệp lượng tử riêng cho từng nền tảng — R3).

**Project Type**: desktop-app (Electron main/renderer) + công cụ dev.

**Performance Goals**: chấm ≤ 20 cặp/câu, p50 ≤ 300 ms ấm (mốc, chốt sau đo — R11); nạp nguội một lần/phiên ở nền; event loop main không bị chặn
đáng kể (đo).

**Constraints**: local-first (chỉ tải model một lần, badge `model`); fail-open; không đổi chunk/locator; tất định (cùng câu ⇒ cùng kết quả); không log
nội dung.

**Scale/Scope**: bộ đo ~148 câu (v3); 2 model × 96 cấu hình; điểm chấm tính một lần/(câu, đoạn, model).

Không còn NEEDS CLARIFICATION (research R1–R12; điểm còn phải xác minh bằng chạy thử: a2 nạp qua `AutoModel` — task smoke-test đầu Pha 0).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                         | Trước thiết kế                                                                                                                                                                                                  | Sau Phase 1                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| I. Local-first & No Default Egress | Suy luận cục bộ; tải model một lần theo khuôn e5/Whisper với badge `sending/model`; lõi hỏi đáp chạy offline khi chưa có model (fail-open). Không gửi câu hỏi/đoạn đi đâu. Hướng b nếu chọn: chỉ Ollama cục bộ. | ✅ contract reranker-service; ADR ghi lý do (tăng cường, không điều kiện). |
| II. Verifiable Citations           | Chỉ chọn đoạn NÀO vào ngữ cảnh; `chunk`/`locator`/`score` không đổi nghĩa; rỗng ⇒ notFound (tăng mức "không bịa").                                                                                              | ✅ contract rerank-filter.                                                 |
| III. Desktop Security Boundary     | Model chạy ở main; 1 kênh IPC chỉ đọc mới, whitelist preload, không tham số; không đường FS/mạng cho renderer; log chỉ mã + tên model; seam fake chỉ khi chưa đóng gói.                                         | ✅                                                                         |
| IV. Test-First & Coverage          | Hàm thuần viết test trước (FAIL rồi mới code); I/O model + công cụ đo loại khỏi coverage theo quy ước 059/108; ngưỡng 80% giữ.                                                                                  | ✅                                                                         |
| V. Phased Delivery                 | Cải thiện lõi RAG Pha 1; cổng dừng ở báo cáo nếu không đạt.                                                                                                                                                     | ✅                                                                         |
| Terminology                        | Thuật ngữ mới (bộ chấm độ liên quan/reranker, điểm rerank, câu không đáp án sát chủ đề…) append glossary trong branch.                                                                                          | ✅                                                                         |
| ADR-governed                       | ADR mới thay một phần 055 (mục không rerank); không đổi stack (không dependency mới).                                                                                                                           | ✅                                                                         |

Không vi phạm ⇒ không cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/20261008-194015-unanswerable-detection/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ rerank-filter.md · reranker-service.md · eval-rerank-cli.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
tests/eval/
├── questions.json            # SỬA (Pha 0) — +12 vi, +3 en unanswerable, datasetVersion "3", reviewed null → duyệt
├── lib/rerank.ts             # MỚI (Pha 0, I/O) — nạp cross-encoder trong công cụ đo, chấm theo lô, cache điểm, đo trễ/RAM/event loop
├── lib/judge.ts              # MỚI (Pha 0, I/O, chỉ khi cần) — hướng b qua Ollama cục bộ
├── lib/rerank-grid.ts        # MỚI (thuần) — lưới R7 + chọn cấu hình + kết luận R6 (test ở tests/unit)
├── lib/harness.ts · report.ts · retrieval.eval.ts   # SỬA — chế độ EVAL_RERANK / EVAL_JUDGE, mục báo cáo mới
└── README.md                 # SỬA — biến môi trường mới

src/main/services/rag/
├── rerank-filter.ts          # MỚI (Pha 0, thuần — dùng chung công cụ đo) — RerankConfig, validateRerankConfig, applyRerank
├── retrieval.ts              # SỬA (Pha 1) — bước rerank sau RRF, fail-open/timeout, rerankScore
├── rag-types.ts              # SỬA — ScoredChunk.rerankScore?
└── relevance-calibration.ts  # SỬA — rerank: RerankCalibration | null, datasetVersion "3"

src/main/services/rerank/     # MỚI (Pha 1)
├── rerank-model.ts           # I/O (loại coverage) — createReranker, tải nền, badge, seam IV_RERANK_FAKE
├── status.ts                 # thuần — máy trạng thái idle/downloading/ready/error
└── model-version.ts          # RERANK_MODEL_VERSION

src/main/index.ts · src/main/ipc/register.ts · src/shared/ipc/{channels,types}.ts · src/preload/index.ts   # SỬA (Pha 1) — wiring, kênh ai:getRerankerStatus
src/renderer/features/ai-runtime/SettingsAiSection.tsx (+ hook nhỏ)                                       # SỬA (Pha 1) — dòng trạng thái
src/shared/i18n/domains/ai.ts                                                                             # SỬA — ai.reranker.status.* vi/en

tests/unit/  rerank-filter · rerank-grid · reranker-status · relevance-calibration (guard) · retrieval (rerank, fail-open, timeout) ·
             rag-service (extended rỗng — hồi quy) · i18n catalog (tự động)
tests/e2e/   rerank.spec.ts (IV_RERANK_FAKE): không đáp án ⇒ notFound không gọi chat; trạng thái Cài đặt; fail-open khi lỗi
docs/04-decisions/2026-10-xx-unanswerable-detection.md (+ INDEX) · docs/00-glossary.md (append) · .github/workflows/eval-retrieval.yml (cache)
```

**Structure Decision**: logic quyết định thuần (`rerank-filter.ts`) nằm ở `src/main/services/rag/` ngay từ Pha 0 để công cụ đo gọi ĐÚNG hàm sẽ
dùng trong app (bài học 108). Phần nạp model của công cụ đo (`tests/eval/lib/rerank.ts`) tách khỏi service app ở Pha 0 (chưa quyết model); Pha 1
service app dùng cùng cách nạp đã xác minh. Service reranker là thư mục mới theo quy ước "cô lập theo feature" (`src/main/services/<slug>/`).

## Phase 0 — Research

[research.md](./research.md): R1 ứng viên · R2 transformers.js cross-encoder · R3 tệp theo nền tảng · R4 điểm chèn · R5 hướng b · R6 bộ đo + tiêu chí ·
R7 lưới + chọn · R8 fail-open/timeout · R9 tải + trạng thái · R10 hiệu chuẩn/canh giữ/ADR/CI · R11 độ trễ · R12 phạm vi không đổi.

## Phase 1 — Design

[data-model.md](./data-model.md) · [contracts/rerank-filter.md](./contracts/rerank-filter.md) ·
[contracts/reranker-service.md](./contracts/reranker-service.md) · [contracts/eval-rerank-cli.md](./contracts/eval-rerank-cli.md) ·
[quickstart.md](./quickstart.md)

### Thứ tự thực hiện gợi ý (cho /speckit-tasks)

1. **Bộ đo v3** (+15 câu, grep chứng minh không có đáp án) → **DỪNG cho chủ dự án duyệt**.
2. Song song: `rerank-filter.ts` + `rerank-grid.ts` (TDD) · smoke-test nạp a1/a2 trong Node (R2) · `tests/eval/lib/rerank.ts`.
3. Đo mốc `EVAL_MODE=current` trên v3 → đo a1, a2 → (b nếu cần) → **CỔNG**: báo cáo + quyết định (DỪNG, trình số liệu cho chủ dự án).
4. Nếu ĐẠT: service reranker + status (TDD phần thuần) → `retrieve()` (TDD: rerank/fail-open/timeout/rỗng) → hiệu chuẩn + guard → IPC + Cài đặt + i18n
   → wiring tải nền → e2e.
5. ADR + INDEX + glossary + README công cụ đo + CI cache → test gate + đo lại `EVAL_MODE=current` (+ `EVAL_WITH_LLM=1` tham khảo).
6. Nếu KHÔNG ĐẠT: chỉ giữ bộ đo v3 + công cụ đo mở rộng + ADR ghi kết quả; `rerank: null`.

## Complexity Tracking

Không có vi phạm hiến pháp cần biện minh.
