# Tasks: Audio player + seek tới trích dẫn (2a-player)

**Feature**: `049-audio-player` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Ghi chú**: Feature đã được implement; tasks dưới đây map 1-1 với code/test hiện có (artifact hồi tố).
Tests là BẮT BUỘC theo Constitution IV (test-first ≥80%). `[P]` = có thể chạy song song (file khác nhau,
không phụ thuộc task chưa xong).

## Phase 1: Setup

- [x] T001 Xác nhận KHÔNG thêm dependency mới (dùng `electron.protocol`, `node:fs`, `node:stream` sẵn có) và KHÔNG migration (dùng cột `origin`/`kind` của bảng `source` từ 045) — kiểm `package.json` không đổi deps.
- [x] T002 [P] Nới CSP tối thiểu cho `<audio>` trong `electron.vite.config.ts`: thêm `media-src 'self' iv-media:` vào cả DEV và PROD; KHÔNG thêm `connect-src`.
- [x] T003 [P] Cập nhật `tsconfig.node.json`: thêm `src/renderer/env.d.ts` vào `include` (để test import renderer dùng `window.api` compile được dưới tsc-node).

## Phase 2: Foundational (giao thức media — chặn mọi user story)

**Mục tiêu**: Hạ tầng phục vụ file audio gốc cho renderer qua `iv-media://` (mọi US đều cần để phát được).

- [x] T004 [P] Viết test hàm thuần TRƯỚC (RED) trong `tests/unit/media-range.test.ts`: `extOf` (đuôi thường hoá, không đuôi/dấu chấm cuối → ""), `mimeForAudioExt` (mp3/wav/flac/ogg + default audio/mpeg + không phân biệt hoa thường), `parseRange` (start-end / start- / suffix -N / vượt size kẹp / start>end → null / start>=size → null / size<=0 → null / header null → null).
- [x] T005 Cài `src/main/services/source-viewer/media-range.ts` (THUẦN) cho GREEN: `extOf(path)`, `mimeForAudioExt(ext)`, `parseRange(header,size)` kẹp `[0,size)`.
- [x] T006 Viết test integration TRƯỚC (RED) trong `tests/unit/media-serve.test.ts`: fake `SourceRepo` + temp file; kiểm `createMediaHandler` trả 404 (id không có / `kind!=="audio"` / file gốc mất), 200 full (Content-Type/Content-Length/Accept-Ranges + body đúng), 206 (Content-Range + đúng lát byte), id đã `encodeURIComponent` decode đúng.
- [x] T007 Cài `src/main/services/source-viewer/media-serve.ts` (I/O) cho GREEN: `createMediaHandler(sourceRepo)` — parse `sourceId` từ URL `iv-media://source/<id>` (decodeURIComponent) → `getById` (404) → chỉ `kind==="audio"` (404) → `getOrigin` + `existsSync`/`statSync` (404 nếu mất) → `createReadStream` + `Readable.toWeb`; Range hợp lệ → 206, else 200. KHÔNG log path/nội dung.
- [x] T008 Đăng ký giao thức trong `src/main/index.ts`: import `protocol`; `registerSchemesAsPrivileged([{scheme:"iv-media", privileges:{stream:true, supportFetchAPI:true}}])` top-level TRƯỚC `whenReady`; `protocol.handle("iv-media", createMediaHandler(ingestion.sourceRepo))` trong `whenReady` sau khi tạo `ingestion`.
- [x] T009 [P] Cập nhật `vitest.config.ts`: thêm `media-range.ts` vào coverage `include`; thêm `media-serve.ts` vào `exclude` (I/O wiring — đã có integration test T006).

**Checkpoint**: `iv-media://source/<id>` phục vụ file audio với Range/seek; hàm thuần + handler xanh.

## Phase 3: User Story 1 — Seek theo trích dẫn (Priority: P1) 🎯 MVP

**Goal**: Bấm chip `[n]` audio → Source Viewer mở, player tua tới `tStart` + tự phát, transcript highlight.

**Independent Test**: Mở nguồn audio qua chip `[n]` → player hiện + vị trí phát khớp `tStart` + highlight đúng đoạn.

- [x] T010 [US1] Viết test component TRƯỚC (RED) trong `tests/unit/source-viewer-audio.test.ts` (jsdom): render `<audio>` khi `content.kind==="audio"` với `src="iv-media://source/<encoded>"` (testid `viewer-audio-player`); seek — sau `loadedmetadata`, `currentTime` = `citation.locator.tStart` và `play()` được gọi (override `currentTime`/`play` để tất định; stub `scrollIntoView`).
- [x] T011 [US1] Trong `src/renderer/features/source-viewer/SourceViewer.tsx`: thêm `audioRef`, cờ `isAudio = content?.kind==="audio"`, `tStart = citation?.locator.tStart`; render `<audio controls preload="metadata" src={`iv-media://source/${encodeURIComponent(target.sourceId)}`}>` sticky phía trên `.vtext` khi `isAudio`.
- [x] T012 [US1] Trong cùng file: effect seek phụ thuộc `[tStart, target?.sourceId]` — `readyState>=1` → set `currentTime=tStart` + `play().catch(()=>{})`; else `addEventListener("loadedmetadata", seek, {once:true})` + cleanup.
- [x] T013 [P] [US1] Trong `src/renderer/features/source-viewer/source-viewer.css`: `.vaudio` (sticky, `top` âm để dính, nền `--surface`, `border-bottom`) + `.vaudio-el` (width 100%, height 36px).

