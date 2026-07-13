# Implementation Plan: Nạp Hình ảnh — OCR + bbox (Pha 2c)

**Branch**: `053-image` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature spec `specs/20260713-074439-image/spec.md`. Bám ADR `docs/04-decisions/2026-07-13-image-clarify.md`.

## Summary

Nạp ảnh (png/jpg/jpeg/webp/bmp/tiff) → **OCR tesseract.js (WASM, local ở main, vie+eng)** trích text +
**bbox mỗi dòng** → `boxMap` (char↔bbox, **cùng cơ chế `timeMap` 045**) → chunk theo char → `Locator.bbox`
(chuẩn hoá 0..1). `kind=image`. Source Viewer render `<img>` qua **`iv-media://`** (049/051) + **overlay
khung bbox** khi bấm chip `[n]`. Traineddata tải lần đầu (badge egress, như Whisper 045). `kind=image`
KHÔNG cần migration (045 bỏ CHECK), nhưng **bbox cần migration #6** (ADD 4 cột bbox_x/y/w/h REAL — thuần
append, không phá CHECK); **CSP** chỉ thêm `iv-media:` vào `img-src`. Rủi ro chính: **đóng gói
tesseract.js-core (wasm) + worker** cross-platform.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18, Electron + electron-vite.

**Primary Dependencies**: **`tesseract.js` ^7** (OCR WASM + worker Node) + **`tesseract.js-core`** (wasm,
dep của tesseract.js) + **`image-size` ^2** (đọc WxH từ header, không decode). Kế thừa `electron.protocol`
(049/051). KHÔNG binary native (khác ffmpeg — chỉ WASM).

**Storage**: `node:sqlite` — cột `origin`/`kind` sẵn có; **migration #6** thêm 4 cột `bbox_*` REAL cho
chunk (ADD COLUMN thuần). Traineddata cache
`<dataDir>/models/tesseract` (tải lần đầu).

**Testing**: Vitest (node + jsdom) — image-transcript (thuần boxMap/bboxForCharRange), ocr-path (thuần),
parseImage (DI mock ocr), media-range/size-limits/media-serve/pipeline mở rộng, SourceViewer image (jsdom).
OCR thật → verify Node (đã làm) + manual.

**Target Platform**: Desktop Electron (macOS arm64 + Windows x64) — wasm core + worker phải đóng gói kèm.

**Project Type**: Desktop app 3 tiến trình; cô lập `src/main/services/ingestion/image/`.

**Performance Goals**: OCR nền, tiến độ theo bước; overlay bbox khớp vị trí ở mọi kích thước hiển thị.

**Constraints**: Offline sau tải traineddata lần đầu; không gửi ảnh ra ngoài; renderer sandbox không đọc
FS/không OCR; file <400 dòng; coverage ≥80%.

**Scale/Scope**: ảnh ≤50MB/nguồn. ~4 file main mới + sửa pipeline/parsers/SourceKind/Locator/media-range/
SourceViewer/AddSourceModal + config.

## Constitution Check

_GATE: pass trước Phase 0; re-check sau Phase 1._

- **I. Local-first & No Default Egress** — ✅ OCR tesseract.js WASM + core **local** (node_modules, không
  tải); chỉ **traineddata** tải lần đầu → `setOnline` badge egress (như Whisper 045), sau offline. Ảnh
  không rời máy. `iv-media://` cục bộ; CSP chỉ thêm `img-src iv-media:`.
- **II. Verifiable Citations** — ✅ bbox từ OCR (`data.blocks[].lines[].bbox`) → `boxMap` → `Locator.bbox`;
  chip `[n]` map đúng vùng chữ; overlay khung đúng chỗ; file mất → giữ transcript + chip.
- **III. Desktop Security Boundary** — ✅ OCR + đọc/stream ảnh CHỈ ở main; renderer sandbox chỉ gán
  `<img src>`; ảnh tra theo ID nguồn từ DB (không path từ renderer); không log path/nội dung.
