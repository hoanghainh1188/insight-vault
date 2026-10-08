# Research — 123 i18n

Nguồn: khảo sát code 2026-10-08 (3 lượt Explore song song: chuỗi ở main, chuỗi + test ở renderer, lời nhắc LLM + bộ
đánh giá), chạy thử `Intl` trên Node và Electron 43.1.0, quyết định clarify `docs/04-decisions/2026-10-08-i18n-clarify.md`.

## R1 — Quy mô và phân loại chuỗi

- **Renderer:** 52/72 tệp có chuỗi Việt trong code (~640 dòng). Đã có module gom chuỗi: `vault-backup/messages.ts`
  (map theo mã), `shared/a11y/messages.ts` (hàm có tham số, một nhánh đếm cần plural cho English), `sources/source-status.ts`
  (`STATUS_LABEL`, `STEP_LABEL`, `statusLabel` trả `errorLabel` từ main), `sources/relink-messages.ts`.
- **Main — gửi sang renderer như dữ liệu:** `errorLabel` (7 giá trị lưu DB + 3 nhãn xử lý lại chỉ qua sự kiện),
  `PrivacyState.label` (6 nhãn), `RagAnswer.answer` (`NOT_FOUND_DISPLAY` — lưu DB; `REINDEXING_ANSWER` — so sánh chuỗi để bỏ
  lưu), `RuntimeStatus.reason` (3 + 4 lý do), `ModelRecommendation.label` (3, đã có `tier`), `CrashReportDraft`.
- **Main — lỗi ném qua IPC:** `safeHandle` không bọc; Electron chỉ giữ `message` (tiền tố "Error invoking remote method").
  ~25 lỗi người-dùng-thấy (validation notebook/câu hỏi, khoá vault, nguồn không tồn tại, xử lý lại, định dạng không hỗ trợ,
  Studio chưa có nguồn/mô hình không tạo được, chưa chọn mô hình, Ollama lỗi HTTP, khoá API/nhà cung cấp) + 6 nhãn lỗi
  online theo `kind`. Lỗi lập trình (id không hợp lệ, provider chưa đăng ký…) không tới người dùng qua luồng UI bình thường.
- **Main — hộp thoại hệ thống:** 3 `showErrorBox` (thư mục dữ liệu, schema mới hơn, lỗi khởi động khác), 4 hộp thoại
  mở/lưu (sao lưu, khôi phục, chọn lại tệp gốc, xuất Studio — tiêu đề + tên bộ lọc). Không có `Menu.setApplicationMenu`
  ⇒ menu mặc định Electron (English) — ngoài phạm vi. Tiêu đề cửa sổ = `<title>InsightVault</title>`.

**Decision:** khoảng 450–550 khoá; phân tầng dịch theo R4. **Alternatives:** dịch tại chỗ từng tệp không qua khoá — loại
(không kiểm được thiếu dịch, FR-010/011).

## R2 — Khung dịch: tự viết có kiểu

**Decision:** module TS thuần `src/shared/i18n/`:

- `vi.ts` export `const vi = { … } as const` lồng theo domain (`sources.status.error`, `settings.language.title`…).
- Kiểu `Messages` = cùng cấu trúc với mọi lá là `string`; `en.ts` khai báo `export const en: Messages` ⇒ `tsc` bắt thiếu/
  thừa khoá.
- `MessageKey` = hợp các đường dẫn lá (template literal type). Tham số suy từ placeholder `{name}` trong chuỗi `vi`
  (`ExtractParams<…>`), nên `t("x", { name })` sai tên tham số bị `tsc` bắt; test runtime so tập placeholder vi↔en.
- Plural: khoá lá dạng `{ one: "…", other: "…" }` (tiếng Việt cho hai giá trị bằng nhau) + `t.plural(key, n, params)` dùng
  `Intl.PluralRules(locale)`.
- `createTranslator(lang)` trả `t` với fallback: khoá thiếu ở ngôn ngữ đích (không thể với kiểu, nhưng phòng dữ liệu) ⇒ `vi`
  ⇒ chính khoá; nội suy chỉ thay `{name}` bằng `String(value)` — **không** HTML.

**Rationale:** 2 ngôn ngữ, vài trăm chuỗi, plural tối thiểu; kiểu chặt + chạy chung main/renderer + không dependency (bundle,
local-first). **Alternatives:** i18next + react-i18next (~40 KB, kiểu khoá cần plugin/tạo kiểu, JSON resource) — dư so với
nhu cầu; `react-intl`/ICU — mạnh nhưng nặng và chỉ renderer.

## R3 — Ngôn ngữ OS, lưu lựa chọn, áp dụng ngay

