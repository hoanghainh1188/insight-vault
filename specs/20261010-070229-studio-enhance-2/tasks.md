# Tasks: Studio đợt 2 — phiên bản, 4 loại mới, yêu cầu tuỳ chỉnh, nhiều nguồn + stream (178)

> **Sửa sau analyze (2026-10-10):** I1 security-reviewer bắt buộc PR 1 · I2 PR 1 dùng branch `178-studio-enhance-2` · U1 T007 file cụ thể · U2 T017
> dùng lại `DeleteConfirm` · C1 test privacy egress khi stream (T062) · A1 SC-006 ≤ 2 s (T068) · C2 tiến độ khi stream (T061) · C3 nguồn đã xoá (T059) · C4 xoá
> khi đang Tạo lại (T016) · U3 tên file test hook · F1 quy ước motion.

**Input**: `specs/20261010-070229-studio-enhance-2/` (plan, spec, research R1–R10, data-model, contracts/studio-ipc.md, quickstart); quyết định
`docs/04-decisions/2026-10-10-studio-enhance-2-clarify.md`.

**Tests**: BẮT BUỘC (Constitution IV — TDD): mọi hàm / module thuần viết test TRƯỚC, chạy thấy FAIL rồi mới code. Ngưỡng ≥ 80% logic nghiệp vụ.

**Tổ chức**: 4 phase = **4 PR tuần tự**, mỗi PR ship độc lập. **PR 1 dùng chính branch `178-studio-enhance-2`** (mang
theo intake / spec / plan / tasks / ADR — rule 3); PR 2–4 mỗi PR một branch `178-studio-enhance-2-prN` cắt từ `main` sau khi PR trước merge. Mỗi phase kết thúc bằng **cổng review**: code-reviewer → glossary-steward →
(security-reviewer — BẮT BUỘC mọi PR đụng DB / IPC: PR 1, PR 3, PR 4; agent tự in `SKIPPED` nếu không liên quan) → test gate (`npm run lint && npm run test && npm run build`, coverage ≥ 80%).

**Quy ước**: không chạy prettier lên `docs/00-glossary.md`, `docs/04-decisions/INDEX.md` (sửa bằng script). `[P]` = khác tệp, không phụ thuộc task chưa xong.
Log không chứa nội dung / yêu cầu tuỳ chỉnh / id. Mọi chuỗi UI qua i18n (vi nguồn `as const`, en `Widen`).
Mọi UI mới (T017, T032, T046, T059, T067): chỉ animate `transform` / `opacity`, tôn trọng `prefers-reduced-motion`, focus-visible rõ.

---

## Phase 1: PR 1 — Lịch sử phiên bản + migration v11 (User Story 1, P1) 🎯 MVP

**Goal**: mỗi lượt tạo thành công thêm một phiên bản; xem / chọn / xoá phiên bản; trần 10 tự xoá bản cũ nhất; ghi chú N phần / đã cắt / AI cục bộ gắn với
phiên bản; dữ liệu cũ giữ nguyên.

**Independent Test**: tạo Tóm tắt 3 lần ⇒ 3 phiên bản, mặc định bản mới nhất; chọn bản 1 ⇒ nội dung + chip của bản 1; xoá bản 2 ⇒ còn 2; tạo 11 lần ⇒
còn 10; DB v10 có kết quả cũ ⇒ sau v11 hiện đủ.

### Setup

- [X] T001 [US1] Append glossary bằng script (KHÔNG prettier) TRƯỚC khi đặt tên: phiên bản kết quả Studio, trần phiên bản (`STUDIO_MAX_VERSIONS`), xoá phiên
      bản (`studio:deleteVersion`) — `docs/00-glossary.md` (chỉ THÊM dòng; không sửa dòng `StudioKind` / `StudioResult` cũ).

### Tests trước (FAIL rồi mới code)

- [X] T002 [US1] Viết test TRƯỚC `tests/unit/migration-studio-versions.test.ts` (khuôn `migration-source.test.ts`): DB chạy migration 1..10, chèn notebook + 4 `studio_result` (citations_json hợp lệ + 1 hỏng) ⇒ `runMigrations` lên 11 ⇒ mọi dòng giữ `id`, `notebook_id`, `kind`, `content`, `citations_json`,
      `created_at`, `updated_at`; 5 cột mới NULL; chèn 2 dòng cùng `(notebook, kind)` được (UNIQUE đã bỏ); CHECK nhận `studyGuide|briefing|timeline|keyTerms|custom`
      và từ chối `bogus`; `truncated`/`local` ngoài {0,1} bị từ chối; xoá notebook ⇒ cascade xoá mọi phiên bản; `PRAGMA foreign_key_check` rỗng; có index
      `idx_studio_notebook` và `idx_studio_versions`; `user_version = 11`.
