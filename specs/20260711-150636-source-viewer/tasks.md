# Tasks: Trình xem nguồn (Source Viewer)

**Feature**: `019-source-viewer` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Cách tiếp cận**: Test-First (Constitution IV, ≥80%). Logic thuần (reconstruct/highlight) nhận DI/thuần →
unit-test không cần Electron. `[P]` = song song (khác file).

**Nguồn**: [data-model.md](./data-model.md), [contracts/ipc-channels.md](./contracts/ipc-channels.md),
[research.md](./research.md) (R1–R5 — crux đã VERIFY reconstruct==gốc). 2 ADR `2026-07-11-source-viewer-*`.

**CRUX**: `reconstruct.ts` (fill gap ranh giới trang PDF) + `highlight.ts` — Constitution II / SC-002.

---

## Phase 1: Setup

- [X] T001 [P] Cập nhật `vitest.config.ts`: thêm `src/main/services/source-viewer/reconstruct.ts` + `src/renderer/features/source-viewer/highlight.ts` vào coverage `include`; exclude `source-viewer/source-content.ts` (assembly).

---

## Phase 2: Foundational (types + kênh — CHẶN mọi US)

- [X] T002 Thêm shared types vào `src/shared/ipc/types.ts`: `PageBreak{page,offset}`, `SourceContent{kind,title,pageCount,text,pageBreaks}`.
- [X] T003 [P] Test whitelist: `tests/unit/source-getcontent-whitelist.test.ts` — `source:getContent` whitelisted, ngoài bị từ chối, tổng ≥23, không trùng (RED).
- [X] T004 Thêm kênh `source:getContent` vào `src/shared/ipc/channels.ts` (`CHANNELS`, `WHITELISTED_CHANNELS`, `ChannelResponse[getContent]=SourceContent|null`) → T003 GREEN.

**Checkpoint**: types + kênh sẵn sàng.

---

## Phase 3: User Story 1 — Chip [n] → viewer highlight đúng đoạn (P1) 🎯 MVP

**Goal**: bấm chip → overlay viewer mở, cuộn + highlight đúng `[charStart,charEnd)`, khớp chunk.text.

**Independent Test**: bấm chip PDF → viewer highlight đúng đoạn + số trang; khớp chính xác chunk.

### Tests (RED trước) — CRUX ở T005/T006

- [X] T005 [P] [US1] `tests/unit/reconstruct.test.ts` — `reconstructText(chunks)` == văn bản gốc (dùng chunkPages tạo dữ liệu): 1 trang non-PDF, PDF nhiều trang (FILL GAP "\n\n"), 1 chunk; `T.slice(charStart,charEnd)===chunk.text` mọi chunk; `derivePageBreaks` offset đúng per page; edge chunk rỗng/gap (SC-002).
- [X] T006 [P] [US1] `tests/unit/highlight.test.ts` — `buildSegments(text, charStart, charEnd, pageBreaks)` chia [before|highlight|after] đúng; biên đầu/cuối; citation rỗng → không highlight; chèn mốc trang; offset ngoài range → phòng thủ không crash.

### Implementation (GREEN)

- [X] T007 [P] [US1] `src/main/services/source-viewer/reconstruct.ts` — `reconstructText(chunks)` (nối theo charStart + fill gap newlines + cắt overlap) + `derivePageBreaks(chunks)` (min charStart per page) → T005 GREEN.
- [X] T008 [P] [US1] `src/renderer/features/source-viewer/highlight.ts` — `buildSegments(...)` chia đoạn + chèn mốc pageBreaks → T006 GREEN.
- [X] T009 [US1] `src/main/services/source-viewer/source-content.ts` — assembly: `getSourceContent(sourceRepo, sourceId)` → đọc `getById`+`listChunks` → `SourceContent{kind,title,pageCount,text:reconstructText,pageBreaks}`; null nếu source không tồn tại.
- [X] T010 [US1] `tests/unit/source-content.test.ts` — `:memory:` SQLite (migration + notebook + source + chunks) → getSourceContent trả text tái dựng đúng + pageBreaks; source không tồn tại → null.
- [X] T011 [US1] Đăng ký `source:getContent` ở `src/main/ipc/register.ts` qua `safeHandle` (KHÔNG log content); dùng `sourceRepo` sẵn có.
- [X] T012 [P] [US1] Preload `src/preload/index.ts`: thêm `sourceGetContent(sourceId): Promise<SourceContent|null>`.
- [X] T013 [US1] Renderer `src/renderer/features/source-viewer/`: `useSourceViewer.ts` (state {open,sourceId,citation} + gọi sourceGetContent + đóng/mở/đổi) + `SourceViewer.tsx` (overlay panel: header tiêu đề + "Trích dẫn [n]" + nút đóng + pager PDF; body render Segment[] từ highlight.ts, auto-scroll tới highlight) + `source-viewer.css`.
- [X] T014 [US1] Nối vào chat (điểm chạm 013): `ChatColumn.tsx` truyền `onCite` thật xuống MessageBubble → gọi `useSourceViewer.open(citation)`; `Workspace.tsx` quản state viewer + render `<SourceViewer/>` overlay.

