# Tasks: Nạp nguồn (Ingestion)

**Feature**: `011-ingestion` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Cách tiếp cận**: Test-First (Constitution IV, ≥80% business logic). Tất cả service nhận dependency inject
(db `:memory:`, mock provider/vector-store/fetch/fs) → unit-test không cần Electron. `[P]` = có thể chạy
song song (khác file, không phụ thuộc task chưa xong).

**Nguồn sự thật**: [data-model.md](./data-model.md) (schema + types), [contracts/ipc-channels.md](./contracts/ipc-channels.md)
(6 kênh), [research.md](./research.md) (R1–R8), 3 ADR `docs/04-decisions/2026-07-11-*`.

---

## Phase 1: Setup (dependency + verify native)

- [x] T001 Cài dependency parse thuần JS: `npm i pdfjs-dist mammoth @mozilla/readability jsdom turndown` và cập nhật `package.json`.
- [x] T002 Cài kho vector native `npm i @lancedb/lancedb`; **smoke test rủi ro cao (research R2)**: viết script tạm mở bảng + add 1 vector + search chạy được ở **cả** Node 24 (vitest) **và** Electron main (`npm run dev`); nếu lỗi ABI → xử lý theo R2 (asarUnpack/electron-rebuild) hoặc escalate ADR. Ghi kết quả verify vào `specs/20260711-102129-ingestion/research.md`.
- [x] T003 [P] Thêm fixture nhỏ: `tests/fixtures/sample.pdf` (2–3 trang), `tests/fixtures/sample.docx`, `tests/fixtures/sample.txt`, `tests/fixtures/sample.md`.
- [x] T004 [P] Cập nhật `vitest.config.ts`: thêm `src/main/services/ingestion/**/*.ts` vào coverage `include`; exclude file wiring thuần (`ingestion/pipeline.ts`, `ingestion/vector-store.ts`) như tiền lệ `ai-runtime.ts`.
- [x] T005 [P] Xác minh `LLMProvider.embed` signature ở `src/main/services/ai-runtime/provider.ts` (nhận mảng text? trả mảng vector?) — ghi chú vào research R5 nếu cần lặp từng text.

---

## Phase 2: Foundational (schema + types + kênh — CHẶN mọi user story)

**Chặn**: mọi US phụ thuộc migration #2, shared types, và whitelist kênh.

- [x] T006 Thêm shared types vào `src/shared/ipc/types.ts`: `SourceKind`, `SourceStatus`, `Locator`, `Source`, `Chunk`, `AddSourceInput`, `AddSourceResult`, `SourceProgressEvent` (theo data-model.md).
- [x] T007 [P] Test migration #2: `tests/unit/migration-source.test.ts` — chạy runMigrations từ user_version=1 (DB đã có bảng notebook) → 2, khẳng định bảng `source`/`chunk` + index tồn tại, không mất dữ liệu notebook (RED).
- [x] T008 APPEND migration #2 vào `src/main/db/migrations.ts` (version=2): tạo bảng `source`, `chunk` (FK `ON DELETE CASCADE`, CHECK enum kind/status) + index `idx_source_notebook`/`idx_source_hash`/`idx_chunk_source`. KHÔNG sửa migration #1. → T007 GREEN.
- [x] T009 [P] Test whitelist: `tests/unit/source-ipc-whitelist.test.ts` — 5 kênh invoke + `source:progress` whitelisted, tên ngoài bị từ chối, tổng ≥21, không trùng (RED).
- [x] T010 Thêm 6 kênh `source:*` vào `src/shared/ipc/channels.ts` (`CHANNELS`, `WHITELISTED_CHANNELS`, `ChannelResponse` cho 5 invoke; `source:progress` chỉ vào whitelist) → T009 GREEN.

**Checkpoint**: schema + types + kênh sẵn sàng → bắt đầu song song các domain logic.

---

## Phase 3: User Story 1 — Nạp tệp → ready (P1) 🎯 MVP

**Goal**: nạp PDF/.docx/.txt/.md → parse → clean → chunk (locator) → embed → lưu SQLite+LanceDB → `ready`,
đếm nguồn thật, bền sau restart.

