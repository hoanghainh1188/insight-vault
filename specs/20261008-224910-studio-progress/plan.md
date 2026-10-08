# Implementation Plan: Hiển thị tiến độ khi tạo kết quả Studio

**Branch**: `146-studio-progress` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/20261008-224910-studio-progress/spec.md`; quyết định `docs/04-decisions/2026-10-08-studio-progress-clarify.md`; intake
`docs/intake/146-studio-progress.md`.

## Summary

Main phát sự kiện tiến độ trong lúc tạo Studio — pha `reading` (i/N trước mỗi lượt đọc), `condensing` (khi bắt đầu rút gọn), `writing` (trước bước viết
cuối; tạo một lượt chỉ có `writing`) — qua kênh push mới `studio:progress`, gắn `generationId` do renderer sinh. Renderer giữ tiến độ theo từng loại, chỉ
nhận sự kiện của lượt đang chạy, hiển thị dòng pha + thanh tiến độ trên thẻ Studio và thông báo trình đọc màn hình ở mốc. Thuật toán, kết quả, trích dẫn
và dữ liệu đã lưu không đổi.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Electron 43, React 18

**Primary Dependencies**: có sẵn (không thêm). `crypto.randomUUID()` ở renderer cho `generationId`.

**Storage**: không đổi.

**Testing**: vitest unit (map-reduce phát tiến độ, studio-service một lượt/nhiều phần, kiểm `generationId`, reducer tiến độ + mốc thông báo, hook `useStudio`
bỏ sự kiện cũ, component tiến độ jsdom, whitelist kênh, catalog i18n); e2e Playwright: kênh có trong `window.api`, thẻ hiện "Đang viết…" khi tạo một lượt
(model giả qua Ollama giả HTTP như e2e #135), ảnh chụp cột hẹp vi/en.

**Target Platform**: macOS arm64 + Windows x64.

**Project Type**: desktop-app (Electron main/renderer).

**Performance Goals**: sự kiện ≤ 12 (đọc) + 1 (rút gọn) + 1 (viết) mỗi lượt; không ảnh hưởng thời gian tạo.

**Constraints**: không nội dung trong sự kiện/log; không egress; không đổi kết quả (SC-005).

**Scale/Scope**: 4 loại Studio, tối đa 12 phần.

Không còn NEEDS CLARIFICATION.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                     | Đánh giá                                                                                                                     | Sau Phase 1 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------- |
| I. Local-first                 | Không kết nối mới; sự kiện nội bộ main→renderer; chỉ báo riêng tư không đổi.                                                 | ✅          |
| II. Verifiable Citations       | Chỉ quan sát; `[n]`, hậu kiểm, `parts`, `truncated` không đổi (test hồi quy hiện có giữ nguyên kỳ vọng).                     | ✅          |
| III. Desktop Security Boundary | Kênh mới whitelist ở preload (chỉ nhận); `generationId` kiểm định dạng ở main; payload chỉ mã + số + id; không log nội dung. | ✅ contract |
| IV. Test-First & Coverage      | Hàm thuần (phát tiến độ, kiểm id, reducer, mốc thông báo) test trước; ngưỡng 80% giữ.                                        | ✅          |
| V. Phased Delivery             | Cải thiện Studio (Pha 1).                                                                                                    | ✅          |
| Terminology                    | Append glossary: `StudioProgressEvent`, `StudioProgressPhase`, `generationId`, tiến độ bất định.                             | ✅          |

## Project Structure

```text
specs/20261008-224910-studio-progress/ plan.md · research.md · data-model.md · quickstart.md · contracts/studio-progress.md · tasks.md

src/shared/ipc/types.ts            # SỬA — StudioProgressPhase, StudioProgressEvent, StudioGenerateInput.generationId?
src/shared/ipc/channels.ts         # SỬA — studioProgress: "studio:progress" (push)
src/shared/studio-progress.ts      # MỚI (thuần) — isValidGenerationId
src/main/services/studio/map-reduce.ts    # SỬA — onProgress (reading i/N trước mỗi lượt map, condensing khi vào vòng rút gọn đầu, writing trước bước cuối)
src/main/services/studio/studio-service.ts # SỬA — generate(input, onProgress?) ; một lượt ⇒ writing; nhiều phần ⇒ truyền xuống runMapReduce
src/main/ipc/register.ts           # SỬA — studio:generate: generationId hợp lệ ⇒ onProgress phát studio:progress tới mọi cửa sổ
src/preload/index.ts               # SỬA — onStudioProgress(cb) ⇒ hàm huỷ
src/renderer/features/studio/studio-progress.ts   # MỚI (thuần) — reducer áp sự kiện + chọn mốc thông báo + chuỗi hiển thị
src/renderer/features/studio/useStudio.ts         # SỬA — sinh generationId, theo dõi lượt đang chạy, progress theo loại
src/renderer/features/studio/StudioProgress.tsx   # MỚI — dòng pha + thanh (progressbar, reduced-motion)
src/renderer/features/studio/StudioColumn.tsx     # SỬA — thay skeleton bằng StudioProgress khi có tiến độ; trên card cũ khi Tạo lại; announce mốc
src/renderer/features/studio/studio.css           # SỬA — kiểu thanh tiến độ
src/shared/i18n/domains/studio.ts, a11y.ts        # SỬA — studio.progress.*, a11y.studioProgress*
tests/unit/ (studio-map-reduce, studio-service, studio-progress, use-studio-progress, studio-progress-ui, studio channels whitelist)
tests/e2e/studio-progress.spec.ts
docs/04-decisions/2026-10-08-studio-progress.md (+ INDEX), docs/00-glossary.md (append)
```

**Structure Decision**: logic quyết định (phát tiến độ, kiểm id, reducer, mốc) là hàm thuần có test; I/O mỏng ở IPC/preload; component trình bày tách riêng.

## Phase 0 — Research

[research.md](./research.md): R1 điểm phát sự kiện · R2 kênh + định danh · R3 renderer state · R4 mốc thông báo · R5 trình bày · R6 e2e.

## Phase 1 — Design

[data-model.md](./data-model.md) · [contracts/studio-progress.md](./contracts/studio-progress.md) · [quickstart.md](./quickstart.md)

### Thứ tự thực hiện gợi ý

1. Glossary append → kiểu chung + `isValidGenerationId` (TDD) → kênh + whitelist test.
2. map-reduce + studio-service phát tiến độ (TDD; test hồi quy cũ giữ kỳ vọng) → IPC + preload.
3. Reducer + mốc + chuỗi (TDD) → `useStudio` (TDD) → `StudioProgress` + `StudioColumn` (jsdom test) → i18n.
4. e2e + ảnh chụp cột hẹp vi/en → ADR + INDEX → test gate.

## Complexity Tracking

Không có vi phạm hiến pháp cần biện minh.
