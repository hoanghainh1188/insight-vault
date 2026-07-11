# Implementation Plan: Workspace enhancements (Studio nâng cấp + kéo cột + nav)

**Branch**: `025-workspace-enhance` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260711-224239-workspace-enhance/spec.md`

## Summary

3 nhóm cùng đụng Workspace. **(A) Studio**: `generate({notebookId, kind, sourceId?})` — **luôn 1 lượt** +
chip `[n]` chính xác (như 021), **nới `STUDIO_CONTEXT_BUDGET` 8000→16000** để bao phủ rộng hơn (vượt vẫn
`truncated` + ghi chú); lọc theo `sourceId`; nút **Copy/Export .md** (kênh mới `studio:export`) + skeleton.
**KHÔNG map-reduce** (quyết định đảo — clarify #1: ưu tiên chip `[n]` chính xác). **(B) Kéo cột**: splitter +
CSS var + localStorage. **(C) Nav**: nút Workspace nhớ `last-notebook-id`. **KHÔNG migration.**

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 24 (Electron 43 main + vitest), React 18 (renderer).

**Primary Dependencies**: KHÔNG thêm dependency. Tái dùng `studio-service/repo/prompt/constants` (021),
`buildContext`/`citation` (013), `source-repo` (011), Source Viewer `openCitation` (019), `node:fs`/electron
`dialog` (đã có, cho export). Splitter/persist thuần renderer.

**Storage**: KHÔNG migration/schema mới. `studio_result` (021) giữ nguyên. Độ rộng cột + last-notebook lưu
**localStorage** (renderer).

**Testing**: Vitest (unit — `sanitizeName` export THUẦN; `useColumnWidths` clamp/parse; `lastNotebook`;
whitelist). Playwright `_electron` (e2e — GIỮ mọi spec cũ xanh SC-007; THÊM dropdown nguồn, kéo splitter+
persist, nav nhớ notebook, `studio:export` whitelist, Copy có mặt).

**Target Platform**: Desktop offline-first (LLM local; ghi file local qua save dialog — không egress).

**Project Type**: Desktop app (Electron main/preload/renderer) — cấu trúc D6.

**Performance Goals**: Studio vẫn 1 lượt chat (như 021, ngân sách rộng hơn — 1 request). Splitter kéo mượt
(pointer events + CSS var, không reflow nặng).

**Constraints**: Constitution I (LLM local + ghi file local, không egress); II (chip `[n]` chính xác tới
đoạn — 1 lượt, KHÔNG map-reduce, KHÔNG bịa); III (đọc chunk/DB + LLM + ghi file CHỈ ở main; renderer qua
`studio:*` whitelisted `safeHandle`; KHÔNG log nội dung); IV coverage ≥80% business logic.

**Scale/Scope**: 0 migration. 1 kênh IPC mới (`studio:export`) + mở rộng `studio:generate` (thêm
`sourceId?`). 1 file main thuần mới (`export.ts`) + mở rộng `studio-service` (sourceId) + `constants` (budget).
Renderer: 2 helper thuần mới (`useColumnWidths`, `lastNotebook`) + mở rộng Workspace/StudioColumn/
StudioResultCard/NavRail/placeholders.

## Constitution Check

_GATE: Phải pass trước Phase 0. Re-check sau Phase 1._

| Principle                                           | Cách tuân thủ                                                                                                                                           | Trạng thái |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **I. Local-first & No Egress**                      | LLM local; Export ghi file **local** qua save dialog (không upload). Không thêm nguồn mạng. `no-egress.spec` giữ xanh.                                  | ✅ PASS    |
| **II. Verifiable Citations (NON-NEGOTIABLE)**       | Studio **luôn 1 lượt** → chip `[n]` chính xác tới đoạn (như 021). KHÔNG map-reduce → KHÔNG hạ độ chính xác. KHÔNG bịa.                                  | ✅ PASS    |
| **III. Desktop Security Boundary (NON-NEGOTIABLE)** | Gom chunk + LLM + **ghi file** CHỈ ở main; renderer qua `studio:generate`/`studio:export`/`studio:list` whitelisted (`safeHandle`). KHÔNG log nội dung. | ✅ PASS    |
| **IV. Test-First & Coverage**                       | Unit cho `sanitizeName`/`useColumnWidths`/`lastNotebook`/whitelist. Coverage ≥80%; exclude `studio-service` (assembly) + `export.ts` (dialog/fs I/O).   | ✅ PASS    |
| **V. Phased Delivery**                              | Bước sau 021/023; KHÔNG nhảy cóc. KHÔNG migration. Map-reduce ĐÃ BÁC (ADR) — ghi rõ.                                                                    | ✅ PASS    |

**Kết luận: GATE PASS.** `studio:export` ghi file local qua dialog người dùng chủ động chọn — hợp lệ
Constitution III (không tự động ghi/gửi). Nới ngân sách giữ chip `[n]` chính xác → Constitution II mức cao.

## Project Structure

### Documentation (this feature)

```text
specs/20260711-224239-workspace-enhance/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ipc-channels.md   # studio:generate(+sourceId) · studio:export
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── shared/ipc/
│   ├── types.ts             # StudioGenerateInput +sourceId?; StudioExportInput/Result (KHÔNG partsCount)
│   └── channels.ts          # THÊM studio:export + ChannelResponse
├── main/
│   ├── services/studio/
│   │   ├── constants.ts         # STUDIO_CONTEXT_BUDGET 8000→16000
│   │   ├── export.ts            # MỚI: sanitizeName (thuần, test) + exportMarkdown via dialog+fs (I/O exclude)
│   │   └── studio-service.ts    # generate +sourceId filter (giữ 1-lượt, budget rộng) — assembly, exclude coverage
│   ├── ipc/register.ts      # studio:generate truyền sourceId; THÊM safeHandle studio:export (không log content)
│   └── index.ts             # wire export (dialog/BrowserWindow) vào register
├── preload/index.ts         # studioExport(input); studioGenerate giữ chữ ký (sourceId trong input)
└── renderer/
    ├── shared/lastNotebook.ts   # MỚI THUẦN: get/setLastNotebookId (localStorage)
    └── features/
        ├── sources/
        │   ├── Workspace.tsx        # B: splitter + CSS var độ rộng; C: setLastNotebookId khi mở
        │   ├── useColumnWidths.ts   # MỚI THUẦN: clampWidths/parseWidths + persist localStorage (test)
        │   └── sources.css          # .workspace grid var(--col-src) 1fr var(--col-studio); .col-splitter
        ├── studio/
        │   ├── StudioColumn.tsx     # A: dropdown chọn nguồn (Tất cả/<source>)
        │   ├── StudioResultCard.tsx # A: nút Copy + Export + skeleton (ghi chú truncated đã có 021)
        │   └── useStudio.ts         # generate(kind, sourceId?)
        └── app-shell/
            ├── NavRail.tsx          # C: mục Workspace → /workspace/<lastId> nếu có
            └── placeholders.tsx     # C: WorkspacePlaceholder: Navigate tới last nếu hợp lệ, else CTA "Chọn notebook"

tests/
├── unit/  studio-export-name.test.ts · column-widths.test.ts · last-notebook.test.ts · studio-export-whitelist.test.ts
└── e2e/   workspace-enhance.spec.ts (dropdown nguồn · kéo splitter+persist · nav nhớ nb · export whitelist · Copy)
```

**Structure Decision**: Nhóm A đụng main nhẹ (budget constant + `sourceId` filter + export). Logic THUẦN tách
`sanitizeName` (export) → unit-test; `studio-service` (assembly) + `export.ts` (dialog/fs I/O) exclude như
tiền lệ. Nhóm B/C thuần renderer — tách helper thuần (`useColumnWidths`, `lastNotebook`) để test; component/
CSS phủ e2e. KHÔNG migration, KHÔNG map-reduce, KHÔNG đụng useChat/useSourceViewer/ingestion.

## Complexity Tracking

> Không vi phạm Constitution. KHÔNG map-reduce (đảo quyết định — giữ chip `[n]` chính xác). Nới ngân sách =
> đổi 1 hằng số; `sourceId` filter + export là additive. Ràng buộc "không migration" giữ. Không cần biện
> minh thêm.
