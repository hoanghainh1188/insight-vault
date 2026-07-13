# image clarify (053, Pha 2c)

- Ngày: 2026-07-13
- Feature: `053-image` (issue #53)
- Nguồn: thảo luận khép Pha 2 sau khi 051 (video) merge; người dùng chốt 3 quyết định pivotal.
- Tiếp nối: 045 (transcribe/cache model/progress), 049/051 (`iv-media://`, Source Viewer).

## Quyết định (đã thảo luận)

**1. Engine = CHỈ OCR (tesseract.js WASM), chạy ở MAIN.** Trích text + **bbox từng dòng/từ** từ ảnh
(scan/screenshot/tài liệu chụp). Offline, cross-platform, KHÔNG binary native (khác ffmpeg — chỉ WASM).
Vision Ollama (mô tả ảnh không chữ) **ngoài phạm vi 053** (để sau — vision không cho bbox nên kiểm chứng
yếu; nếu làm, gắn nhãn AI theo Constitution II "mở rộng").

- _Loại bỏ:_ vision-only (mất kiểm chứng) · OCR+vision (model vision nặng, phức tạp v1).

**2. Traineddata (vie+eng) TẢI LẦN ĐẦU** — như Whisper 045: cache vào `<dataDir>/models/tesseract`, badge
egress khi tải (Constitution I), sau chạy offline. Installer nhỏ, nhất quán 045.

- _Đánh đổi:_ cần Internet lần đầu OCR. _(Loại bỏ bundle sẵn: installer to hơn.)_

**3. Highlight VÙNG BBOX trên ảnh.** Bấm chip `[n]` → Source Viewer hiện ảnh + **overlay khung** đúng vùng
OCR của đoạn trích dẫn (map toạ độ pixel → % để co giãn theo kích thước hiển thị). Đúng "Kiểm chứng được"
(Constitution II), khớp `{bbox}` đã có trong glossary `Locator`.

- _Loại bỏ:_ mở ảnh không khoanh vùng (kiểm chứng yếu — không chỉ đúng chỗ).

## Kiến trúc kế thừa (tái dùng)

- **Cache model + badge + progress (045):** tesseract cache traineddata như Whisper; `logger` → progress
  (`SourceProgressEvent` 037); `setOnline` badge khi tải lần đầu.
- **boxMap ~ timeMap (045):** OCR → text + `boxMap` (char-range ↔ bbox mỗi dòng) — **cùng cơ chế** như
  `timeMap`/`timeForCharRange` của audio. Chunk theo char như thường → `bbox` chunk = **hợp bbox các dòng**
  giao với char-range (hàm THUẦN `bboxForCharRange`).
- **`iv-media://` (049/051):** phục vụ ảnh GỐC (thêm image MIME) → renderer `<img src="iv-media://source/id">`
  - overlay bbox. Tham chiếu file gốc, KHÔNG copy.
- **Migration:** `kind=image` KHÔNG cần (045 bỏ CHECK kind). NHƯNG **bbox cần migration #6** — chunk lưu
  locator bằng CỘT (char_start/char_end, t_start/t_end), nên bbox thêm 4 cột `bbox_x/bbox_y/bbox_w/bbox_h`
  REAL (ADD COLUMN thuần, append-only, KHÔNG phá CHECK — đơn giản hơn #5). _(Đính chính: intake/thảo luận
  ban đầu nói "không migration" — đúng cho kind, sai cho bbox; xác minh schema ở plan → cần #6.)_ **CSP:**
  chỉ thêm `iv-media:` vào `img-src` (đang có `'self' data:`).

## Giả định / mặc định (spec Assumptions; clarify xác nhận nếu intake nêu)

- **Định dạng:** png, jpg/jpeg, webp, bmp, tiff. **heic ngoài phạm vi** (cần chuyển đổi). gif → khung đầu.
- **`Locator` thêm `bbox?`** `{x,y,w,h}` **chuẩn hoá 0..1** (theo kích thước ảnh) để overlay co giãn.
  Backward-compat (như tStart/tEnd của 045).
- **Ảnh KHÔNG có chữ** (OCR rỗng) → **VẪN nạp thành công** (ready, 0 chunk, ảnh vẫn xem được) — như video
  no-audio (051 FR-011).
- **Giới hạn kích thước ảnh:** 50MB/nguồn.
- **Ngôn ngữ OCR:** `vie+eng` (dự án tiếng Việt).
- **bbox mức DÒNG** (hợp vùng cho chunk nhiều dòng — vùng chữ nhật đủ để "chỉ đúng chỗ").
- **OCR chạy ở main** (Constitution III); ảnh đọc theo path từ DB (không renderer); không log nội dung/path.

## Clarify (2026-07-13) — 6 ambiguity đã chốt

- **C1 — Định dạng ảnh:** png, jpg/jpeg, webp, bmp, **tiff** (phủ scan). **heic + gif NGOÀI phạm vi** (heic
  cần chuyển đổi; gif động phức tạp).
- **C2 — Độ mịn bbox:** **mức DÒNG** — chunk nhiều dòng → overlay = **hợp bbox các dòng** (1 khối chữ nhật).
  Khớp cách chunk theo char sẵn có; đủ "chỉ đúng đoạn".
- **C3 — Ảnh KHÔNG có chữ (OCR rỗng):** **VẪN nạp thành công** (ready, 0 chunk, ảnh vẫn xem được), báo nhẹ
  "không phát hiện chữ trong ảnh" — như video no-audio (051 FR-011). _(bake mặc định.)_
- **C4 — Giới hạn kích thước ảnh:** **50MB/nguồn**. _(bake mặc định.)_
- **C5 — Đóng gói tesseract.js-core (wasm) + worker:** thuộc plan — asarUnpack `tesseract.js-core` +
  `corePath`/`workerPath` trỏ vị trí đúng (dev vs đóng gói), như xử lý native/wasm khác. _(plan lo.)_
- **C6 — Tiến độ OCR:** tái dùng `SourceProgressEvent` (037) — bước `ocr` (logger tesseract → progress).
  _(bake mặc định.)_

## Phạm vi

- **Trong 053:** nạp ảnh (png/jpg/jpeg/webp/bmp/tiff), OCR tesseract.js vie+eng ở main (cache+badge+progress),
  `boxMap`→`Locator.bbox`, `kind=image`, `iv-media://` +image MIME, Source Viewer `<img>` + overlay bbox,
  bật ô Ảnh AddSourceModal, size-limit ảnh 50MB.
- **Ngoài 053:** vision Ollama (mô tả ảnh); heic; layout/table/handwriting detection; tiền xử lý nâng cao
  (deskew/threshold) ngoài mặc định tesseract.
