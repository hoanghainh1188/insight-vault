# Tasks: Nạp Hình ảnh — OCR + bbox (Pha 2c)

**Feature**: `053-image` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Ghi chú**: Tests BẮT BUỘC (Constitution IV). `[P]` = song song. OCR thật đã verify Node; luồng phủ
mock/DI + build-verify + manual.

## Phase 1: Setup

- [x] T001 Thêm `tesseract.js` `tesseract.js-core` `image-size` vào `dependencies` (`package.json`) + `npm install`.
- [x] T002 [P] `electron.vite.config.ts`: CSP DEV+PROD `img-src` thêm `iv-media:` (giữ `'self' data:`).
- [x] T003 [P] `electron-builder.yml`: `asarUnpack` thêm `node_modules/tesseract.js/**` + `node_modules/tesseract.js-core/**`.
- [x] T004 [P] `src/shared/ipc/types.ts`: `SourceKind` +`"image"`; `Locator` +`bbox?:{x,y,w,h}`.

## Phase 2: Foundational (migration + OCR + boxMap + MIME/handler — chặn mọi US)

- [x] T005 Migration #6 `src/main/db/migrations.ts`: `ALTER TABLE chunk ADD COLUMN bbox_x/bbox_y/bbox_w/bbox_h REAL` (append-only, không phá CHECK). Test-first `tests/unit/migration-image.test.ts` (user_version tăng; 4 cột tồn tại; chunk cũ giữ nguyên).
- [x] T006 `src/main/services/ingestion/source-repo.ts`: đọc `bbox_*`→`locator.bbox` khi `bbox_x!=null` (như t_start); `insertChunks` ghi 4 cột bbox. Bổ sung test source-repo (chunk có bbox round-trip).
- [x] T007 [P] Test-first `tests/unit/image-transcript.test.ts` (THUẦN): `buildImageTranscript(lines,w,h)` chuẩn hoá 0..1 + text ghép; `bboxForCharRange` hợp nhiều dòng (1 khối), null ngoài range, kẹp 0..1.
- [x] T008 Cài `src/main/services/ingestion/image/image-transcript.ts` cho GREEN.
- [x] T009 [P] Test-first `tests/unit/ocr-path.test.ts`: `resolveCorePath` dev giữ / packaged thay app.asar→unpacked.
- [x] T010 Cài `src/main/services/ingestion/image/ocr-path.ts` cho GREEN.
- [x] T011 Cài `src/main/services/ingestion/image/ocr.ts` (I/O): `createOcr({cacheDir,setOnline})` worker tesseract lazy (corePath resolve; recognize→OcrLine[] từ blocks.lines; setOnline bọc tải traineddata đầu; không log). (exclude coverage.)
- [x] T012 [P] Test-first mở rộng `tests/unit/media-range.test.ts`: MIME image png/jpg/jpeg/webp/bmp/tiff/gif; giữ audio/video.
- [x] T013 `src/main/services/source-viewer/media-range.ts`: thêm image MIME.
- [x] T014 `src/main/services/source-viewer/media-serve.ts`: nới kiểm kind nhận `image`. Bổ sung test media-serve.test.ts kind=image → 200.
- [x] T015 [P] Test-first mở rộng `tests/unit/size-limits.test.ts`: image 50MB.
- [x] T016 `src/main/services/ingestion/size-limits.ts`: image 50MB.

**Checkpoint**: migration bbox, OCR (mock-able), boxMap thuần, MIME/handler ảnh sẵn sàng.

## Phase 3: User Story 1 — Nạp ảnh, hỏi đáp có trích dẫn (P1) 🎯 MVP

