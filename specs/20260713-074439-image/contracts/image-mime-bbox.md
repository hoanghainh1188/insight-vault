# Contract — Image MIME + iv-media:// + overlay bbox (053)

Tái dùng giao thức `iv-media://` (049/051) — chỉ mở rộng MIME + nhận `kind=image`. Request/response/bảo
mật giữ nguyên 049.

## media-range.ts — thêm image MIME (thuần)

| Đuôi      | MIME       |
| --------- | ---------- |
| png       | image/png  |
| jpg, jpeg | image/jpeg |
| webp      | image/webp |
| bmp       | image/bmp  |
| tiff      | image/tiff |
| gif       | image/gif  |

Giữ audio (049) + video (051). `parseRange`/`extOf` KHÔNG đổi. (Ảnh nhỏ nhưng vẫn phục vụ qua cùng handler;
`<img>` thường tải full 200, Range không bắt buộc.)

## media-serve.ts

- Kiểm `kind`: nhận `"audio"` | `"video"` | `"image"` (loại khác → 404). Phần còn lại giữ nguyên.

## Renderer — Source Viewer

- `content.kind === "image"` → khung bọc `position:relative` chứa `<img src="iv-media://source/<id>"
data-testid="viewer-image-el">` (width 100%).
- Khi `citation?.locator.bbox` có → overlay `<div data-testid="viewer-bbox">` định vị:
  `left:{bbox.x*100}% top:{bbox.y*100}% width:{bbox.w*100}% height:{bbox.h*100}%` (position:absolute trong
  khung relative) → khung nổi bật co giãn theo `<img>`. Mở trực tiếp (citation=null) → không overlay.
- `onError` (file gốc mất) → thông báo như 049 (transcript giữ).
- CSP: `img-src 'self' data: iv-media:` (thêm iv-media:).

## Bất biến (kế thừa 049/051)

- Path ảnh tra theo `sourceId` từ DB (không từ renderer); không log; phục vụ cục bộ (không egress);
  privileged scheme không đổi.
