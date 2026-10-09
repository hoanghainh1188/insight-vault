# Data Model — 149

Không đổi DB / `StudioResult` / `StudioProgressEvent`.

## GenerationEntry (main, trong `createGenerationRegistry`)

| Trường         | Kiểu              | Ghi chú                                                       |
| -------------- | ----------------- | ------------------------------------------------------------- |
| `generationId` | string            | khoá; `/^[A-Za-z0-9_-]{1,64}$/` (146)                         |
| `notebookId`   | string            | khoá phụ `(notebookId, kind)` để supersede                    |
| `kind`         | `StudioKind`      |                                                               |
| `owner`        | `WebContents`     | chỉ owner được `cancel`                                       |
| `controller`   | `AbortController` | `signal` truyền xuống `generate`                              |
| `reason`       | `CancelReason?`   | đặt khi bị huỷ: `user` · `navigate` · `window` · `superseded` |

Vòng đời: `register` (lượt mới; lượt cũ cùng `(notebookId, kind)` ⇒ abort `superseded`) → `cancel` / `abortAllFor` / `abortAll` (đặt `reason`, abort) →
`finish` (luôn ở `finally`; xoá). `cancel` trả `true` chỉ khi tồn tại, cùng owner và chưa bị huỷ.

## CancelReason

`"user" | "navigate" | "window" | "superseded"` — chỉ dùng cho log `studio.cancelled` (không gửi renderer).

## ChatAbortedError (main)

Lỗi chuyên dụng khi `signal` ngoài đã abort — khác `OnlineProviderError(timeout)`. `studio-service` đổi thành `UserFacingError("studioCancelled")`.

## StudioGenerateOutcome (renderer)

`"done" | "failed" | "cancelled" | "stale"` — trả về từ `useStudio.generate`; `stale` = lượt không còn hiện hành (không ghi state, không announce).

## Trạng thái renderer bổ sung (theo loại)

- `cancelling: Partial<Record<StudioKind, boolean>>` — UI tức thì sau khi bấm Huỷ; xoá khi lượt kết thúc.
- `activeIds` (146) dùng thêm cho `isCurrentGeneration` và tự huỷ khi đổi notebook / unmount.
