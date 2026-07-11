# Implementation Plan: Studio (tổng hợp tri thức từ notebook)

**Branch**: `021-studio` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260711-175831-studio/spec.md`

## Summary

Cột Studio (cột 3 Workspace) có 4 nút "Tạo nhanh" (Tóm tắt · Ý chính · FAQ · Dàn ý). Bấm → gom **toàn bộ
chunk** của notebook theo thứ tự nạp, dựng ngữ cảnh đánh số `[1..k]` theo ngân sách `STUDIO_CONTEXT_BUDGET`
(~8000), gọi **1 lượt** LLM local, **hậu kiểm chip `[n]`** (Constitution II), rồi **lưu bền** (SQLite
migration #3 `studio_result`, UNIQUE `(notebook_id,kind)`). Kết quả hiện dạng card text + chip `[n]` → bấm
mở Source Viewer (019). Tái dùng `buildContext`/`citation` (013), `LLMProvider`/`RuntimeStatus` (007),
`source-repo` (011). 2 kênh mới `studio:generate`/`studio:list`.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 24 (Electron 43 main + vitest), React 18 (renderer)

**Primary Dependencies**: KHÔNG thêm dependency. Tái dùng `node:sqlite` + migration runner (011),
`LLMProvider`/`ProviderRegistry`/`RuntimeStatus` (007), `buildContext` (013 context-builder),
`postprocessCitations`/`citationsFromMap` (013 citation), `Citation`/`Locator`/`Chunk`/`Source` (011/013),
Source Viewer `openCitation` (019). Prompt Studio + gom chunk là logic THUẦN.

**Storage**: SQLite — **migration #3** thêm bảng `studio_result` (append-only, PRAGMA user_version 2→3, FK
`notebook_id` ON DELETE CASCADE, UNIQUE `(notebook_id,kind)`). Vector store KHÔNG đụng.

**Testing**: Vitest (unit, node, DI — `studio-repo` với `:memory:` SQLite + migration #3; `prompt` thuần;
`source-repo.listChunksByNotebook`; whitelist kênh). Playwright `_electron` (e2e: tạo card + chip → viewer;
4 loại; tạo lại ghi đè; persist qua đóng/mở; notebook rỗng vô hiệu; runtime lỗi báo thân thiện; render an
toàn).

**Target Platform**: Desktop (offline-first — LLM local Ollama, không egress mặc định).

**Project Type**: Desktop app (Electron main/preload/renderer) — cấu trúc D6.

**Performance Goals**: 1 lượt LLM (dùng chat timeout 120s đã có); gom chunk + dựng ngữ cảnh tuyến tính theo
số chunk, cắt theo ngân sách nên chặn trên. UI hiện "Đang tạo…" trong lúc chờ.

**Constraints**: Constitution I (LLM local, không egress); II (chip `[n]` trỏ chunk THẬT, hậu kiểm gỡ chip
ngoài `[1..k]`, 0 chip→`citationsFromMap`); III (đọc chunk/DB + gọi LLM CHỈ ở main, renderer qua
`studio:*` whitelisted `safeHandle`, không log nội dung, render text an toàn không `innerHTML`); IV coverage
≥80% business logic.

**Scale/Scope**: 1 migration, 2 kênh IPC mới, 1 domain main mới (`studio`: repo + prompt + service), 1
domain renderer mới (`studio`: column + card + hook). **KHÔNG đụng `source-repo` (011)** — gom chunk ở tầng
service qua `listByNotebook` + `listChunks` sẵn có. Chỉ thêm tham số `budget` tuỳ chọn cho `buildContext`
(013, additive không phá vỡ). Điểm chạm renderer: `Workspace.tsx` thay placeholder cột Studio.

## Constitution Check

_GATE: Phải pass trước Phase 0. Re-check sau Phase 1._

| Principle                                           | Cách tuân thủ                                                                                                                                                                                                              | Trạng thái |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **I. Local-first & No Egress**                      | Studio chỉ gọi LLM local qua `LLMProvider` (Ollama HTTP local); đọc chunk từ SQLite. KHÔNG gọi mạng ra ngoài ở chế độ mặc định. Hoạt động offline.                                                                         | ✅ PASS    |
| **II. Verifiable Citations (NON-NEGOTIABLE)**       | Ngữ cảnh đánh số `[1..k]` từ chunk THẬT; sau chat `postprocessCitations` gỡ chip ngoài phạm vi; 0 chip hợp lệ→`citationsFromMap` gắn nguồn đã dùng → mọi kết quả truy được về chunk. Chip mở Source Viewer đúng đoạn.      | ✅ PASS    |
| **III. Desktop Security Boundary (NON-NEGOTIABLE)** | Đọc chunk/DB + gọi LLM CHỈ ở main; renderer qua `studio:generate`/`studio:list` whitelisted (`safeHandle`, không catch-all). Vector thô KHÔNG ra renderer. Card render text an toàn (React text node). KHÔNG log nội dung. | ✅ PASS    |
| **IV. Test-First & Coverage**                       | TDD; unit cho `studio-repo` (upsert/cascade/serialize), `prompt` (4 kind), `source-repo.listChunksByNotebook`. Coverage ≥80%; exclude `studio-service` (assembly quanh LLM I/O) + UI.                                      | ✅ PASS    |
| **V. Phased Delivery**                              | Đúng D8 (pha 7 — sau source-viewer). Tái dùng 007/011/013/019; KHÔNG sửa pipeline 011 hay type Citation/Locator (013). Migration #3 append-only.                                                                           | ✅ PASS    |

**Kết luận: GATE PASS.** Migration #3 là bảng mới độc lập (không đổi bảng cũ). Import `buildContext`/`citation`
từ `rag/` là dùng lại hàm thuần ổn định — nếu có consumer thứ 3 mới tách `services/shared/`.

## Project Structure

### Documentation (this feature)

```text
specs/20260711-175831-studio/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ipc-channels.md   # kênh studio:generate + studio:list
├── checklists/requirements.md
└── tasks.md                    # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── shared/ipc/
│   ├── channels.ts          # THÊM studio:generate + studio:list + WHITELISTED + ChannelResponse
│   └── types.ts             # THÊM StudioKind, StudioResult, StudioGenerateInput
├── main/
│   ├── db/migrations/       # THÊM migration #3: bảng studio_result (user_version 2→3)
│   ├── services/studio/
│   │   ├── studio-repo.ts       # THUẦN/DI: upsert / listByNotebook / getByNotebookKind + (de)serialize citations_json — test :memory:
│   │   ├── prompt.ts            # THUẦN: systemPromptFor(kind) — 4 prompt "cite [n], chỉ dùng đoạn đánh số"
│   │   └── studio-service.ts    # assembly: listByNotebook(ready)+listChunks → ScoredChunk[] → buildContext(_, STUDIO_CONTEXT_BUDGET) → chat → postprocessCitations → upsert (wiring — exclude coverage)
│   ├── services/rag/context-builder.ts  # THÊM tham số budget tuỳ chọn: buildContext(scored, budget=CONTEXT_CHAR_BUDGET) — additive, rag KHÔNG đổi hành vi
│   ├── ipc/register.ts      # THÊM safeHandle studio:generate + studio:list (không log content)
│   └── index.ts             # wire studio-service (db + source-repo + providerRegistry) vào register
├── preload/index.ts         # THÊM studioGenerate(input) + studioList(notebookId)
└── renderer/features/studio/
    ├── StudioColumn.tsx     # 4 nút Tạo nhanh + trạng thái (đang tạo/lỗi/vô hiệu) + banner runtime + list card
    ├── StudioResultCard.tsx # text + chip [n] (tái dùng render chip) + ghi chú truncated + nút Tạo lại
    ├── useStudio.ts         # state results/loading/error theo kind; studioGenerate/studioList; onCite→openCitation
    └── studio.css

