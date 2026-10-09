# Data Model — 146

Không đổi DB / `StudioResult`.

## StudioProgressPhase

`"reading" | "condensing" | "writing"` — thứ tự tăng dần (dùng để bỏ sự kiện lùi).

## StudioProgressEvent (push `studio:progress`)

| Trường         | Kiểu                  | Ghi chú                                           |
| -------------- | --------------------- | ------------------------------------------------- |
| `generationId` | string                | do renderer sinh, `/^[A-Za-z0-9_-]{1,64}$/`       |
| `notebookId`   | string                |                                                   |
| `kind`         | `StudioKind`          |                                                   |
| `phase`        | `StudioProgressPhase` |                                                   |
| `index`        | number?               | chỉ khi `reading` — phần đang đọc, 1-based        |
| `total`        | number?               | chỉ khi `reading` — số phần thực chạy (= `parts`) |

## StudioGenerateInput (mở rộng)

`generationId?: string` — thiếu/không hợp lệ ⇒ main không phát tiến độ (vẫn tạo bình thường).

## StudioProgressState (renderer, theo loại)

`{ generationId, phase, index?, total? } | undefined` trong `Record<StudioKind, …>`; xoá khi xong/lỗi/đổi notebook.
