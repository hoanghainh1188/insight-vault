# Implementation Plan: Hiệu chuẩn bộ lọc độ liên quan của truy xuất

**Branch**: `108-relevance-calibration` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20261007-111628-relevance-calibration/spec.md`; quyết định:
`docs/04-decisions/2026-10-07-relevance-calibration-clarify.md`; intake: `docs/intake/108-relevance-calibration.md`.

## Summary

Hiện bộ lọc độ liên quan của hỏi đáp gần như không tác dụng: ngưỡng `0.5` rộng so với khoảng cách nén hẹp của e5-small
và nhánh BM25 không bị lọc ⇒ `retrieve()` hầu như không rỗng ⇒ "Không tìm thấy" phụ thuộc mô hình tự giác; thêm nữa
`rag-service` gắn MỌI đoạn ngữ cảnh làm trích dẫn khi mô hình không trích được. Kế hoạch: (A) bộ đánh giá công khai trong
`tests/eval/` + công cụ đo chạy bằng vitest với các thành phần THẬT (e5, LanceDB, FTS5) trên thư mục tạm; (B) tách logic
lọc thành hàm thuần `selectRelevant` (ngưỡng tuyệt đối, ngưỡng tương đối, chặn BM25) dùng chung cho app và công cụ đo,
quét lưới cấu hình, chọn theo tiêu chí đã chốt; (C) áp dụng qua bản ghi `RELEVANCE_CALIBRATION` gắn
`EMBEDDING_MODEL_VERSION` (test canh giữ), siết nhánh "không có [n]" ⇒ không tìm thấy + gợi ý, ADR mới.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 24 (dev/CI), Electron 43 (app — không đổi)

**Primary Dependencies**: có sẵn — `@huggingface/transformers` (e5 in-process), `@lancedb/lancedb`, `node:sqlite` (FTS5),
`vitest` 4. KHÔNG thêm dependency mới.

**Storage**: không đổi schema. Bộ đánh giá: tệp `.md` + JSON trong `tests/eval/`. Công cụ đo dùng thư mục tạm.

**Testing**: vitest (unit, node env) cho logic thuần; công cụ đo = vitest config riêng `vitest.eval.config.ts` (không chạy
trong `npm test`, không tính coverage); Playwright E2E hiện có giữ nguyên.

**Target Platform**: app macOS arm64 + Windows x64 (không đổi); công cụ đo: macOS/Linux dev + ubuntu CI.

**Project Type**: desktop-app (Electron main/renderer) + công cụ dev.

**Performance Goals**: SC-006 — thời gian trả lời không tăng > 10%; `selectRelevant` O(hits) ≤ 20 phần tử, tái dùng
vector đã lấy cho MMR (research R11).

**Constraints**: offline/local-first (không egress mới trong app — FR-022); kết quả truy xuất tất định; chunk/locator
không đổi (Constitution II).

**Scale/Scope**: bộ đánh giá ~8–12 tài liệu + 2–3 tài liệu nhiễu, ~110 câu; lưới quét ~200–400 cấu hình (mỗi cấu hình
chỉ lọc lại trên hit đã tính sẵn — embed/tìm kiếm chạy MỘT lần cho mỗi câu).

Không còn NEEDS CLARIFICATION (research.md R1–R12).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                         | Đánh giá trước thiết kế                                                                                                                               | Sau Phase 1                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| I. Local-first & No Default Egress | Công cụ đo chỉ ở dev/CI; tải mô hình vào thư mục cache riêng; app không thêm kết nối (FR-022).                                                        | ✅ `tests/eval/**` ngoài `out/**` (electron-builder chỉ gói `out/**`); badge không đổi. |
| II. Verifiable Citations           | Lọc chỉ đổi đoạn NÀO được chọn; nhánh "không có [n]" nay trả "Không tìm thấy" thay vì gắn mọi đoạn — TĂNG mức tuân thủ.                               | ✅ `selectRelevant` không đổi id/chunk/locator (contract).                              |
| III. Desktop Security Boundary     | Không IPC mới, không đổi preload; không log nội dung (công cụ đo chỉ dùng tài liệu công khai của repo).                                               | ✅                                                                                      |
| IV. Test-First & Coverage          | Hàm thuần mới (`selectRelevant`, chỉ số, khớp trích đoạn, guard phiên bản) viết test trước; phần I/O của công cụ đo loại khỏi coverage theo quy ước.  | ✅ ngưỡng 80% giữ.                                                                      |
| V. Phased Delivery                 | Cải thiện lõi Pha 1 (RAG) — đúng hướng.                                                                                                               | ✅                                                                                      |
| Terminology                        | Thuật ngữ mới (bộ đánh giá, câu không có đáp án, Recall@k, bản ghi hiệu chuẩn, chặn BM25…) append glossary trong branch (intake mục "Thuật ngữ mới"). | ✅                                                                                      |
| ADR-governed                       | ADR mới thay phát biểu 0.75 của ADR 013; không đổi stack.                                                                                             | ✅                                                                                      |

Không vi phạm ⇒ không cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/20261007-111628-relevance-calibration/
├── plan.md              # file này
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── eval-retrieval-cli.md
│   └── relevance-filter.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (chưa tạo)
```

### Source Code (repository root)

```text
src/main/services/rag/
├── relevance-filter.ts        # MỚI — RelevanceConfig, validateRelevanceConfig, selectRelevant (thuần)
├── relevance-calibration.ts   # MỚI — RELEVANCE_CALIBRATION (config + embeddingModelVersion + metrics)
├── retrieval.ts               # SỬA — thay lọc `distance ≤ RELEVANCE_MAX_DISTANCE` bằng selectRelevant; nhận cfg tuỳ chọn (công cụ đo truyền vào)
├── rag-service.ts             # SỬA — grounded không [n] ⇒ notFound; mọi nhánh not-found trả NOT_FOUND_DISPLAY
└── constants.ts               # SỬA — bỏ RELEVANCE_MAX_DISTANCE; thêm NOT_FOUND_HINT, NOT_FOUND_DISPLAY

tests/unit/
├── relevance-filter.test.ts        # MỚI
├── relevance-calibration.test.ts   # MỚI — guard EMBEDDING_MODEL_VERSION
├── eval-metrics.test.ts            # MỚI — Recall@k, MRR, tỉ lệ từ chối, Wilson CI, histogram, chọn cấu hình
├── eval-dataset.test.ts            # MỚI — khớp trích đoạn (chuẩn hoá), validate manifest/câu hỏi (dữ liệu giả nhỏ)
├── retrieval*.test.ts              # SỬA — theo cấu hình mới
└── rag-service.test.ts             # SỬA — nhánh không [n] ⇒ notFound + hiển thị gợi ý

tests/eval/                         # MỚI — dev-only, không đóng gói
├── corpus/
│   ├── README.md                   # nguồn + giấy phép
│   ├── manifest.json
│   └── <id>.md                     # toàn văn
├── questions.json
├── lib/
│   ├── dataset.ts                  # nạp + validate + khớp trích đoạn (thuần, test ở tests/unit)
│   ├── metrics.ts                  # chỉ số + chọn cấu hình (thuần, test ở tests/unit)
│   ├── grid.ts                     # lưới cấu hình quét
│   ├── harness.ts                  # I/O: thư mục tạm, pipeline thật, retrieve() theo cấu hình
│   └── report.ts                   # ghi report.json/report.md
├── retrieval.eval.ts               # entry vitest
├── .cache/                         # gitignore — mô hình
└── reports/                        # gitignore — kết quả

vitest.eval.config.ts               # MỚI — include tests/eval/**/*.eval.ts, timeout dài, không coverage
package.json                        # SỬA — script "eval:retrieval"
.github/workflows/eval-retrieval.yml # MỚI — workflow_dispatch
.gitignore                          # SỬA — tests/eval/.cache, tests/eval/reports
docs/04-decisions/2026-10-xx-relevance-calibration.md  # MỚI — ADR số liệu + supersede 0.75 (+ INDEX)
docs/00-glossary.md                 # append thuật ngữ mới
```

**Structure Decision**: logic thuần đặt trong `src/main/services/rag/` (cạnh `retrieval.ts`, dùng chung app + công cụ đo);
công cụ đo nằm trọn trong `tests/eval/` (không vào `src/` ⇒ không thể bị đóng gói). Phần thuần của công cụ đo
(`dataset.ts`, `metrics.ts`) có unit test trong `tests/unit/` và được thêm vào `coverage.include`; `harness.ts`/`report.ts`
là I/O, không tính coverage. Retrieval nhận cấu hình qua tham số tuỳ chọn (mặc định `RELEVANCE_CALIBRATION.config`) để công
cụ đo gọi ĐÚNG hàm của app.

## Phase 0 — Research

Xem [research.md](./research.md): R1 chạy ngoài Electron · R2 cache · R3 phương án lọc · R4 lưới + chọn · R5 chỉ số ·
R6 khớp trích đoạn · R7 siết "đường bịa" + tách NOT_FOUND_DISPLAY · R8 bản ghi + guard · R9 LLM tham khảo · R10 CI ·
R11 hiệu năng · R12 giấy phép.

## Phase 1 — Design

- [data-model.md](./data-model.md) — EvalDocument, EvalQuestion, RelevanceConfig, RelevanceCalibration, EvalReport.
- [contracts/relevance-filter.md](./contracts/relevance-filter.md) — `selectRelevant`.
- [contracts/eval-retrieval-cli.md](./contracts/eval-retrieval-cli.md) — `npm run eval:retrieval`.
- [quickstart.md](./quickstart.md) — kiểm chứng end-to-end.

### Thứ tự thực hiện gợi ý (cho /speckit-tasks)

1. Bộ dữ liệu (tài liệu + câu hỏi) → **DỪNG cho người dùng duyệt** (FR-003) trước khi hiệu chuẩn.
2. Song song: hàm thuần + test (`selectRelevant`, chỉ số, khớp trích đoạn) → công cụ đo (I/O) → CI.
3. Chạy baseline → quét → chọn cấu hình → áp dụng `RELEVANCE_CALIBRATION` + guard.
4. Siết `rag-service` + câu không tìm thấy (độc lập với 1–3, có thể làm sớm).
5. ADR + glossary + cập nhật ADR 013 tham chiếu.

## Complexity Tracking

Không có vi phạm hiến pháp cần biện minh.
