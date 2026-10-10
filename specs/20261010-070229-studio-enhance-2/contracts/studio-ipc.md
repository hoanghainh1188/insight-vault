# Contract — IPC Studio đợt 2 (178)

Mọi kênh mới: thêm vào `CHANNELS` (`src/shared/ipc/channels.ts`), whitelist preload, cập nhật `tests/unit/studio-channels-whitelist.test.ts`. Main kiểm mọi
tham số từ renderer. Log không chứa nội dung, yêu cầu tuỳ chỉnh hay id.

## Đổi hành vi

### `studio:list(notebookId) → StudioResult[]` (PR 1)

Trả **mọi phiên bản** của notebook (≤ 9 kind × 10), sắp `kind`, rồi `createdAt` giảm dần. Mỗi phần tử mang `parts?`, `truncated?`, `local?`,
`customPrompt?` (PR 3), `sourceIds?` (PR 4).

### `studio:generate(input: StudioGenerateInput) → StudioResult` (PR 1, 3, 4)

- PR 1: lưu = **insert** phiên bản mới + dọn trần 10 trong một giao dịch; kết quả trả là phiên bản vừa lưu (có `parts`, `truncated`, `local`).
- PR 3: `kind = "custom"` ⇒ bắt buộc `customPrompt` hợp lệ; lỗi ⇒ reject `UserFacingError(studioCustomPromptEmpty | studioCustomPromptTooLong |
studioCustomPromptInvalid)` **trước** khi gọi AI. Sổ lượt khoá `(notebookId, "custom")`.
- PR 4: `sourceIds?: string[]` thắng `sourceId`; lỗi ⇒ `studioSourcesInvalid` / `studioSourceNotReady`, không gọi AI. Có `generationId` hợp lệ ⇒ lượt viết cuối
  stream qua `studio:streamToken`. Huỷ giữa stream ⇒ reject `studioCancelled`, không insert.

## Kênh mới

### `studio:deleteVersion({ notebookId, id }) → { deleted: boolean }` (PR 1, invoke)

Xoá đúng một phiên bản khi `id` thuộc `notebookId`. Id lạ / khác notebook / tham số sai kiểu ⇒ `{ deleted: false }` (không ném). Idempotent.

### `studio:streamToken` — push main → renderer (PR 4, KHÔNG vào `ChannelResponse`)

```ts
{
  generationId: string;
  delta: string;
}
```

- Gửi bằng `event.sender.send` của lượt đã gọi `studio:generate` — **không** broadcast mọi cửa sổ (khác `rag:streamToken`).
- Chỉ lượt viết cuối; không gửi khi `signal.aborted` hoặc `sender.isDestroyed()`.
- Không mang `notebookId`, `kind`, nội dung nguồn hay yêu cầu tuỳ chỉnh.
- Preload: `onStudioStreamToken(cb: (e: StudioStreamTokenEvent) => void): () => void`.

## Mã lỗi mới (`src/shared/codes/user-error.ts` + thông điệp vi/en)

| Mã                          | PR  | Khi                                                       |
| --------------------------- | --- | --------------------------------------------------------- |
| `studioCustomPromptEmpty`   | 3   | Yêu cầu rỗng sau chuẩn hoá                                |
| `studioCustomPromptTooLong` | 3   | > 500 code point (tham số `{ max: 500 }`)                 |
| `studioCustomPromptInvalid` | 3   | Không phải chuỗi                                          |
| `studioSourcesInvalid`      | 4   | Không phải mảng chuỗi, > 50, hoặc id không thuộc notebook |

`studioSourceNotReady` (025) dùng lại khi id thuộc notebook nhưng chưa `ready`.