- Electron 43 có `app.getPreferredSystemLanguages()` (`electron.d.ts:1335`) và `app.getLocale()` (sau `ready`).
- **Decision:** `osLocale = getPreferredSystemLanguages()[0] ?? getLocale()`; `resolveLanguage(pref, osLocale)`:
  `pref ∈ {vi,en}` ⇒ pref; `auto` ⇒ `/^vi(-|_|$)/i` ⇒ `vi`, còn lại (kể cả rỗng) ⇒ `en`. `parseUiLanguage(raw)`: ngoài
  `{auto,vi,en}` ⇒ `auto`.
- Lưu `uiLanguage` (mặc định `auto`) ở electron-store qua `StoreLike` (mẫu `onboarding.ts`); tính lại mỗi lần khởi động; **không**
  thêm vào allowlist `config-sanitize.ts` (không theo sao lưu).
- Áp dụng ngay: `setUiLanguage(pref)` ở main ⇒ lưu ⇒ tính hiệu lực ⇒ phát `app:uiLanguageChanged` tới mọi cửa sổ (mẫu
  `app:privacyChanged`, `index.ts:581`). Renderer: `I18nProvider` giữ `{preference, effective}`, đọc lần đầu qua
  `app:getUiLanguage`, cập nhật theo sự kiện; React re-render toàn cây; `document.documentElement.lang = effective`.
- Kiểm thử e2e: `IV_UI_LANG=vi|en` (chỉ khi `!app.isPackaged`, mẫu `IV_EMBED_FAKE`) ghi đè ngôn ngữ OS — e2e không phụ thuộc
  locale máy CI. Helper mặc định `vi`.

## R4 — Ai dịch chuỗi do main sinh

**Decision (lai):**

| Bề mặt                             | Cách                                                                                                                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nhãn lỗi nguồn                     | Mã `SourceErrorCode` lưu ở cột `error_label` (giữ tên cột — R5), truyền `Source.errorCode` / `SourceProgressEvent.errorCode`; renderer dịch                                                                                                               |
| Nhãn xử lý lại (sự kiện)           | mã `reprocessFailed` / `reprocessChanged` / `reprocessVaultLocked`; `pipeline.ts` so sánh mã thay chuỗi                                                                                                                                                   |
| Chỉ báo riêng tư                   | `PrivacyState = { mode, egressKind? }` (bỏ `label`); dedup theo `mode                                                                                                                                                                                     | egressKind` |
| "Không tìm thấy" / tái lập chỉ mục | `RagAnswer.notFound` (có sẵn) + `RagAnswer.reindexing` (mới); renderer hiện câu dịch; `persist` bỏ lưu theo cờ                                                                                                                                            |
| Lỗi người-dùng-thấy qua IPC        | `UserFacingError(code, params)` ⇒ thông điệp mang thẻ `[[err:<code>]]` + JSON tham số đã mã hoá; `parseIpcError` mở rộng trả `{ code, params, onlineKind, message }`; renderer dịch theo `code`, lỗi không thẻ ⇒ `errors.unexpected` (chi tiết vẫn ở log) |
| Lỗi online (098)                   | dịch theo `onlineKind` + tham số `provider`; "chưa nhập khoá API"/"chưa chọn mô hình" ⇒ `UserFacingError`                                                                                                                                                 |
| `RuntimeStatus`                    | thêm `reasonCode` (`ollamaUnreachable` / `modelsNotSelected` / `modelsMissing` + `params.models`); bỏ dùng `reason` ở UI                                                                                                                                  |
| Khuyến nghị model                  | renderer dịch theo `tier` sẵn có                                                                                                                                                                                                                          |
| Hộp thoại hệ thống                 | main dịch bằng `tMain()` = translator theo ngôn ngữ hiệu lực hiện tại                                                                                                                                                                                     |
| Hộp thoại lỗi khởi động            | `resolveLanguage("auto", osLocale)` trực tiếp (store có thể chưa sẵn)                                                                                                                                                                                     |
| Báo lỗi 093                        | khung cố định English (decision #13); hộp thoại UI dịch                                                                                                                                                                                                   |

**Rationale:** đổi ngôn ngữ phải đổi cả chuỗi đã hiển thị và đã lưu (FR-004/014/015) ⇒ dữ liệu phải là mã. Thẻ lỗi
`[[err:…]]` tái dùng cơ chế đã chứng minh của 098 (`online-error-tag.ts`) thay vì đổi hợp đồng của mọi kênh.
**Alternatives:** main tự dịch mọi thứ rồi ép phát lại — loại (chuỗi đã lưu/đang hiển thị không đổi).

## R5 — Dữ liệu cũ

- `source.error_label` chỉ có tập hữu hạn văn bản: `Lỗi trích xuất`, `Lỗi nhúng`, `Lỗi lưu trữ`, `Lỗi`, `Lỗi tải trang`,
  `Tệp quá lớn`, `Gián đoạn khi nạp — thử lại` (3 nhãn xử lý lại không bao giờ lưu).
- **Decision:** migration **#10** chỉ `UPDATE` dữ liệu — giữ tên cột `error_label` (không đổi schema ⇒ `schema-guard` sao
  lưu/khôi phục không đổi), ghi mã: `extract | embed | store | generic | fetch | tooLarge | interrupted`; giá trị khác (không
  NULL) ⇒ `unknown`. Đọc: `toSource` chạy `normalizeSourceErrorCode(raw)` (mã hợp lệ giữ; văn bản cũ khớp ⇒ mã; còn lại ⇒
  `unknown`) — lớp phòng thủ cho bản sao lưu cũ khôi phục rồi chưa chạy migration, hay sửa tay.