Điểm chạm feature khác (tách commit):
- src/renderer/features/sources/Workspace.tsx: thay placeholder cột Studio bằng <StudioColumn/>
  (truyền notebookId, onCite=viewer.openCitation; readiness hasReadySources/ollamaReady tự fetch trong useStudio — giảm prop drilling)
- (nếu cần) tách helper render chip [n] từ MessageBubble (013) sang renderer/shared để dùng chung — hàm thuần

tests/
├── unit/  studio-repo.test.ts · studio-prompt.test.ts · studio-context-budget.test.ts · studio-channels-whitelist.test.ts
└── e2e/   studio.spec.ts
```

**Structure Decision**: Domain mới `studio` ở main (repo lưu bền + prompt thuần + service assembly) và
renderer (column + card + hook). Logic test được (repo/prompt/budget) phủ unit ≥80%; `studio-service`
(assembly quanh LLM I/O) + UI exclude như tiền lệ (rag-service, source-content). KHÔNG đụng 011 (gom chunk
qua API sẵn có); chỉ thêm tham số `budget` tuỳ chọn cho `buildContext` (013, additive). Workspace thay
placeholder — tách commit rõ (rule 5). Import `buildContext`/`citation` từ `rag/` (hàm thuần).

## Complexity Tracking

> Không vi phạm Constitution. Migration #3 là bảng mới độc lập (không đổi schema cũ). Import helper 013 thay
> nhân bản logic ngân sách/hậu kiểm — giữ nhất quán "kiểm chứng được" giữa Chat và Studio; tách `services/shared`
> chỉ khi có consumer thứ 3 (YAGNI). Không cần biện minh thêm.
