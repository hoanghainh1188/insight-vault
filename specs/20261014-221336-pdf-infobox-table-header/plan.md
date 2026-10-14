# Implementation Plan: Trích PDF giữ nguyên hộp thông tin và tiêu đề cột bảng

**Branch**: `206-pdf-infobox-table-header` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/20261014-221336-pdf-infobox-table-header/spec.md`

## Summary

Hai lỗi trích PDF làm đoạn đáp án bị bộ chấm độ liên quan chấm thấp (q-162: 0,12; q-185: 0,23), đều xuất hiện trong dữ liệu thật của `tuyen-2a-ha-noi.pdf` (khảo sát toạ độ ở [research.md](research.md)):

1. **Hộp thông tin (trang 2)**: cột thân bài hẹp x∈[43,190] đứng cạnh hộp x∈[206,500] (nhãn x≈206, giá trị x≈265, chữ nhỏ hơn). `orderRegions` không tách vì cột thân bài "không đủ dày" (segment rộng 147 pt = 24,7% < ngưỡng 25% bề rộng trang), nên dòng thân bài và dòng hộp bị coi là MỘT bảng 3 cột ("| năm 2021, Tuyến 2A chính | Khổ | 1.435 mm … |"). Hướng sửa: nhận **cột thân bài hẹp, canh trái, đứng cạnh một vùng khác** để tách vùng; vùng hộp sau đó đi qua bảng 2 cột hiện có, thêm gộp dòng nối tiếp của nhãn / giá trị ("Khổ" + "đường sắt" → "Khổ đường sắt").
2. **Bảng nhà ga (trang 5)**: tiêu đề cột trải 8 dòng, ô canh giữa dọc, nằm TRÊN dòng dữ liệu đầu (y 49–103, dữ liệu từ y 124) và không vào bảng. Hướng sửa: sau khi `detectTables` biết các cột dữ liệu, **ghép dải tiêu đề phía trên** theo cột (chồng lấn x) thành một dòng tiêu đề; tiêu đề trải nhiều cột ("Khoảng cách (km)") gắn tiền tố cho từng cột nó phủ.

Cổng khả thi làm TRƯỚC (bước 0): chấm thử bằng bộ chấm hiện hành văn bản "lý tưởng" viết tay cho q-162 / q-185; không vượt ngưỡng ⇒ dừng, ghi ADR "giới hạn đã biết", không viết mã (tránh làm cả nền mà không cứu được câu nào — bài học #187).

## Technical Context

**Language/Version**: TypeScript 5 (Node/Electron main process)

**Primary Dependencies**: `pdfjs-dist` legacy (đã có); không thêm phụ thuộc

**Storage**: SQLite hiện có — không đổi schema; chỉ tăng `PDF_EXTRACTION_VERSION` (3 → 4) ở `src/shared/ipc/types.ts`

**Testing**: vitest (unit, hàm thuần trên `LayoutItem[]`), bộ đánh giá `npm run eval:retrieval` (nhóm PDF, `EVAL_DETAILS=1`), fixture PDF tự sinh (`make-pdf-layout`) + `tuyen-2a-ha-noi.pdf`

**Target Platform**: macOS + Windows (Electron); thuần JS nên không khác nền tảng

**Project Type**: desktop-app (Electron)

**Performance Goals**: trích `tuyen-2a-ha-noi.pdf` ≤ 1000 ms (ngân sách eval hiện hành); tất định

**Constraints**: local-first, không tải model, không IPC mới; văn bản ra ở dạng cố định của `cleanText` (locator tính trên văn bản chính tắc); trang không có hộp / bảng nhiều dòng tiêu đề cho văn bản giống hệt (FR-004)

**Scale/Scope**: 2 thay đổi trong `pdf-layout/` (mỗi cái 1 module mới, ≤ ~200 dòng) + tăng phiên bản + đo lại

## Constitution Check

| Nguyên tắc | Đánh giá |
|---|---|
| I. Local-first | ĐẠT — thuần cục bộ, không mạng, không model mới |
| II. Verifiable Citations | ĐẠT CÓ ĐIỀU KIỆN — locator vẫn tính trên văn bản chính tắc (`cleanText(text) === text`), `blocks` của bảng vẫn đúng offset; cần test: chip → trang + vùng tô khớp với bảng / hộp mới. Chip cũ xử lý như 112 (chunkId không còn ⇒ mở nguồn không highlight) |
| III. Security Boundary | ĐẠT — chỉ main process, không IPC / preload mới; không security-reviewer bắt buộc (không đụng IPC / model) |
| IV. Test-First & Coverage | ĐẠT — TDD trên hàm thuần; fixture cả hai dạng + ca "không chắc"; coverage ≥ 80% |
| V. Phased Delivery | ĐẠT — thuộc lõi Pha 1 (ingestion) |

Không có vi phạm cần biện minh. Re-check sau thiết kế: không đổi.

## Project Structure

### Documentation (this feature)

```text
specs/20261014-221336-pdf-infobox-table-header/
├── plan.md              # file này
├── research.md          # khảo sát dữ liệu thật + quyết định + phương án loại
├── data-model.md        # kiểu mới trong pdf-layout (không đổi DB)
├── quickstart.md        # cách kiểm đầu-cuối
├── contracts/
│   └── pdf-layout-delta.md   # thay đổi hợp đồng văn bản trích (so với 112 / 147)
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/main/services/ingestion/pdf-layout/
├── columns.ts           # SỬA: tiêu chí "cột thân bài hẹp" để tách vùng (US2)
├── side-box.ts          # MỚI: nhận hộp nhãn/giá trị trong vùng tách + gộp dòng nối tiếp (US2) — hàm thuần
├── table-header.ts      # MỚI: ghép dải tiêu đề phía trên theo cột dữ liệu (US1) — hàm thuần
├── tables.ts            # SỬA nhỏ: gọi table-header sau khi có cột dữ liệu (đang 420 dòng; không nở thêm >100)
└── types.ts             # SỬA: ngưỡng mới (hằng số có tên)
src/shared/ipc/types.ts  # SỬA: PDF_EXTRACTION_VERSION 3 → 4 (+ chú thích)

