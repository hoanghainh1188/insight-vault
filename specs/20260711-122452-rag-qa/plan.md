# Implementation Plan: Hỏi đáp theo nguồn (RAG Q&A)

**Branch**: `013-rag-qa` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260711-122452-rag-qa/spec.md`

## Summary

Cột Chat của Workspace: người dùng hỏi → **embed câu hỏi → LanceDB search top-k trong notebook → JOIN SQLite
text+locator → ghép context đánh số [1..k] → LLMProvider.chat (2 chế độ) → HẬU KIỂM chip [n]** → trả
`{answer, citations, notFound}`. Crux Constitution II: chip `[n]` không bao giờ trỏ sai/không tồn tại — hệ
thống hậu kiểm mọi `[n]` so tập chunk thật. Không streaming (giữ `LLMProvider.chat`), lịch sử hội thoại
in-memory phiên (không migration). Mở rộng vùng dùng chung: `VectorStore.search` + `source-repo.getChunksByIds`.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 24 (Electron 43 main + vitest), React 18 (renderer)

**Primary Dependencies**: tái dùng `@lancedb/lancedb` (search), `node:sqlite`, `ProviderRegistry`/
`LLMProvider.{chat,embed}` + `RuntimeStatus` (007), `Chunk`/`Locator`/`vector-store`/`source-repo` (011).
KHÔNG thêm dependency mới. KHÔNG đổi `LLMProvider.chat` (không streaming).

**Storage**: đọc SQLite `chunk`/`source` (011) + LanceDB `chunks` (011) — CHỈ đọc/search, KHÔNG schema mới.
Lịch sử hội thoại: state renderer (in-memory phiên), không persist.

**Testing**: Vitest (unit, node, DI — mock provider/vector-store/source-repo, `:memory:` SQLite cho
getChunksByIds). Playwright `_electron` (e2e: rag:ask, whitelist, notebook rỗng chặn gửi).

**Target Platform**: Desktop (macOS/Windows/linux CI) — offline-first, chat qua Ollama local.

**Project Type**: Desktop app (Electron main/preload/renderer) — cấu trúc D6.

**Performance Goals**: 1 câu hỏi = 1 embed + 1 vector search (brute-force MVP, đủ nhanh quy mô cá nhân) +
1 chat call. Không streaming → hiện spinner tới khi có câu trả lời trọn.

**Constraints**: Constitution II (chip đúng chunk — hậu kiểm), III (main-only, whitelisted, không log câu
hỏi/nội dung), I (không egress ngoài Ollama local). Câu hỏi ≤2000 ký tự. Coverage ≥80% business logic.

**Scale/Scope**: MVP cá nhân. 1 kênh IPC `rag:ask`, domain `rag/` (retrieval/context/prompt/citation/
service/validation) + UI cột Chat. Mở rộng nhẹ 2 file 011 (search, getChunksByIds).

## Constitution Check

_GATE: Phải pass trước Phase 0. Re-check sau Phase 1._

| Principle                                           | Cách tuân thủ                                                                                                                                                                                                                                                                                          | Trạng thái |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **I. Local-first & No Egress**                      | Embed + search + chat qua Ollama local; không dịch vụ ngoài. Không telemetry.                                                                                                                                                                                                                          | ✅ PASS    |
| **II. Verifiable Citations (NON-NEGOTIABLE)**       | Grounded: chỉ trả lời từ context, thiếu căn cứ → "không tìm thấy", cấm bịa. Chip `[n]` **hậu kiểm** (đánh số context [1..k], validate mọi [n], gỡ chip ngoài phạm vi) → citation luôn trỏ chunk thật + locator. Open: phần ngoài nguồn gắn nhãn "không dựa trên nguồn". Test `citation.ts` phủ SC-002. | ✅ PASS    |
| **III. Desktop Security Boundary (NON-NEGOTIABLE)** | embed/search/SQLite/chat CHỈ ở main; renderer qua kênh `rag:ask` whitelisted (`safeHandle`). Không log câu hỏi/nội dung/ngữ cảnh (redact + không truyền payload vào logEvent).                                                                                                                         | ✅ PASS    |
| **IV. Test-First & Coverage**                       | TDD; unit cho citation/context-builder/prompt/question-validation/retrieval/rag-service (DI). Coverage ≥80%; exclude wiring (rag-service assembly) + vector-store adapter.                                                                                                                             | ✅ PASS    |
| **V. Phased Delivery**                              | Đúng D8 (pha 005, sau ingestion, trước source-viewer). Không đụng viewer highlight (006)/Studio/persist/streaming.                                                                                                                                                                                     | ✅ PASS    |

**Kết luận: GATE PASS.** Mở rộng interface dùng chung (VectorStore.search, getChunksByIds) là **additive**,
không sửa nghĩa cũ → rủi ro thấp; không cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/20260711-122452-rag-qa/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ipc-channels.md   # kênh rag:ask
├── checklists/requirements.md
└── tasks.md                    # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── shared/ipc/
│   ├── channels.ts          # THÊM rag:ask + WHITELISTED + ChannelResponse
│   └── types.ts             # THÊM RagMode, RagAskInput, Citation, RagAnswer, RetrievedChunk
├── main/
│   ├── services/
│   │   ├── ingestion/
│   │   │   ├── vector-store.ts   # MỞ RỘNG: search() (+ VectorSearchHit) — adapter, exclude coverage
│   │   │   └── source-repo.ts    # MỞ RỘNG: getChunksByIds(ids)
│   │   └── rag/
│   │       ├── question-validation.ts  # giới hạn 2000 ký tự (thuần)
│   │       ├── retrieval.ts            # embed → search → lọc ngưỡng → getChunksByIds (DI, thuần)
│   │       ├── context-builder.ts      # đánh số [1..k] + ghép ~6000 ký tự bỏ nguyên chunk (thuần)
│   │       ├── prompt.ts               # 2 system prompt template grounded/open (thuần)
│   │       ├── citation.ts             # HẬU KIỂM chip [n] → Citation[] (thuần — CRUX, test kỹ)
│   │       └── rag-service.ts          # điều phối ask() (wiring — exclude coverage)
│   ├── ipc/register.ts      # THÊM safeHandle rag:ask (không log payload)
│   └── index.ts             # tạo ragService, truyền vào registerIpc
├── preload/index.ts         # THÊM ragAsk(input)
└── renderer/features/rag-qa/
    ├── ChatColumn.tsx       # cột Chat thật (thay placeholder Workspace 011)
    ├── useChat.ts           # hội thoại in-memory phiên + ragAsk + RuntimeStatus + có nguồn ready
    ├── MessageBubble.tsx    # render answer + chip [n] (.cite) + srcnote
    ├── ModeToggle.tsx       # grounded/open + modehint
    └── citation-format.ts   # render danh sách nguồn (thuần, coverage)

tests/
├── unit/  citation.test.ts · context-builder.test.ts · rag-prompt.test.ts · question-validation.test.ts
│          · retrieval.test.ts · rag-service.test.ts · get-chunks-by-ids.test.ts · rag-ipc-whitelist.test.ts
│          · citation-format.test.ts
└── e2e/   rag-qa.spec.ts
```

**Structure Decision**: Domain mới `src/main/services/rag/` (thuần, DI) + `src/renderer/features/rag-qa/`.
Mở rộng additive 2 file `ingestion/` (search, getChunksByIds). `Workspace.tsx` (011) đổi 1 dòng import
ChatColumn thay placeholder. Wiring (`rag-service.ts`) + adapter (`vector-store.ts`) exclude coverage như
tiền lệ; logic thuần (citation/context/prompt/validation/retrieval/citation-format) phủ unit ≥80%.

## Complexity Tracking

> Không vi phạm Constitution. Không thêm dependency/schema. Mở rộng interface dùng chung là additive
> (không breaking) — không cần biện minh.
