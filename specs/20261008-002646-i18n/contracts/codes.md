# Contract — mã thay chuỗi hiển thị do main sinh

## 1. Nhãn lỗi nguồn — `src/shared/codes/source-error.ts`

```ts
export type SourceErrorCode =
  | "extract"
  | "embed"
  | "store"
  | "generic"
  | "fetch"
  | "tooLarge"
  | "interrupted"
  | "reprocessFailed"
  | "reprocessChanged"
  | "reprocessVaultLocked"
  | "unknown";
export const SOURCE_ERROR_CODES: readonly SourceErrorCode[];
/** Mã hợp lệ ⇒ giữ; văn bản Việt cũ (bảng ánh xạ cố định) ⇒ mã; null/"" ⇒ null; khác ⇒ "unknown". */
export function normalizeSourceErrorCode(
  raw: string | null | undefined,
): SourceErrorCode | null;
export const LEGACY_SOURCE_ERROR_LABELS: Readonly<
  Record<string, SourceErrorCode>
>; // dùng cả cho migration #10
```

- `Source.errorLabel` ⇒ **`Source.errorCode: SourceErrorCode | null`**; `SourceProgressEvent.errorLabel` ⇒ `errorCode`.
- Khoá dịch: `sources.error.<code>`.
- `pipeline.ts`: `StepError` mang `code` thay `label`; nhánh hoãn xử lý lại chọn theo mã.

## 2. Lỗi người-dùng-thấy qua IPC — `src/shared/codes/user-error.ts`

```ts
export type UserErrorCode =
  | "vaultLocked"
  | "notebookNameEmpty"
  | "notebookNameTooLong"
  | "notebookNotFound"
  | "questionEmpty"
  | "questionTooLong"
  | "historyTooLong"
  | "sourceNotFound"
  | "sourcePathMissing"
  | "sourcePathNotLocal"
  | "sourceRetryNotError"
  | "unsupportedFormat"
  | "reprocessNotPdf"
  | "reprocessBusy"
  | "reprocessBadStatus"
  | "studioSourceNotReady"
  | "studioNoReadySources"
  | "studioEmptyOutput"
  | "studioNoNotes"
  | "studioSaveFailed"
  | "chatModelNotSelected"
  | "embeddingModelNotSelected"
  | "ollamaHttp"
  | "apiKeyMissing"
  | "modelNotSelected"
  | "apiKeyInvalidInput";

export class UserFacingError extends Error {
  constructor(code: UserErrorCode, params?: Record<string, string | number>);
  readonly code: UserErrorCode;
  readonly params?: Record<string, string | number>;
}
/** message = "<code> [[err:<code>|<base64url JSON params>]]" — chỉ ASCII, an toàn đi qua Electron invoke. */
export function encodeUserError(
  code: UserErrorCode,
  params?: Record<string, string | number>,
): string;
```

`src/shared/online-error-tag.ts` — `parseIpcError(raw)` mở rộng:

```ts
export interface ParsedIpcError {
  message: string; // đã bỏ tiền tố Electron + thẻ
  code?: UserErrorCode; // từ [[err:…]]
  params?: Record<string, string | number>;
  onlineKind?: OnlineErrorKind; // từ [[online:…]] (098, giữ nguyên)
  provider?: string; // nhãn nhà cung cấp tách từ tiền tố "<Provider>: " của lỗi online
}
```

- Renderer: `describeIpcError(parsed, t)` ⇒ `t("errors.<code>", params)` | `t("online.<kind>", {provider})` |
  `t("errors.unexpected")`. Không bao giờ hiển thị `message` thô của lỗi không thẻ.
- Tham số JSON giải mã an toàn (try/catch; chỉ chấp nhận giá trị string/number, độ dài ≤ 200).

## 3. Chỉ báo riêng tư — `PrivacyState`

`{ mode: "local" | "online" | "sending"; egressKind?: "ai" | "url" | "model" }` — khoá dịch `privacy.local`,
`privacy.online`, `privacy.sending.ai|url|model`, `privacy.checking`.

## 4. Hỏi đáp — `RagAnswer`

- `notFound: true` ⇒ `chat.notFound` + `chat.notFoundHint`.
- `reindexing: true` (mới) ⇒ `chat.reindexing`.
- Nội dung lưu tin không tìm thấy mới: hằng `NOT_FOUND_CONTENT` (English trung tính).

## 5. Trạng thái runtime — `RuntimeStatus.reasonCode`

`"ollamaUnreachable" | "modelsNotSelected" | "modelsMissing" | "providerInvalid" | "apiKeyMissing" | "modelNotSelected" |
"connectionFailed"` + `reasonParams` ⇒ khoá `runtime.reason.<code>`. Khuyến nghị model ⇒ `settings.ai.recommend.<tier>`.

## 6. Hộp thoại hệ thống (main dịch)

| Hộp thoại                      | Khoá                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Không tạo được thư mục dữ liệu | `dialogs.dataDir.title`, `dialogs.dataDir.detail{path}`                         |
| Schema mới hơn                 | `dialogs.schemaNewer.title`, `dialogs.schemaNewer.detail{dbVersion,appVersion}` |
| Lỗi khởi động khác             | `dialogs.startupError.title`, `dialogs.startupError.detail{errorType}`          |
| Sao lưu / khôi phục            | `dialogs.backup.title`, `dialogs.restore.title`, `dialogs.backup.filter`        |
| Chọn lại tệp gốc               | `dialogs.relink.title`, `dialogs.relink.filter`                                 |
| Xuất Studio                    | `dialogs.export.filter`                                                         |

## 7. Báo lỗi 093

Khung `report.ts` (tiêu đề, mục, chú thích cắt bớt) cố định English; không qua khoá dịch (nằm trong allowlist quét chuỗi
không áp dụng vì không có chữ Việt).