**Independent Test**: nạp `sample.pdf` vào notebook rỗng → `ready`, N nguồn=1, chunk có locator, còn sau restart.

### Tests (RED trước)

- [x] T011 [P] [US1] `tests/unit/cleaning.test.ts` — chuẩn hoá whitespace/nhiễu, giữ độ dài offset ổn định.
- [x] T012 [P] [US1] `tests/unit/chunker.test.ts` — recursive splitter: mọi chunk `charStart<charEnd` trong `[0,len]`, overlap ~150, PDF không vắt trang (page đơn trị), 100% chunk có locator, ordinal tăng dần.
- [x] T013 [P] [US1] `tests/unit/size-limits.test.ts` — giới hạn theo loại (PDF/docx 50MB, txt/md 25MB); vượt → ném lỗi "Tệp quá lớn".
- [x] T014 [P] [US1] `tests/unit/source-repo.test.ts` — `:memory:` SQLite: create source/chunk, list theo notebook, get, delete cascade (chunk về 0), sourceCount đúng.
- [x] T015 [P] [US1] `tests/unit/source-status.test.ts` — nhãn tiếng Việt theo status/step + ánh xạ `.stat` + aggregate "đã lập chỉ mục / đang xử lý M / ẩn khi 0".

### Implementation (GREEN)

- [x] T016 [P] [US1] `src/main/services/ingestion/cleaning.ts` — làm sạch văn bản → T011 GREEN.
- [x] T017 [P] [US1] `src/main/services/ingestion/size-limits.ts` — hằng số + kiểm kích thước → T013 GREEN.
- [x] T018 [P] [US1] `src/main/services/ingestion/status.ts` — enum + chuyển trạng thái hợp lệ (state machine data-model).
- [x] T019 [US1] `src/main/services/ingestion/chunker.ts` — recursive char splitter + gắn `Locator` (page cho PDF, không vắt trang) → T012 GREEN.
- [x] T020 [US1] `src/main/services/ingestion/source-repo.ts` — CRUD source/chunk (parameterized `?`), delete cascade, đếm sourceCount, dedup helper theo `(notebook_id, content_hash)` → T014 GREEN.
- [x] T021 [P] [US1] `src/main/services/ingestion/parsers/text.ts` — đọc txt/md qua `node:fs` → `{ text }`.
- [x] T022 [P] [US1] `src/main/services/ingestion/parsers/pdf.ts` — pdfjs-dist legacy, text theo trang + page boundaries (research R1).
- [x] T023 [P] [US1] `src/main/services/ingestion/parsers/docx.ts` — mammoth extractRawText.
- [x] T024 [US1] `src/main/services/ingestion/parsers/index.ts` — chọn parser theo kind → `{ text, pages? }`.
- [x] T025 [P] [US1] `src/main/services/ingestion/dedup.ts` — sha256 nội dung tệp (research R5/A8) → T014 phần dedup.
- [x] T026 [US1] `src/main/services/ingestion/embed.ts` — batch gọi `provider.embed`, đọc `dim` từ vector (không hardcode).
- [x] T027 [US1] `src/main/services/ingestion/vector-store.ts` — bọc `@lancedb/lancedb`: open(`userData/vectors/`), add(chunks), deleteBySource, deleteByNotebook, search (interface inject được để mock).
- [x] T028 [US1] `src/main/services/ingestion/queue.ts` — hàng đợi FIFO tuần tự + phát tiến độ (business logic, inject clock).
- [x] T029 [US1] `tests/unit/ingestion-pipeline.test.ts` — luồng đầy đủ (mock parser/provider/vector-store): file → ready, chunk+vector khớp id (RED).
- [x] T030 [US1] `src/main/services/ingestion/pipeline.ts` — điều phối parse→clean→chunk→embed→store, cập nhật status + phát `SourceProgressEvent` → T029 GREEN.
- [x] T031 [US1] Mở rộng `src/main/services/notebooks/notebook-repo.ts`: `sourceCount` đếm thật từ bảng `source`; `delete` gọi `vectorStore.deleteByNotebook` trước khi xoá notebook (cascade SQLite). Cập nhật `tests/unit/notebook-repo.test.ts` cho sourceCount thật.
- [x] T032 [US1] Đăng ký kênh invoke ở `src/main/ipc/register.ts`: `source:add/listByNotebook/get/delete/retry` qua `safeHandle`; wiring progress emitter → `webContents.send('source:progress')` (không log nội dung).
- [x] T033 [US1] Wiring ở `src/main/index.ts`: mở vector-store, tạo pipeline+source-repo, truyền vào `registerIpc`; khởi động lại hàng đợi cho nguồn dở khi mở app.
- [x] T034 [P] [US1] Preload `src/preload/index.ts`: thêm `window.api.source.{add,listByNotebook,get,delete,retry}` + `onProgress(cb)→unsubscribe`.
- [x] T035 [US1] Renderer `src/renderer/features/sources/`: `AddSourceModal.tsx` (kéo-thả tệp + hàng đợi tiến độ; **vô hiệu (disabled) loại Audio/Video + Hình ảnh kèm tooltip "Pha 2" — FR-003**), `SourceList.tsx`+`SourceItem.tsx` (cột Nguồn), `useSources.ts` (snapshot + subscribe onProgress), `source-status.ts` → T015 GREEN. Gắn vào Workspace + card đếm nguồn thật.

