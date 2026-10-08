---
description: "Task list — 123 i18n (Tiếng Việt + English), AI trả lời theo ngôn ngữ câu hỏi"
---

# Tasks: Giao diện đa ngôn ngữ (Tiếng Việt + English), AI trả lời theo ngôn ngữ câu hỏi

**Input**: `specs/20261008-002646-i18n/` (plan.md, spec.md, research.md, data-model.md, contracts/{i18n-core,ipc-ui-language,codes}.md, quickstart.md); quyết định `docs/04-decisions/2026-10-08-i18n-clarify.md`.

**Tests**: BẮT BUỘC (Constitution IV + yêu cầu TDD) — mọi hàm thuần viết test trước, chạy thấy FAIL rồi mới implement.

**Organization**: theo lớp commit của plan (khung → ngôn ngữ + Cài đặt → renderer → main → lời nhắc → English + quét + e2e → docs), mỗi task gắn user story của spec: US1 English lần đầu (P1) · US2 đổi ngôn ngữ áp dụng ngay + dữ liệu cũ (P1) · US3 AI trả lời theo ngôn ngữ câu hỏi (P2) · US4 Studio theo ngôn ngữ giao diện (P3) · US5 định dạng (P3). Commit theo phase.

**Quy ước:** KHÔNG chạy prettier lên `docs/00-glossary.md`, `docs/04-decisions/INDEX.md`, `tests/eval/corpus/`, `tests/eval/questions.json`. Hook block-no-verify: không đặt cờ `-n` chung lệnh `git commit`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1–US5 như trên

---

## Phase 1: Setup

- [X] T001 Thêm `src/shared/i18n/**`, `src/shared/codes/**`, `src/main/services/ui-language/**`, `src/renderer/shared/i18n/i18n-context.ts`, `src/renderer/shared/i18n/describe-error.ts` vào `coverage.include` trong `vitest.config.ts`
- [X] T002 [P] Tạo thư mục `tests/unit/helpers/` (nếu chưa có) và tệp rỗng chờ `tests/unit/helpers/t-vi.ts`

---

## Phase 2: Foundational — khung dịch + mã (lớp 1) — chặn mọi story

**Mục tiêu:** khung `src/shared/i18n` + `src/shared/codes` thuần, có test; chưa đổi hành vi app.

- [X] T003 [P] Viết test FAIL `tests/unit/i18n-resolve-language.test.ts`: `parseUiLanguage` (auto/vi/en giữ; null, "", "fr", 1, {} ⇒ auto) và `resolveLanguage` (vi|en giữ; auto + `vi`, `vi-VN`, `VI_vn`, `vi-Latn` ⇒ vi; `en-US`, `de-DE`, `""`, `undefined` ⇒ en) theo `contracts/i18n-core.md`
- [X] T004 Tạo `src/shared/i18n/languages.ts` (`LanguageCode`, `UiLanguagePreference`, `LANGUAGES` với `nativeName`/`intlLocale` vi-VN, en-US, `SOURCE_LANGUAGE="vi"`) và `src/shared/i18n/resolve-language.ts` cho T003 xanh
- [X] T005 [P] Viết test FAIL `tests/unit/i18n-translate.test.ts` với catalog giả nhỏ (tiêm vào `createTranslatorFrom(catalogs, lang)`): tra khoá lồng, nội suy `{name}` (số + chuỗi), placeholder thiếu tham số giữ `{name}`, tham số chứa `<b>` trả nguyên văn (không HTML), fallback khoá thiếu ⇒ vi ⇒ chính khoá, `plural` one/other theo `Intl.PluralRules` (en: 1 ⇒ one, 2 ⇒ other; vi ⇒ other), `{count}` tự có
- [X] T006 Tạo `src/shared/i18n/translate.ts` (`createTranslatorFrom`, `createTranslator(lang)` dùng catalog thật, kiểu `MessageKey`/`PluralKey`/`ParamsOf` suy từ `vi.ts` bằng template literal types) cho T005 xanh
- [X] T007 Tạo `src/shared/i18n/vi.ts` (`as const`) khởi đầu với nhóm khoá dùng ở Phase 3 (`settings.language.*`, `common.*`, `errors.unexpected`) và `src/shared/i18n/en.ts` (`export const en: Messages`) tương ứng; `src/shared/i18n/index.ts` re-export
- [X] T008 [P] Viết test FAIL `tests/unit/i18n-catalog.test.ts`: tập khoá lá vi = en; tập placeholder mỗi khoá bằng nhau; lá plural có `one`+`other` ở mọi ngôn ngữ; không chuỗi rỗng; không chứa `<`; mọi `LANGUAGES[].code` có catalog — rồi chỉnh T007 cho xanh
- [X] T009 [P] [US5] Viết test FAIL `tests/unit/i18n-format.test.ts`: `formatDateTime` (vi-VN/en-US medium+short), `formatNumber`, `formatBytes` (0 B, 1023 B, 1,5 KB vs 1.5 KB, MB, GB), `isoDate` ổn định, `formatRelativeTime` giữ đúng các bucket và chuỗi vi hiện có của `tests/unit/relative-time.test.ts` (vừa xong, N phút trước, hôm qua, tuần trước, dd/mm/yyyy) + bản en ("just now", "3 minutes ago", "yesterday", "last week", ngày ngắn en-US)
- [X] T010 [US5] Tạo `src/shared/i18n/format.ts` + khoá `time.*` trong `vi.ts`/`en.ts` cho T009 xanh
- [X] T011 [P] [US3] Viết test FAIL `tests/unit/i18n-detect-language.test.ts` (research R10): câu vi có dấu ⇒ vi; vi không dấu ⇒ undefined; câu English ≥ 3 từ ⇒ en; "Q3 2024?" / "Hà Nội" / "OK" ⇒ undefined; câu trộn ưu tiên mật độ dấu; bỏ `[n]`, URL, số
- [X] T012 [US3] Tạo `src/shared/i18n/detect-language.ts` (`detectQuestionLanguage`) cho T011 xanh
- [X] T013 [P] [US2] Viết test FAIL `tests/unit/codes-source-error.test.ts`: `normalizeSourceErrorCode` — 11 mã hợp lệ giữ; 7 văn bản Việt cũ (data-model.md) ⇒ mã; 3 nhãn xử lý lại cũ ⇒ mã; null/"" ⇒ null; giá trị lạ ⇒ `unknown`; `LEGACY_SOURCE_ERROR_LABELS` đủ 10 mục
- [X] T014 [US2] Tạo `src/shared/codes/source-error.ts` cho T013 xanh
- [X] T015 [P] [US1] Viết test FAIL `tests/unit/codes-user-error.test.ts`: `UserFacingError` giữ code/params; `encodeUserError` chỉ ASCII; `parseIpcError` (mở rộng) trên chuỗi có tiền tố Electron "Error invoking remote method 'x': Error: " ⇒ `{code, params}`; params base64 hỏng/khác kiểu/quá 200 ký tự ⇒ bỏ params, giữ code; mã lạ ⇒ không code; thẻ online 098 cũ vẫn ra `onlineKind`; tách `provider` từ tiền tố "Claude (Anthropic): …"
- [X] T016 [US1] Tạo `src/shared/codes/user-error.ts` và mở rộng `src/shared/online-error-tag.ts` (`ParsedIpcError` thêm `code`, `params`, `provider`) cho T015 xanh; test cũ `tests/unit/online-error-tag*.test.ts` vẫn xanh
- [X] T017 [P] Tạo `tests/unit/helpers/t-vi.ts` export `tVi = createTranslator("vi").t` và `tEn` tương tự
- [X] T018 Chạy `npm run lint` + `npm test`; commit "feat(123): khung i18n dùng chung + mã thay chuỗi (lớp 1)"