- Bản sao lưu cũ (schema v9) khôi phục vào app mới ⇒ migration #10 chạy ở lần mở sau như mọi migration.
- `chat_message`: **không migration** — cờ `not_found` đã có (migration #4). Nội dung lưu mới đổi thành câu English trung
  tính `NOT_FOUND_CONTENT = "Not found in the sources."` (vì nội dung này được gửi lại cho model làm lịch sử hội thoại — R8);
  hiển thị luôn dịch theo cờ.

## R6 — Renderer: provider, hằng module, state

- `main.tsx` render `RouterProvider` không provider; router (`routes.tsx`) tạo một lần, `errorElement` ngoài `<App/>` ⇒
  `I18nProvider` bọc **ngoài** `RouterProvider`.
- `useT()` **fallback tiếng Việt khi không có provider** — test component hiện render không provider (vitest không setupFiles).
- Hằng module chứa chuỗi (`NavRail` TOP/BOTTOM, `StudioColumn.KINDS`, `StudioResultCard.KIND_LABEL`, `ModeToggle.MODE_HINTS`,
  `shortcuts.SHORTCUTS`, `CrashReportDialog.PROBLEM_TEXT`, `BackupDialog.PW_HINT`, `a11y CHAT_*`, `REPROCESS_MISMATCH_MSG`,
  `routes.tsx <h2>Cài đặt>`) ⇒ chỉ giữ **mã/khoá**, dịch lúc render. Trang Cài đặt tách thành `SettingsPage`.
- State lưu chuỗi đã dịch (`BackupDialog/RestoreDialog phase.message`, `useRelink`, `useReprocess`, `useChat.error`,
  `useStudio.errors`, `AddSourceModal`, `NotebookModal`, `NotebooksGrid.deleteError`, `SettingsAiOnlineSection.testMsg`, flash
  notices) ⇒ lưu `{ code, params }` hoặc `ParsedIpcError`, dịch lúc render.
- Thông báo trình đọc màn hình: dịch **trước** `announce()` (hàng đợi LiveRegion giữ chuỗi; không dịch lại khi đổi — chấp
  nhận vì là thông báo một lần).
- `ModelSelect` `data-testid` đang dựng từ nhãn Việt ⇒ đổi sang id ổn định (vai trò: `chat`/`embedding`).

## R7 — Định dạng

- Đã chạy: `Intl` đủ dữ liệu `vi`/`en` trên Node và Electron 43.1.0 (`RelativeTimeFormat('vi')` ⇒ "3 phút trước", "Hôm qua";
  `DateTimeFormat('vi-VN', medium/short)` ⇒ "14:05 8 thg 10, 2026"; `en-US` ⇒ "Oct 8, 2026, 2:05 PM"; `NumberFormat`
  `1.536,5` / `1,536.5`).
- **Decision:** giữ **logic bucket** hiện có của `relative-time.ts` (vừa xong / N phút / N giờ / hôm qua / N ngày / tuần trước /
  ngày đầy đủ) — chuỗi qua khoá + plural, ngày đầy đủ qua `Intl.DateTimeFormat(locale, dateStyle:"short")` cho `en` và giữ
  `dd/mm/yyyy` cho `vi` (test cũ giữ nguyên). Lý do: `Intl.RelativeTimeFormat` viết hoa "Hôm qua" và không có bucket "vừa xong" ⇒
  đổi hành vi `vi`. Ngày giờ: `Intl.DateTimeFormat(locale, {dateStyle:"medium", timeStyle:"short"})`. Dung lượng:
  `NumberFormat(locale, {maximumFractionDigits:1})` + đơn vị `B/KB/MB/GB` (không dịch). Tên tệp xuất: ngày ISO `yyyy-mm-dd`.
- Không có `localeCompare` trong `src/` (xác nhận) ⇒ không đổi sắp xếp.

## R8 — Lời nhắc LLM

Hiện trạng (khảo sát): `rag/prompt.ts` (grounded/open), `rag/rewrite.ts` (SYSTEM + nhãn lịch sử + khung user), `studio/prompt.ts`
(`COMMON` có "Trả lời bằng tiếng Việt", `BY_KIND` có "Hỏi:/Đáp:"), `studio/map-reduce.ts` (`NOTES_RULES` "Viết tiếng Việt",
`MAP_PROMPT`, `CONDENSE_PROMPT`, `FROM_NOTES`), `rag/context-builder.ts` `citationBlock` (`[n] (Nguồn: …, trang …)`), fallback
tiêu đề `"Nguồn"`. Lịch sử hội thoại gửi model dạng turn thật (gồm câu "không tìm thấy" đã lưu). **Không** code nào parse đầu ra
model ngoài `[n]`.

**Decision:**

- Một bộ lời nhắc **English** cho Chat (grounded/open), rewrite, Studio (4 loại) và map-reduce; tham số `outputLanguage`:
  - Chat: `detectQuestionLanguage(question)` ⇒ `vi` ⇒ "Write the answer in Vietnamese."; `en` ⇒ "… in English."; không chắc ⇒
    "Write the answer in the same language as the user's last question." (luôn có câu này làm nền).
  - Studio + mọi bước map-reduce: ngôn ngữ giao diện lúc bấm tạo (truyền qua `StudioGenerateInput.outputLanguage`, main kiểm enum;
    thiếu ⇒ ngôn ngữ hiệu lực của main).
  - Rewrite: "Keep the question in its original language."; nhãn `User`/`Assistant`; guardrail 200 ký tự giữ.
- Grounded: bỏ yêu cầu câu "không tìm thấy" nguyên văn ⇒ "If the passages do not contain the answer, say briefly that the sources
  do not contain it, without citations." (app vẫn thay câu hiển thị theo cờ).
- Open: phần ngoài nguồn ghi chú "(not based on sources)" — hoặc tương đương trong ngôn ngữ câu trả lời, vd "(không dựa trên
  nguồn)" (Constitution II).
