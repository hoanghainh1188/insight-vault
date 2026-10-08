# Implementation Plan: Giao diện đa ngôn ngữ (Tiếng Việt + English), AI trả lời theo ngôn ngữ câu hỏi

**Branch**: `123-i18n` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20261008-002646-i18n/spec.md`; quyết định
`docs/04-decisions/2026-10-08-i18n-clarify.md` (17 mục); intake `docs/intake/123-i18n.md`.

## Summary

Thêm khung i18n **tự viết, có kiểu, không dependency** ở `src/shared/i18n/` (tiếng Việt là ngôn ngữ nguồn, `en` phải
khớp kiểu), dùng chung main + renderer. Main giữ **lựa chọn ngôn ngữ** (`uiLanguage` = `auto`/`vi`/`en` trong
electron-store) và **ngôn ngữ hiệu lực** (`auto` ⇒ ngôn ngữ OS ưu tiên đầu tiên: `vi*` ⇒ `vi`, còn lại ⇒ `en`), phát sự kiện
`app:uiLanguageChanged`; renderer bọc `I18nProvider` quanh router, mọi chuỗi qua `t(key, params)`, đồng bộ `<html lang>`.
Chuỗi do main sinh đổi sang **mã + tham số**: nhãn lỗi nguồn (`error_label` chuyển giá trị sang mã bằng migration dữ liệu
#10, ánh xạ phòng thủ khi đọc), `PrivacyState` (`mode` + `egressKind`), `RagAnswer` (cờ `notFound`/`reindexing`), lỗi
người-dùng-thấy qua IPC (thẻ `[[err:code]]` tương tự thẻ lỗi online 098), `RuntimeStatus.reasonCode`, khuyến nghị model
theo `tier`. Main tự dịch hộp thoại hệ thống theo ngôn ngữ hiệu lực (lỗi khởi động theo locale OS). Báo lỗi 093 cố định
English. Lời nhắc LLM (Chat Theo nguồn/Mở rộng, Studio + map-reduce, rewrite, nhãn khối nguồn) viết lại **một bản English**

- chỉ dẫn ngôn ngữ đầu ra (`detectQuestionLanguage` thuần cho Chat; ngôn ngữ giao diện cho Studio); nhận diện "không tìm
  thấy" giữ nguyên (không `[n]` hợp lệ ⇒ notFound). Đo trước/sau bằng bộ đánh giá 108 mở rộng (`EVAL_WITH_LLM=1` đo đúng
  ngôn ngữ, `[n]` hợp lệ, từ chối đúng; ~20 câu English mới, người dùng duyệt). Test: kiểm khoá/tham số vi↔en, quét chuỗi
  Việt viết cứng trong `npm test`, helper `tVi` cho test cũ, e2e cố định `vi` qua `IV_UI_LANG` + 1 e2e English + 1 e2e đổi
  ngôn ngữ.

## Technical Context

**Language/Version**: TypeScript 5 (Electron 43 main/preload/renderer, Node ≥ 20), React 18

**Primary Dependencies**: không thêm. Dùng `Intl.DateTimeFormat` / `NumberFormat` / `RelativeTimeFormat` (có sẵn trong
Chromium/Node của Electron, đủ dữ liệu `vi`/`en` — xác minh R7), `app.getPreferredSystemLanguages()` / `app.getLocale()`.

**Storage**: electron-store khoá mới `uiLanguage`; SQLite migration **#10 chỉ dữ liệu** (đổi giá trị `source.error_label`
sang mã — không đổi schema); không đụng LanceDB.

**Testing**: vitest (unit node + jsdom per-file), Playwright `_electron` e2e (xvfb ở CI), bộ đánh giá 108
(`npm run eval:retrieval`, `EVAL_WITH_LLM=1` chạy tay với Ollama).

**Target Platform**: macOS (arm64) + Windows (x64) desktop

**Project Type**: desktop-app (Electron)

**Performance Goals**: đổi ngôn ngữ ⇒ toàn giao diện cập nhật ≤ 1 s (SC-003); tra khoá O(1); không tăng thời gian khởi
động đáng kể (tệp dịch là module TS tĩnh, < 100 KB).

**Constraints**: không egress (tệp dịch đóng gói); renderer sandbox; kênh IPC mới whitelist, đặt ngôn ngữ chỉ nhận enum;
không `dangerouslySetInnerHTML` (nội suy là văn bản thuần); migration append-only; không đổi truy xuất/ngưỡng 108.

**Scale/Scope**: ~640 dòng chuỗi ở 52 tệp renderer + ~150 chuỗi người-dùng-thấy ở main (khảo sát 2026-10-08, research
R1) ⇒ ước tính 450–550 khoá; ~276 điểm assert chuỗi Việt ở 82 tệp test.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                     | Đánh giá                                                                                                                                                                                                                                                                                                            | Kết quả |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I. Local-first & No Egress     | Tệp dịch là module tĩnh đóng gói; không tải gói ngôn ngữ/font; không telemetry ngôn ngữ. Chỉ báo riêng tư: main gửi `mode` + `egressKind` (không đổi hành vi), renderer dịch ⇒ luôn đúng trạng thái kể cả sau đổi ngôn ngữ (test giữ). Đo LLM chỉ dùng Ollama **cục bộ** (không dùng model `:cloud`).               | PASS    |
| II. Verifiable Citations       | Locator/chunk/hậu kiểm `postprocessCitations` không đổi. "Không tìm thấy" vẫn quyết định bằng cấu trúc (không `[n]` hợp lệ). Chế độ Mở rộng vẫn yêu cầu gắn nhãn "ngoài nguồn" (theo ngôn ngữ câu trả lời: "(không dựa trên nguồn)" / "(not based on sources)"). Lời nhắc mới phải đo không kém trước khi giữ (R9). | PASS    |
| III. Desktop Security Boundary | Đọc locale OS, lưu cài đặt, dịch hộp thoại ở main. 3 kênh mới whitelist (`app:getUiLanguage`, `app:setUiLanguage` chỉ nhận `auto`/`vi`/`en` — main kiểm lại, `app:uiLanguageChanged` push). Nội suy chèn văn bản thuần; tệp dịch không chứa dữ liệu nhạy cảm; log không đổi.                                        | PASS    |
| IV. Test-First & Coverage      | Hàm thuần mới (`translate`, `resolveLanguage`, `parseUiLanguage`, formatters, `detectQuestionLanguage`, `legacyLabelToCode`, mã lỗi IPC encode/parse, prompt builders) test trước; `src/shared/i18n/**` vào coverage include; test quét chuỗi cứng + test khoá/tham số.                                             | PASS    |
| V. Phased Delivery             | Pha 1 + 2 đã xong; i18n là hạn chế đã biết ⑦, không nhảy cóc.                                                                                                                                                                                                                                                       | PASS    |

**Terminology / Source-of-truth:** English theo cột English glossary; nhãn UI chuẩn mới append glossary; prototype/OVERVIEW
không sửa (English là bản dịch phát sinh — ghi ADR). Sửa nghĩa dòng glossary `NOT_FOUND_DISPLAY` ⇒ PR glossary riêng.

## Project Structure

### Documentation (this feature)

```text
specs/20261008-002646-i18n/
├── plan.md              # file này
├── research.md          # Phase 0 (R1–R12)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── i18n-core.md         # API khung dịch dùng chung (t, resolveLanguage, formatters)
│   ├── ipc-ui-language.md   # 3 kênh IPC ngôn ngữ
│   └── codes.md             # mã thay chuỗi: nhãn lỗi nguồn, lỗi IPC, privacy, runtime, rag
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/shared/i18n/                 # MỚI — dùng chung main + renderer (thuần, không Node/DOM API)
├── languages.ts                 # bảng ngôn ngữ: code, tên tự xưng, locale Intl ("vi-VN"/"en-US")
├── vi.ts                        # ngôn ngữ nguồn (as const) ⇒ kiểu Messages, MessageKey, tham số theo khoá
├── en.ts                        # en: Messages (tsc bắt thiếu khoá)
├── translate.ts                 # createTranslator(lang) → t(key, params) + plural; nội suy {name}
├── resolve-language.ts          # parseUiLanguage, resolveLanguage(pref, osLocales)
├── format.ts                    # formatDateTime, formatNumber, formatBytes, formatRelativeTime theo lang
├── detect-language.ts           # detectQuestionLanguage(text) → "vi" | "en" | undefined
└── index.ts
src/shared/codes/                # MỚI — mã thay chuỗi hiển thị
├── source-error.ts              # SourceErrorCode + legacyLabelToCode (ánh xạ văn bản Việt cũ)
└── user-error.ts                # UserErrorCode, UserFacingError, encode/parse thẻ [[err:…]]
src/shared/online-error-tag.ts   # parseIpcError mở rộng trả { code, params, onlineKind }
src/shared/ipc/{channels,types}.ts  # 3 kênh mới; Source.errorCode; PrivacyState.egressKind; RagAnswer.reindexing; RuntimeStatus.reasonCode

src/main/services/ui-language/   # MỚI — service StoreLike + effective language + onChange; tMain() cho hộp thoại
src/main/db/migrations.ts        # + migration #10 (UPDATE source.error_label → mã)
src/main/services/ingestion/*    # status.ts, pipeline.ts, size-limits.ts, reprocess-guard.ts → mã
src/main/services/app-shell/privacy-state.ts, startup-error.ts
src/main/services/rag/{prompt,rewrite,context-builder,constants,rag-service}.ts
src/main/services/studio/{prompt,map-reduce,studio-service}.ts
src/main/services/{notebooks,ai-runtime,crash-report,vault-backup}/…   # lỗi → UserFacingError; hộp thoại → tMain
src/main/ipc/register.ts, src/main/index.ts, src/preload/index.ts

src/renderer/shared/i18n/        # MỚI — I18nProvider, useT (fallback vi khi không provider), useFormat
src/renderer/main.tsx            # bọc I18nProvider quanh RouterProvider
src/renderer/app/SettingsPage.tsx + features/app-shell/SettingsLanguageSection.tsx   # MỚI
src/renderer/**                  # thay chuỗi bằng t(); hằng module → hàm nhận t; state lưu mã thay chuỗi

tests/unit/i18n-*.test.ts        # MỚI: khoá/tham số, translate, resolve, format, detect, quét chuỗi cứng, migration #10
tests/unit/helpers/t-vi.ts       # MỚI — tVi(key, params) cho test cũ
tests/e2e/helper.ts              # IV_UI_LANG=vi mặc định; tests/e2e/i18n.spec.ts (English + đổi ngôn ngữ)
tests/eval/                      # + ~20 câu English (questions.json), runWithLlm mở rộng đo ngôn ngữ/[n]/từ chối
```

**Structure Decision**: khung dịch là code thuần ở `src/shared/` (CLAUDE.md dành cho types + contract dùng chung), lớp
React mỏng ở `src/renderer/shared/i18n/`, service ngôn ngữ ở `src/main/services/ui-language/` (cô lập theo feature). Mã
thay chuỗi đặt ở `src/shared/codes/` để main sinh, renderer dịch, cùng một nguồn kiểu.

## Commit theo lớp (decision #15)

1. Khung `src/shared/i18n` + `codes` + test (TDD) — chưa đổi hành vi.
2. Service ngôn ngữ ở main + 3 kênh IPC + preload + `I18nProvider` + mục Cài đặt › Ngôn ngữ (chỉ khoá Cài đặt dùng `t`).
3. Renderer: thay toàn bộ chuỗi (theo feature), hằng module → hàm, state lưu mã.
4. Main: mã nhãn lỗi + migration #10, `PrivacyState`, `RagAnswer`, lỗi IPC `UserFacingError`, `RuntimeStatus`, hộp thoại
   `tMain`, startup dialog, báo lỗi English.
5. Lời nhắc: đo **trước** (bộ đánh giá mở rộng trên lời nhắc cũ) → viết lại English + chỉ dẫn ngôn ngữ → đo **sau** → chốt.
6. Bản English đầy đủ + test quét chuỗi cứng + e2e English/đổi ngôn ngữ + ảnh chụp tràn chữ.
7. Docs: ADR, glossary (append), README EN/VI, CLAUDE.md dòng ngôn ngữ UI.

## Complexity Tracking

| Vi phạm / độ phức tạp                                                                | Vì sao cần                                                                          | Phương án đơn giản hơn bị loại vì                                                                                  |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Đổi hợp đồng IPC dùng chung (`Source`, `PrivacyState`, `RagAnswer`, `RuntimeStatus`) | Đổi ngôn ngữ phải cập nhật cả chuỗi do main sinh, kể cả dữ liệu đã lưu              | Main tự dịch rồi gửi chuỗi: chuỗi đã gửi/đã lưu không đổi khi người dùng đổi ngôn ngữ (vi phạm FR-004/014)         |
| Migration dữ liệu #10                                                                | `error_label` lưu văn bản Việt; cần một nguồn sự thật là mã                         | Chỉ ánh xạ ngược khi đọc mãi mãi: bảng văn bản cũ sống vĩnh viễn, vẫn ghi văn bản mới — giữ làm lớp phòng thủ thôi |
| Một PR rất lớn (chạm gần mọi tệp UI)                                                 | i18n là tính năng xuyên suốt; chia nhiều PR để lại app nửa Việt nửa Anh trên `main` | Commit theo lớp trong một branch + test quét chặn chuỗi sót                                                        |
