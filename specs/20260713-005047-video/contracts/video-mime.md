# Contract — Video MIME + giao thức iv-media:// mở rộng (051)

Tái dùng giao thức `iv-media://` của 049 ([../../20260713-000936-audio-player/contracts/iv-media-protocol.md]).
051 chỉ **mở rộng MIME** để phục vụ `<video>` — request/response/bảo mật giữ nguyên 049.

## media-range.ts — mở rộng MIME (hàm thuần)

Bảng MIME (thêm video, giữ audio 049):

| Đuôi     | MIME                  |
| -------- | --------------------- |
| mp3      | audio/mpeg            |
| wav      | audio/wav             |
| flac     | audio/flac            |
| ogg      | audio/ogg             |
| m4a      | audio/mp4             |
| aac      | audio/aac             |
| **mp4**  | **video/mp4**         |
| **mov**  | **video/quicktime**   |
| **webm** | **video/webm**        |
| **mkv**  | **video/x-matroska**  |
| (khác)   | audio/mpeg (mặc định) |

- Giữ export `mimeForAudioExt` (tránh phá test 049) HOẶC đổi tên `mimeForMediaExt` + alias — quyết ở
  implement, ưu tiên không phá 16 test 049.
- `parseRange`/`extOf` KHÔNG đổi.

## Renderer — Source Viewer

- `content.kind === "video"` → render `<video controls preload="metadata" src="iv-media://source/<id>">`
  (thay `<audio>`); **cùng** `ref` + effect seek (`currentTime = tStart` on `loadedmetadata`) + `onError`
  (049). `kind === "audio"` giữ `<audio>`.
- CSP: `media-src 'self' iv-media:` (049) đã phủ `<video>` → **KHÔNG đổi**.

## Handler (media-serve.ts)

- Đổi kiểm `source.kind !== "audio"` → chấp nhận cả `"audio"` và `"video"` (loại khác → 404). Phần còn lại
  (Range/206/200/404, tra DB, không path từ renderer) giữ nguyên 049.
