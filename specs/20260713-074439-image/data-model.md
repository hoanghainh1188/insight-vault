# Data Model — 053-image (Phase 1)

KHÔNG bảng/cột mới (KHÔNG migration). Mở rộng `kind` + `Locator`.

## Source (bảng `source`) — mở rộng `kind`

| Trường   | Vai trò 053                                                                   |
| -------- | ----------------------------------------------------------------------------- |
| `kind`   | Thêm `"image"`. 045 (migration #5) đã bỏ CHECK → không migration.             |
| `origin` | Path file ảnh GỐC; `iv-media://` đọc qua `getOrigin(id)` để hiển thị `<img>`. |

`SourceKind = ...|"audio"|"video"|"image"`.

## Locator — thêm `bbox?` (KHÔNG đổi bảng, chỉ type + cột char sẵn có)

`Locator = { page; charStart; charEnd; tStart?; tEnd?; bbox? }`

- `bbox?: { x: number; y: number; w: number; h: number }` — **chuẩn hoá 0..1** theo kích thước ảnh. Vùng
  chữ (hợp bbox các dòng) của chunk. Backward-compat (như tStart/tEnd 045; nguồn khác không có bbox).

> **Migration #6 (ĐÃ XÁC MINH schema):** chunk lưu locator bằng CỘT (`char_start/char_end`, `t_start/t_end`
> — 045). bbox KHÔNG có cột → **cần migration #6**: `ALTER TABLE chunk ADD COLUMN bbox_x/bbox_y/bbox_w/
bbox_h REAL` (4 cột, giá trị 0..1). Đây là ADD COLUMN **thuần, append-only, KHÔNG phá CHECK** (khác
> migration #5 phải backup/restore để bỏ CHECK) → đơn giản, an toàn. `source-repo` đọc: gắn `bbox` vào
> locator khi `bbox_x != null` (như gắn tStart khi t_start != null). `insertChunks` ghi 4 cột bbox.
>
> _Đính chính so với ADR/spec ban đầu ("KHÔNG migration"): mệnh đề đó ĐÚNG cho `kind=image` (CHECK kind đã
> bỏ ở #5), nhưng bbox cần lưu → migration #6 ADD 4 cột. Đã cập nhật ADR._

## boxMap (runtime, không persist) — ~ timeMap 045

`boxMap: [{ charStart, charEnd, bbox(0..1) }]` — sinh khi parse, dùng gắn `Locator.bbox` mỗi chunk, KHÔNG
lưu (như timeMap).

## SourceContent (IPC) — KHÔNG đổi cấu trúc

`kind` có thể `"image"` → renderer render `<img>` + overlay. `text` = transcript OCR (rỗng nếu không chữ).

## Định dạng & giới hạn (size-limits.ts)

| kind  | Định dạng                      | Giới hạn |
| ----- | ------------------------------ | -------- |
| image | png, jpg/jpeg, webp, bmp, tiff | 50MB     |

## Trạng thái xử lý

`queued → processing(ocr) → awaiting_embedding → ready` (hoặc ready 0 chunk nếu ảnh không chữ). Tiến độ
`SourceProgressEvent` (037): bước `ocr` (logger tesseract → progress) trong bước parse.