**Checkpoint US1**: nạp tệp cục bộ hoạt động end-to-end (MVP giao được).

---

## Phase 4: User Story 2 — Nạp URL + privacy (P2)

**Goal**: URL → fetch + trích nội dung chính → pipeline; privacy "online" khi fetch; chặn SSRF.

**Independent Test**: URL bài viết → `ready` nhãn "Web"; `localhost`/IP nội bộ → `error` chặn SSRF.

- [x] T036 [P] [US2] `tests/unit/ssrf-guard.test.ts` — bảng IP loopback/private/link-local + hostname localhost + redirect-to-internal đều chặn; public pass (RED).
- [x] T037 [US2] `src/main/services/ingestion/parsers/ssrf-guard.ts` — kiểm scheme http/https + phân giải IP + dải nội bộ + redirect thủ công ≤5 hop → T036 GREEN.
- [x] T038 [US2] `src/main/services/ingestion/parsers/url.ts` — fetch (giới hạn body 10MB) + jsdom + readability + turndown → `{ text, title }`; dùng ssrf-guard mỗi hop; readability null → ném "Lỗi trích xuất".
- [x] T039 [US2] Nối `url` vào `parsers/index.ts` + pipeline (kind='url', page=null, title từ trang).
- [x] T040 [US2] Bật privacy indicator "online" khi fetch URL: trong pipeline/parser url, cập nhật privacy-state (001) lúc bắt đầu/kết thúc fetch. Cập nhật `AddSourceModal` cho nhập URL.
- [x] T041 [US2] `tests/unit/` bổ sung: pipeline với kind='url' (mock fetch) → ready nhãn Web; SSRF → error.

**Checkpoint US2**: nạp URL an toàn + phản ánh privacy.

---

## Phase 5: User Story 3 — Tiến độ, lỗi, retry, xoá cascade (P2)

**Goal**: vòng đời nguồn: tiến độ realtime, lỗi thân thiện không treo hàng đợi, retry, xoá dọn 2 store.

**Independent Test**: tệp lỗi → error + retry; xoá nguồn ready → chunk+vector về 0.

- [x] T042 [P] [US3] `tests/unit/ingestion-pipeline.test.ts` mở rộng: 1 nguồn error không chặn nguồn khác trong hàng đợi; retry dọn dữ liệu một phần rồi re-queue.
- [x] T043 [US3] Xử lý lỗi theo bước trong `pipeline.ts` → set `status='error'` + `error_label` ("Lỗi trích xuất"/"Lỗi tải trang"/"Lỗi nhúng"/"Tệp quá lớn"); tiếp tục nguồn kế trong hàng đợi.
- [x] T044 [US3] `source:retry` ở register + pipeline: validate status='error', dọn chunk/vector một phần, re-queue → T042 GREEN.
- [x] T045 [US3] Huỷ/xoá nguồn đang `queued`/`processing`: `source:delete` đánh dấu huỷ, dừng xử lý giữa chừng + dọn SQLite cascade + `vectorStore.deleteBySource`.
- [x] T046 [US3] Renderer: hàng đợi hiển thị thanh tiến độ + nhãn trạng thái/lỗi + nút "Thử lại" + nút xoá (`SourceItem.tsx`, `useSources.ts`); aggregate "đã lập chỉ mục" ở header cột Nguồn.

