# Tasks: Nạp nguồn Video (Pha 2b)

**Feature**: `051-video` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Ghi chú**: Tests BẮT BUỘC (Constitution IV). `[P]` = song song (file khác, không phụ thuộc task chưa
xong). Luồng ffmpeg thật phủ mock + build-verify + manual (quickstart).

## Phase 1: Setup

- [x] T001 Thêm `ffmpeg-static` vào `dependencies` (`package.json`) + `npm install` (postinstall tải binary host).
- [x] T002 [P] `electron-builder.yml`: thêm `node_modules/ffmpeg-static/**` vào `asarUnpack` (binary ngoài asar).
- [x] T003 [P] `src/shared/ipc/types.ts`: thêm `"video"` vào `SourceKind`.

## Phase 2: Foundational (tách audio + MIME + player video — chặn mọi US)

- [x] T004 [P] Test-first `tests/unit/ffmpeg-path.test.ts`: `resolveFfmpegPath()` — dev trả path nguyên; đóng gói thay `app.asar`→`app.asar.unpacked`.
- [x] T005 Cài `src/main/services/ingestion/video/ffmpeg-path.ts` cho GREEN.
- [x] T006 [P] Test-first `tests/unit/extract-audio.test.ts` (mock `child_process.spawn`): exit 0 + file out → path; exit≠0 + stderr "does not contain any stream" → null; lỗi khác → throw; KHÔNG log path.
- [x] T007 Cài `src/main/services/ingestion/video/extract-audio.ts` (spawn ffmpeg mảng tham số `-vn -ac 1 -ar 16000 -f wav`; no-audio→null; xoá do caller).
- [x] T008 [P] Test-first mở rộng `tests/unit/media-range.test.ts`: MIME video mp4/mov/webm/mkv + m4a/aac; giữ audio 049.
- [x] T009 `src/main/services/source-viewer/media-range.ts`: thêm MIME video + m4a/aac (giữ export cũ để không phá test 049).
- [x] T010 `src/main/services/source-viewer/media-serve.ts`: nới kiểm `kind` — chấp nhận `"audio"` VÀ `"video"` (loại khác 404). Bổ sung test media-serve.test.ts case kind=video → 200/206.
- [x] T011 [P] Test-first `tests/unit/size-limits.test.ts` (hoặc mở rộng): video 1GB; audio thêm m4a/aac 200MB.
- [x] T012 `src/main/services/ingestion/size-limits.ts`: thêm video (1GB) + m4a/aac (audio 200MB).

**Checkpoint**: tách audio (mock xanh), MIME video, handler phục vụ video, giới hạn kích thước sẵn sàng.

## Phase 3: User Story 1 — Nạp video, hỏi đáp có trích dẫn (P1) 🎯 MVP

- [x] T013 [US1] Test-first `tests/unit/parse-video.test.ts` (DI mock extractor+transcriber): wav→ParseResult đầy đủ (tStart/tEnd); null (no-audio)→rỗng; wav tạm được xoá (`finally`).
- [x] T014 [US1] Cài `src/main/services/ingestion/parsers/video.ts`: `parseVideo(path, extractor, transcriber, onProgress)` → extract → parseAudio (045) → xoá tmp; no-audio→rỗng.
- [x] T015 [US1] `src/main/services/ingestion/pipeline.ts`: route `kind=video` → parseVideo (thêm bước tiến độ `extract` trước `parse`); `m4a/aac` → parseAudio + `kind=audio`. Bổ sung test pipeline (DI) cho nhánh video.
- [x] T016 [US1] `src/main/services/ingestion/parsers/index.ts` (hoặc nơi map ext→kind): nhận mp4/mov/webm/mkv→video; m4a/aac→audio. Test map ext.

**Checkpoint**: nạp video có tiếng → transcript + chip `[n]` (kiểm qua unit/DI; e2e thật → manual).

## Phase 4: User Story 2 — Player video + seek (P1)

- [x] T017 [US2] Test-first mở rộng `tests/unit/source-viewer-audio.test.ts` (hoặc file mới jsdom): `kind="video"` → render `<video>` src iv-media encoded; seek tới tStart sau `loadedmetadata`; onError hiện thông báo.
- [x] T018 [US2] `src/renderer/features/source-viewer/SourceViewer.tsx`: `kind==="video"` → `<video controls>` (tái dùng ref/effect seek/onError 049; đổi element). `kind==="audio"` giữ `<audio>`.
- [x] T019 [P] [US2] `src/renderer/features/source-viewer/source-viewer.css`: khung `<video>` (.vvideo hoặc tái dùng .vaudio; max-width/height hợp lý).

**Checkpoint**: chip `[n]` video → `<video>` seek đúng mốc.

## Phase 5: User Story 3 — Nạp m4a/aac + UX modal (P2)

- [x] T020 [US3] `src/renderer/features/sources/AddSourceModal.tsx`: bật tab Audio/Video (đang disabled); nhận ext mp4/mov/webm/mkv/m4a/aac; thêm **ghi chú UX** khi chọn video ("video phát từ vị trí file gốc; xoá/di chuyển sẽ không phát lại được"). Bổ sung/để e2e cũ (add-source) xanh.
- [x] T021 [US3] Xác nhận m4a/aac đi nhánh audio (T015/T016) → mở nguồn hiện `<audio>` (không video). Test map ext (đã ở T016) phủ.

**Checkpoint**: 3 US hoàn tất, kiểm được độc lập.

## Phase 6: Polish & Cross-Cutting

- [x] T022 [P] ADR `docs/04-decisions/2026-07-13-video-clarify.md` + INDEX (đã có) — xác nhận khớp; glossary append `video`/`audio extraction (demux)`/`video player`.
- [x] T023 [P] Ghi chú license GPL ffmpeg-static vào tài liệu phát hành (README/notice) — bắt buộc khi ship.
- [x] T024 Gate: `npm run lint` + `npm run test` (≥80%) + `npm run build` + **kiểm binary ffmpeg ở app.asar.unpacked** + `npx playwright test security no-egress source-viewer shell`.
- [x] T025 Kiểm thử thủ công `quickstart.md`: US1/US2/US3 + no-audio + file mất + egress=0 (cần ffmpeg + video thật).

## Dependencies & Execution Order

- Setup (T001–T003) → Foundational (T004–T012) trước mọi US.
- US1 (T013–T016) cần Foundational (extract). MVP.
- US2 (T017–T019) cần Foundational (MIME/handler) — song song US1 được (renderer vs main).
- US3 (T020–T021) cần US1 (pipeline route). Polish (T022–T025) sau cùng.

## Parallel Execution Examples

- Setup: T002 ∥ T003.
- Foundational: T004/T006/T008/T011 (test-first, file khác) song song trước phần cài.
- US1 ∥ US2: pipeline (main) ∥ SourceViewer video (renderer).
- Polish: T022 ∥ T023.

## Implementation Strategy

- **MVP = US1** (nạp video → hỏi đáp có chip). US2 (player) ngang P1 — làm liền sau/song song.
- Rủi ro cao nhất = **đóng gói ffmpeg** → verify bằng `npm run build` thật ở T024 (không chỉ tin unit).
- Luồng ffmpeg thật (extract) → mock ở unit; xác nhận e2e/manual với video thật (quickstart).