- [x] T017 [US1] Test-first `tests/unit/parse-image.test.ts` (DI mock ocr + readDims): có dòng→ParseResult text+boxMap; rỗng (không chữ)→ParseResult rỗng.
- [x] T018 [US1] Cài `src/main/services/ingestion/parsers/image.ts` (`parseImage(path, ocr, readDims)`).
- [x] T019 [US1] `src/main/services/ingestion/parsers/index.ts`: `EXT_KIND` + png/jpg/jpeg/webp/bmp/tiff→image; `ParseResult` +`boxMap?`. Test map ext.
- [x] T020 [US1] `src/main/services/ingestion/pipeline.ts`: route `kind=image` (statSize + parseImage); gắn `Locator.bbox` mỗi chunk qua `bboxForCharRange` (song song nhánh timeMap); ảnh không chữ→ready 0 chunk. Bổ sung test pipeline image route.
- [x] T021 [US1] `src/main/services/ingestion/ingestion.ts`: wire `parseImage` (createOcr + image-size readDims); cache `<dataDir>/models/tesseract`.

**Checkpoint**: nạp ảnh có chữ → transcript + chip (unit/DI; e2e thật→manual).

## Phase 4: User Story 2 — Xem lại đúng vùng chữ (highlight bbox) (P1)

- [x] T022 [US2] Test-first `tests/unit/source-viewer-image.test.ts` (jsdom): `kind=image`→`<img>` src iv-media encoded; có `locator.bbox`→overlay `viewer-bbox` với left/top/width/height %; không bbox→không overlay; onError→thông báo.
- [x] T023 [US2] `src/renderer/features/source-viewer/SourceViewer.tsx`: `kind==="image"`→khung relative + `<img>` + overlay bbox div (%); tái dùng onError 049.
- [x] T024 [P] [US2] `src/renderer/features/source-viewer/source-viewer.css`: `.vimage` (khung relative) + `.vbbox` (overlay khung nổi bật, border/màu cite).

**Checkpoint**: chip `[n]` ảnh → khung bbox đúng vùng.

## Phase 5: User Story 3 — Ảnh không chữ + UI modal (P2)

- [x] T025 [US3] `src/renderer/features/sources/AddSourceModal.tsx`: bật ô "Hình ảnh" (→ tab Tệp); accept + FILE_EXT png/jpg/jpeg/webp/bmp/tiff; cập nhật hint + thông báo lỗi định dạng.
- [x] T026 [US3] `src/renderer/features/sources/SourceItem.tsx`: `KIND_ICON`/subLabel +image ("IMG"/"Hình ảnh").
- [x] T027 [US3] Xác nhận ảnh không chữ → ready 0 chunk (pipeline T020) + báo nhẹ; e2e ingestion cập nhật ô Hình ảnh bật.

**Checkpoint**: 3 US hoàn tất, kiểm độc lập.

## Phase 6: Polish & Cross-Cutting

- [x] T028 [P] ADR `2026-07-13-image-clarify.md` + INDEX (đã có) — xác nhận; glossary append OCR/bbox/boxMap/kind=image/traineddata.
- [x] T029 Gate: `npm run lint` + `npm run test` (≥80%) + `npm run build` + **kiểm tesseract-core wasm ở app.asar.unpacked** (`npm run pack`) + e2e (ingestion/security/no-egress/source-viewer/shell).
- [x] T030 Kiểm thử thủ công `quickstart.md`: US1/US2 (bbox co giãn)/US3 + file mất + egress (traineddata lần đầu) — cần ảnh thật + Ollama.

## Dependencies & Execution Order

- Setup (T001–T004) → Foundational (T005–T016) trước mọi US.
- US1 (T017–T021) cần Foundational (OCR/boxMap/migration). MVP.
- US2 (T022–T024) cần Foundational (MIME/handler + Locator.bbox) — song song US1 (renderer vs main).
- US3 (T025–T027) cần US1 (pipeline route). Polish (T028–T030) sau cùng.

## Parallel Execution Examples

- Setup: T002 ∥ T003 ∥ T004.
- Foundational: T007/T009/T012/T015 (test-first, file khác) song song.
- US1 ∥ US2: pipeline (main) ∥ SourceViewer image (renderer).

## Implementation Strategy

- **MVP = US1** (nạp ảnh → hỏi đáp có chip). US2 (bbox highlight) ngang P1 — làm liền/song song.
- Rủi ro cao nhất = **đóng gói tesseract-core** → verify `npm run pack` thật ở T029 (OCR chain đã verify Node).
- Luồng OCR thật → mock/DI ở unit; xác nhận manual (quickstart) với ảnh thật.
