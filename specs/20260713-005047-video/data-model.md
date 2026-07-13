# Data Model — 051-video (Phase 1)

KHÔNG tạo bảng/cột mới (KHÔNG migration). Tiêu thụ + mở rộng entity sẵn có.

## Source (bảng `source`) — mở rộng `kind`, KHÔNG đổi schema

| Trường   | Vai trò trong 051                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------- |
| `kind`   | Thêm giá trị `"video"` (m4a/aac dùng `"audio"`). 045 (migration #5) đã bỏ CHECK → không migration. |
| `origin` | Path file video/audio GỐC trên đĩa; handler `iv-media://` đọc qua `getOrigin(id)` để phát.         |

`SourceKind = "pdf"|"docx"|"txt"|"md"|"url"|"audio"|"video"` (thêm `"video"` ở `src/shared/ipc/types.ts`).

## Chunk + Locator — KHÔNG đổi (kế thừa 045)

`Locator.tStart/tEnd` (giây) sinh từ transcribe của audio tách ra; dùng để seek `<video>`/`<audio>`. Video
KHÔNG có audio → 0 chunk (transcript rỗng).

## SourceContent (IPC) — KHÔNG đổi cấu trúc

`SourceContent.kind` nay có thể là `"video"` → renderer render `<video>`. `text` = transcript (rỗng nếu
video không audio).

## Định dạng & giới hạn (size-limits.ts)

| kind  | Định dạng                                      | Giới hạn |
| ----- | ---------------------------------------------- | -------- |
| video | mp4, mov, webm, mkv                            | **1GB**  |
| audio | wav, mp3, flac, ogg (045) **+ m4a, aac** (051) | 200MB    |

## Trạng thái xử lý (pipeline) — thêm bước

Luồng video: `queued → processing(extract) → processing(transcribe) → awaiting_embedding → ready`
(hoặc `ready` với transcript rỗng nếu no-audio). Tiến độ qua `SourceProgressEvent` (037): thêm nhãn bước
`extract` (tách audio) trước `parse`.

## File tạm (không persist)

`<dataDir>/tmp/<uuid>.wav` — wav 16kHz mono ffmpeg xuất; **xoá** ở `finally` sau transcribe. Không vào DB.

## State renderer — tái dùng 049

`audioError` (049) dùng chung cho `<video>` onError. Không state mới.
