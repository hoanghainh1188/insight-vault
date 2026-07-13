# Quickstart / Validation — 053-image

## Prerequisites

- `npm ci` (tesseract.js + tesseract.js-core + image-size). 045/049/051 đã merge.
- (Manual) Ollama + ảnh có chữ (screenshot/scan). Lần OCR đầu cần Internet (tải traineddata vie+eng).

## Automated gate (bắt buộc xanh)

```bash
npm run lint
npm run test          # coverage ≥80%; test mới: image-transcript (boxMap/bboxForCharRange), ocr-path,
                      #   parseImage (DI), media-range image MIME, media-serve image, pipeline image route
                      #   (+ảnh không chữ→ready), source-viewer image (jsdom <img>+overlay), migration #6
npm run build
npx playwright test ingestion security no-egress source-viewer shell   # e2e cũ xanh
```

### Kiểm đóng gói tesseract-core (rủi ro chính — gate)

```bash
npm run pack
ls release/**/app.asar.unpacked/node_modules/tesseract.js-core/*.wasm   # phải có wasm core
```

- `resolveCorePath()` (unit) khẳng định thay `app.asar`→`app.asar.unpacked` khi đóng gói.

## Manual validation

1. `npm run dev`. Modal Thêm nguồn → ô **Hình ảnh** đã bật.
2. **US1**: nạp screenshot có chữ → tiến độ bước OCR → `ready` → hỏi → chip `[n]` trỏ ảnh.
3. **US2**: bấm `[n]` → Source Viewer hiện `<img>` + **khung nổi bật đúng vùng chữ**; thu/phóng cửa sổ →
   khung vẫn khớp (bbox chuẩn hoá co giãn). Mở ảnh trực tiếp → không khung.
4. **US3**: nạp ảnh phong cảnh (không chữ) → nạp thành công, xem được, báo "không phát hiện chữ".
5. **Edge file mất**: xoá ảnh gốc → mở nguồn → báo lỗi; transcript giữ.
6. **Egress**: sau khi traineddata đã tải, giám sát mạng khi nạp/OCR/xem → 0 request ngoài; badge "Chạy
   cục bộ" (badge egress chỉ hiện lúc tải traineddata lần đầu).

## Rollback

Migration #6 chỉ ADD COLUMN (append-only) — revert code an toàn (cột thừa vô hại). Gỡ deps nếu cần.