**Checkpoint US3**: vòng đời nguồn đầy đủ, nhất quán 2 store.

---

## Phase 6: User Story 4 — Runtime offline → awaiting_embedding → auto ready (P3)

**Goal**: nạp khi Ollama offline → dừng `awaiting_embedding`; runtime sẵn sàng → tự embed tiếp.

**Independent Test**: tắt Ollama → txt dừng `awaiting_embedding`; bật → tự `ready`.

- [x] T047 [P] [US4] `tests/unit/ingestion-pipeline.test.ts` mở rộng: provider `test()` fail → nguồn `awaiting_embedding` (đã có chunk, chưa vector); provider sẵn sàng → resume embed → `ready` (RED/GREEN).
- [x] T048 [US4] Pipeline: kiểm `provider.test()`/runtime-status trước bước embed; offline → lưu chunk + set `awaiting_embedding`, KHÔNG lỗi.
- [x] T049 [US4] Cơ chế resume: khi runtime chuyển sẵn sàng (poll runtime-status/khi mở app), quét nguồn `awaiting_embedding` → đẩy lại hàng đợi chỉ bước embed → `ready`.
- [x] T050 [US4] Renderer: nhãn "chờ nhúng" cho `awaiting_embedding` (source-status.ts).

**Checkpoint US4**: pipeline bền khi model tạm offline.

---

## Phase 7: Polish & Cross-Cutting

- [x] T051 [P] Append 7 term glossary vào `docs/00-glossary.md`: ingestion pipeline, chunking, vector store, source status, ingestion queue, text cleaning, content extraction (intake §Thuật ngữ mới).
- [x] T052 [P] e2e `tests/e2e/ingestion.e2e.ts` (Playwright `_electron`): add `sample.txt` → ready; delete → chunk/vector cascade; whitelist source:* (renderer không gọi được kênh ngoài danh sách).
- [x] T053 [P] Rà bảo mật: xác nhận không log nội dung tài liệu (redact) ở register/pipeline; renderer bundle không import pdfjs/mammoth/jsdom/lancedb (grep build output) — SC-008.
- [x] T054 Chạy test gate: `npm run lint && npm run test && npm run build && npm run test:e2e`; coverage ingestion ≥80%. Sửa tới xanh.

---

## Dependencies & thứ tự

- **Setup (T001–T005)** → **Foundational (T006–T010)** → user stories.
- **US1 (T011–T035)** = MVP, chặn US2/US3/US4 (chúng dùng lại pipeline/parser/repo/queue của US1).
- **US2 (T036–T041)**, **US3 (T042–T046)**, **US4 (T047–T050)** độc lập tương đối sau US1 — có thể làm tuần tự theo ưu tiên P2→P2→P3.
- **Polish (T051–T054)** sau cùng.
- Trong mỗi phase: task `[P]` (khác file) chạy song song; test RED trước implement GREEN.

## Song song mẫu (US1)

`T011,T012,T013,T014,T015` (5 test file khác nhau) chạy song song; rồi `T016,T017,T018,T021,T022,T023,T025`
(service/parsers khác file) song song; `T019/T020/T024/T026–T030` theo phụ thuộc.

## MVP scope

**Chỉ US1** (Phase 1+2+3) = nạp tệp cục bộ end-to-end, đã giao được giá trị lõi (chỉ mục hoá tài liệu →
sẵn sàng cho RAG 005). US2–US4 tăng cường (URL, vòng đời, độ bền offline).

**Tổng: 54 task** — Setup 5, Foundational 5, US1 25, US2 6, US3 5, US4 4, Polish 4.
