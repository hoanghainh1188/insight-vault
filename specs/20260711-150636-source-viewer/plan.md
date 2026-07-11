# Implementation Plan: Trình xem nguồn (Source Viewer)

**Branch**: `019-source-viewer` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260711-150636-source-viewer/spec.md`

## Summary

Bấm chip `[n]` → overlay panel hiển thị nội dung nguồn, cuộn + **highlight đúng `[charStart,charEnd)`**.
Toàn văn nguồn **tái dựng từ chunk đã lưu** (không re-parse/re-fetch → local, offset khớp locator 100%,
Constitution I/II). PDF hiển thị text đã trích + mốc trang; non-PDF cuộn tự do. Kênh mới
`source:getContent`. Không migration/schema mới; chỉ đọc dữ liệu 011 + nối `onCite` (013)/`onOpen` (011).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 24 (Electron 43 main + vitest), React 18 (renderer)

**Primary Dependencies**: KHÔNG thêm dependency. Tái dùng `node:sqlite`/`source-repo` (011),
`Citation`/`Locator`/`Chunk`/`Source` (011/013). Tái dựng + highlight là logic THUẦN (không thư viện).

**Storage**: CHỈ ĐỌC `source`/`chunk` (011) — KHÔNG schema/migration mới. Nội dung hiển thị dựng runtime từ
chunk, không lưu bền riêng.

**Testing**: Vitest (unit, node, DI — reconstruct/highlight thuần; `:memory:` SQLite cho source-content
assembly). Playwright `_electron` (e2e: chip→viewer highlight, mở từ cột Nguồn, nguồn xoá, whitelist).

**Target Platform**: Desktop (offline-first — URL hiển thị bản đã lưu, không egress).

**Project Type**: Desktop app (Electron main/preload/renderer) — cấu trúc D6.

**Performance Goals**: mở viewer + highlight ≤2s (SC-001). Tái dựng T tuyến tính theo số chunk; render text

- auto-scroll mượt với tài liệu lớn.

**Constraints**: Constitution II (highlight khớp CHÍNH XÁC locator, không ước lượng — crux); III (đọc nội
dung CHỈ ở main, renderer qua `source:getContent` whitelisted, vector thô không ra renderer, không log nội
dung); I (URL không fetch lại). Coverage ≥80% business logic.

**Scale/Scope**: 1 kênh IPC mới, 1 domain main (source-viewer: reconstruct + assembly), 1 domain renderer
(viewer overlay + highlight). Điểm chạm nhỏ vào 011 (SourceItem onOpen) + 013 (ChatColumn onCite) + Workspace.

## Constitution Check

_GATE: Phải pass trước Phase 0. Re-check sau Phase 1._

| Principle                                           | Cách tuân thủ                                                                                                                                                                                                                                      | Trạng thái |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **I. Local-first & No Egress**                      | Toàn văn tái dựng từ chunk đã lưu (SQLite) — KHÔNG re-parse file, KHÔNG re-fetch URL. Viewer hoạt động offline.                                                                                                                                    | ✅ PASS    |
| **II. Verifiable Citations (NON-NEGOTIABLE)**       | Highlight dùng TRỰC TIẾP `locator.charStart/charEnd` (offset toàn cục vào T tái dựng) — không ước lượng/tái tạo. Reconstruct đảm bảo T == văn bản đã-làm-sạch gốc → offset khớp. `reconstruct.ts`+`highlight.ts` test kỹ (SC-002).                 | ✅ PASS    |
| **III. Desktop Security Boundary (NON-NEGOTIABLE)** | Đọc source/chunk CHỈ ở main; renderer qua `source:getContent` whitelisted (`safeHandle`, không catch-all). Vector thô KHÔNG gửi renderer. MessageBubble/SourceViewer render text an toàn (React text node, không `innerHTML`). Không log nội dung. | ✅ PASS    |
| **IV. Test-First & Coverage**                       | TDD; unit cho reconstruct/highlight (DI, thuần). Coverage ≥80%; exclude assembly (source-content.ts) + UI.                                                                                                                                         | ✅ PASS    |
| **V. Phased Delivery**                              | Đúng D8 (pha 006, sau rag-qa). KHÔNG đụng schema/pipeline 011, không sửa type 013. Không nhảy cóc.                                                                                                                                                 | ✅ PASS    |

**Kết luận: GATE PASS.** Điểm chạm 011/013 là additive (thêm callback/kênh), không sửa nghĩa cũ.

## Project Structure

### Documentation (this feature)

```text
specs/20260711-150636-source-viewer/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ipc-channels.md   # kênh source:getContent
├── checklists/requirements.md
└── tasks.md                    # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── shared/ipc/
│   ├── channels.ts          # THÊM source:getContent + WHITELISTED + ChannelResponse
│   └── types.ts             # THÊM SourceContent, PageBreak
├── main/
│   ├── services/source-viewer/
│   │   ├── reconstruct.ts       # THUẦN: reconstructText(chunks) + derivePageBreaks(chunks) — CRUX, test kỹ
│   │   └── source-content.ts    # assembly: source-repo → SourceContent|null (wiring — exclude coverage)
│   └── ipc/register.ts      # THÊM safeHandle source:getContent (không log content)
├── preload/index.ts         # THÊM sourceGetContent(sourceId)
└── renderer/features/source-viewer/
    ├── SourceViewer.tsx     # overlay panel: header (tiêu đề + "Trích dẫn [n]" + pager PDF + đóng) + body
    ├── useSourceViewer.ts   # state {open, sourceId, citation|null} + getContent + đổi/đóng
    ├── highlight.ts         # THUẦN: segment text theo [charStart,charEnd) + chèn mốc pageBreaks — test được
    └── source-viewer.css

Điểm chạm feature khác (tách commit):
- src/renderer/features/rag-qa/ChatColumn.tsx (013): truyền onCite thật → mở viewer
- src/renderer/features/sources/SourceItem.tsx + SourceList.tsx (011): thêm onOpen(sourceId)
- src/renderer/features/sources/Workspace.tsx: quản state viewer + render <SourceViewer/> overlay

tests/
├── unit/  reconstruct.test.ts · highlight.test.ts · source-content.test.ts · source-getcontent-whitelist.test.ts
└── e2e/   source-viewer.e2e.ts
```

**Structure Decision**: Domain mới `source-viewer` ở main (reconstruct thuần + assembly) + renderer
(overlay + highlight thuần). Logic crux (reconstruct/highlight) phủ unit ≥80%; assembly (source-content) +
UI exclude như tiền lệ. Điểm chạm 011/013 tối thiểu (thêm callback/kênh), tách commit rõ (rule 5).

## Complexity Tracking

> Không vi phạm Constitution. Không thêm dependency/schema/migration. Tái dựng từ chunk (thay re-parse/store
> full-text) là phương án tối giản nhất giữ local + offset khớp — không cần biện minh.