- [X] T003 [P] [US1] Viết test TRƯỚC trong `tests/unit/studio-repo.test.ts` (sửa kỳ vọng upsert cũ): `insert` tạo phiên bản mới với uuid mới mỗi lần
      (`now` / `uuid` tiêm); trả `parts`, `truncated`, `local` khi có; lưu bản thứ 11 cùng `(notebook, kind)` ⇒ còn 10, bản `created_at` nhỏ nhất bị xoá (hoà
      `created_at` ⇒ theo rowid); trần tính riêng từng kind và từng notebook; `listByNotebook` trả mọi phiên bản sắp `kind`, `created_at` giảm dần;
      `listVersions(notebookId, kind)`; `deleteVersion(notebookId, id)` ⇒ `true` khi khớp, `false` khi id lạ / khác notebook / đã xoá; dòng cũ (cột NULL) ⇒
      không có `parts` / `truncated` / `local` trong kết quả.
- [X] T004 [P] [US1] Viết test TRƯỚC `tests/unit/studio-versions.test.ts` cho hàm thuần `src/renderer/features/studio/studio-versions.ts`:
      `groupVersions(results)` ⇒ `Partial<Record<StudioKind, StudioResult[]>>` mới nhất trước; `currentVersion(versions, selected, kind)` (thiếu / id không
      còn ⇒ mới nhất; không có bản ⇒ `undefined`); `afterDelete(versions, selected, kind, id)` ⇒ state mới (không mutate) + id được chọn kế tiếp (bản mới nhất
      còn lại) hoặc `undefined`; `withInserted(versions, result)` ⇒ đặt đầu danh sách, cắt còn 10.
- [X] T005 [P] [US1] Sửa test TRƯỚC `tests/unit/studio-channels-whitelist.test.ts`: có `studio:deleteVersion` trong whitelist + preload, tên duy nhất.
- [X] T006 [P] [US1] Viết test TRƯỚC trong `tests/unit/studio-service.test.ts`: `generate` gọi `studioRepo.insert` (không còn `upsert`) với `parts`, `truncated`
      và `local: true` chỉ khi `input.target === "local"`; huỷ (signal) ⇒ `insert` không được gọi (giữ kỳ vọng 149); `deleteVersion(notebookId, id)` chuyển xuống
      repo; kiểm kiểu tham số (không phải chuỗi / rỗng ⇒ `{deleted:false}`, repo không gọi).
- [X] T007 [P] [US1] Viết test TRƯỚC trong `tests/unit/vault-backup-prepare.test.ts` (cạnh ca "schema cũ hơn ⇒ được migrate lên max"): bản sao lưu ở schema v10 có
      `studio_result` ⇒ `assertSchemaMatches(v10)` qua, `runMigrations` lên v11, dữ liệu Studio giữ nguyên; `expectedSchema(11)` khớp DB mới tạo.

### Implementation

- [X] T008 [US1] Thêm migration `version: 11` vào cuối `MIGRATIONS` trong `src/main/db/migrations.ts` theo research R1: `CREATE TABLE studio_result_new`
      (bảng ở data-model.md, CHECK 9 kind) → `INSERT INTO studio_result_new (id, notebook_id, kind, content, citations_json, created_at, updated_at) SELECT …
FROM studio_result` → `DROP TABLE studio_result` → `ALTER TABLE studio_result_new RENAME TO studio_result` → `CREATE INDEX idx_studio_notebook`,
      `idx_studio_versions (notebook_id, kind, created_at)`. KHÔNG đụng `PRAGMA foreign_keys` (chú thích lý do: bảng con, không bảng nào tham chiếu; PRAGMA là
      no-op trong giao dịch). T002 + T007 xanh.
- [X] T009 [US1] `src/main/services/studio/constants.ts`: `STUDIO_MAX_VERSIONS = 10`; `STUDIO_ALL_KINDS` (9 giá trị, khớp CHECK v11) tách khỏi `STUDIO_KINDS`
      (giữ 4 loại hiện có ở PR này).
- [X] T010 [US1] `src/shared/ipc/types.ts`: `StudioResult.local?: boolean` (chú thích: G4, từ DB); sửa chú thích `parts` / `truncated` (nay đọc từ DB);
      `StudioDeleteVersionInput { notebookId: string; id: string }`.
- [X] T011 [US1] Viết lại `src/main/services/studio/studio-repo.ts`: `insert({notebookId, kind, content, citations, parts?, truncated?, local?})` trong
      `BEGIN…COMMIT` (INSERT + `DELETE … WHERE id IN (SELECT id … ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ?)` với `STUDIO_MAX_VERSIONS`), ROLLBACK khi
      lỗi; `listByNotebook` (mọi phiên bản); `listVersions`; `deleteVersion(notebookId, id): boolean`; `toResult` đọc 3 cột mới (NULL ⇒ bỏ trường); bỏ `upsert`
      và `getByNotebookKind` nếu không còn dùng. SQL tham số hoá. T003 xanh.
- [X] T012 [US1] `src/main/services/studio/studio-service.ts`: thay `upsert` bằng `insert` (truyền `parts`, `truncated`, `local: input.target === "local"`),
      giữ `assertNotAborted` ngay trước insert; thêm `deleteVersion(notebookId: unknown, id: unknown): { deleted: boolean }` (kiểm chuỗi không rỗng). T006 xanh.
