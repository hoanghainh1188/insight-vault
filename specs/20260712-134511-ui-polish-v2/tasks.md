# Tasks: UI Polish v2 (037)

Tests-first (Constitution IV). `[P]` = song song.

## Phase 1 — Thuần (test-first)

- [x] T001 [P] `tests/unit/format-bytes.test.ts` (RED) → `src/renderer/shared/format-bytes.ts`.
- [x] T002 [P] `tests/unit/source-step-label.test.ts` (RED) → `stepLabel` trong `source-status.ts`.
- [x] T003 `src/shared/ipc/{types,channels}.ts` — `StorageInfo` + kênh `app:getStorageInfo`.

## Phase 2 — Storage (main + IPC + renderer)

- [x] T004 [P] `tests/unit/storage-info.test.ts` (RED) → `storage-info.ts`: `dirSize` (fake walk) +
      `computeStorageInfo` (fake statfs).
- [x] T005 `register.ts` + `preload/index.ts` — kênh getStorageInfo (không log).
- [x] T006 [P] `tests/unit/ipc-*.test.ts` — whitelist +`app:getStorageInfo`.
- [x] T007 `SettingsStorageSection.tsx` + ghép vào routes + CSS.

## Phase 3 — Tiến độ nguồn (US1)

- [x] T008 [US1] `useSources.ts` — `progressById` từ onSourceProgress (xoá khi ready/error).
- [x] T009 [US1] `SourceItem.tsx` + `sources.css` — thanh tiến độ + nhãn bước khi processing.

## Phase 4 — Viewer + polish (US2)

- [x] T010 [US2] `SourceViewer.tsx` + `source-viewer.css` — nhãn `.hltag` [n] trên highlight.
- [x] T011 [P] `sources.css` icon badge màu + `SourceList` skeleton khi loading.

## Phase 5 — Polish

- [x] T012 e2e `ui-polish-v2.spec.ts` — section Lưu trữ + whitelist; GIỮ e2e cũ xanh.
- [x] T013 Coverage include (format-bytes/source-status/storage-info) ≥80%.
- [x] T014 Gate: lint + test + build + e2e.

## MVP

US1 (tiến độ) là lõi P1; US2/US3 (viewer + storage) P2.