**Checkpoint US1**: bấm chip → viewer highlight (MVP giao được).

---

## Phase 4: User Story 2 — Non-PDF + URL offline (P1)

**Goal**: nguồn không có trang → cuộn tự do + auto-scroll + highlight; URL hiển thị bản đã lưu (offline).

**Independent Test**: chip trỏ .txt → highlight đúng khoảng ký tự, không pager; URL offline → vẫn hiển thị.

- [X] T015 [US2] `SourceViewer.tsx` + `highlight.ts`: non-PDF (`pageBreaks=[]`, page=null) → không render pager/mốc trang, một trang cuộn tự do, auto-scroll tới charStart. (reconstruct/getContent đã xử lý mọi kind — chỉ khác trình bày.)
- [X] T016 [US2] Xác nhận URL: `getSourceContent` cho kind='url' trả `text` từ chunk đã lưu (KHÔNG fetch) — thêm ca test vào `source-content.test.ts` (kind='url' → text tái dựng, không lời gọi mạng).

**Checkpoint US2**: mọi loại nguồn + offline.

---

## Phase 5: User Story 3 — Nhiều chip + mở từ cột Nguồn + nguồn xoá (P2)

**Goal**: viewer cập nhật tại chỗ khi bấm chip khác; mở nguồn trực tiếp từ cột Nguồn; nguồn xoá → báo lỗi.

**Independent Test**: bấm [1] rồi [2] → đổi nguồn/đoạn; bấm tên nguồn → mở đầu tài liệu; nguồn xoá → thông báo.

- [X] T017 [US3] `useSourceViewer.ts`: bấm chip khác khi đang mở → `open(newCitation)` cập nhật state (đổi sourceId → fetch lại; cùng source → chỉ đổi highlight). Test hành vi state (nếu tách được logic thuần).
- [X] T018 [US3] Mở từ cột Nguồn (điểm chạm 011): `SourceItem.tsx`/`SourceList.tsx` thêm `onOpen(sourceId)`; `Workspace.tsx` nối → `useSourceViewer.open({sourceId, citation:null})` → viewer mở đầu tài liệu, không highlight (FR-009/A9).
- [X] T019 [US3] Nguồn/chunk đã xoá: `SourceViewer.tsx` khi `getContent` trả null → hiển thị "Nguồn không còn tồn tại." + nút đóng (FR-010/A7).

**Checkpoint US3**: điều hướng + đường vào thứ hai + độ bền.

---

## Phase 6: Polish & Cross-Cutting

- [X] T020 [P] Glossary `docs/00-glossary.md`: append `source viewer` + `highlight` nếu cần (theo intake §4).
- [X] T021 [P] e2e `tests/e2e/source-viewer.e2e.ts` (Playwright `_electron`): `window.api.sourceGetContent` tồn tại + không invoke chung (whitelist); tạo notebook + nạp 2 txt khác nhau → mở viewer từ cột Nguồn (nguồn A) → text A hiển thị; **mở tiếp nguồn B khi viewer đang mở → viewer đổi sang text B (cover SC-004/FR-008 chuyển nguồn)**; getContent sourceId không tồn tại → null.
- [X] T022 [P] Rà bảo mật (SC-006): không log nội dung ở register/source-content (grep); `SourceViewer`/`MessageBubble` render text bằng React node, KHÔNG `dangerouslySetInnerHTML` (chống XSS); renderer bundle không import source-repo/sqlite.
- [X] T023 Test gate: `npm run lint && npm run test && npm run build && npm run test:e2e`; coverage reconstruct+highlight ≥80%. Sửa tới xanh.

---

## Dependencies & thứ tự

- **Setup (T001)** → **Foundational (T002–T004)** → US.
- **US1 (T005–T014)** = MVP, chặn US2/US3 (dùng lại getContent/highlight/SourceViewer).
- **US2 (T015–T016)**, **US3 (T017–T019)** sau US1.
- **Polish (T020–T023)** cuối.
- Test RED trước implement GREEN; `[P]` khác file song song.

## Song song mẫu (US1)

`T005,T006` (2 test crux) ∥; rồi `T007,T008` (reconstruct/highlight khác file) ∥; `T009→T010→T011`;
`T012` ∥ với `T013`; `T014` cuối (nối chat).

## MVP scope

**US1** (Phase 1–3) = bấm chip → viewer highlight đúng đoạn — hoàn thiện vòng "kiểm chứng được". US2 (mọi
loại nguồn/offline) + US3 (điều hướng/mở-trực-tiếp/độ-bền) tăng cường.

**Tổng: 23 task** — Setup 1, Foundational 3, US1 10, US2 2, US3 3, Polish 4.
