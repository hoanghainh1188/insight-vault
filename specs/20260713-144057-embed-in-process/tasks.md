# Tasks: Embedding in-process + gợi ý model theo RAM (059)

**Feature dir**: `specs/20260713-144057-embed-in-process/` · **Branch**: `059-embed-in-process`
**Nguồn**: plan.md · spec.md · research.md · data-model.md · contracts/ · ADR
`docs/04-decisions/2026-07-13-embed-in-process-clarify.md`

**Bất biến (mọi task)**: Constitution II — đổi engine embedding CHỈ đổi vector; **locator không đổi**, chip
`[n]` map chính xác; KHÔNG đụng reconstruct/highlight (019) / timeMap (045) / boxMap (053). Constitution I —
embed local ở main, chỉ tải model lần đầu rời máy (badge dùng chung 045/031). Constitution III — main-only,
KHÔNG log nội dung. Test-first ≥80% business logic.

---

## Phase 1: Setup

- [x] T001 Xác nhận `@huggingface/transformers` + onnxruntime đã bundle/asarUnpack (electron-builder.yml
      `**/*.node`) đủ cho task `feature-extraction`; tái dùng cachePath data dir của 045 — ghi chú trong
      `src/main/services/embedding/README-notes.md` (không thêm dependency mới).
- [x] T002 [P] Tạo thư mục feature `src/main/services/embedding/` và khung file rỗng (e5-prefix.ts,
      model-version.ts, vector-normalize.ts, embed-model.ts, reindex-plan.ts, reindex-runner.ts) + barrel
      `index.ts`.

---

## Phase 2: Foundational (blocking — hàm thuần test-first)

- [x] T003 [P] Test `src/main/services/embedding/__tests__/e5-prefix.test.ts`: `withE5Prefix(t,"query")`
      → `"query: "+t`; `"passage"` → `"passage: "+t`; chuỗi rỗng vẫn gắn tiền tố.
- [x] T004 [P] Impl `src/main/services/embedding/e5-prefix.ts` cho pass T003.
- [x] T005 [P] Test `src/main/services/embedding/__tests__/model-version.test.ts`: `matchesVersion` khớp
      `EMBEDDING_MODEL_VERSION`, không khớp version cũ/`undefined`.
- [x] T006 [P] Impl `src/main/services/embedding/model-version.ts` (`EMBEDDING_MODEL_VERSION="e5-small-384"`,
      `matchesVersion`).
- [x] T007 [P] Test `src/main/services/embedding/__tests__/vector-normalize.test.ts`: `l2normalize` cho ‖v‖≈1;
      vector 0 giữ nguyên (không chia 0).
- [x] T008 [P] Impl `src/main/services/embedding/vector-normalize.ts` cho pass T007.
- [x] T009 [P] Test `src/main/services/embedding/__tests__/reindex-plan.test.ts`: `planReindexBatches` chia
      đúng lô, phần dư, mảng rỗng → [].
- [x] T010 [P] Impl `src/main/services/embedding/reindex-plan.ts` cho pass T009.

**Checkpoint**: hàm thuần nền tảng xanh → sẵn sàng cho US1/US2/US3.

---

## Phase 3: User Story 1 — Embedding in-process + retrieval (P1) 🎯 MVP

**Goal**: Nhúng chunk + query in-process (không Ollama cho embed); hỏi đáp có chip `[n]` đúng; "không tìm
thấy" hoạt động với ngưỡng e5.

**Independent test**: Tắt Ollama, nạp nguồn mới → sẵn sàng >0 chunk; hỏi → chip `[n]` map đúng đoạn.

- [x] T011 [US1] Impl `src/main/services/embedding/embed-model.ts` — `createEmbedder({cacheDir,model,
setOnline})` bọc `pipeline("feature-extraction","Xenova/multilingual-e5-small")` (tái dùng loader 045:
      `env.cacheDir`, progress_callback, `setOnline` badge quanh tải model đầu); `embed(texts,role,onProgress)`
      gắn `withE5Prefix` + `{pooling:"mean",normalize:true}` + `l2normalize`. (I/O — exclude coverage.)
