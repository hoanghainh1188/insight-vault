# Implementation Plan: Studio đợt 2 — lịch sử phiên bản, 4 loại mới, yêu cầu tuỳ chỉnh, nhiều nguồn + stream

**Branch**: `178-studio-enhance-2` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/20261010-070229-studio-enhance-2/spec.md`; quyết định `docs/04-decisions/2026-10-10-studio-enhance-2-clarify.md`; intake
`docs/intake/178-studio-enhance-2.md`; kế thừa 025 (export, scope), 098 (AI cục bộ), 105 (map-reduce), 123 (i18n), 146 (tiến độ), 149 (huỷ, sổ lượt).

## Summary

Giao **4 PR theo thứ tự, mỗi PR ship độc lập**, một spec:

1. **PR 1 — Phiên bản**: migration **v11 (duy nhất của feature)** dựng lại `studio_result` (bỏ UNIQUE, CHECK 9 kind, +5 cột `custom_prompt`,
   `source_ids_json`, `parts`, `truncated`, `local`); repo insert + dọn trần 10 trong giao dịch; `studio:list` trả mọi phiên bản; invoke
   `studio:deleteVersion`; renderer `versions` + `selected` + bộ chọn/xoá phiên bản trên card; ghi chú N phần / đã cắt / AI cục bộ đọc từ phiên bản.
2. **PR 2 — 4 loại mới** `studyGuide | briefing | timeline | keyTerms`: `StudioKind`, `STUDIO_KINDS`, `task()`, i18n, lưới 2×4.
3. **PR 3 — `custom`**: `parseCustomPrompt` ở main (≤ 500), yêu cầu chỉ ở user message trong khối `<request>` của lượt viết cuối; hàng nhập riêng dưới lưới;
   lưu `custom_prompt`; "Tạo lại" dùng prompt của phiên bản đang xem. **security-reviewer bắt buộc.**
4. **PR 4 — Nhiều nguồn + stream**: `resolveSourceScope` (≤ 50, thuộc notebook + ready); bộ chọn nhiều nguồn; `onToken` chỉ ở lượt viết cuối,
   `assertNotAborted` **ngay sau** lượt stream; kênh push `studio:streamToken` chỉ về `sender`; chữ tạm gỡ `[n]`. **security-reviewer bắt buộc.**

Không đổi thuật toán map-reduce, hậu kiểm `[n]`, tiến độ 146, huỷ 149.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Electron 43 (Node 22, `node:sqlite` `DatabaseSync`), React 18

**Primary Dependencies**: có sẵn — không thêm dependency.

**Storage**: SQLite `studio_result` — migration v11 (rebuild, xem [research R1](./research.md)); `PRAGMA foreign_keys = ON` toàn cục, không tắt trong giao
dịch (no-op) và không cần (bảng con, không bảng nào tham chiếu). Schema guard của vault-backup tự khớp v11.

**Testing**: vitest (unit + jsdom), Playwright e2e với Ollama giả HTTP. Test mới/sửa: `migration-studio-versions`, `studio-repo`, `studio-service`,
`studio-map-reduce`, `studio-prompt`, `studio-custom-prompt`, `studio-source-scope`, `studio-stream` (+ provider giả mô phỏng hợp đồng abort của Ollama /
OpenAI / Anthropic / Gemini), `studio-citation-strip`, `studio-versions` (hàm thuần renderer), `studio-channels-whitelist`, `useStudio` hooks, card/column jsdom,
catalog i18n vi↔en, vault-backup v10→v11; e2e `studio-versions`, `studio-kinds-layout`, `studio-custom`, `studio-stream`.

**Target Platform**: macOS arm64 + Windows x64.

**Project Type**: desktop-app (Electron main / preload / renderer).

**Performance Goals**: chữ đầu tiên hiện trong vài giây sau khi bước viết bắt đầu (SC-006); `studio:list` ≤ 90 dòng; insert + dọn trần một giao dịch.

**Constraints**: không egress mới; không log nội dung / yêu cầu / id; yêu cầu tuỳ chỉnh không vào system prompt; token chỉ về cửa sổ gọi; huỷ ⇒ không lưu; UI
vừa 262 px ở vi + en; `prefers-reduced-motion`.

**Scale/Scope**: 9 kind × ≤ 10 phiên bản / notebook; ≤ 50 nguồn được chọn; ≤ 12 phần map-reduce (không đổi).

Không còn NEEDS CLARIFICATION (R1–R10 ở [research.md](./research.md)).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                     | Đánh giá                                                                                                                                                                                                                                                                  | Sau Phase 1 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| I. Local-first                 | Không kết nối mới; loại mới / custom / nhiều nguồn vẫn qua `pickProvider(target)`; stream dùng nhánh stream sẵn có của provider; huỷ ngắt fetch (đã xác minh cả 4 provider, R7).                                                                                          | ✅          |
| II. Verifiable Citations       | Mọi loại + `custom` qua `postprocessCitations` / `citationsFromMap` / `studioEmptyOutput`; system prompt giữ khung `[n]`; chữ stream gỡ `[n]` (không hiển thị trích dẫn chưa kiểm); phiên bản giữ citations.                                                              | ✅          |
| III. Desktop Security Boundary | Kênh mới whitelist + preload; main kiểm `customPrompt` (kiểu, chuẩn hoá, ≤ 500), `sourceIds` (kiểu, ≤ 50, thuộc notebook, ready), `deleteVersion` (khớp notebook); token chỉ `sender`; text node khi hiển thị lại; log không nội dung. **security-reviewer PR 3 + PR 4.** | ✅ contract |
| IV. Test-First & Coverage      | Hàm thuần (repo trần, migration, parseCustomPrompt, resolveSourceScope, stripCitationMarkers, groupVersions/currentVersion/afterDelete) test trước; ≥ 80% logic nghiệp vụ.                                                                                                | ✅          |
| V. Phased Delivery             | Hoàn thiện Studio (Pha 1); 4 PR tuần tự, mỗi PR ship được.                                                                                                                                                                                                                | ✅          |
| Terminology                    | Append glossary (PR tương ứng): phiên bản kết quả Studio, trần phiên bản, 4 loại mới (`keyTerms` ≠ glossary dự án), yêu cầu tuỳ chỉnh, phạm vi nguồn, `studio:streamToken`. Sửa dòng `StudioKind`/`StudioResult` ⇒ PR glossary riêng.                                     | ✅          |

Thay một phần ADR 021 #4/#6 và 146/149 "ngoài phạm vi stream" — đã ghi ở ADR clarify; mỗi PR thêm ADR thực thi ngắn nếu có quyết định triển khai mới.

## Project Structure

### Documentation (this feature)

```text
specs/20261010-070229-studio-enhance-2/
├── plan.md · research.md · data-model.md · quickstart.md · contracts/studio-ipc.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (theo PR)