- FAQ: "Q:/A:" theo ngôn ngữ đầu ra ("Hỏi:/Đáp:" cho vi) — tham số trong builder.
- `citationBlock`: `[n] (Source: <title>, page <p|—>)` — nhãn trung tính English; fallback tiêu đề `"Source"`.
- `CHARS_PER_TOKEN = 2.5` (thận trọng cho tiếng Việt) giữ nguyên — vẫn đúng chiều an toàn cho English.
- **Chốt bằng số đo (R9):** nếu bộ English kém bản tiếng Việt cũ ở câu hỏi tiếng Việt vượt dung sai, giữ lời nhắc theo ngôn
  ngữ (bản vi cho câu hỏi vi) — quyết định ghi ADR.

## R9 — Đo lời nhắc (SC-006)

Hiện trạng `tests/eval/`: 112 câu (vi 102 + **en 10** đã có: q-103…q-112), corpus tiếng Việt; hồi quy "hồi quy OK" chỉ so nhóm
**vi dev / vi holdout** (`relevance-calibration.ts:39-74`) ⇒ thêm câu `lang:"en"` **không** đổi số hồi quy. `EVAL_WITH_LLM=1`
hiện chỉ đo "% câu vi holdout có đáp án bị trả không tìm thấy" (n=24), model theo `EVAL_LLM_MODEL` hoặc model đầu tiên.

**Decision:**

- Thêm ~20 câu `lang:"en"` (≈14 có đáp án + 6 không đáp án, chia dev/holdout), trích đoạn khớp nguyên văn corpus; tăng
  `datasetVersion` "2", `reviewed: null` cho tới khi người dùng duyệt (như 108) rồi ghi `reviewed`.
- Mở rộng `runWithLlm` ⇒ `runLlmEval`: chạy cả vi + en, có đáp án + không đáp án (holdout + dev), đo theo nhóm ngôn ngữ:
  (a) tỉ lệ câu trả lời có ≥ 1 `[n]` hợp lệ (câu có đáp án), (b) tỉ lệ từ chối đúng (câu không đáp án ⇒ `notFound`), (c) tỉ lệ
  trả lời sai thành "không tìm thấy" (câu có đáp án), (d) ngôn ngữ câu trả lời khớp câu hỏi (`detectQuestionLanguage` trên câu
  trả lời đã bỏ `[n]`). In bảng; không xét ĐẠT trong CI.