- [x] T012 [US1] SỬA `src/main/services/ingestion/vector-store.ts`: thêm `dropTable()` (LanceDB
      `conn.dropTable("chunks")`, reset `table=null`); giữ nguyên `add/search/getVectorsByIds/deleteBy*`. Bảng
      tái tạo dim 384 qua `add` (schema suy từ hàng đầu — đã verify).
- [x] T013 [US1] SỬA `src/main/services/ingestion/embed.ts`: dùng `Embedder.embed(texts,"passage")`
      in-process thay `provider.embed` (Ollama); `dim` đọc từ vector (=384). Giữ chữ ký `embedTexts` +
      onProgress.
- [x] T014 [US1] Wire ingestion pipeline (`src/main/services/ingestion/*`) truyền embedder in-process vào
      `embedTexts` khi lập chỉ mục nguồn (thay provider Ollama). Không đổi locator/chunk.
- [x] T015 [US1] SỬA `src/main/services/rag/constants.ts`: hạ `RELEVANCE_MAX_DISTANCE` → `0.5` cho e5
      (cosine hẹp — research R5); ghi chú calibration.
- [x] T016 [US1] SỬA `src/main/services/rag/retrieval.ts`: embed query in-process qua
      `Embedder.embed([q],"query")` (thay Ollama); giữ hybrid RRF/MMR (055) nguyên phía sau. DI embedder.
- [x] T017 [P] [US1] Test `src/main/services/rag/__tests__/retrieval.embed.test.ts` (DI mock embedder +
      vector-store): locator của ScoredChunk **giữ nguyên** sau đổi engine; ngưỡng mới lọc đúng "không tìm
      thấy"; hybrid vẫn gọi (không hồi quy 055).
- [x] T018 [P] [US1] Test `src/main/services/ingestion/__tests__/embed.passage.test.ts` (DI mock embedder):
      `embedTexts` gắn tiền tố passage, trả dim 384, onProgress đủ bước.

**Checkpoint**: US1 độc lập chạy — MVP embedding in-process hoàn chỉnh.

---

## Phase 4: User Story 2 — Tái lập chỉ mục nền, resume (P2)

**Goal**: Phát hiện version lệch → job nền nhúng lại toàn bộ; idempotent/resume; báo "đang tái lập chỉ mục".

**Independent test**: Notebook vector cũ → mở app thấy tiến độ; tắt giữa chừng mở lại tiếp tục; xong không
chạy lại.

- [x] T019 [US2] Impl `src/main/services/embedding/reindex-runner.ts` — `runReindex(deps)`: drop bảng cũ
      nếu dim lệch (lần đầu), lấy chunk id từ SQLite, **bỏ chunk đã có vector** trong bảng mới
      (`getVectorsByIds`), nhúng passage theo lô (`planReindexBatches`), `add` vào LanceDB, phát progress,
      `markComplete()` bump version electron-store **khi toàn bộ xong**. `needsReindex(storedVersion)`. (I/O —
      exclude coverage; phần thuần đã ở reindex-plan/model-version.)
- [x] T020 [US2] Wire startup `src/main/index.ts` (hoặc bootstrap main): sau khi DB/LanceDB sẵn sàng, nếu
      `needsReindex` → kick `runReindex` **nền** (không chặn khởi động); giữ tham chiếu trạng thái tiến độ.
- [x] T021 [US2] SỬA `src/main/services/rag/retrieval.ts` (hoặc rag-service): khi notebook **chưa** reindex
      xong (version lệch / thiếu vector) → trả trạng thái "đang tái lập chỉ mục" trong answer thay vì rỗng/sai
      (không đổi shape `rag:ask`).
- [x] T022 [P] [US2] IPC `src/shared/ipc/*` + main handler + preload: `embed:reindexStatus`
      (`{inProgress,done,total}`) + event `embed:reindexProgress`. Whitelisted, renderer chỉ nhận trạng thái.
- [x] T023 [P] [US2] Renderer: hiển thị dải "đang tái lập chỉ mục N/M" (vd banner Workspace hoặc cột Nguồn)
      — KHÔNG đổi UI Chat/Nguồn về hành vi; chỉ thêm chỉ báo tiến độ.
