# Research — 053-image (Phase 0)

0 NEEDS CLARIFICATION (3 pivotal + 6 clarify chốt ở ADR). Tập trung API tesseract.js + đóng gói WASM.

## R1. tesseract.js v7 — API OCR + bbox (ĐÃ VERIFY THẬT ở Node)

- **Decision**: `createWorker("vie+eng", 1, { cachePath, logger, corePath?, workerPath? })` → `worker.
recognize(imagePath, {}, { blocks: true })` → `data.text` + `data.blocks[].paragraphs[].lines[]` (mỗi
  `line` có `.text` + `.bbox {x0,y0,x1,y1}` pixel). `worker.terminate()` khi xong (hoặc giữ lazy như 045).
- **Rationale**: `{blocks:true}` bắt buộc để có bbox (mặc định chỉ `text`). Line-level đủ cho highlight
  vùng (C2). Verify: ảnh test "InsightVault OCR" → text đúng + line bbox `{19,35,350,78}`.
- **cachePath**: nơi cache traineddata (`.traineddata` tải lần đầu từ CDN tesseract). Đặt
  `<dataDir>/models/tesseract` → nhất quán Whisper 045; sau tải chạy offline.
- **setOnline (badge egress)**: bọc lần tải traineddata đầu (giống transcribe 045 bọc `pipeline()` đầu).
- **Alternatives**: node-tesseract-ocr (cần binary tesseract hệ thống — phá offline/tự chủ) → loại.
  Vision Ollama → ngoài phạm vi (không bbox).

## R2. Đóng gói tesseract.js-core (WASM) + worker (RỦI RO CHÍNH)

- **Decision**: `tesseract.js-core` (wasm) + `tesseract.js` (worker Node `src/worker-script/node/index.js`)
  **có sẵn trong node_modules** (KHÔNG tải runtime — khác traineddata). electron-builder `asarUnpack:
node_modules/tesseract.js/**` + `node_modules/tesseract.js-core/**` (wasm phải ngoài asar để load).
- **Runtime resolve (ocr-path.ts)**: trong Node/main, tesseract.js tự `require.resolve` core/worker. Khi
  đóng gói, `require` tự trỏ `app.asar.unpacked` (Node xử lý .unpacked). **An toàn mặc định**; nếu lệch,
  set `corePath` = thư mục `tesseract.js-core` đã resolve (thay `app.asar`→`app.asar.unpacked` như
  ffmpeg-path 051) làm net an toàn. langPath dùng `cachePath` cho traineddata.
- **Rationale**: mẫu asarUnpack đồng nhất với ffmpeg (051)/lancedb/keytar. wasm không chạy trong asar.
- **Verify (bắt buộc gate)**: `npm run pack` → kiểm `app.asar.unpacked/node_modules/tesseract.js-core/
*.wasm` tồn tại + `resolveCorePath()` trỏ đúng.
- **Alternatives**: bundle traineddata luôn (installer to) → chọn tải-lần-đầu (ADR). corePath CDN (cần
  mạng runtime) → KHÔNG (phá offline) → dùng core local.

## R3. boxMap ~ timeMap (tái dùng cơ chế 045)

- **Decision**: `buildImageTranscript(lines, imgW, imgH)` → `{ text, boxMap:[{charStart,charEnd,bbox}] }`
  — ghép text các dòng (1 space/newline giữa dòng, chuẩn hoá như cleanText để khớp char sau), mỗi dòng 1
  entry boxMap với `bbox` **chuẩn hoá 0..1**: `{x:x0/imgW, y:y0/imgH, w:(x1-x0)/imgW, h:(y1-y0)/imgH}`.
  `bboxForCharRange(boxMap, cStart, cEnd)` → **hợp** (union) bbox các dòng giao `[cStart,cEnd)` → 1 bbox
  0..1. THUẦN — test kỹ (crux, như timeForCharRange).
- **Rationale**: đối xứng hoàn toàn với audio 045 (timeMap/timeForCharRange) → pipeline gắn `Locator.bbox`
  y như gắn `tStart/tEnd`. Chuẩn hoá 0..1 → overlay co giãn theo kích thước `<img>` hiển thị (dùng %).
- **imgW/imgH**: `image-size` đọc từ header (png/jpg/webp/bmp/tiff/gif) — không decode cả ảnh (nhẹ, an
  toàn bộ nhớ). tesseract cũng cần path ảnh; image-size đọc riêng.

## R4. Locator.bbox + pipeline

- **Decision**: `Locator` thêm `bbox?: {x,y,w,h}` (0..1, backward-compat như tStart/tEnd 045). Pipeline
  `kind=image`: `statSize` + `parseImage` → `boxMap` → gắn `bbox` mỗi chunk qua `bboxForCharRange` (song
  song với nhánh `timeMap`). Ảnh không chữ (OCR rỗng) → pages rỗng → cho phép với image (ready 0 chunk —
  như video no-audio 051).
- **Rationale**: tái dùng nguyên `processFull` (đã có nhánh timeMap); chỉ thêm nhánh bbox tương tự.

## R5. Hiển thị ảnh + overlay bbox (tái dùng iv-media:// 049/051)

- **Decision**: `media-range.ts` thêm image MIME (png→image/png, jpg/jpeg→image/jpeg, webp→image/webp,
  bmp→image/bmp, tiff→image/tiff, gif→image/gif). `media-serve.ts` nhận `kind=image`. SourceViewer:
  `kind==="image"` → `<img src="iv-media://source/<id>">`; khi `citation.locator.bbox` có → overlay `<div>`
  định vị `left/top/width/height` = bbox×100% trong khung bọc `position:relative` bao `<img>`. CSP thêm
  `iv-media:` vào `img-src`.
- **Rationale**: overlay % tự co giãn theo `<img>` (object-fit hoặc width:100%). Không cần biết pixel hiển
  thị. onError như 049 (file gốc mất → báo, transcript giữ).
- **Alternatives**: canvas vẽ bbox → phức tạp, không cần; div overlay đủ.