**Checkpoint:** khung dịch, định dạng, nhận diện ngôn ngữ, mã lỗi có test xanh; app chưa đổi hành vi.

---

## Phase 3: User Story 2 (P1) — ngôn ngữ giao diện: lưu, hiệu lực, IPC, provider, Cài đặt › Ngôn ngữ (lớp 2)

**Goal:** người dùng chọn Tự động/Tiếng Việt/English trong Cài đặt; lựa chọn lưu bền; renderer cập nhật ngay qua sự kiện.

**Independent Test:** unit service + IPC whitelist; jsdom `SettingsLanguageSection` đổi lựa chọn ⇒ gọi `setUiLanguage`, sự kiện ⇒ `<html lang>` và chuỗi trong cây đổi.

- [ ] T019 [P] [US2] Viết test FAIL `tests/unit/ui-language-service.test.ts`: store trống ⇒ `{preference:"auto", effective theo osLocale}`; `set("en")` lưu khoá `uiLanguage`, phát `onChange` đúng một lần; `set("en")` lặp lại không phát; `set("fr")`/`set(1)` ném, không ghi; giá trị hỏng trong store ⇒ auto; `IV_UI_LANG` ghi đè osLocale khi `isPackaged=false`, bỏ qua khi `true`; `translator()` theo effective; `startupLanguage(osLocale)`; thêm ca vào `tests/unit/vault-backup-hardening.test.ts`: `sanitizeConfig` bỏ khoá `uiLanguage` (FR-005 — ngôn ngữ không đi theo sao lưu/khôi phục)
- [ ] T020 [US2] Tạo `src/main/services/ui-language/ui-language.ts` + `index.ts` (`createUiLanguageService({store, osLocale, envOverride, isPackaged})`, `startupLanguage`) cho T019 xanh
- [ ] T021 [P] [US2] Viết test FAIL `tests/unit/ui-language-whitelist.test.ts` (mẫu `tests/unit/crash-report-whitelist.test.ts`): 3 kênh `app:getUiLanguage`, `app:setUiLanguage`, `app:uiLanguageChanged` có trong `CHANNELS`, 2 kênh invoke trong `WHITELISTED_CHANNELS`; kiểu `UiLanguageState` trong `ChannelResponse`
- [ ] T022 [US2] Thêm kênh + kiểu `UiLanguageState` vào `src/shared/ipc/channels.ts` và `src/shared/ipc/types.ts`; đăng ký `safeHandle` ở `src/main/ipc/register.ts` (set kiểm enum qua service); khởi tạo service ở `src/main/index.ts` (osLocale = `app.getPreferredSystemLanguages()[0] ?? app.getLocale()`, `IV_UI_LANG` chỉ khi `!app.isPackaged`) và phát `app:uiLanguageChanged` tới mọi `BrowserWindow` (mẫu `onPrivacyChange` ≈ dòng 581); expose `getUiLanguage`/`setUiLanguage`/`onUiLanguageChanged` ở `src/preload/index.ts` — T021 xanh
- [ ] T023 [P] [US2] Viết test FAIL jsdom `tests/unit/i18n-provider.test.ts`: `useT()` không provider ⇒ tiếng Việt; trong `I18nProvider` với `window.api` giả: mount gọi `getUiLanguage`, hiển thị theo `effective`; sự kiện `onUiLanguageChanged` ⇒ re-render ngôn ngữ mới + `document.documentElement.lang` đổi; unmount huỷ đăng ký; đổi ngôn ngữ khi `ChatColumn` đang stream (`window.api` giả phát token) ⇒ stream không bị huỷ, nội dung đã nhận giữ nguyên, chỉ chrome đổi ngôn ngữ (FR-004, edge case)
- [ ] T024 [US2] Tạo `src/renderer/shared/i18n/i18n-context.ts` (context + `useT`, `useLang`, `useFormat`, fallback vi) và `src/renderer/shared/i18n/I18nProvider.tsx`; bọc `I18nProvider` ngoài `RouterProvider` trong `src/renderer/main.tsx` — T023 xanh
- [ ] T025 [P] [US2] Viết test FAIL jsdom `tests/unit/settings-language-section.test.ts`: 3 lựa chọn (radio native trong `fieldset`/`legend`) nhãn `Tự động` + tên tự xưng `Tiếng Việt`/`English` (không đổi theo ngôn ngữ hiện tại); chọn ⇒ `window.api.setUiLanguage(pref)`; lựa chọn hiện tại được `checked`; lỗi IPC ⇒ thông báo `errors.unexpected`
- [ ] T026 [US2] Tách trang Cài đặt khỏi `src/renderer/app/routes.tsx` thành `src/renderer/app/SettingsPage.tsx` (giữ `data-testid="placeholder-settings"`, `<h2>` qua `t`), tạo `src/renderer/features/app-shell/SettingsLanguageSection.tsx` theo markup `settings-ai`/`settings-ai-head` (đặt đầu trang); thêm khoá `settings.title`, `settings.language.*` — T025 xanh
- [ ] T027 [US2] Chạy `npm run lint` + `npm test`; commit "feat(123): lựa chọn ngôn ngữ giao diện + Cài đặt › Ngôn ngữ (lớp 2)"

