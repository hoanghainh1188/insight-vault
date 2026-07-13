# Implementation Plan: Embedding in-process + gợi ý model theo RAM

**Branch**: `059-embed-in-process` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260713-144057-embed-in-process/spec.md` · ADR
`docs/04-decisions/2026-07-13-embed-in-process-clarify.md`

## Summary

Chuyển khâu **embedding** từ Ollama sang **chạy in-process** bằng `@huggingface/transformers` +
onnxruntime (đã bundle từ 045), model `Xenova/multilingual-e5-small` (384d). Chat vẫn qua Ollama (031).
Vì đổi model làm vector cũ (768d) không tương thích → **job nền tái lập chỉ mục** (drop bảng LanceDB cũ →
tạo lại dim 384 → nhúng lại toàn bộ chunk), idempotent/resume, hiện tiến độ. Thêm **gợi ý model chat theo
RAM** + **health-check Ollama** ở màn Cài đặt. Bất biến: locator không đổi (chip `[n]` chính xác), embed
local ở main, chỉ tải model lần đầu rời máy (badge dùng chung 045/031).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node/Electron 43 main process, React 18 renderer.

**Primary Dependencies**: `@huggingface/transformers` ^4.2.0 + onnxruntime (đã có/bundle từ 045),
`@lancedb/lancedb` (vector store), `node:sqlite` (metadata), electron-store (ai-runtime 007).

**Storage**: LanceDB (bảng `chunks` — **tạo lại dim 384**); SQLite (chunk.text nguồn để nhúng lại + bảng
`app_meta` cho `embedding_model_version` & reindex state — chốt ở research); model cache ở data dir.

**Testing**: Vitest (unit hàm thuần + integration DI mock), Playwright (e2e regression — chip `[n]` vẫn
map đúng, màn Cài đặt hiện gợi ý).

**Target Platform**: Desktop Electron macOS + Windows (mục tiêu chính của feature: máy Windows/yếu).

**Project Type**: Desktop app (main/preload/renderer), cô lập feature `src/main/services/embedding/`.

**Performance Goals**: Nhúng in-process không chậm hơn rõ rệt Ollama cho lô chunk thường; tái lập chỉ mục
chạy nền không giật UI; tải model lần đầu ~120MB một lần.

**Constraints**: Offline sau khi tải model; main-only inference (Constitution III); không log nội dung;
không egress ngầm (chỉ badge khi tải model / chat online).

**Scale/Scope**: Vài nghìn chunk/notebook; nhúng lại theo lô (vd 32/lô) để resume được.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Local-first / no egress ngầm**: PASS — embed chạy in-process ở main; chỉ **lần tải model đầu** rời
  máy → dùng **chung badge egress 045/031** (không thêm kênh). Embedding thường ngày KHÔNG bật badge.
- **II. Kiểm chứng được**: PASS — đổi engine embedding **chỉ đổi vector xếp hạng**; locator
  (page/char/tStart/bbox) và cơ chế reconstruct/highlight (019/045/053) **KHÔNG đụng**; chip `[n]` map
  chính xác. Khi notebook đang reindex → báo "đang tái lập chỉ mục" thay vì trả kết quả sai (không bịa).
- **III. Offline & main-only**: PASS — inference/LanceDB/health ở main; renderer qua IPC; KHÔNG log nội
  dung câu hỏi/chunk/đường dẫn.
- **IV. Test-first ≥80% business logic**: PASS — hàm thuần (e5-prefix, model-version, model-recommend,
  planReindexBatches, vector-normalize, ngưỡng relevance) test trước; I/O (embed-model, ollama-health,
  reindex runner, vector-store) exclude coverage như tiền lệ 045/011.
- **Đảo 031**: ghi nhận ở ADR 059 — "embedding LUÔN qua Ollama" (031) được thay bằng in-process; chat giữ
  nguyên. Không vi phạm constitution (đây là quyết định thiết kế, có ADR).

→ **Không có vi phạm cần Complexity Tracking.**

## Project Structure

### Documentation (this feature)

```text
specs/20260713-144057-embed-in-process/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ipc-and-interfaces.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/main/services/embedding/           # MỚI — cô lập feature
├── e5-prefix.ts               # THUẦN: withE5Prefix(text, role) → "query: "/"passage: "
├── model-version.ts           # THUẦN: EMBEDDING_MODEL_VERSION, matchesVersion()
├── vector-normalize.ts        # THUẦN: l2normalize() (nếu cần cho MMR ổn định)
├── embed-model.ts             # I/O: createEmbedder() bọc transformers feature-extraction (tái dùng 045)
├── reindex-plan.ts            # THUẦN: planReindexBatches(chunkIds, size)
└── reindex-runner.ts          # I/O: runReindex() job nền (drop+recreate table, nhúng lại, resume)

src/main/services/ai/                  # mở rộng ai-runtime (007)
├── model-recommend.ts         # THUẦN: recommendChatModel(totalMemBytes) → tier
└── ollama-health.ts           # I/O: checkOllama() HTTP local

src/main/services/ingestion/
├── embed.ts                   # SỬA: dùng embedder in-process thay provider.embed (Ollama)
└── vector-store.ts            # SỬA: thêm dropTable/recreate (dim 384); interface search/add giữ nguyên

src/main/services/rag/
├── constants.ts               # SỬA: RELEVANCE_MAX_DISTANCE hiệu chỉnh cho e5 (cosine hẹp)
└── retrieval.ts               # SỬA: embed query in-process (e5 query prefix); "đang reindex" guard

src/main/db/
├── migrations.ts              # SỬA (nếu chọn bảng meta): migration #8 app_meta + reindex state
src/main/                      # startup: kiểm version → kick reindex nền; bump version khi xong
src/shared/ipc/                # SỬA: kênh ai:ollamaHealth / ai:recommendModel + reindex progress event
src/renderer/features/settings/# SỬA: hiện gợi ý model theo RAM + health-check (KHÔNG đổi Chat/Nguồn)

tests/ (vitest) + e2e (playwright)
```

**Structure Decision**: Feature mới `src/main/services/embedding/` (cô lập theo slug). Mở rộng `ai/`
(007) cho recommend/health. Sửa tối thiểu điểm tích hợp `ingestion/embed.ts`, `vector-store.ts`,
`rag/constants.ts`, `rag/retrieval.ts`, startup, IPC, Settings. KHÔNG đụng UI Chat/Nguồn, KHÔNG đụng
reconstruct/highlight/timeMap/boxMap (Constitution II).

## Complexity Tracking

> Không có vi phạm Constitution cần biện minh.