- [X] T013 [US1] `src/shared/ipc/channels.ts`: `studioDeleteVersion: "studio:deleteVersion"` + `ChannelResponse` `{ deleted: boolean }`;
      `src/main/ipc/register.ts`: `safeHandle(studioDeleteVersion)` gọi `studioServices.active.deleteVersion`; `src/preload/index.ts`: `studioDeleteVersion(input)`.
      T005 xanh.
- [X] T014 [US1] Thêm khoá i18n vi + en: `studio.versions.label` ("Phiên bản" / "Version"), `studio.versions.option` ("Bản {n}/{total} · {time}"),
      `studio.versions.delete`, `studio.versions.deleteAria` (có tên loại), `studio.versions.confirmDelete`, `a11y.studioVersionDeleted` — trong
      `src/shared/i18n/domains/studio.ts`, `src/shared/i18n/domains/a11y.ts`; catalog test vi↔en xanh.
- [X] T015 [US1] Hiện thực `src/renderer/features/studio/studio-versions.ts` (T004 xanh).
- [X] T016 [US1] Viết test TRƯỚC rồi sửa `src/renderer/features/studio/useStudio.ts` (test hook TRƯỚC ở `tests/unit/studio-versions-hook.test.ts`, khuôn `studio-cancel-hook.test.ts`):
      `versions` + `selected` thay `results`; nạp `studioList` ⇒ `groupVersions`; generate xong ⇒ `withInserted` + chọn bản mới; `select(kind, id)`;
      `deleteVersion(kind, id)` gọi IPC rồi `afterDelete`; bỏ `localKinds` (dùng `version.local`); giữ nguyên A→B→A / huỷ / tự huỷ khi đổi notebook (149);
      xoá phiên bản đang xem trong lúc loại đó đang "Tạo lại" ⇒ lượt tạo vẫn chạy, xong vẫn chèn bản mới và chọn nó.
- [X] T017 [US1] Tạo `src/renderer/features/studio/StudioVersionPicker.tsx`: `<select>` có `<label>` (chỉ hiện khi ≥ 2 bản) + nút xoá (`aria-label` có tên loại) + xác nhận xoá dùng lại mẫu `src/renderer/features/notebooks/DeleteConfirm.tsx` / xác nhận trong `src/renderer/features/sources/SourceItem.tsx`
      (KHÔNG `window.confirm`); sau xoá: focus về select (còn bản) hoặc nút loại (hết bản),
      `announce(a11y.studioVersionDeleted)`. Test jsdom TRƯỚC `tests/unit/studio-version-picker.test.ts` (nhãn vi/en, ẩn khi 1 bản, xác nhận huỷ ⇒ không xoá,
      focus, announce).
- [X] T018 [US1] Sửa `src/renderer/features/studio/StudioResultCard.tsx` + `StudioColumn.tsx`: card hiển thị `currentVersion`; Copy / Export / chip `[n]` dùng
      phiên bản đang xem; badge AI cục bộ từ `version.local`; ghi chú N phần / đã cắt từ phiên bản; đặt `StudioVersionPicker`; "Tạo lại" thêm bản mới. Cập nhật
      `tests/unit/studio-parts-ui.test.ts` và test UI liên quan.
- [X] T019 [US1] `src/renderer/features/studio/studio.css`: hàng bộ chọn phiên bản + nút xoá không tràn 262 px (token sẵn có, focus-visible, không animate thuộc
      tính layout, tôn trọng `prefers-reduced-motion`).
- [X] T020 [US1] e2e `tests/e2e/studio-versions.spec.ts` (Ollama giả, khuôn `studio-cancel.spec.ts`): 3 lần tạo ⇒ 3 phiên bản; chọn bản 1 + Copy; xoá bản đang
      xem (xác nhận); Tạo lại + Huỷ ⇒ không thêm bản; cửa sổ 900 px không tràn.

### Cổng review PR 1

- [X] T021 [US1] ADR thực thi ngắn `docs/04-decisions/2026-10-10-studio-versions.md` (migration v11, trần trong giao dịch, `studio:list` trả mọi phiên bản,
      `deleteVersion`, `local` từ main) + append dòng `docs/04-decisions/INDEX.md` bằng script.
- [X] T022 [US1] Gọi subagent **code-reviewer** (đối chiếu constitution / spec / plan / tasks phase 1); xử lý mọi Blocking.
- [X] T023 [US1] Gọi subagent **glossary-steward**; append term mới thiếu (KHÔNG sửa term cũ).
- [X] T024 [US1] Gọi subagent **security-reviewer** (BẮT BUỘC — PR đụng DB: migration v11, IPC mới `deleteVersion`); xử lý mọi Blocking.
- [X] T025 [US1] Test gate: `npm run lint && npm run test && npm run build` xanh, coverage ≥ 80%; quickstart dòng PR 1 (gồm dữ liệu v0.2.19 + khôi phục sao
      lưu cũ); mở PR 1.

