# Implementation Plan: Thêm PDF vào bộ đánh giá truy xuất

**Branch**: `177-eval-pdf` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/20261010-114620-eval-pdf/spec.md` · Quyết định: `docs/04-decisions/2026-10-10-eval-pdf-clarify.md`

## Summary

Bộ đánh giá truy xuất (`npm run eval:retrieval`) hiện coi mọi tài liệu là Markdown (`parseText`, `kind: "md"`). Feature này cho
manifest khai báo **định dạng** từng tài liệu; tài liệu PDF được nạp qua **`parsePdf` của app với cấu hình mặc định** (đúng nhánh
`kind === "pdf"` của `ingestion.ts`), trích dẫn đáp án PDF được kiểm trên **văn bản do chính `parsePdf` trích** (bước kiểm dữ liệu
chuyển sang bất đồng bộ), và báo cáo có **nhóm số liệu PDF** (tham khảo) kèm **cảnh báo** khi cận trên Wilson 95% Recall@6 PDF thấp hơn
Markdown. Thêm 2 PDF: 1 **sinh tất định từ fixture** (`make-pdf.ts`, chỉ thêm khả năng) chứa bảng số căn phải, trang ngang, gạch nối,
hai cột, đáp án sát cuối trang; 1 **bản "Tải về dạng PDF" của Wikipedia tiếng Việt** cho một bài mới. Tăng `datasetVersion` 3 → 4,
`reviewed: null`, đo lại `RELEVANCE_CALIBRATION` (chỉ số liệu) trong cùng PR; không đạt ⇒ dừng.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node của Electron (vitest chạy Node)

**Primary Dependencies**: có sẵn — vitest, `pdfjs-dist` (qua `parsePdf`), `@lancedb`, `better-sqlite3`, e5 embedder, cross-encoder 109;
`node:crypto` (sha256). **Không thêm dependency.**

**Storage**: tệp trong repo `tests/eval/corpus/` (manifest JSON + `.md` + `.pdf`); chỉ mục tạm (SQLite + LanceDB) trên `os.tmpdir()`

**Testing**: vitest — `npm test` (unit, coverage ≥ 80% phần logic, không mô hình / không mạng) và `npm run eval:retrieval`
(`vitest.eval.config.ts`, bấm tay, cần cache mô hình)

**Target Platform**: máy dev macOS / Windows + job CI `eval-retrieval` (workflow_dispatch)

**Project Type**: công cụ dev-only bên trong app desktop Electron (không đóng gói)

**Performance Goals**: `parsePdf` mỗi PDF ≤ 1000 ms (dư ≥ 5× so với `LAYOUT_BUDGET_MS` = 5000); kiểm dữ liệu (không mô hình) ≤ vài giây

**Constraints**: offline khi chạy; không đổi `parsePdf` / `PDF_EXTRACTION_VERSION` / chunker / `retrieve()` / rerank; chỉ đổi **số liệu**
trong `src/main/services/rag/relevance-calibration.ts`; tổng dung lượng thêm ≤ ~1 MB; tài liệu eval không vào `out/**`

**Scale/Scope**: 11 → 13 tài liệu; 148 câu → ~170–180 câu (thêm ~20–30 câu PDF tiếng Việt, gồm câu không đáp án sát chủ đề PDF)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                                      | Đánh giá                                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Local-first & No Default Egress              | ✅ Eval chạy offline; PDF Wikipedia tải **một lần** khi soạn dữ liệu (thao tác tay của người phụ trách, ngoài lúc chạy), commit vào repo. Không thêm egress vào app. |
| II. Verifiable Citations                        | ✅ Đo đúng chip `[n]` gốc: đoạn chứa trích dẫn đáp án lấy từ văn bản `parsePdf` thật. Không đổi đường trích dẫn.                                                     |
| III. Desktop Security Boundary                  | ✅ Không đụng renderer / preload / IPC.                                                                                                                              |
| IV. Test-First & Coverage                       | ✅ Mọi hàm thuần mới (`dataset.ts`, `metrics.ts`, `report.ts`, fixture builder) có unit test viết trước; harness là I/O (đã loại khỏi coverage như 108).             |
| V. Phased Delivery                              | ✅ Công cụ đo cho lõi Pha 1 (ingestion PDF → RAG).                                                                                                                   |
| Ràng buộc bổ sung (no new deps, không đóng gói) | ✅                                                                                                                                                                   |

Không có vi phạm ⇒ không cần Complexity Tracking. **Re-check sau Phase 1**: ✅ (thiết kế không thêm dependency, không đổi mã chạy app ngoài
số liệu hiệu chuẩn).

## Project Structure

### Documentation (this feature)

```text
specs/20261010-114620-eval-pdf/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── manifest.md        # schema manifest + quy tắc kiểm
│   └── report.md          # phần báo cáo mới (nhóm PDF, cảnh báo, pdfExtractionVersion)
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
tests/eval/
├── lib/
│   ├── dataset.ts         # SỬA: format/file/sha256, EvalLicense + "CC0-1.0", loadDataset → async (parsePdf), docFormat()
│   ├── metrics.ts         # SỬA: QuestionOutcome.format, groupOutcomes + pdfDev/pdfHoldout/mdDev/mdHoldout, pdfWarnings()
│   ├── report.ts          # SỬA: pdfExtractionVersion, mục "Nhóm PDF (tham khảo)", cảnh báo
│   ├── harness.ts         # SỬA (I/O): kind theo format, parseFile pdf → parsePdf(bytes) mặc định
│   └── pdf-fixture.ts     # MỚI: buildEvalFixturePdf() thuần, tất định (dùng make-pdf)
├── corpus/
│   ├── manifest.json      # SỬA: +2 tài liệu PDF, format/file/sha256
│   ├── <fixture-id>.pdf   # MỚI (sinh từ pdf-fixture.ts, commit)
│   ├── <wiki-id>.pdf      # MỚI (Wikipedia "Tải về dạng PDF", commit)
│   └── README.md          # SỬA: nguồn / giấy phép / ghi công / tái tạo / sha256
├── questions.json         # SỬA: datasetVersion "4", reviewed null, +câu PDF
├── retrieval.eval.ts      # SỬA: await loadDataset, nhóm PDF, cảnh báo
└── README.md              # SỬA

tests/fixtures/pdf/make-pdf.ts   # SỬA (chỉ thêm): helper dàn dòng / phân trang; hành vi cũ giữ nguyên
src/main/services/rag/relevance-calibration.ts   # SỬA: CHỈ số liệu + datasetVersion "4" + calibratedAt
tests/unit/
├── eval-dataset.test.ts       # SỬA: format/sha256/license/async loader
├── eval-metrics.test.ts       # SỬA: nhóm PDF + pdfWarnings
├── eval-report.test.ts        # MỚI hoặc SỬA: render mục PDF
├── eval-pdf-corpus.test.ts    # MỚI: trích mỗi PDF 2 lần giống hệt, ≤ 1000 ms, mọi quote PDF khớp, sha256 khớp, metadata sạch
└── eval-pdf-fixture.test.ts   # MỚI: buildEvalFixturePdf tất định + đủ đặc trưng (bảng, ngang, gạch nối, 2 cột)
docs/04-decisions/2026-10-10-eval-pdf.md  # ADR thực thi (sau review) + INDEX
```

**Structure Decision**: giữ nguyên cấu trúc bộ đánh giá 108/109; mọi logic mới là hàm thuần trong `tests/eval/lib/` (test được bằng
`npm test`), I/O ở `harness.ts` và `retrieval.eval.ts`. App chỉ đổi số liệu bản ghi hiệu chuẩn.

## Phase 0 — Research

Xem [research.md](research.md) (R1–R9): cách nạp PDF trong harness, loader bất đồng bộ, dàn trang fixture trong giới hạn 128 ký tự,
tái tạo + sha256, tải và kiểm PDF Wikipedia, metadata, nhóm số liệu theo định dạng, cảnh báo Wilson, quy trình đo lại hiệu chuẩn.

## Phase 1 — Design

- [data-model.md](data-model.md) — EvalDocument mở rộng, EvalQuestion (không đổi), QuestionOutcome.format, nhóm PDF, PdfWarning, báo cáo.
- [contracts/manifest.md](contracts/manifest.md), [contracts/report.md](contracts/report.md).
- [quickstart.md](quickstart.md) — kịch bản kiểm chứng.

## Thứ tự triển khai (gợi ý cho /speckit-tasks)

1. Glossary append (thuật ngữ mới) → test trước cho `dataset.ts` (format/file/sha256/license, loader async) → hiện thực.
2. `make-pdf.ts` helper dàn dòng (test cũ phải xanh) → `pdf-fixture.ts` + test tất định / đặc trưng → sinh + commit PDF fixture.
3. PDF Wikipedia: chọn bài, **xin phép tải** (thao tác ra mạng), kiểm lớp chữ / dung lượng / metadata, commit + sha256 + ghi công.
4. `eval-pdf-corpus.test.ts` (2 lần giống hệt, ≤ 1000 ms, quote khớp) → soạn câu hỏi PDF (dev/hold-out 70/30, vi), `datasetVersion` 4.
5. `metrics.ts` nhóm PDF + `pdfWarnings` (test trước) → `report.ts` → `harness.ts` / `retrieval.eval.ts`.
6. Chạy eval v3 (main) vs v4 (branch) ⇒ bảng trước / sau; đo lại hiệu chuẩn; không đạt ⇒ dừng + báo.
7. README eval + corpus, ADR thực thi + INDEX → cổng review → test gate.

## Complexity Tracking

Không có.