```text
# PR 1 — phiên bản (+ migration v11 duy nhất)
src/main/db/migrations.ts                       # SỬA — append v11 (rebuild studio_result, 5 cột mới, 2 index)
src/main/services/studio/constants.ts           # SỬA — STUDIO_MAX_VERSIONS = 10, STUDIO_ALL_KINDS (9, khớp CHECK)
src/main/services/studio/studio-repo.ts         # SỬA — insert + dọn trần (giao dịch), listByNotebook (mọi bản), listVersions, deleteVersion; đọc parts/truncated/local
src/main/services/studio/studio-service.ts      # SỬA — upsert → insert({parts, truncated, local: target==="local"}); deleteVersion
src/shared/ipc/{types,channels}.ts              # SỬA — StudioResult.local?, StudioDeleteVersionInput, studio:deleteVersion
src/main/ipc/register.ts · src/preload/index.ts # SỬA — studio:deleteVersion (kiểm kiểu), preload studioDeleteVersion
src/renderer/features/studio/studio-versions.ts # MỚI (thuần) — groupVersions, currentVersion, afterDelete, versionLabel
src/renderer/features/studio/useStudio.ts       # SỬA — versions/selected, select, deleteVersion; bỏ localKinds
src/renderer/features/studio/StudioVersionPicker.tsx # MỚI — chọn phiên bản (select có nhãn) + nút xoá + xác nhận
src/renderer/features/studio/StudioResultCard.tsx · StudioColumn.tsx · studio.css # SỬA
src/shared/i18n/domains/{studio,a11y}.ts        # SỬA — studio.versions.*, a11y.studioVersionDeleted
tests/unit/migration-studio-versions.test.ts (mới), studio-repo, studio-service, studio-versions (mới), studio-channels-whitelist, useStudio/card jsdom, vault-backup
tests/e2e/studio-versions.spec.ts

# PR 2 — 4 loại mới
src/shared/ipc/types.ts                         # StudioKind += studyGuide|briefing|timeline|keyTerms
src/main/services/studio/{constants,prompt}.ts  # STUDIO_KINDS 8 loại; task() 4 chỉ dẫn + nhãn mục theo ngôn ngữ
src/renderer/features/studio/StudioColumn.tsx · studio.css # KINDS 8, lưới 2×4, nhãn xuống dòng
src/shared/i18n/domains/studio.ts               # studio.kind.{studyGuide,briefing,timeline,keyTerms}
tests/unit/studio-prompt, studio-service (loại mới qua 1-lượt + map-reduce), i18n catalog; tests/e2e/studio-kinds-layout.spec.ts

# PR 3 — custom (security-reviewer)
src/main/services/studio/custom-prompt.ts       # MỚI (thuần) — parseCustomPrompt, STUDIO_CUSTOM_PROMPT_MAX = 500
src/main/services/studio/{prompt,studio-service,map-reduce}.ts # task("custom") cố định; khối <request> chỉ ở user message lượt viết cuối
src/shared/codes/user-error.ts (+ i18n core)    # studioCustomPromptEmpty | TooLong | Invalid
src/shared/ipc/types.ts                         # StudioKind += custom; StudioResult.customPrompt?; StudioGenerateInput.customPrompt?
src/renderer/features/studio/StudioCustomRequest.tsx # MỚI — textarea có nhãn + đếm n/500 + nút Tạo
src/renderer/features/studio/{useStudio,StudioColumn,StudioResultCard}.tsx # generate(custom, prompt); card hiện yêu cầu (text node); Tạo lại dùng prompt bản đang xem
tests/unit/studio-custom-prompt (mới), studio-service (messages chụp: system không chứa yêu cầu), studio-map-reduce, jsdom; tests/e2e/studio-custom.spec.ts

# PR 4 — nhiều nguồn + stream (security-reviewer)
src/main/services/studio/source-scope.ts        # MỚI (thuần) — resolveSourceScope (≤ 50, thuộc notebook, ready)
src/main/services/studio/{studio-service,map-reduce}.ts # scope; onToken chỉ lượt viết cuối; assertNotAborted NGAY SAU lượt stream
src/main/index.ts                               # deps.chat chuyển onToken xuống provider.chat
src/main/ipc/register.ts · src/preload/index.ts # studio:streamToken qua sender (bỏ khi aborted/destroyed); onStudioStreamToken
src/shared/ipc/{types,channels}.ts · src/shared/codes/user-error.ts # sourceIds?, StudioStreamTokenEvent, studioSourcesInvalid
src/renderer/features/studio/citation-strip.ts  # MỚI (thuần) — stripCitationMarkers (kể cả mẩu chưa đóng)
src/renderer/features/studio/StudioScopePicker.tsx # MỚI — disclosure + checkbox nguồn ("Tất cả nguồn" / "N nguồn")
src/renderer/features/studio/{useStudio,StudioColumn,StudioResultCard}.tsx · studio.css # streamText theo lượt hiện hành; vùng chữ tạm
tests/unit/studio-source-scope, studio-stream (huỷ giữa stream ⇒ repo không gọi; 4 provider giả), studio-citation-strip, whitelist, hooks; tests/e2e/studio-stream.spec.ts

docs/00-glossary.md (append theo PR) · docs/04-decisions/ (ADR thực thi nếu có + INDEX)
```