**Checkpoint**: PR 1 merge được độc lập — 4 loại cũ có lịch sử phiên bản.

---

## Phase 2: PR 2 — Bốn loại mới (User Story 2, P2)

**Goal**: thêm `studyGuide`, `briefing`, `timeline`, `keyTerms` qua toàn bộ đường tạo; lưới 2×4 vừa 262 px.

**Independent Test**: bấm từng loại mới ⇒ đúng định nghĩa FR-010, có chip `[n]`; tiến độ / huỷ / phiên bản như loại cũ; 8 nút không tràn ở vi + en.

- [X] T026 [US2] Append glossary bằng script: Hướng dẫn học (`studyGuide`), Bản tóm lược (`briefing`), Dòng thời gian (`timeline`), Bảng thuật ngữ (`keyTerms`
      — ghi rõ ≠ `docs/00-glossary.md`) — `docs/00-glossary.md`.
- [X] T027 [P] [US2] Viết test TRƯỚC trong `tests/unit/studio-prompt.test.ts`: `systemPromptFor` cho 4 loại mới (vi + en) chứa khung `common()` (quy tắc `[n]`,
      không bịa) + đúng một dòng "Task: …" theo FR-010 (study guide: khái niệm / 5–10 câu hỏi ôn tập kèm đáp án / từ khoá; briefing: bối cảnh / phát hiện / hệ
      quả chỉ khi nguồn nêu / câu hỏi mở; timeline: "mốc — sự kiện", không suy diễn ngày, nhãn "Không rõ thời điểm" / "Undated"; keyTerms: "thuật ngữ — định
      nghĩa", chữ cái, chỉ thuật ngữ được định nghĩa trong nguồn); kind lạ vẫn ném.
- [X] T028 [P] [US2] Viết test TRƯỚC trong `tests/unit/studio-service.test.ts` + `tests/unit/studio-map-reduce.test.ts`: mỗi loại mới chạy được đường 1-lượt
      và map-reduce (system của lượt cuối là prompt của loại đó), hậu kiểm `[n]`, insert đúng `kind`.
- [X] T029 [US2] `src/shared/ipc/types.ts`: `StudioKind` += `"studyGuide" | "briefing" | "timeline" | "keyTerms"`; `src/main/services/studio/constants.ts`:
      `STUDIO_KINDS` = 8 loại theo thứ tự hiển thị (summary, keyPoints, faq, outline, studyGuide, briefing, timeline, keyTerms).
- [X] T030 [US2] `src/main/services/studio/prompt.ts`: thêm 4 chỉ dẫn vào `task()` (nhãn mục theo ngôn ngữ đầu ra như `FAQ_LABELS`); `common()` KHÔNG đổi.
      T027, T028 xanh.
- [X] T031 [US2] i18n `studio.kind.{studyGuide,briefing,timeline,keyTerms}` vi (Hướng dẫn học, Bản tóm lược, Dòng thời gian, Bảng thuật ngữ) + en (Study
      guide, Briefing, Timeline, Glossary) trong `src/shared/i18n/domains/studio.ts`; catalog test xanh; kiểm `export-name` dùng nhãn mới.
- [X] T032 [US2] Viết test jsdom TRƯỚC `tests/unit/studio-kinds-layout.test.ts`: 8 nút theo thứ tự, mỗi nút tên đọc đúng loại, thứ tự Tab = thứ tự hiển thị,
      trạng thái "Đang tạo…" từng nút; rồi sửa `KINDS` trong `src/renderer/features/studio/StudioColumn.tsx` + `studio.css` (lưới 2 cột 2×4, nhãn xuống dòng
      không cắt, không cuộn ngang).
- [X] T033 [US2] e2e `tests/e2e/studio-kinds-layout.spec.ts`: cột 262 px + cửa sổ 900 px, vi và en — không tràn (scrollWidth ≤ clientWidth); tạo 1 loại mới với
      Ollama giả ⇒ thẻ kết quả + chip.

### Cổng review PR 2

- [ ] T034 [US2] Gọi **code-reviewer**; xử lý Blocking.
- [ ] T035 [US2] Gọi **glossary-steward**; append term thiếu.
- [ ] T036 [US2] Test gate (lint, test, build, coverage ≥ 80%) + quickstart dòng PR 2 (gồm kiểm thủ công chất lượng 4 loại trên Ollama thật, vi + en); mở PR 2.

**Checkpoint**: PR 2 merge độc lập — 8 loại có lịch sử phiên bản.

---

## Phase 3: PR 3 — Yêu cầu tuỳ chỉnh (User Story 3, P2) 🔒 security-reviewer BẮT BUỘC

**Goal**: loại `custom` với văn bản tự do ≤ 500 ký tự, kiểm ở main, chỉ trong user message, hậu kiểm `[n]` như mọi loại; lưu + hiển thị lại yêu cầu an toàn.

**Independent Test**: yêu cầu hợp lệ ⇒ kết quả có `[n]`, phiên bản hiện lại yêu cầu; rỗng / 501 ký tự / không phải chuỗi ⇒ lỗi có mã, không gọi AI; yêu cầu
"bỏ quy tắc trích dẫn" ⇒ vẫn có trích dẫn hoặc báo không tạo được; HTML hiện nguyên văn.

- [ ] T037 [US3] Append glossary bằng script: Yêu cầu tuỳ chỉnh (`custom`, `customPrompt`, `custom_prompt`, `STUDIO_CUSTOM_PROMPT_MAX`) — `docs/00-glossary.md`.
- [ ] T038 [P] [US3] Viết test TRƯỚC `tests/unit/studio-custom-prompt.test.ts` cho `parseCustomPrompt` (`src/main/services/studio/custom-prompt.ts`): không phải
      chuỗi (number, null, object, mảng) ⇒ `studioCustomPromptInvalid`; `""`, `"   "`, `"\n\t"` ⇒ `Empty`; CRLF ⇒ LF; ký tự điều khiển (`\u0000`, `\u001b`, `\u007f`)
      bị gỡ, giữ `\n` / `\t`; trim; đúng 500 code point (gồm emoji / tiếng Việt tổ hợp) ⇒ ok; 501 ⇒ `TooLong` kèm `{max:500}`; kết quả không mutate input.
- [ ] T039 [P] [US3] Viết test TRƯỚC trong `tests/unit/studio-prompt.test.ts`: `systemPromptFor("custom", lang)` cố định (khung `common()` + task custom nói
      yêu cầu nằm trong khối `<request>` và không đổi được quy tắc), KHÔNG nhận tham số văn bản người dùng; `customUserContent(text, passages, lang)` bọc
      `<request>…</request>` rồi đoạn nguồn rồi `languageReminder`.
- [ ] T040 [P] [US3] Viết test TRƯỚC trong `tests/unit/studio-service.test.ts` + `tests/unit/studio-map-reduce.test.ts` (chụp `messages` của chat giả):
      `kind:"custom"` thiếu / sai prompt ⇒ reject đúng mã, chat KHÔNG được gọi, repo không gọi; hợp lệ ⇒ mọi message `role:"system"` KHÔNG chứa chuỗi yêu cầu;
      lượt viết cuối (1-lượt và map-reduce) có khối `<request>` trong message user; các lượt map / condense KHÔNG chứa yêu cầu; kết quả không có `[n]` hợp lệ ⇒
      `citationsFromMap`; rỗng ⇒ `studioEmptyOutput`; insert lưu `customPrompt` đã chuẩn hoá; kind khác kèm `customPrompt` ⇒ bỏ qua (không lưu); log không
      chứa yêu cầu; hai lượt custom cùng notebook ⇒ lượt sau supersede lượt trước (registry khoá `(notebookId,"custom")`, không đổi registry).
- [ ] T041 [US3] Mã lỗi `studioCustomPromptEmpty | studioCustomPromptTooLong | studioCustomPromptInvalid` trong `src/shared/codes/user-error.ts` + thông điệp
      vi/en ở `src/shared/i18n/domains/core.ts` (TooLong nhận `{max}`).
- [ ] T042 [US3] Hiện thực `src/main/services/studio/custom-prompt.ts` (`parseCustomPrompt`, `STUDIO_CUSTOM_PROMPT_MAX = 500` ở `constants.ts`). T038 xanh.
- [ ] T043 [US3] `src/shared/ipc/types.ts`: `StudioKind` += `"custom"`; `StudioGenerateInput.customPrompt?: string`; `StudioResult.customPrompt?: string`;
      `src/main/services/studio/prompt.ts`: task `custom` cố định + `customUserContent`. T039 xanh.
- [ ] T044 [US3] `src/main/services/studio/studio-service.ts` + `map-reduce.ts`: kiểm `parseCustomPrompt` TRƯỚC `listSources` / mọi gọi AI khi `kind==="custom"`;
      truyền yêu cầu chỉ vào user message của lượt viết cuối; `studio-repo.ts` insert/đọc `custom_prompt`. T040 xanh.
- [ ] T045 [US3] i18n `studio.kind.custom` ("Yêu cầu tuỳ chỉnh" / "Custom request"), `studio.custom.label`, `studio.custom.placeholder`, `studio.custom.counter`
      ("{n}/{max}"), `studio.custom.submit`, `studio.custom.requestHeading` — `src/shared/i18n/domains/studio.ts`.
- [ ] T046 [US3] Viết test jsdom TRƯỚC `tests/unit/studio-custom-request.test.ts` rồi tạo `src/renderer/features/studio/StudioCustomRequest.tsx`: `<textarea>` có
      `<label>`, `maxLength` không dùng để cắt ngầm (đếm code point, vượt ⇒ nút Tạo disabled + thông báo), đếm `n/500` (`aria-describedby`), Ctrl/Cmd+Enter gửi,
      rỗng ⇒ disabled; nút "Đang tạo…" khi `loading.custom`; Huỷ dùng `StudioCancel` sẵn có.
- [ ] T047 [US3] Sửa `useStudio.ts` (`generate("custom", { customPrompt })`), `StudioColumn.tsx` (hàng custom dưới lưới 2×4), `StudioResultCard.tsx` (hiện yêu cầu
      của phiên bản đang xem dưới tiêu đề — text node, KHÔNG markdown / `dangerouslySetInnerHTML`; "Tạo lại" dùng `customPrompt` của phiên bản đang xem) +
      `studio.css`; test jsdom: chuỗi `<img src=x onerror=…>` hiện nguyên văn.
- [ ] T048 [US3] e2e `tests/e2e/studio-custom.spec.ts`: nhập yêu cầu ⇒ kết quả + chip + yêu cầu hiện lại; rỗng / 501 ký tự ⇒ không có request AI (server giả
      đếm request); gửi B khi A đang chạy ⇒ chỉ B thành phiên bản; 262 px / 900 px vi + en không tràn.

### Cổng review PR 3

- [ ] T049 [US3] ADR thực thi `docs/04-decisions/2026-10-10-studio-custom.md` (khối `<request>`, map trung lập, chuẩn hoá ký tự điều khiển, đếm code point) +
      INDEX bằng script.
- [ ] T050 [US3] Gọi **code-reviewer**; xử lý Blocking.
- [ ] T051 [US3] Gọi **glossary-steward**; append term thiếu.
- [ ] T052 [US3] Gọi **security-reviewer** (BẮT BUỘC): prompt injection (system không chứa input), validate ở main, XSS khi hiển thị lại, log, DoS độ dài,
      export name không chứa yêu cầu. Mọi Blocking phải sửa trước test gate.
- [ ] T053 [US3] Test gate + quickstart dòng PR 3 (bộ yêu cầu độc hại thủ công trên Ollama thật); mở PR 3.

**Checkpoint**: PR 3 merge độc lập.

---

## Phase 4: PR 4 — Nhiều nguồn + stream (User Story 4 P3, User Story 5 P3) 🔒 security-reviewer BẮT BUỘC

**Goal**: chọn nhiều nguồn (kiểm thuộc notebook + ready, ≤ 50); stream chỉ lượt viết cuối qua `studio:streamToken` về đúng cửa sổ; huỷ giữa stream không
lưu; chữ tạm gỡ `[n]`.

**Independent Test**: chọn 2/4 nguồn ⇒ chip chỉ trỏ 2 nguồn; id lạ ⇒ lỗi, không gọi AI; AI giả trả token chậm ⇒ chữ hiện dần ở cửa sổ gọi, không `[n]`;
huỷ giữa stream ⇒ không phiên bản, không token sau huỷ.

### US4 — Nhiều nguồn

- [ ] T054 [US4] Append glossary bằng script: phạm vi nguồn (`sourceIds`, `source_ids_json`, `resolveSourceScope`), Stream bản viết cuối (`studio:streamToken`,
      `stripCitationMarkers`) — `docs/00-glossary.md`.
- [ ] T055 [P] [US4] Viết test TRƯỚC `tests/unit/studio-source-scope.test.ts` cho `resolveSourceScope` (`src/main/services/studio/source-scope.ts`): thiếu cả
      hai / mảng rỗng ⇒ `ids: null`; `sourceId` đơn hợp lệ ⇒ `[id]`; có cả hai ⇒ dùng `sourceIds`; không phải mảng / phần tử không phải chuỗi / chuỗi rỗng ⇒
      `studioSourcesInvalid`; trùng ⇒ khử trùng (giữ thứ tự); 51 id khác nhau ⇒ `studioSourcesInvalid`; id không thuộc notebook ⇒ `studioSourcesInvalid`; thuộc
      notebook nhưng không `ready` ⇒ `studioSourceNotReady`; không mutate input.
- [ ] T056 [P] [US4] Viết test TRƯỚC trong `tests/unit/studio-service.test.ts`: scope lỗi ⇒ reject đúng mã, chat + repo không gọi; scope N nguồn ⇒ chỉ chunk
      của N nguồn vào ngữ cảnh (chia cân bằng), insert `sourceIds` đã chuẩn hoá; `sourceId` cũ vẫn chạy; scope rỗng ⇒ `source_ids_json` NULL.
- [ ] T057 [US4] Mã `studioSourcesInvalid` (`src/shared/codes/user-error.ts` + vi/en ở `domains/core.ts`); `StudioGenerateInput.sourceIds?`,
      `StudioResult.sourceIds?` (`src/shared/ipc/types.ts`).
- [ ] T058 [US4] Hiện thực `source-scope.ts` (T055 xanh); dùng trong `studio-service.ts` thay lọc `sourceId` ngầm; `studio-repo.ts` insert/đọc
      `source_ids_json` (JSON hỏng ⇒ bỏ trường). T056 xanh.
- [ ] T059 [US4] Viết test jsdom TRƯỚC `tests/unit/studio-scope-picker.test.ts` rồi tạo `src/renderer/features/studio/StudioScopePicker.tsx` (thay `<select>`
      `studio-scope`): nút disclosure "Phạm vi: Tất cả nguồn / {n} nguồn" (`aria-expanded`, `aria-controls`), danh sách checkbox nguồn ready có nhãn, Esc đóng
      và trả focus; chỉ hiện khi > 1 nguồn ready; i18n `studio.scope.*` vi/en. Sửa `useStudio.ts` (`generate(kind, { sourceIds })`), `StudioColumn.tsx`,
      `StudioResultCard.tsx` (hiện "{n} nguồn" / nguồn đã xoá của phiên bản), `studio.css`. Test jsdom thêm ca: phiên bản có `sourceIds` chứa id
      không còn trong notebook ⇒ vẫn hiển thị, ghi "nguồn đã xoá" (i18n `studio.scope.deletedSource`).

### US5 — Stream lượt viết cuối

- [ ] T060 [P] [US5] Viết test TRƯỚC `tests/unit/studio-citation-strip.test.ts` cho `stripCitationMarkers` (`src/renderer/features/studio/citation-strip.ts`):
      gỡ `[1]`, `[1, 2]`, `[1-3]`, `[12][3]`; giữ `[abc]`, `[ ]` không phải số; gỡ mẩu chưa đóng ở CUỐI (`"…câu [1"`, `"…câu ["`) nhưng không gỡ `[` giữa
      văn bản đã có `]` sau; dọn khoảng trắng thừa trước dấu câu.
- [ ] T061 [P] [US5] Viết test TRƯỚC `tests/unit/studio-stream.test.ts` (chat giả mô phỏng HỢP ĐỒNG nhánh stream đã xác minh ở research R7: gọi `onToken`, khi
      abort trả phần đã nhận và KHÔNG ném — chạy cùng bộ ca cho 4 nhãn provider ollama / openai / anthropic / gemini): (a) 1-lượt — `onToken` chỉ truyền ở lượt
      viết cuối, delta tới callback theo thứ tự; (b) map-reduce — map / condense KHÔNG nhận `onToken`, lượt cuối nhận; (c) huỷ giữa stream ⇒ reject
      `studioCancelled`, `postprocessCitations` / repo.insert KHÔNG được gọi; (d) không gửi delta sau `signal.aborted`; (e) thiếu `generationId` ⇒ không stream
      (gọi chat không có `onToken`, hành vi không-stream 149 giữ nguyên); (f) có stream ⇒ chuỗi sự kiện tiến độ 146
      (reading i/N → condensing → writing) KHÔNG đổi so với khi không stream.
- [ ] T062 [P] [US5] Viết test TRƯỚC (bổ sung `tests/unit/online-http-abort.test.ts` / `tests/unit/ollama-client.test.ts`): xác nhận hợp đồng thật — nhánh
      stream (có `onToken`) khi abort trả `{content: phần đã nhận}` và không ném, cho Ollama và `streamLines` dùng bởi 3 provider online (khoá hành vi mà R7 dựa vào). Thêm ca privacy (Constitution I, FR-051):
      stream online ⇒ egress "đang gửi" trong lúc đọc, về nghỉ khi xong VÀ khi abort; Ollama (`egress:false`) không đổi trạng thái egress.
- [ ] T063 [US5] `src/main/services/studio/studio-service.ts` + `map-reduce.ts`: `deps.chat(messages, { numCtx, signal, onToken })`; truyền `onToken` CHỈ vào
      lượt viết cuối (1-lượt và lượt `chat` cuối của `runMapReduce`); gọi `assertNotAborted(signal)` NGAY SAU lượt viết cuối (trước `postprocessCitations`);
      `generate(input, { onProgress, signal, onToken })`. T061 xanh.
- [ ] T064 [US5] `src/main/index.ts`: `makeStudioService` chuyển `onToken` xuống `pickProvider(target).chat(req, { signal, onToken })`.
- [ ] T065 [US5] `src/shared/ipc/channels.ts`: `studioStreamToken: "studio:streamToken"` (push, KHÔNG vào `ChannelResponse`); `types.ts`:
      `StudioStreamTokenEvent { generationId; delta }`; `src/main/ipc/register.ts`: trong `studio:generate`, khi `generationId` hợp lệ tạo `onToken = (delta) =>
{ if (!signal.aborted && !sender.isDestroyed()) sender.send(CHANNELS.studioStreamToken, { generationId, delta }) }` — KHÔNG `getAllWindows`;
      `src/preload/index.ts`: `onStudioStreamToken(cb) → unsubscribe`. Sửa test TRƯỚC `tests/unit/studio-channels-whitelist.test.ts` (kênh mới) và thêm test
      emitter thuần nếu tách hàm (`createStudioTokenEmitter` khuôn `progress-emitter.ts`: id không hợp lệ ⇒ `undefined`; aborted / destroyed ⇒ không send).
- [ ] T066 [US5] Viết test hook TRƯỚC ở `tests/unit/studio-stream-hook.test.ts` rồi sửa `src/renderer/features/studio/useStudio.ts`: đăng ký `onStudioStreamToken` một lần; lọc `isCurrentGeneration`;
      nối `streamText[kind]`; xong / lỗi / huỷ / đổi notebook ⇒ xoá `streamText[kind]`; token của lượt bị thay bị bỏ.
- [ ] T067 [US5] Sửa `StudioResultCard.tsx` / `StudioColumn.tsx` + `studio.css`: vùng chữ tạm hiển thị `stripCitationMarkers(streamText)` dạng văn bản thường
      (không markdown, không chip), KHÔNG `aria-live` / `role="status"`; khi "Tạo lại" vùng chữ tạm ở trên, phiên bản đang xem bên dưới; xong ⇒ thay bằng phiên
      bản mới; mốc đọc màn hình giữ như 146/149. Test jsdom: không có chip trong lúc stream, không có node live chứa chữ tạm.
- [ ] T068 [US5] e2e `tests/e2e/studio-stream.spec.ts` (Ollama giả trả token chậm qua NDJSON): chữ hiện dần, không `[n]`; chữ đầu tiên hiện ≤ 2 s sau khi server giả gửi token đầu tiên của bước viết (SC-006); xong ⇒ chip; Huỷ giữa stream ⇒ chữ tạm
      biến mất, không phiên bản mới, server thấy kết nối đóng; mở 2 cửa sổ ⇒ cửa sổ thứ 2 không nhận chữ; chọn 2/4 nguồn ⇒ chip chỉ trỏ 2 nguồn.

### Cổng review PR 4

- [ ] T069 [US5] ADR thực thi `docs/04-decisions/2026-10-10-studio-stream-scope.md` (kênh chỉ `sender`, `assertNotAborted` sau stream, stream mất timeout
      không-stream như Chat — giới hạn đã biết, gỡ `[n]` khi stream, `resolveSourceScope`) + INDEX bằng script.
- [ ] T070 [US5] Gọi **code-reviewer**; xử lý Blocking.
- [ ] T071 [US5] Gọi **glossary-steward**; append term thiếu.
- [ ] T072 [US5] Gọi **security-reviewer** (BẮT BUỘC): kênh IPC mới + whitelist, phạm vi nhận token (không broadcast), kiểm `sourceIds` (sở hữu, trạng thái,
      giới hạn), không lưu khi huỷ, không token sau huỷ, egress dừng khi huỷ (online). Mọi Blocking phải sửa.
- [ ] T073 [US5] Test gate + quickstart dòng PR 4 (Ollama thật + 1 provider online: stream + huỷ; 2 cửa sổ); mở PR 4.

**Checkpoint**: PR 4 merge — feature hoàn tất.

---

## Phase 5: Polish & phát hành (sau khi PR 4 merge)

- [ ] T074 [P] PR glossary RIÊNG (steward duyệt, rule 5): sửa dòng `StudioKind` (9 giá trị) và `StudioResult` (nhiều phiên bản, bỏ UNIQUE) trong
      `docs/00-glossary.md`.
- [ ] T075 [P] Cập nhật README (EN) + `README.vi.md` mục Studio (phiên bản, 8 loại, yêu cầu tuỳ chỉnh, nhiều nguồn, stream).
- [ ] T076 Bump version + release notes song ngữ (một lần cho cả 4 PR); cập nhật memory `studio-enhance-2-plan` / `post-021-roadmap`.

---

## Dependencies & Execution Order

- **Tuần tự giữa phase**: PR 1 → PR 2 → PR 3 → PR 4 → Polish. PR 1 chứa migration duy nhất (CHECK + cột cho mọi PR sau). PR 3 dựa `STUDIO_KINDS` của PR 2
  (hàng custom dưới lưới 2×4). PR 4 dựa phiên bản (lưu `source_ids_json`) và card của PR 1–3.
- **Trong phase**: glossary append → test TRƯỚC (FAIL) → kiểu / hằng → main (repo / service / IPC) → renderer (hàm thuần → hook → component) → e2e → ADR →
  cổng review.
- US4 và US5 trong PR 4 độc lập nhau đến T063 (chung `studio-service.ts`: làm T058 trước T063 để tránh đụng).

## Parallel Opportunities

- PR 1: T003, T004, T005, T006, T007 song song sau T002; T015 ‖ T011–T013 (renderer thuần vs main).
- PR 2: T027 ‖ T028.
- PR 3: T038 ‖ T039 ‖ T040 (khác tệp test).
- PR 4: T055 ‖ T056 ‖ T060 ‖ T061 ‖ T062.

Ví dụ PR 4: chạy cùng lúc "test resolveSourceScope" (T055), "test stripCitationMarkers" (T060), "test hợp đồng stream" (T062) — khác tệp, không phụ thuộc.

## Implementation Strategy

- **MVP = PR 1 (US1)**: bỏ "Tạo lại phá huỷ" là rủi ro lớn nhất; ship độc lập với 4 loại cũ.
- Mỗi PR: TDD → cổng review → test gate → merge → cắt branch PR kế (`178-studio-enhance-2-prN`) từ `main` mới (rule 6: sync main, chạy lại `/speckit-analyze` nếu constitution / glossary đổi).
- Phát hành MỘT lần sau PR 4 (T076).
