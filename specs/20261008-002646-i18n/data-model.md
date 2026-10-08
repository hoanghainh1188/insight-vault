# Data Model — 123 i18n

## Thực thể mới

### UiLanguagePreference (lựa chọn ngôn ngữ)

| Trường                                       | Kiểu                     | Ràng buộc                                                                                                                                      |
| -------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `uiLanguage` (electron-store, `config.json`) | `"auto" \| "vi" \| "en"` | mặc định `"auto"`; giá trị khác khi đọc ⇒ `"auto"` (`parseUiLanguage`); chỉ ghi qua `app:setUiLanguage`; **không** nằm trong allowlist sao lưu |

### EffectiveLanguage (ngôn ngữ hiệu lực)

- `LanguageCode = "vi" | "en"` (mở rộng = thêm mục vào `LANGUAGES`).
- Suy ra: `resolveLanguage(preference, osLocale)`; `osLocale = app.getPreferredSystemLanguages()[0] ?? app.getLocale()`;
  ghi đè kiểm thử `IV_UI_LANG` (chỉ khi `!app.isPackaged`).
- Giữ ở main (service `ui-language`), phát `app:uiLanguageChanged` mỗi khi đổi; renderer giữ bản sao trong `I18nProvider`.

### LanguageInfo (bảng ngôn ngữ — `src/shared/i18n/languages.ts`)

| Trường       | Ví dụ `vi`   | Ví dụ `en` |
| ------------ | ------------ | ---------- |
| `code`       | `vi`         | `en`       |
| `nativeName` | `Tiếng Việt` | `English`  |
| `intlLocale` | `vi-VN`      | `en-US`    |

### MessageCatalog (tệp dịch)

- `vi.ts`: đối tượng lồng `as const`, lá là `string` hoặc `{ one: string; other: string }` (plural). Ngôn ngữ nguồn.
- `en.ts`: kiểu `Messages` (cùng cấu trúc, lá `string`/plural) — thiếu/thừa khoá ⇒ lỗi `tsc`.
- Placeholder `{name}`: tập placeholder của một khoá phải giống nhau giữa các ngôn ngữ (test runtime).
- Không chứa HTML; không chứa dữ liệu người dùng.

## Mã thay chuỗi (lưu bền hoặc truyền qua IPC)

### SourceErrorCode (cột `source.error_label`, trường `Source.errorCode`, `SourceProgressEvent.errorCode`)

| Mã                     | Văn bản cũ (vi) được ánh xạ                                                         | Lưu DB?                    |
| ---------------------- | ----------------------------------------------------------------------------------- | -------------------------- |
| `extract`              | `Lỗi trích xuất`                                                                    | có                         |
| `embed`                | `Lỗi nhúng`                                                                         | có                         |
| `store`                | `Lỗi lưu trữ`                                                                       | có                         |
| `generic`              | `Lỗi`                                                                               | có                         |
| `fetch`                | `Lỗi tải trang`                                                                     | có                         |
| `tooLarge`             | `Tệp quá lớn`                                                                       | có                         |
| `interrupted`          | `Gián đoạn khi nạp — thử lại`                                                       | có                         |
| `reprocessFailed`      | `Xử lý lại thất bại — vẫn dùng bản cũ.`                                             | không (chỉ sự kiện)        |
| `reprocessChanged`     | `Tệp gốc đã bị sửa so với lúc nạp — xử lý lại bị huỷ, vẫn dùng bản cũ.`             | không                      |
| `reprocessVaultLocked` | `Đang sao lưu/khôi phục — thử lại sau giây lát. Xử lý lại bị huỷ, vẫn dùng bản cũ.` | không                      |
| `unknown`              | mọi giá trị khác không NULL                                                         | có (sau migration/khi đọc) |