**Structure Decision**: mọi quyết định (trần, chuẩn hoá yêu cầu, phạm vi nguồn, gỡ `[n]`, chọn phiên bản) là hàm thuần có test; I/O mỏng ở repo / IPC /
preload / `index.ts`; component trình bày tách riêng. Code nằm trong vùng feature Studio có sẵn (`src/main/services/studio/`,
`src/renderer/features/studio/`); vùng dùng chung chỉ chạm `types.ts`, `channels.ts`, `user-error.ts`, i18n, `migrations.ts`, `register.ts`, preload.

## Phase 0 — Research

[research.md](./research.md): R1 migration v11 + FK · R2 repo trần · R3 list/renderer · R4 loại mới · R5 custom · R6 nhiều nguồn · R7 stream abort (đã xác minh
cả 4 provider) · R8 kênh token · R9 metadata phiên bản · R10 kiểm thử.

## Phase 1 — Design

[data-model.md](./data-model.md) · [contracts/studio-ipc.md](./contracts/studio-ipc.md) · [quickstart.md](./quickstart.md)

### Thứ tự thực hiện (mỗi PR: TDD → code → code-reviewer → glossary-steward → [security-reviewer] → test gate → PR)

1. **PR 1**: test migration v11 (dữ liệu v10 giữ nguyên, CHECK, cascade, `foreign_key_check`, vault v10→v11) → v11 → repo (insert/trần/list/delete) →
   service + IPC `deleteVersion` + whitelist → hàm thuần `studio-versions` → `useStudio` → `StudioVersionPicker` + card (ghi chú từ phiên bản) → i18n → e2e.