- [x] T024 [P] [US2] Test `src/main/services/embedding/__tests__/reindex-runner.test.ts` (DI mock
      vector-store + embedder + store): **resume** (bỏ chunk đã có vector, không trùng), **idempotent** (chạy 2
      lần không nhân bản), bump version **chỉ khi xong**, progress đếm đúng.

**Checkpoint**: US2 độc lập — nâng cấp không mất dữ liệu, an toàn khi tắt giữa chừng.

---

## Phase 5: User Story 3 — Gợi ý model theo RAM + health Ollama (P3)

**Goal**: Cài đặt AI hiện gợi ý cỡ model theo RAM + trạng thái Ollama; chỉ gợi ý, không tự tải.

**Independent test**: Mở Cài đặt AI trên máy RAM biết trước → tier đúng; Ollama tắt/model chưa pull → báo rõ.

- [x] T025 [P] [US3] Test `src/main/services/ai/__tests__/model-recommend.test.ts`: 3 mốc RAM
      (<8/8–16/>16 GB) → 3 tier (small/medium/large) + examples đúng.
- [x] T026 [P] [US3] Impl `src/main/services/ai/model-recommend.ts` (`recommendChatModel(bytes)`) + `detectRam()`
      (`os.totalmem()`, I/O mỏng tách riêng).
- [x] T027 [US3] Impl `src/main/services/ai/ollama-health.ts` — `checkOllama(deps)` tái dùng
      `ai-runtime/ollama-client.ts` (`/api/tags`): `{running,models,modelPulled}` (model đang chọn từ
      model-selection 007). (I/O — exclude coverage.)
- [x] T028 [P] [US3] IPC `ai:recommendModel` + `ai:ollamaHealth` (hoặc mở rộng `ai:getRuntimeStatus` 007):
      handler main + preload whitelist + type ở `src/shared/ipc/*`.
- [x] T029 [US3] Renderer `src/renderer/features/settings/*`: khối "Gợi ý model theo cấu hình máy" (tier +
      giải thích) + trạng thái Ollama (đang chạy? model đã pull?) + hướng dẫn khắc phục. KHÔNG tự tải model.

**Checkpoint**: US3 độc lập — hướng dẫn người dùng máy yếu chọn model phù hợp.

---

## Phase 6: Polish & Cross-cutting

- [x] T030 [P] E2E `tests/e2e/*`: regression **chip `[n]` map đúng đoạn** sau đổi engine embedding (nạp
      nguồn → hỏi → bấm chip → đúng nguồn+vị trí). Bằng chứng Constitution II.
- [x] T031 [P] E2E: màn Cài đặt AI hiện gợi ý model + trạng thái Ollama.
- [x] T032 Kiểm coverage business logic ≥80% (loại I/O: embed-model, reindex-runner, ollama-health,
      vector-store); bổ sung test hàm thuần nếu thiếu.
- [x] T033 Rà Constitution: không log nội dung chunk/câu hỏi/đường dẫn (grep logEvent trong embedding/*);
      badge egress CHỈ bật lúc tải model đầu (không lúc nhúng thường). Cập nhật `docs/00-glossary.md` nếu có
      thuật ngữ nghiệp vụ mới (embedding_model_version, reindex).

---

## Dependencies

- **Setup (P1 phase)** → **Foundational (P2 phase)** → US1 → US2 → US3 → Polish.
- US1 là MVP (embedding in-process). US2 phụ thuộc US1 (embedder + vector-store dropTable). US3 độc lập
  tương đối (chỉ đụng ai/* + Settings) — có thể làm song song US2 sau khi Foundational xong.
- Foundational (T003–T010) chặn tất cả US.

## Parallel example

- Foundational: T003+T005+T007+T009 (test) song song; rồi T004+T006+T008+T010 (impl) song song.
- US1: T017+T018 (test) song song sau khi T011–T016 xong.
- US3 có thể chạy song song US2 (khác file: ai/* + settings vs embedding/reindex + rag).

## MVP scope

**US1 (P1)** = MVP: embedding chạy in-process, hỏi đáp có chip `[n]` đúng, không cần Ollama cho embed. US2
(migration) + US3 (gợi ý RAM) là tăng cường.