- **IV. Test-First & Coverage** — ✅ hàm thuần (image-transcript/ocr-path) + parseImage (DI) test-first;
  jsdom cho `<img>`+overlay.
- **V. Phased Delivery** — ✅ Pha 2c sau 2a/2b (merged); khép Pha 2.
- **Additional** — ✅ ADR + clarify (6 điểm); intake `docs/intake/053-image.md`; migration #6 (ADD 4 cột
  bbox — thuần append); security
  review sẽ chạy (OCR + FS + protocol). Glossary: OCR/bbox/boxMap/image.

→ **Không vi phạm.** Complexity Tracking trống.

## Project Structure

### Documentation (this feature)

```text
specs/20260713-074439-image/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (ocr-contract.md, image-mime-bbox.md)
└── tasks.md (/speckit-tasks)
```

### Source Code (repository root)

```text
src/main/services/ingestion/
├── image/
│   ├── ocr-path.ts             # MỚI (thuần): resolve corePath dev↔app.asar.unpacked (như ffmpeg-path 051)
│   ├── ocr.ts                  # MỚI (I/O): createOcr({cacheDir, setOnline}) → worker tesseract lazy;
│   │                           #   recognize(path) → {text, lines:[{text,bbox}]}; badge egress lần tải đầu
│   └── image-transcript.ts     # MỚI (THUẦN): buildImageTranscript(lines, imgW, imgH) → {text, boxMap};
│                               #   bboxForCharRange(boxMap, cStart, cEnd) → hợp bbox (0..1) — ~ audio-transcript
├── parsers/
│   └── image.ts                # MỚI: parseImage(path, ocr, readDims) → OCR + buildImageTranscript;
│                               #   ảnh không chữ → ParseResult rỗng
├── pipeline.ts                 # SỬA: kind=image → parseImage; boxMap→Locator.bbox (~ timeMap→tStart);
│                               #   ảnh không chữ → ready 0 chunk (như video no-audio 051)
├── size-limits.ts              # SỬA: image 50MB
└── source-repo.ts              # KHÔNG đổi

src/main/services/source-viewer/media-range.ts   # SỬA: +image MIME (png/jpg/webp/bmp/tiff/gif)
src/main/services/source-viewer/media-serve.ts    # SỬA: nhận kind=image
src/shared/ipc/types.ts                            # SỬA: SourceKind +image; Locator +bbox?{x,y,w,h}

src/renderer/features/
├── source-viewer/SourceViewer.tsx    # SỬA: kind=image → <img> + overlay khung bbox (div %) khi có bbox
├── source-viewer/source-viewer.css   # SỬA: .vimage + .vbbox (overlay)
├── sources/AddSourceModal.tsx        # SỬA: bật ô Hình ảnh (→ tab Tệp) + accept + ext
└── sources/SourceItem.tsx            # SỬA: kind=image icon

electron.vite.config.ts               # SỬA: CSP img-src thêm iv-media:
electron-builder.yml                  # SỬA: asarUnpack tesseract.js-core + tesseract.js
package.json                          # SỬA: +tesseract.js +tesseract.js-core +image-size
```

**Structure Decision**: Feature-isolated `src/main/services/ingestion/image/`. Tách **thuần**
(`image-transcript.ts` boxMap/bboxForCharRange — crux, test kỹ; `ocr-path.ts` resolve) khỏi **I/O**
(`ocr.ts` worker tesseract). `parseImage` tái dùng pattern parser (như parseVideo 051). boxMap ~ timeMap
045, bboxForCharRange ~ timeForCharRange → tái dùng nguyên tư duy. `<img>` overlay tái dùng iv-media:// +
onError của 049/051.

## Complexity Tracking

> Không vi phạm Constitution — trống. (Rủi ro đóng gói tesseract-core ghi ở research.md — rủi ro kỹ thuật.)
