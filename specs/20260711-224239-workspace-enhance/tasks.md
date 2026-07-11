# Tasks: Workspace enhancements (Studio nâng cấp + kéo cột + nav)

**Feature**: `025-workspace-enhance` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Cách tiếp cận**: Test-First (Constitution IV, ≥80%). Logic thuần/DI (`export sanitize`, `useColumnWidths`,
`lastNotebook`) unit-test. `[P]` = song song (khác file). KHÔNG migration. KHÔNG map-reduce (quyết định đảo
2026-07-11 — xem clarify #1: tăng ngân sách, giữ chip `[n]` chính xác).

**Nguồn**: [research.md](./research.md) (R1–R7), [data-model.md](./data-model.md),
[contracts/ipc-channels.md](./contracts/ipc-channels.md).

**Kế thừa (KHÔNG sửa nghĩa cũ)**: studio-service/repo/prompt/constants (021), buildContext/citation (013),
Source Viewer openCitation (019), source-repo (011). Chống hồi quy: giữ mọi e2e cũ xanh (SC-007).

---

## Phase 1: Setup

- [X] T001 [P] Cập nhật `vitest.config.ts`: include `src/renderer/features/sources/useColumnWidths.ts` + `src/renderer/shared/lastNotebook.ts`; exclude `src/main/services/studio/export.ts` (dialog/fs I/O). (`studio-service.ts` đã exclude; export sanitize test qua hàm thuần export riêng.)

---

## Phase 2: Foundational (types + kênh — CHẶN nhóm A)

- [X] T002 [P] Mở rộng shared types `src/shared/ipc/types.ts`: `StudioGenerateInput` +`sourceId?`; THÊM `StudioExportInput{content,suggestedName}` + `StudioExportResult{saved,path?}`. (KHÔNG thêm `partsCount` — bỏ map-reduce.)
- [X] T003 [P] Test whitelist `tests/unit/studio-export-whitelist.test.ts` — `studio:export` whitelisted; kênh ngoài bị từ chối; `WHITELISTED_CHANNELS.size` +1 (RED).
- [X] T004 Thêm kênh `studio:export` vào `src/shared/ipc/channels.ts` (`CHANNELS` + `ChannelResponse[studioExport]=StudioExportResult`) → T003 GREEN.

**Checkpoint**: types + kênh sẵn sàng.

---

## Phase 3: Nhóm A — Studio nâng cấp (US1 ngân sách + US2 lọc nguồn + US3 Copy/Export) 🎯 P1

**Goal**: nới ngân sách (bao phủ rộng hơn, giữ chip `[n]` chính xác); lọc theo nguồn; Copy/Export/skeleton.

**Independent Test**: notebook trong ngân sách mới → tổng hợp trọn vẹn, chip `[n]` mở đúng đoạn; lọc 1 nguồn → chỉ nội dung nguồn đó; Copy/Export hoạt động.

### Tests (RED trước)

- [X] T005 [P] [US3] `tests/unit/studio-export-name.test.ts` — `sanitizeName`: bỏ ký tự cấm `/\:*?"<>|`, cắt độ dài, rỗng→mặc định (RED).

### Implementation

- [X] T006 [US1] Tăng `STUDIO_CONTEXT_BUDGET` 8000 → 16000 trong `src/main/services/studio/constants.ts` (chú thích: vẫn dưới context window model local; bao phủ rộng hơn, giữ 1-lượt + chip [n] chính xác).
- [X] T007 [US1] Mở rộng `src/main/services/studio/studio-service.ts`: `generate({notebookId,kind,sourceId?})` — nếu `sourceId` → chỉ gom chunk nguồn đó (ready + thuộc notebook); else toàn ready (như 021). Giữ 1-lượt `buildContext(scored, STUDIO_CONTEXT_BUDGET)` + `postprocessCitations`/`citationsFromMap` + cờ `truncated` (như 021). KHÔNG map-reduce. KHÔNG log content.
- [X] T008 [US3] Viết `src/main/services/studio/export.ts`: `sanitizeName(name)` (THUẦN, export riêng → T005 GREEN) + `exportMarkdown(win, content, suggestedName)` → `dialog.showSaveDialog` + `fs.writeFile` .md; canceled→{saved:false}. KHÔNG log content.
- [X] T009 [US1] `src/main/ipc/register.ts`: `studio:generate` truyền `sourceId` (input); THÊM `safeHandle studio:export` (gọi exportMarkdown với BrowserWindow). KHÔNG log content/citations.
- [X] T010 [US1] `src/main/index.ts`: wire `exportMarkdown` (dialog/BrowserWindow) vào register.
- [X] T011 [US3] `src/preload/index.ts`: thêm `studioExport(input)`; `studioGenerate` giữ chữ ký (sourceId trong input).
- [X] T012 [P] [US2] `src/renderer/features/studio/StudioColumn.tsx`: dropdown "Tất cả nguồn / <nguồn>" (đọc `sourceListByNotebook`, chỉ nguồn ready); state `scope` truyền vào `generate(kind, scope)`.
- [X] T013 [P] [US1] `src/renderer/features/studio/useStudio.ts`: `generate(kind, sourceId?)` gọi `studioGenerate({notebookId,kind,sourceId})`.
- [X] T014 [US3] `src/renderer/features/studio/StudioResultCard.tsx` + `studio.css`: nút **Sao chép** (`navigator.clipboard.writeText`, phản hồi "đã sao chép") + **Xuất** (`studioExport`) + **skeleton** khi loading. (Ghi chú `truncated` "dựa trên phần đầu" đã có từ 021.)
- [X] T015 [US1] e2e `tests/e2e/workspace-enhance.spec.ts` (case A tất định): `studio:export` whitelisted (`window.api.studioExport`, không invoke chung); dropdown nguồn hiển thị; nút Sao chép có mặt. (Sinh nội dung đầy đủ cần Ollama → thủ công.)

**Checkpoint**: Studio ngân sách rộng hơn + lọc nguồn + Copy/Export.

---

## Phase 4: Nhóm B — Kéo đổi độ rộng cột (US4) — P2 (renderer thuần)

**Goal**: splitter kéo đổi width cột Nguồn/Studio, Chat co giãn, nhớ được.

**Independent Test**: kéo splitter → width đổi (clamp); reload → giữ.

- [X] T016 [P] [US4] `tests/unit/column-widths.test.ts` — `clampWidths`: clamp src∈[220,460]/studio∈[200,420]; `parseWidths`(localStorage hỏng/thiếu)→default {src:300,studio:260} (RED).
- [X] T017 [US4] Viết `src/renderer/features/sources/useColumnWidths.ts` (THUẦN + hook): `clampWidths`/`parseWidths` + hook trả `{widths, onDragSrc, onDragStudio}` (pointer events cập nhật + clamp + persist localStorage `workspace-col-widths`) → T016 GREEN.
- [X] T018 [US4] `src/renderer/features/sources/Workspace.tsx` + `sources.css`: grid `var(--col-src) 1fr var(--col-studio)` (style từ `widths`); thêm 2 `.col-splitter` (cursor col-resize) gọi onDrag*.
- [X] T019 [US4] e2e `workspace-enhance.spec.ts` (case B): kéo splitter Nguồn|Chat → width đổi; đọc lại localStorage `workspace-col-widths` có giá trị (persist).

**Checkpoint**: kéo cột + nhớ được.

---

## Phase 5: Nhóm C — Nav nhớ notebook (US5) — P3 (renderer thuần)

**Goal**: nút Workspace mở lại notebook gần nhất; chưa có/đã xoá → CTA.

**Independent Test**: mở nb→nav workspace→đúng nb; xoá→CTA.

- [X] T020 [P] [US5] `tests/unit/last-notebook.test.ts` — `getLastNotebookId`/`setLastNotebookId` qua localStorage; đọc rỗng→null; hỏng→null (RED).
- [X] T021 [US5] Viết `src/renderer/shared/lastNotebook.ts` (THUẦN) → T020 GREEN.
- [X] T022 [US5] `src/renderer/features/sources/Workspace.tsx`: `setLastNotebookId(notebookId)` trong effect khi mở.
- [X] T023 [US5] `src/renderer/features/app-shell/placeholders.tsx` (WorkspacePlaceholder): nếu `getLastNotebookId()` hợp lệ (kiểm tồn tại qua `notebookList`) → `<Navigate to=/workspace/id>`; else CTA "Chọn notebook" → `/notebooks`.
- [X] T024 [US5] e2e `workspace-enhance.spec.ts` (case C): mở 1 notebook → điều hướng `#/workspace` (bare) → tự về notebook đó.

**Checkpoint**: nav nhớ notebook.

---

## Phase 6: Chống hồi quy + gate

- [X] T025 Chạy TOÀN BỘ e2e cũ (14 spec) — SC-007 (0 hồi quy). Studio vẫn chip [n] chính xác.
- [X] T026 [P] Rà `register.ts`/`studio-service.ts`/`export.ts`: KHÔNG log content/citations/nội dung (Constitution III / FR-012). `no-egress.spec` xanh (SC-008).
- [X] T027 Chạy `npm run lint` + `npm run test` (coverage ≥80%: export-name/column-widths/last-notebook/whitelist) + `npm run build` xanh; cập nhật `[X]`.

---

## Dependencies & thứ tự

- **Setup (T001)** → **Foundational (T002–T004)** CHẶN nhóm A.
- **Nhóm A (T005–T015)**: export test (T005) → constants/service (T006–T007) → export/IPC/preload (T008–T011)
  → renderer (T012–T014) → e2e (T015). Đụng main/IPC — làm trước.
- **Nhóm B (T016–T019)** + **Nhóm C (T020–T024)**: renderer thuần, độc lập nhau + độc lập A.
- **Gate (T025–T027)** sau cùng.

## Song song (ví dụ)

- Foundational: T002, T003 [P]. Nhóm A UI: T012, T013 [P].
- Nhóm B (T016–T019) và Nhóm C (T020–T024) [P] với nhau (khác file).

## MVP

**Nhóm A (Phase 1–3)** = MVP: Studio ngân sách rộng hơn (bao phủ notebook lớn hơn, chip [n] chính xác) + lọc
nguồn + Copy/Export. B (kéo cột) + C (nav) là increment UX thuần renderer.