- **Migration #10** (append-only, chỉ dữ liệu): `UPDATE source SET error_label = CASE error_label WHEN '<vi>' THEN '<code>' …
ELSE 'unknown' END WHERE error_label IS NOT NULL AND error_label NOT IN (<các mã>)`. Không đổi schema.
- Đọc (`toSource`): `normalizeSourceErrorCode(raw)` ⇒ mã hợp lệ / ánh xạ văn bản cũ / `unknown`; `null` giữ `null`.
- Trạng thái nguồn không đổi (`error` vẫn đi cùng mã; nguồn `ready` sau xử lý lại lỗi chỉ nhận mã qua sự kiện).

### UserErrorCode (lỗi người-dùng-thấy qua IPC)

- `UserFacingError extends Error { code: UserErrorCode; params?: Record<string, string | number> }`; `message` =
  `encodeUserError(code, params)` = `"<code> [[err:<code>|<base64url(JSON params)>]]"`.
- Danh sách mã (khởi điểm, đầy đủ ở `contracts/codes.md`): `vaultLocked`, `notebookNameEmpty`, `notebookNameTooLong{max}`,
  `notebookNotFound`, `questionEmpty`, `questionTooLong{max}`, `historyTooLong`, `sourceNotFound`, `sourcePathMissing`,
  `sourcePathNotLocal`, `sourceRetryNotError`, `unsupportedFormat{ext}`, `reprocessNotPdf`, `reprocessBusy`,
  `reprocessBadStatus`, `studioSourceNotReady`, `studioNoReadySources`, `studioEmptyOutput`, `studioNoNotes`,
  `studioSaveFailed`, `chatModelNotSelected`, `embeddingModelNotSelected`, `ollamaHttp{status}`, `apiKeyMissing{provider}`,
  `modelNotSelected{provider}`, `apiKeyInvalidInput`.
- Lỗi online giữ thẻ 098 `[[online:<kind>]]`; renderer dịch `online.<kind>` + tham số `provider` (tách từ tiền tố nhãn nhà
  cung cấp).
- Lỗi không thẻ ⇒ renderer hiển thị `errors.unexpected`; chi tiết vẫn ghi log main (088) như hiện nay.

### PrivacyState (sửa)

| Trước                                                       | Sau                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `{ mode: "local" \| "online" \| "sending"; label: string }` | `{ mode: "local" \| "online" \| "sending"; egressKind?: "ai" \| "url" \| "model" }` |

- `egressKind` chỉ có khi `mode = "sending"`; khoá dedup `notifyIfChanged` = `` `${mode}|${egressKind ?? ""}` ``.
- Renderer dịch: `privacy.local`, `privacy.online`, `privacy.sending.ai|url|model`.

### RagAnswer (mở rộng)

- Thêm `reindexing?: boolean` (true khi trả câu "đang tái lập chỉ mục"; `answer` = chuỗi trung tính, không hiển thị).
- `notFound: true` ⇒ renderer hiện `chat.notFound` + `chat.notFoundHint` theo ngôn ngữ hiện tại.
- Nội dung lưu cho tin "không tìm thấy" mới: `NOT_FOUND_CONTENT = "Not found in the sources."` (vì được gửi lại cho model
  làm lịch sử). Tin cũ giữ nội dung Việt trong DB; hiển thị vẫn theo cờ.
- `persist` bỏ lưu theo `reindexing === true` (thay so sánh chuỗi).

### RuntimeStatus (mở rộng)

- Thêm `reasonCode?: "ollamaUnreachable" | "modelsNotSelected" | "modelsMissing" | "providerInvalid" | "apiKeyMissing" |
"modelNotSelected" | "connectionFailed"` + `reasonParams?: { models?: string; provider?: string }`.
- `reason` giữ (tương thích, dùng cho log) nhưng renderer hiển thị theo `reasonCode`.

### Studio

- `StudioGenerateInput.outputLanguage?: "vi" | "en"` (renderer gửi ngôn ngữ hiệu lực lúc bấm; main kiểm enum, thiếu ⇒ ngôn
  ngữ hiệu lực của main).
- `studio_result` không đổi (nội dung giữ nguyên văn bản đã sinh).

## Trạng thái & chuyển đổi

```text
uiLanguage: auto ──setUiLanguage(vi|en)──▶ vi|en ──setUiLanguage(auto)──▶ auto
EffectiveLanguage = resolveLanguage(uiLanguage, osLocale) — tính lại khi: khởi động, setUiLanguage
  ⇒ phát app:uiLanguageChanged {preference, effective} ⇒ renderer re-render + <html lang>
source.error_label: '<văn bản Việt>' ──migration #10──▶ '<mã>' (một lần, không đảo ngược)
```