- Quy trình: chạy **trước** (lời nhắc cũ, trên commit trước lớp 5) và **sau**, cùng `EVAL_LLM_MODEL`, ghi cả hai vào ADR.
  Model tham chiếu: model **cục bộ** của người dùng (máy dev hiện có `gpt-oss:20b`; `qwen2.5:7b` là gợi ý mặc định của app —
  cần người dùng đồng ý tải ~4,7 GB nếu muốn dùng). **Không** dùng model `:cloud` (egress).
- Tiêu chí giữ lời nhắc mới: (a) và (b) không thấp hơn trước quá 1 câu/nhóm; (d) ≥ 90% câu có đáp án (SC-006).
- `EVAL_MODE=current npm run eval:retrieval` vẫn bắt buộc ở test gate ("hồi quy OK").

## R10 — `detectQuestionLanguage`

**Decision:** hàm thuần: bỏ `[n]`, URL, số; nếu có ký tự riêng tiếng Việt (`ă â đ ê ô ơ ư` hoặc dấu thanh trên nguyên âm
Latin) với tỉ lệ ≥ 1 ký tự/30 chữ cái ⇒ `vi`; nếu ≥ 3 từ và ≥ 50% từ thuộc danh sách từ chức năng English phổ biến hoặc toàn
ASCII với ≥ 3 từ và có ≥ 1 từ chức năng English ⇒ `en`; còn lại `undefined`. Câu tiếng Việt không dấu ⇒ thường `undefined`
(model tự theo). Test bảng ca: câu vi có dấu, vi không dấu, en, mã số, tên riêng, trộn.

## R11 — Kiểm thử chuỗi

- **Thiếu khoá/tham số:** `tsc` (kiểu `Messages`) + `tests/unit/i18n-catalog.test.ts` (so tập khoá lá, tập placeholder, dạng
  plural vi↔en; không chuỗi rỗng; không HTML `<`).
- **Quét chuỗi Việt cứng:** `tests/unit/i18n-no-hardcoded-vi.test.ts` đọc `src/**/*.{ts,tsx}` (trừ `src/shared/i18n/vi.ts`),
  bỏ chú thích, tìm literal/JSX text có ký tự Việt có dấu; ngoại lệ trong `tests/unit/i18n-allowlist.ts` (đường dẫn + lý do:
  vd bảng `legacyLabelToCode`, regex nhận diện tiếng Việt của `detect-language.ts`, dữ liệu FTS fold). Kiểm thêm ca cố ý gây lỗi
  (SC-002).
- **Test cũ:** `tests/unit/helpers/t-vi.ts` export `tVi = createTranslator("vi")`; thay assert chuỗi Việt cứng bằng `tVi(key)` ở
  nơi chuỗi đổi nguồn; giữ assert chuỗi nguyên văn ở test của chính tệp dịch (bảo đảm văn phong vi không đổi — FR-009).
- **E2E:** helper đặt `IV_UI_LANG=vi`; hai spec tự launch (`vault-backup`, `crash-report`) cũng thêm biến. `tests/e2e/i18n.spec.ts`:
  (1) `IV_UI_LANG=en` ⇒ màn chính English, không ký tự Việt trong chrome; (2) đổi ngôn ngữ trong Cài đặt ⇒ giao diện đổi ngay,
  `<html lang>` đổi, khởi động lại giữ lựa chọn.
- **Migration:** test với DB v9 có đủ 7 nhãn cũ + 1 nhãn lạ ⇒ mã đúng; NULL giữ NULL.
- **Tràn chữ:** ảnh chụp e2e English ở kích thước cửa sổ mặc định và nhỏ nhất (`minWidth/minHeight` của `BrowserWindow`), soát
  tay (SC-009).
- Coverage: thêm `src/shared/i18n/**`, `src/shared/codes/**`, `src/main/services/ui-language/**` vào `include`.

## R12 — Phạm vi ngoài renderer

- Tên app "InsightVault", `productName`, trình cài đặt, menu mặc định Electron: không đổi.
- Nhật ký 088: tên sự kiện/meta giữ nguyên.
- OCR (`vie+eng`) và Whisper (không ép ngôn ngữ): không đổi (FR-022).
- `docs/OVERVIEW.md`, `docs/03-ui/prototype.html`: không sửa. `CLAUDE.md` dòng "UI: tiếng Việt (i18n để sau)" và README EN/VI
  cập nhật khi merge.