2. **PR 2**: `StudioKind` + `STUDIO_KINDS` → `task()` (test chuỗi theo vi/en) → i18n → lưới 2×4 (jsdom + e2e 262/900 px vi/en).
3. **PR 3**: `parseCustomPrompt` (TDD bảng ca: rỗng, khoảng trắng, CRLF, ký tự điều khiển, 500/501 code point, emoji, không phải chuỗi) → prompt + service +
   map-reduce (test chụp `messages`) → mã lỗi + i18n → `StudioCustomRequest` + card → e2e → **security-reviewer**.
4. **PR 4**: `resolveSourceScope` (TDD) → service scope + lưu `source_ids_json` → `stripCitationMarkers` (TDD) → `onToken` + `assertNotAborted` sau stream
   (test: provider giả trả phần dở khi abort ⇒ `studioCancelled`, repo không gọi, không token sau abort) → kênh + preload + whitelist → `StudioScopePicker` +
   vùng chữ tạm → e2e (stream + huỷ, 2 cửa sổ) → **security-reviewer**.
5. Sau PR 4: phát hành một lần (bump version + release notes song ngữ).

## Complexity Tracking

| Điểm                                           | Vì sao cần                                                    | Phương án đơn giản hơn bị loại vì                                              |
| ---------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Migration rebuild bảng (thay vì ADD COLUMN)    | SQLite không bỏ được UNIQUE/CHECK bằng ALTER                  | ADD COLUMN giữ UNIQUE ⇒ không có lịch sử                                       |
| 5 cột mới thay vì 2 như plan duyệt ban đầu     | G4 (clarify): ghi chú/nhãn gắn phiên bản, tránh migration v12 | 2 cột ⇒ mất ghi chú khi xem bản cũ                                             |
| Lượt viết cuối stream mất timeout không-stream | Hành vi sẵn có của nhánh stream (giống Chat 039); có Huỷ 149  | Thêm idle-timeout cho stream ⇒ đổi provider dùng chung với Chat, ngoài phạm vi |