tests/unit/
├── pdf-layout-side-box.test.ts      # MỚI
├── pdf-layout-table-header.test.ts  # MỚI
├── pdf-layout-regression.test.ts    # MỚI: văn bản fixture cũ giống hệt (FR-004 / SC-005)
└── (cập nhật) pdf-layout-columns.test.ts, ingestion-pdf-blocks.test.ts
tests/eval/              # đo lại; có thể cần cập nhật quote q-162 / q-185 (xem Rủi ro R2)
docs/04-decisions/       # ADR 2026-10-1x-pdf-infobox-table-header.md + INDEX
```

**Structure Decision**: giữ kiến trúc 112 (hàm thuần `LayoutItem[] → text + blocks`), thêm hai bước nhỏ vào pipeline `dòng → vùng → (hộp) → bảng(+tiêu đề) → đoạn`, mỗi bước có thể tắt bằng try/catch về hành vi cũ (FR-003).

## Phasing (đề xuất)

| Bước | Nội dung | Cổng |
|---|---|---|
| 0 | Cổng khả thi: viết tay văn bản "lý tưởng" cho đoạn q-162 (tiêu đề + dòng Láng) và q-185 (hộp), chấm bằng bộ chấm hiện hành qua công cụ `tests/eval` | Điểm ≥ minScore 0,6 ở CẢ HAI ⇒ làm tiếp; chỉ một ⇒ làm riêng phần cứu được; không ⇒ dừng + ADR |
| 1 | US1 — ghép tiêu đề (table-header) + test + fixture | Test xanh, fixture cũ giống hệt |
| 2 | US2 — tách cột thân bài hẹp + hộp + test | Test xanh, trang 2 cho hộp sạch; toàn bộ 12 trang của PDF thật được diff đọc tay |
| 3 | Tăng phiên bản, đo lại eval, ADR, đối chiếu từng câu | SC-001…SC-006 |

Bước 1–3 có thể cùng một PR; tách PR nếu diff > ~600 dòng.

## Rủi ro

- **R1 — trích tốt hơn chưa chắc cứu điểm bộ chấm**: bước 0 chặn rủi ro này sớm (chi phí vài phút, không mã).
- **R2 — quote bộ đo lệch văn bản mới**: q-185 dùng quote `| Điện khí | Ray thứ ba 750V DC |`; sau khi gộp nhãn thành "Điện khí hóa" quote không còn khớp ⇒ cần đổi quote (chỉ chuỗi chứng cứ, không đổi câu hỏi / loại / tách dev–hold-out). Việc này sửa bộ đo v5 đã được chủ dự án duyệt ⇒ **cần chủ dự án duyệt lại các quote đổi** (ghi trong PR, tăng `datasetVersion` nếu convention yêu cầu). Quote q-162 (`| T2A 04 | Láng | …`) dự kiến giữ nguyên.
- **R3 — hạ ngưỡng "cột dày" làm trang khác tách nhầm**: đo trên toàn bộ fixture + corpus PDF; chỉ nhận tiêu chí hẹp ("cột canh trái, nhiều dòng, đứng cạnh vùng có bố cục khác"), không hạ ngưỡng toàn cục (xem research D1).
- **R4 — bảng tiêu đề nhiều tầng / ô gộp**: không chắc ⇒ giữ cách trích hiện tại (FR-003).
- **R5 — hàng dữ liệu nhiều dòng canh giữa dọc đã gộp sai** (hàng 02/03 của bảng nhà ga hiện thành "T2A 02 T2A 03 | La Thành Thái Hà"): NGOÀI phạm vi spec (không ảnh hưởng q-162); ghi nhận để quyết sau khi có số đo.