**Checkpoint:** đổi ngôn ngữ hoạt động end-to-end cho phần Cài đặt; phần còn lại vẫn tiếng Việt cứng.

---

## Phase 4: User Story 1 (P1) — renderer: mọi chuỗi qua `t` (lớp 3)

**Goal:** toàn bộ chuỗi renderer lấy từ catalog; hằng module chỉ giữ khoá/mã; state lưu mã thay chuỗi đã dịch.

**Independent Test:** test jsdom hiện có xanh (qua `tVi`); `IV_UI_LANG=en npm run dev` ⇒ chrome renderer English (phần chuỗi do main sinh xong ở Phase 5).

Mỗi task: thêm khoá vào `src/shared/i18n/vi.ts` (giữ nguyên văn tiếng Việt hiện có — FR-009) + bản English tạm bằng chính chuỗi English đã duyệt glossary trong `en.ts`; thay chuỗi trong tệp; cập nhật test của tệp đó sang `tVi(key)` nếu assert chuỗi đổi nguồn.

- [ ] T028 [P] [US1] App shell: `src/renderer/features/app-shell/{NavRail,AppHeader,OnboardingGate,SettingsStorageSection,LogsFolderRow,placeholders}.tsx`, `src/renderer/shared/{ErrorFallback,ShortcutsHelp}.tsx`, `src/renderer/shared/shortcuts.ts` (`SHORTCUTS` giữ khoá mô tả, dịch lúc render), `src/renderer/shared/markdown/MarkdownContent.tsx`; NavRail `TOP`/`BOTTOM` giữ khoá nhãn — cập nhật `tests/unit/{shortcuts,error-boundary,ui-modal-a11y}.test.ts`
- [ ] T029 [P] [US1] Notebooks: `src/renderer/features/notebooks/{NotebooksGrid,NotebookCard,NotebookModal,DeleteConfirm,useNotebooks}.tsx|ts`; `relative-time.ts` chuyển sang gọi `formatRelativeTime` của `src/shared/i18n/format.ts` (giữ export cho tương thích) — cập nhật `tests/unit/relative-time.test.ts` (giữ ca vi nguyên văn, thêm ca en)
- [ ] T030 [P] [US1] Sources: `src/renderer/features/sources/{AddSourceModal,SourceItem,SourceList,Workspace,useSources,useReprocess,useRelink}.tsx|ts`, `source-status.ts` (`STATUS_LABEL`/`STEP_LABEL` ⇒ khoá; `aggregateLabel` dùng `plural`; `statusLabel(source, t)` dịch `errorCode` qua `sources.error.<code>` — tạm đọc cả `errorLabel` cũ cho tới Phase 5), `relink-messages.ts` (trả khoá), `useReprocess` lưu mã thay `REPROCESS_MISMATCH_MSG` — cập nhật `tests/unit/{source-status,source-step-label,source-relink-ui,source-reprocess-ui}.test.ts`
- [ ] T031 [P] [US1] Chat: `src/renderer/features/rag-qa/{ChatColumn,MessageBubble,ModeToggle,useChat,citation-format}.tsx|ts` — `MODE_HINTS` ⇒ khoá; nhãn chế độ "Sources only"/"Extended", badge "Extended · may go beyond sources" (decision #16); `citation-format` nhận `t` cho " · trang X"/"Nguồn:"; `useChat.error` lưu `ParsedIpcError` và render qua `describeIpcError` — cập nhật `tests/unit/{citation-format,online-fallback-ui,markdown-render}.test.ts`
- [ ] T032 [P] [US1] Studio: `src/renderer/features/studio/{StudioColumn,StudioResultCard,useStudio}.tsx|ts` — một nguồn khoá loại `studio.kind.<kind>` (bỏ trùng `KINDS`/`KIND_LABEL`); `run(kind)` dịch nhãn lúc thông báo; `useStudio.errors` lưu `ParsedIpcError` — cập nhật `tests/unit/studio-parts-ui.test.ts`
- [ ] T033 [P] [US1] Source viewer: `src/renderer/features/source-viewer/{SourceViewer,useSourceViewer}.tsx|ts` — cập nhật `tests/unit/{source-viewer-audio,source-viewer-stale,highlight}.test.ts`
- [ ] T034 [P] [US1] Search: `src/renderer/features/search/ContentSearchBox.tsx`
- [ ] T035 [P] [US1] AI runtime: `src/renderer/features/ai-runtime/{SettingsAiSection,SettingsAiOnlineSection,SettingsModelAdvice,RuntimeOnboarding,ReindexBanner,ModelSelect,useRuntimeStatus}.tsx|ts` — `ModelSelect` `data-testid` đổi sang id ổn định theo vai trò (`model-select-chat`/`model-select-embedding`) và cập nhật mọi e2e/unit dùng id cũ; `testMsg` lưu mã — cập nhật test liên quan
- [ ] T036 [P] [US1] Vault backup: `src/renderer/features/vault-backup/{BackupDialog,RestoreDialog,RestoreResultNotice,VaultBackupPanel}.tsx`, `messages.ts` (map mã ⇒ khoá), `phase.message` ⇒ lưu mã; ngày giờ qua `formatDateTime` (US5) — cập nhật `tests/unit/vault-backup-ui-rules.test.ts`
- [ ] T037 [P] [US1] Crash report UI: `src/renderer/shared/crash-report/CrashReportDialog.tsx` (`PROBLEM_TEXT` ⇒ khoá), `src/renderer/features/crash-report/CrashNoticeBanner.tsx` — cập nhật `tests/unit/crash-report-ui.test.ts`
- [ ] T038 [P] [US1] A11y: `src/renderer/shared/a11y/messages.ts` — mọi hàm nhận `t` (`chatDoneMessage` dùng `plural` cho số trích dẫn; `sourceStatusMessage` dịch `errorCode`); nơi gọi `announce()` truyền chuỗi đã dịch — cập nhật `tests/unit/{a11y-announcer,a11y-live-region,a11y-messages*}.test.ts`
- [ ] T039 [P] [US5] Dung lượng: `src/renderer/shared/format-bytes.ts` uỷ quyền `formatBytes(bytes, lang)`; `ModelSelect` GB qua `formatNumber`; nơi gọi lấy `lang` từ `useLang()` — cập nhật `tests/unit/format-bytes.test.ts`
- [ ] T040 [US1] `src/renderer/index.html` giữ `lang="vi"` làm mặc định ban đầu (provider ghi đè ngay khi có `effective`); xác nhận không còn chuỗi Việt trong `src/renderer/**` ngoài catalog bằng cách chạy tạm script quét của R11 (chưa thành test); quét thêm `toLocale`/`new Date(`/`getFullYear` trong `src/renderer/**` để mọi chỗ hiển thị ngày giờ/số dùng `src/shared/i18n/format.ts` (FR-023)
- [ ] T041 [US1] Chạy `npm run lint` + `npm test` + `npm run build`; commit "feat(123): renderer dùng khung dịch (lớp 3)"

**Checkpoint:** renderer hoàn toàn qua catalog; giao diện tiếng Việt y như cũ.

---

## Phase 5: User Story 1 + 2 — main trả mã, hộp thoại dịch, dữ liệu cũ (lớp 4)

**Goal:** chuỗi do main sinh thành mã + tham số (đổi ngôn ngữ áp dụng cả cho chúng và dữ liệu đã lưu); hộp thoại hệ thống theo ngôn ngữ hiệu lực.

**Independent Test:** test DB v9 có nhãn Việt ⇒ mã sau migration; nguồn lỗi cũ hiển thị English khi đổi; câu "không tìm thấy" cũ hiển thị theo cờ; chỉ báo riêng tư đổi theo ngôn ngữ.

- [ ] T042 [P] [US2] Viết test FAIL `tests/unit/migration-010-error-code.test.ts`: tạo DB v9 (chạy `MIGRATIONS` tới 9), chèn nguồn với 7 nhãn Việt cũ + 1 nhãn lạ + NULL + một mã đã đúng; chạy migration #10 ⇒ mã đúng / `unknown` / NULL / giữ mã; `PRAGMA user_version` = 10; schema (cột) không đổi so với v9 (`schema-guard` `expectedSchema`)
- [ ] T043 [US2] Thêm migration #10 (append-only, dùng `LEGACY_SOURCE_ERROR_LABELS`) vào `src/main/db/migrations.ts` — T042 xanh; cập nhật test schema/restore nếu so phiên bản cứng
- [ ] T044 [P] [US2] Viết test FAIL cập nhật `tests/unit/{ingestion-status,pipeline*,source-repo*}.test.ts`: `errorLabelForStep` ⇒ `errorCodeForStep` trả mã; `SizeLimitError.code = "tooLarge"`; `resumeInterrupted` ghi `interrupted`; sự kiện xử lý lại mang `reprocessFailed|reprocessChanged|reprocessVaultLocked`; nhánh chọn theo mã (không so chuỗi); `toSource` chuẩn hoá qua `normalizeSourceErrorCode`
- [ ] T045 [US2] Đổi `src/main/services/ingestion/{status,size-limits,pipeline,source-repo,reprocess-guard}.ts` sang mã; `Source.errorLabel` ⇒ `Source.errorCode`, `SourceProgressEvent.errorLabel` ⇒ `errorCode` ở `src/shared/ipc/types.ts`; renderer `source-status.ts`/`a11y/messages.ts`/`useReprocess.ts` bỏ đường đọc `errorLabel` tạm của T030 — T044 xanh
- [ ] T046 [P] [US2] Viết test FAIL cập nhật `tests/unit/{privacy-state,privacy-badge}.test.ts`: `getPrivacyState` trả `{mode, egressKind?}` (không `label`); dedup theo `mode|egressKind`; badge render nhãn dịch theo `mode`/`egressKind`, đổi ngôn ngữ (provider) ⇒ nhãn đổi, trạng thái giữ đúng (Constitution I)
- [ ] T047 [US2] Sửa `src/main/services/app-shell/privacy-state.ts`, `PrivacyState` trong `src/shared/ipc/types.ts`, `src/renderer/features/app-shell/PrivacyBadge.tsx` (bỏ 2 chuỗi cứng; `privacy.checking`) — T046 xanh
- [ ] T048 [P] [US2] Viết test FAIL cập nhật `tests/unit/rag-service.test.ts` + jsdom `tests/unit/chat-not-found-ui.test.ts`: `notFoundResult()` trả `notFound:true`, `answer = NOT_FOUND_CONTENT` (English trung tính), `persist` lưu `NOT_FOUND_CONTENT` + cờ; tái lập chỉ mục trả `reindexing:true` và `persist` bỏ lưu theo cờ (không so chuỗi); `MessageBubble` với `notFound` hiển thị `chat.notFound` + `chat.notFoundHint` theo ngôn ngữ, bỏ qua `content` (kể cả content Việt cũ trong DB); `reindexing` hiển thị `chat.reindexing`
- [ ] T049 [US2] Sửa `src/main/services/rag/{constants,rag-service}.ts`, `RagAnswer` trong `src/shared/ipc/types.ts`, `src/renderer/features/rag-qa/{MessageBubble,useChat}.tsx|ts` — T048 xanh
- [ ] T050 [P] [US1] Viết test FAIL cho lỗi người-dùng-thấy: cập nhật `tests/unit/{notebook-validation,question-validation,reprocess-guard,reprocess-request,parsers-index,studio-service,map-reduce,ollama-provider,online-runtime,online-providers}.test.ts` assert `UserFacingError` với `code`/`params` (contracts/codes.md §2) thay thông điệp Việt; `register.ts` `VAULT_LOCKED` ⇒ `vaultLocked`
- [ ] T051 [US1] Đổi các `throw new Error("…")` người-dùng-thấy sang `UserFacingError` ở `src/main/ipc/register.ts`, `src/main/services/notebooks/{validation,notebook-repo}.ts`, `src/main/services/rag/question-validation.ts`, `src/main/services/ingestion/{pipeline,reprocess-guard,reprocess-request,parsers/index}.ts`, `src/main/services/studio/{studio-service,map-reduce,studio-repo,export}.ts`, `src/main/services/ai-runtime/{ollama-provider,ollama-client}.ts`, `src/main/services/ai-runtime/online/{online-runtime,anthropic-provider,gemini-provider,openai-provider}.ts`; lỗi lập trình giữ `Error` (không tới UI) — T050 xanh
- [ ] T052 [US1] Renderer: thay mọi chỗ hiển thị `e.message` (`useSources.ts`, `useNotebooks.ts`, `NotebooksGrid.tsx`, `NotebookModal.tsx`, `AddSourceModal.tsx`, `SettingsAiOnlineSection.tsx`, `useReprocess.ts`, `useChat.ts`, `useStudio.ts`) bằng `describeIpcError(parseIpcError(e), t)` (tạo ở `src/renderer/shared/i18n/describe-error.ts` + test `tests/unit/describe-error.test.ts` viết trước: code ⇒ `errors.<code>`, online ⇒ `online.<kind>` + provider, không thẻ ⇒ `errors.unexpected`)
- [ ] T053 [P] [US1] Viết test FAIL cập nhật `tests/unit/{runtime-status,model-recommend,settings-ai*}.test.ts`: `RuntimeStatus.reasonCode` + `reasonParams` cho 7 lý do; UI hiển thị theo `reasonCode`; khuyến nghị theo `tier`
- [ ] T054 [US1] Sửa `src/main/services/ai-runtime/runtime-status.ts`, `src/main/services/ai-runtime/online/anthropic-provider.ts` (`testOnlineChat`), `src/main/services/ai/model-recommend.ts` (giữ `label` cho log), `RuntimeStatus` ở `src/shared/ipc/types.ts`, renderer `RuntimeOnboarding.tsx`/`SettingsAiSection.tsx`/`SettingsAiOnlineSection.tsx`/`SettingsModelAdvice.tsx` — T053 xanh
- [ ] T055 [P] [US1] Viết test FAIL `tests/unit/startup-error.test.ts` (cập nhật) + `tests/unit/main-dialogs.test.ts`: `startupErrorDialog(err, lang)` trả tiêu đề/nội dung theo `lang` (vi giữ nguyên văn cũ, en bản dịch); hộp thoại sao lưu/khôi phục/chọn lại tệp gốc/xuất Studio nhận tiêu đề + tên bộ lọc từ translator tiêm vào
- [ ] T056 [US1] Sửa `src/main/services/app-shell/startup-error.ts`, `src/main/index.ts` (thư mục dữ liệu + `handleFatalStartup` dùng `startupLanguage(osLocale)`), `src/main/services/vault-backup/dialogs.ts`, `src/main/services/ingestion/relink-dialog.ts`, `src/main/services/studio/export.ts` dùng `uiLanguage.translator()`; khoá `dialogs.*` — T055 xanh
- [ ] T057 [P] [US1] Viết test FAIL cập nhật `tests/unit/crash-report-build.test.ts`: khung báo cáo English cố định (tiêu đề "Bug report: InsightVault …", mục "### Description" / "### Environment" / "### Recent errors (newest last)" / "### Native crashes", chú thích cắt bớt English), không ký tự Việt
- [ ] T058 [US1] Sửa `src/main/services/crash-report/report.ts` — T057 xanh
- [ ] T059 [US1] Fallback tiêu đề nguồn `"Nguồn"` ở `src/main/index.ts` (RAG + content search) ⇒ `"Source"` (chỉ dùng khi thiếu tiêu đề; không lưu chuỗi Việt mới); kiểm `tests/unit/content-search*.test.ts`
- [ ] T060 [US2] Chạy `npm run lint` + `npm test` + `npm run build`; commit "feat(123): main trả mã + hộp thoại theo ngôn ngữ + migration #10 (lớp 4)"

**Checkpoint:** đổi ngôn ngữ cập nhật cả nhãn lỗi nguồn, câu "không tìm thấy" cũ, chỉ báo riêng tư, lỗi IPC, hộp thoại.

---

## Phase 6: User Story 3 (P2) + User Story 4 (P3) — lời nhắc và đo (lớp 5)

**Goal:** Chat trả lời theo ngôn ngữ câu hỏi, Studio theo ngôn ngữ giao diện; "không bịa" không xấu đi (số đo trước/sau).

**Independent Test:** unit prompt builders; `EVAL_WITH_LLM=1` báo cáo vi/en trước/sau đạt tiêu chí R9; `EVAL_MODE=current` "hồi quy OK".

- [ ] T061 [US3] Soạn ~20 câu `lang:"en"` (≈14 có đáp án + 6 không đáp án, chia dev/holdout, `quotes` khớp nguyên văn corpus, id tiếp nối q-113…) vào `tests/eval/questions.json` (sửa bằng script/Edit, **không** prettier), `datasetVersion: "2"`, `reviewed: null`; chạy `npm run eval:retrieval` để `validateQuestions` xanh
- [ ] T062 [US3] **DỪNG — người dùng duyệt bộ câu English** (in danh sách câu + đoạn trích); sau khi duyệt ghi `reviewed: { by: "Hải", date: <ngày> }`
- [ ] T063 [P] [US3] Viết test FAIL `tests/unit/eval-llm-metrics.test.ts` cho hàm thuần mới ở `tests/eval/lib/llm-metrics.ts`: từ danh sách kết quả `{lang, type, notFound, citations, answer, questionLang}` tính theo nhóm vi/en: tỉ lệ `[n]` hợp lệ (có đáp án), từ chối đúng (không đáp án), trả nhầm "không tìm thấy" (có đáp án), ngôn ngữ khớp (dùng `detectQuestionLanguage` trên câu trả lời đã bỏ `[n]`; undefined ⇒ không tính vào mẫu số, báo riêng)
- [ ] T064 [US3] Mở rộng `tests/eval/lib/harness.ts` `runWithLlm` ⇒ chạy mọi câu holdout + dev (vi + en, có/không đáp án) qua `createRagService` chế độ grounded; `tests/eval/lib/report.ts` in bảng LLM theo nhóm; giữ `EVAL_LLM_MODEL`; không xét ĐẠT — T063 xanh; `EVAL_MODE=current npm run eval:retrieval` vẫn "hồi quy OK"
- [ ] T065 [US3] **Đo TRƯỚC** trên lời nhắc hiện tại: `EVAL_MODE=current EVAL_WITH_LLM=1 EVAL_LLM_MODEL=<model cục bộ> npm run eval:retrieval`; lưu bảng vào `specs/20261008-002646-i18n/eval-llm-before.md` (model, ngày, số câu mỗi nhóm). Model: hỏi người dùng nếu cần tải `qwen2.5:7b`; không dùng model `:cloud`
- [ ] T066 [P] [US3] Viết test FAIL cập nhật `tests/unit/rag-prompt.test.ts`: lời nhắc English; grounded có chỉ dẫn chỉ dùng đoạn, chèn `[n]`, không bịa, nói ngắn khi không có câu trả lời (không bắt câu nguyên văn); open yêu cầu ghi chú "(not based on sources)" hoặc tương đương theo ngôn ngữ câu trả lời; dòng ngôn ngữ: `vi` ⇒ "Vietnamese", `en` ⇒ "English", undefined ⇒ "same language as the user's last question"; không ký tự Việt trong lời nhắc ngoài ví dụ nhãn "(không dựa trên nguồn)"
- [ ] T067 [P] [US3] Viết test FAIL cập nhật `tests/unit/{context-builder,rewrite}*.test.ts`: `citationBlock` ⇒ `[n] (Source: <title>, page <p|—>)`; rewrite English + "Keep the question in its original language", nhãn `User`/`Assistant`, guardrail 200 ký tự giữ
- [ ] T068 [US3] Sửa `src/main/services/rag/{prompt,context-builder,rewrite,rag-service}.ts`: `systemPromptFor(mode, contextText, outputLanguage?)`; `rag-service.compute` gọi `detectQuestionLanguage(question)` — T066/T067 xanh; cập nhật `tests/unit/rag-service.test.ts` các assert prompt
- [ ] T069 [P] [US4] Viết test FAIL cập nhật `tests/unit/{studio-prompt,map-reduce,studio-service}.test.ts`: `systemPromptFor(kind, outputLanguage)` English + "Write in Vietnamese|English"; FAQ nhãn `Hỏi:/Đáp:` (vi) / `Q:/A:` (en); `NOTES_RULES`/`MAP_PROMPT`/`CONDENSE_PROMPT`/`FROM_NOTES` là hàm theo ngôn ngữ, mọi bước map-reduce dùng cùng ngôn ngữ; `StudioGenerateInput.outputLanguage` không hợp lệ ⇒ dùng ngôn ngữ hiệu lực của main
- [ ] T070 [US4] Sửa `src/main/services/studio/{prompt,map-reduce,studio-service}.ts`, `StudioGenerateInput` ở `src/shared/ipc/types.ts`, `src/main/ipc/register.ts` (kiểm enum), renderer `useStudio.ts` gửi `outputLanguage = effective` lúc bấm — T069 xanh
- [ ] T071 [US4] Tên tệp xuất: `StudioResultCard.tsx` và `MessageBubble.tsx` dùng `studio.kind.<kind>` / `chat.exportName` theo ngôn ngữ hiện tại + `isoDate`; cập nhật test xuất tương ứng
- [ ] T072 [US3] **Đo SAU** cùng lệnh/model như T065; lưu `specs/20261008-002646-i18n/eval-llm-after.md`; so tiêu chí R9 ((a),(b) không thấp hơn quá 1 câu/nhóm; ngôn ngữ khớp ≥ 90% câu có đáp án). Không đạt ⇒ điều chỉnh lời nhắc (hoặc giữ lời nhắc theo ngôn ngữ cho câu hỏi vi — R8) và đo lại; ghi quyết định
- [ ] T073 [US3] Chạy `npm run lint` + `npm test` + `EVAL_MODE=current npm run eval:retrieval` ("hồi quy OK"); commit "feat(123): lời nhắc English + ngôn ngữ đầu ra, bộ đo LLM mở rộng (lớp 5)"

**Checkpoint:** Chat theo ngôn ngữ câu hỏi, Studio theo ngôn ngữ giao diện, số đo trước/sau đã ghi.

---

## Phase 7: User Story 1 (P1) — bản English đầy đủ, quét chuỗi cứng, e2e (lớp 6)

**Goal:** English hoàn chỉnh theo glossary; chặn chuỗi Việt cứng tái xuất hiện; e2e English + đổi ngôn ngữ.

**Independent Test:** test quét đỏ khi cố ý thêm chuỗi Việt, xanh khi bỏ; `npm run test:e2e` xanh gồm `i18n.spec.ts`.

- [ ] T074 [US1] Rà toàn bộ `src/shared/i18n/en.ts`: thuật ngữ theo cột English `docs/00-glossary.md`, sentence case, ngắn; nhãn chuẩn (chế độ trả lời, trạng thái nguồn, Reprocess, vault lock, privacy indicator) thống nhất mọi nơi
- [ ] T075 [P] [US1] Viết test `tests/unit/i18n-no-hardcoded-vi.test.ts` + `tests/unit/i18n-allowlist.ts` (research R11): quét `src/**/*.{ts,tsx}` trừ `src/shared/i18n/vi.ts`, bỏ chú thích, báo literal/JSX text có ký tự Việt có dấu kèm tệp:dòng; allowlist có lý do (bảng `LEGACY_SOURCE_ERROR_LABELS`, ký tự nhận diện ở `detect-language.ts`, ví dụ nhãn trong lời nhắc, dữ liệu FTS fold nếu có); thêm ca tự kiểm (chuỗi giả trong bộ nhớ ⇒ phát hiện) — chạy, sửa mọi vi phạm còn sót cho tới khi xanh
- [ ] T076 [P] [US1] Cập nhật `tests/e2e/helper.ts` (`IV_UI_LANG: "vi"` mặc định trong env) và hai spec tự launch `tests/e2e/vault-backup.spec.ts`, `tests/e2e/crash-report.spec.ts`; e2e cũ xanh
- [ ] T077 [US1] Viết `tests/e2e/i18n.spec.ts`: (1) `IV_UI_LANG=en` vault trống ⇒ NavRail/Notebooks/Cài đặt/hộp thoại tạo notebook English, `document.documentElement.lang === "en"`, không ký tự Việt trong `body` ngoài dữ liệu người dùng; (2) `IV_UI_LANG=vi` ⇒ Cài đặt › Ngôn ngữ chọn English ⇒ chuỗi đổi ≤ 1 s không reload (giữ text đang gõ trong ô tìm), `lang` đổi; khởi động lại cùng `--user-data-dir` ⇒ vẫn English; (3) ảnh chụp English ở kích thước mặc định và nhỏ nhất (`BrowserWindow` minWidth/minHeight) lưu `test-results/` để soát tràn chữ (SC-009)
- [ ] T078 [US1] Soát ảnh chụp T077; sửa CSS/viết gọn chuỗi English ở chỗ tràn (không sửa prototype)
- [ ] T079 [US1] Chạy `npm run lint` + `npm test` + `npm run build` + `npm run test:e2e`; commit "feat(123): bản English đầy đủ, quét chuỗi cứng, e2e English (lớp 6)"

---

## Phase 8: Polish & Docs (lớp 7)

- [ ] T080 [P] ADR `docs/04-decisions/2026-10-08-i18n.md`: kiến trúc (từ điển có kiểu, mã thay chuỗi IPC/DB, migration #10), lời nhắc English + bảng số đo trước/sau (T065/T072), giới hạn đã biết (model cục bộ không bảo đảm ngôn ngữ; English là bản dịch phát sinh, prototype chỉ tiếng Việt; menu OS/trình cài đặt chưa dịch; thông báo a11y đã xếp hàng không dịch lại); thêm dòng `docs/04-decisions/INDEX.md` bằng script (không prettier)
- [ ] T081 [P] Append glossary `docs/00-glossary.md` (không prettier): ngôn ngữ giao diện (`uiLanguage`), ngôn ngữ hiệu lực (`effective language`), tệp dịch (`message catalog`), khoá dịch (`message key`), mã nhãn lỗi nguồn (`SourceErrorCode`), lỗi người-dùng-thấy (`UserFacingError`), ngôn ngữ đầu ra (`outputLanguage`), nhãn UI English chuẩn (Sources only / Extended / Reprocess / Privacy indicator…). **Không sửa** dòng `NOT_FOUND_DISPLAY` hiện có — ghi chú cần PR glossary riêng
- [ ] T082 [P] Cập nhật `README.md` (English: UI English + Vietnamese, chọn ở Settings › Language; bỏ câu "UI Vietnamese only") và `README.vi.md` tương ứng; `CLAUDE.md` dòng "Ngôn ngữ tài liệu thiết kế gốc & UI: tiếng Việt (i18n để sau)" ⇒ ghi UI Việt + English (i18n #123)
- [ ] T083 Đánh dấu `[X]` các task đã xong trong `specs/20261008-002646-i18n/tasks.md`; chạy quickstart.md mục 1–6 (phần tay ghi kết quả vào PR), gồm kiểm tay SC-008: ngắt mạng, chạy cả hai ngôn ngữ ⇒ không yêu cầu mạng mới
- [ ] T084 Test gate cuối: `npm run lint`, `npm test` (coverage ≥ 80%), `npm run build`, `npm run test:e2e`, `EVAL_MODE=current npm run eval:retrieval` ("hồi quy OK"); commit "docs(123): ADR i18n, glossary, README EN/VI, CLAUDE.md"

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2** (khung) chặn mọi phase sau.
- **Phase 3 (US2 lựa chọn ngôn ngữ)** cần Phase 2; chặn Phase 4 (renderer cần `I18nProvider`/`useT`).
- **Phase 4 (US1 renderer)** cần Phase 3. **Phase 5 (main trả mã)** cần Phase 4 (renderer phải dịch mã) — T030 có đường đọc `errorLabel` tạm để Phase 4 không phá.
- **Phase 6 (US3/US4 lời nhắc)** cần Phase 2 (`detectQuestionLanguage`) và Phase 5 (`RagAnswer`); T062 DỪNG chờ người dùng — **trong lúc chờ làm song song T063/T064** (bộ đo mở rộng không phụ thuộc bộ câu mới); T065 cần T062 + T064 và phải chạy **trước** T066–T070.
- **Phase 7** cần Phase 4–6 xong (quét toàn bộ). **Phase 8** cuối.
- US5 (định dạng) nằm rải ở T009–T010, T029, T036, T039.

### Song song

- Phase 2: T003, T005, T008, T009, T011, T013, T015, T017 (khác tệp test) — implement tương ứng tuần tự sau test của nó.
- Phase 4: T028–T039 theo feature, khác tệp (chỉ cùng chạm `vi.ts`/`en.ts` — thêm khoá theo nhóm domain riêng để giảm xung đột; khi làm một mình thì tuần tự).
- Phase 5: các cặp test/impl theo bề mặt (T042/T043, T044/T045, T046/T047, T048/T049, T050–T052, T053/T054, T055/T056, T057/T058).
- Phase 6: T063, T066, T067, T069 viết test song song; T065 tuần tự trước impl.

## Implementation Strategy

- **MVP = Phase 1–4 + phần Phase 5 cần cho hiển thị** (US1 + US2): giao diện English/Tiếng Việt đổi ngay. Lời nhắc (US3/US4) là gia số độc lập, đo trước/sau.
- Mỗi phase một commit (theo lớp), không để `main` của branch hỏng giữa chừng; gộp `main` định kỳ (merge, không rebase) và chạy lại `/speckit-analyze` nếu glossary/constitution trên `main` đổi.