**Checkpoint**: US1 độc lập kiểm được — chip `[n]` audio mở player + seek đúng.

## Phase 4: User Story 2 — Mở nguồn audio trực tiếp (Priority: P2)

**Goal**: Mở nguồn audio từ cột Nguồn → player phát từ đầu; nguồn không phải audio → không có player.

**Independent Test**: Mở trực tiếp nguồn audio (citation=null) → player hiện; mở nguồn pdf/txt → không player.

- [x] T014 [US2] Bổ sung test trong `tests/unit/source-viewer-audio.test.ts`: nguồn `kind!=="audio"` (vd pdf) → KHÔNG render `viewer-audio-player`.
- [x] T015 [US2] Xác nhận trong `SourceViewer.tsx` player chỉ render khi `isAudio && target` (citation=null vẫn render player, không áp mốc tua vì `tStart` undefined → effect no-op) — không cần code thêm ngoài điều kiện render ở T011.

**Checkpoint**: US2 kiểm được độc lập; phân biệt audio/non-audio đúng.

## Phase 5: User Story 3 — File gốc mất vẫn dùng transcript (Priority: P3)

**Goal**: File gốc xoá/di chuyển → player báo lỗi thân thiện; transcript + chip `[n]` + highlight vẫn hoạt động.

**Independent Test**: Mở nguồn audio có file gốc mất → thấy thông báo lỗi + transcript vẫn xem được.

- [x] T016 [US3] Bổ sung test trong `tests/unit/source-viewer-audio.test.ts`: dispatch `error` trên `<audio>` → hiện `viewer-audio-error` chứa "Không phát được"; ban đầu chưa có thông báo.
- [x] T017 [US3] Trong `SourceViewer.tsx`: thêm state `audioError`; `onError` trên `<audio>` set `true`; render `<p data-testid="viewer-audio-error">` thông báo khi `audioError`; effect reset `audioError=false` khi đổi `target?.sourceId`.
- [x] T018 [P] [US3] Trong `source-viewer.css`: `.vaudio-err` (12px, màu `--danger`).

**Checkpoint**: cả 3 user story hoàn tất & kiểm được độc lập.

## Phase 6: Polish & Cross-Cutting

- [x] T019 [P] Ghi quyết định `docs/04-decisions/2026-07-12-audio-player-clarify.md` (giao thức, tham chiếu-không-copy, player+seek, CSP) + append `docs/04-decisions/INDEX.md`.
- [x] T020 [P] Bổ sung phòng thủ: `encodeURIComponent(sourceId)` ở `<audio src>` (đã ở T011) — xác nhận không dùng path thô.
- [x] T021 Chạy test gate: `npm run lint` + `npm run test` (coverage ≥80%) + `npm run build` + `npx playwright test security no-egress source-viewer shell` (e2e cũ giữ xanh do CSP/protocol không phá).
- [x] T022 Kiểm thử thủ công theo `quickstart.md` (US1/US2/US3 + egress) với nguồn audio đã bóc băng.

## Dependencies & Execution Order

- **Setup (T001–T003)** → **Foundational (T004–T009)** phải xong trước mọi user story.
- **US1 (T010–T013)** phụ thuộc Foundational (cần giao thức phát). Là MVP.
- **US2 (T014–T015)** và **US3 (T016–T018)** phụ thuộc US1 (chung `SourceViewer.tsx` — render/effect nền), nên làm tuần tự sau US1; các task CSS `[P]` (T013/T018) độc lập file CSS.
- **Polish (T019–T022)** sau cùng.
- Không có story nào cần migration/IPC mới.

## Parallel Execution Examples

- Setup: T002 (CSP) ∥ T003 (tsconfig) — file khác nhau.
- Foundational: T004 (test thuần) ∥ (chuẩn bị) T009 (vitest config) trước khi vào T005/T007.
- US1: T013 (CSS) ∥ T010 (test component).
- Polish: T019 (ADR) ∥ T020 (defense-in-depth).

## Implementation Strategy

- **MVP = US1** (seek theo trích dẫn) — giá trị cốt lõi "kiểm chứng bằng tai". Ship được ngay sau Phase 3.
- US2/US3 là tăng cường (mở trực tiếp; xử lý lỗi file mất) — thêm dần trên cùng component.
- Luồng phát/seek thật cần audio đã transcribe → phủ unit+integration+component + manual (quickstart);
  không ép e2e nặng Whisper vào CI.
