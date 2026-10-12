# Tasks: Meeting Capture — ghi âm cuộc họp, transcript gần thời gian thực, nguồn cuộc họp trích dẫn theo timestamp (186)

> **Sửa sau analyze (2026-10-12):** K1 diễn giải Constitution III (không còn "ngoại lệ") — plan/research/spec/T065 · P1 `RecordingProvider` + thanh "Đang ghi"
>
> - giám sát renderer/không lô 5 s chuyển vào PR A (T042, T047, T052, T054; T113/T117 thành nâng cấp) · P2 US1 AC5/FR-009: PR A chỉ lưu khoảng ngừng, hiển thị ở B/C2 ·
>   C1 SC-002 (T022, T127) · C2 SC-001 180 phút (T127) · C3 SC-012 (T019) · C4 SC-010 tự động (T061) · I1 `MeetingState.segments` (contract, T094) · T1–T3 glossary ·
>   D1 electron-store (contract, T053) · A1 ngôn ngữ bản chốt PR A (T042) · A2 không có micro (T053) · A3 SC-004/SC-008 (T061, T099) · A4 ghi chú lệch D8 (T070).

**Input**: `specs/20261012-072338-meeting-capture/` (plan, spec, research R1–R18, data-model, contracts/meeting-ipc.md, quickstart); quyết định
`docs/04-decisions/2026-10-12-meeting-capture-clarify.md`.

**Tests**: BẮT BUỘC (Constitution IV — TDD). Mọi hàm/module thuần: viết test TRƯỚC, chạy thấy FAIL, rồi mới code. Coverage ≥ 80% logic nghiệp vụ; tệp I/O
(`capture-writer.ts`, `meeting-files.ts`, `asr-worker.ts`, `asr-client.ts`, `session-store.ts`, `capture/mic-capture.ts`, `capture/pcm-worklet.ts`) đưa vào
`exclude` của coverage như 045.

**Tổ chức**: 4 phase = **4 PR tuần tự**, mỗi PR ship độc lập. **PR A dùng chính branch `186-meeting-capture`** (mang theo intake / spec / plan / tasks / ADR — rule
3); PR B, C1, C2 mỗi PR một branch `186-meeting-capture-prb|prc1|prc2` cắt từ `main` sau khi PR trước merge (rule 6: sync main, chạy lại `/speckit-analyze` nếu
constitution/glossary đổi). Mỗi phase kết thúc bằng **cổng review**: code-reviewer → glossary-steward → security-reviewer (BẮT BUỘC ở PR A, B, C1; PR C2 theo quy trình
chung) → test gate (`npm run lint && npm run test && npm run build && npx playwright test <e2e của PR>`, coverage ≥ 80%).

**Quy ước**: không chạy prettier lên `docs/00-glossary.md`, `docs/04-decisions/INDEX.md` (sửa bằng script, chỉ THÊM dòng). `[P]` = khác tệp, không phụ thuộc task
chưa xong. Log không chứa audio / transcript / tiêu đề / đánh dấu / đường dẫn. Mọi chuỗi UI qua i18n domain `meeting` (vi nguồn `as const`, en `Widen`). Mọi UI mới:
chỉ animate `transform`/`opacity`, tôn trọng `prefers-reduced-motion`, focus-visible rõ, vừa cột 262 px ở vi + en. Seam test (`IV_ASR_FAKE`,
`IV_MEETING_SEGMENT_SEC`, `IV_E2E_AUDIO_PUMP`, `IV_E2E_FAKE_MIC`) chỉ có hiệu lực khi `!app.isPackaged`.

---

## Phase 1: PR A — Ghi âm thành nguồn (User Story 1 P1, User Story 2 P1) 🎯 MVP · 🔒 security-reviewer BẮT BUỘC

**Goal**: ghi micro thành phân đoạn WAV bền, tạm dừng/tiếp tục/kết thúc, hoàn tất bằng ASR chốt trong `asr-worker`, tạo nguồn `meeting` tham gia tìm kiếm/hỏi đáp/Studio;
citation audio/video chỉ tua; xoá/sao lưu đúng; sự cố ⇒ tự hoàn tất lần mở sau.

**Independent Test**: ghi 3 phút (1 lần tạm dừng) → kết thúc → nguồn `Sẵn sàng`; nghe lại; hỏi một câu ⇒ `[n]` mở đúng mốc và không tự phát; nguồn mp3 cũ cũng
không tự phát; xoá nguồn ⇒ thư mục phiên biến mất.

### Spike S1 (task đầu — chặn mọi task renderer capture)

- [x] T001 [US1] Spike S1 trên branch nháp `186-spike-s1` (KHÔNG merge): màn dev tạm `src/renderer/features/meeting-capture/spike/SpikeCapture.tsx` dùng
      `new AudioContext({ sampleRate: 16000 })` + `audioWorklet.addModule(new URL("./spike-worklet.ts", import.meta.url))` ghi 30 s Int16 qua một kênh IPC tạm ra
      `<userData>/spike.wav`; build `npm run dist:mac` và `npm run dist:win`, chạy bản đóng gói (`file://`, CSP PROD) xác minh 3 điểm của research R1 (16 kHz, addModule
      không bị CSP chặn, đổi tai nghe Bluetooth không lệch tốc độ) + một lần `utilityProcess.fork` nạp `@huggingface/transformers` từ asar (R5 — có cần `asarUnpack`
      `onnxruntime-node/**` không) + cờ `--use-fake-device-for-media-stream` có hiệu lực qua dòng lệnh Electron không (R15).
- [x] T002 [US1] Ghi kết quả S1 (máy, phiên bản, đạt/không, fallback chọn) vào mục "Kết quả spike S1" của ADR nháp `docs/04-decisions/2026-10-12-meeting-capture.md`;
      nếu cần fallback thì cập nhật research R1/R5/R15 tương ứng trước khi đi tiếp.

### Setup

- [x] T003 [US1] Thu fixture `tests/fixtures/meeting/speech-16k.wav` (≈ 60 s tiếng Việt + 30 s English + 10 s im lặng, 16 kHz mono, tự thu) + `tests/fixtures/meeting/README.md`
      ghi nguồn và giấy phép.
- [x] T004 [US1] Tạo domain i18n `src/shared/i18n/domains/meeting.ts` (`meetingVi` as const, `meetingEn: Widen<typeof meetingVi>`), đăng ký namespace `meeting` trong
      `src/shared/i18n/vi.ts` và `src/shared/i18n/en.ts` (khoá được bổ sung dần ở các task UI).

### Tests trước (FAIL rồi mới code)

- [x] T005 [P] [US1] Test TRƯỚC `tests/unit/permissions.test.ts` cho `decideMediaPermission` / `decidePermissionCheck` (`src/main/services/app-shell/permissions.ts`):
      chỉ `true` khi `permission="media"`, `mediaTypes` = `["audio"]`, origin renderer app (file:// hoặc URL dev), cửa sổ chính, `now < armedUntil`; từ chối khi có
      `video`, `mediaTypes` rỗng, origin lạ, hết cổng, mọi permission khác (`geolocation`, `notifications`, `clipboard-read`, `camera`…).
- [x] T006 [P] [US1] Test TRƯỚC `tests/unit/migration-meeting.test.ts` (khuôn `migration-source.test.ts`): chạy 1..11 + dữ liệu mẫu ⇒ `runMigrations` lên 12; 3 bảng +
      index theo data-model §2; CHECK `phase`, `language_mode`, `transcript_quality`, `marker.kind` từ chối giá trị lạ; cascade khi xoá `source`; dữ liệu cũ giữ nguyên;
      `PRAGMA foreign_key_check` rỗng; `user_version = 12`.
- [x] T007 [P] [US1] Test TRƯỚC `tests/unit/meeting-session-state.test.ts` cho `sessionTransition(state, event)` (`session-state.ts`): mọi chuyển ở data-model §5
      hợp lệ; chuyển không hợp lệ trả lỗi (vd `resume` khi `recording`); `ended_by_user` đặt đúng; ánh xạ phase ⇒ `source.status`.
- [x] T008 [P] [US1] Test TRƯỚC `tests/unit/meeting-wav.test.ts`: `buildWavHeader(dataBytes, 16000, 1, 16)` đúng 44 byte (RIFF/WAVE/fmt/data, byte rate, block align);
      `repairWavHeader(fileSize)` cắt byte lẻ, độ dài data = fileSize − 44, tệp < 44 byte ⇒ rỗng hợp lệ.
- [x] T009 [P] [US1] Test TRƯỚC `tests/unit/meeting-segments.test.ts` (`segments.ts`): `segmentShouldRotate`, `segmentOffsets` (offset = tổng mẫu phân đoạn trước),
      `durationSec`, `locateInSegments(segments, tSec)` ⇒ `{index, offsetSec}` (biên đầu/cuối, ngoài phạm vi ⇒ null), `playbackTarget(phase, segments, mergedExists)`
      ⇒ `merged` | `segment n`.
- [x] T010 [P] [US1] Test TRƯỚC `tests/unit/meeting-audio-ingress.test.ts` cho `validateAudioBatch(state, msg)`: sai sessionId / sender / phase ⇒ `reject`; byteLength 0,
      lẻ, > 65 536 ⇒ `reject`; seq trùng ⇒ `duplicate`; seq nhảy ⇒ `accept` + `gap`; > 4 lô/s ⇒ `rateLimited`; không ném.
- [x] T011 [P] [US1] Test TRƯỚC `tests/unit/meeting-stitch.test.ts` cho `stitchTranscriptSegments(prevTail, current, overlapSec=5)`: bỏ segment thuộc vùng chồng lấn, không mất
      chữ ở ranh giới, không lặp câu bị cắt đôi, phân đoạn đầu không có prevTail.
- [x] T012 [P] [US1] Test TRƯỚC `tests/unit/meeting-transcript.test.ts` cho `buildMeetingTranscript(segmentsBySeg, offsets)`: text nối `\n` đã trim; spans có thời gian
      **audio tuyệt đối**; khoảng ngừng KHÔNG xuất hiện trong text; `timeMap` dùng được với `timeForCharRange` sẵn có; bất biến `cleanText(text) === text` (offset không
      lệch); 0 segment ⇒ text rỗng.
- [x] T013 [P] [US1] Test TRƯỚC `tests/unit/meeting-disk-guard.test.ts` cho `diskLevel({freeBytes, recordedBytes, bytesPerMin})` + `canStart`: ngưỡng 30/5/1 phút, dự phòng
      2× + 500 MB, start bị chặn < 10 phút, freeBytes âm sau dự phòng ⇒ `stop`.
- [x] T014 [P] [US1] Test TRƯỚC `tests/unit/meeting-asr-protocol.test.ts` cho `parseWorkerMessage` (main nhận) và `parseMainMessage` (worker nhận): đúng mọi loại ở R5,
      từ chối thiếu trường / sai kiểu / `reqId` không phải chuỗi / đường dẫn ngoài `meetings/`.
- [x] T015 [P] [US1] Test TRƯỚC `tests/unit/meeting-fake-asr.test.ts` cho `fakeTranscribe(pcm, windowStartSec)`: segment "đoạn <n>" với timestamp đúng cửa sổ, cửa sổ im
      lặng ⇒ rỗng, xác định (cùng vào ⇒ cùng ra).
- [x] T016 [P] [US1] Test TRƯỚC `tests/unit/meeting-default-title.test.ts` cho `defaultMeetingTitle(date, lang)` (vi "Cuộc họp 12/10, 14:30", en tương ứng) và
      `formatDuration(sec)` (`00:00:07`, `01:42:18`, > 10 giờ).
- [x] T017 [P] [US1] Test TRƯỚC `tests/unit/meeting-channels-whitelist.test.ts` (khuôn `chat-channels-whitelist.test.ts`): kênh PR A trong `CHANNELS` + whitelist + preload,
      tên duy nhất, `meeting:audio` là send, `meeting:state` là push (không trong `ChannelResponse`).
- [x] T018 [P] [US1] Test TRƯỚC `tests/unit/meeting-repo.test.ts` (DB tạm v12): tạo/đọc/cập nhật `meeting_session` (phase, segments_json, pause_gaps_json, duration,
      quality, final_progress); `replaceSpans` xoá-rồi-chèn trong giao dịch; `listByPhase`; JSON hỏng ⇒ mảng rỗng + không ném.
- [x] T019 [P] [US1] Test TRƯỚC `tests/unit/pipeline-meeting.test.ts`: `createMeetingSource` tạo `kind="meeting"`, `status="processing"`, `origin="meeting:<id>"`;
      `ingestParsed` chunk/embed/store với `tStart/tEnd` từ timeMap ⇒ `ready`; `resumeInterrupted` bỏ qua `meeting`; `retry`/`relink` meeting ⇒ `notSupported`;
      `remove` meeting gọi hook xoá thư mục; `listByNotebook` trả `meetingPhase`/`transcriptQuality`; `detectKindFromPath` không bao giờ trả `meeting`; **SC-012**: một PDF enqueue trong lúc cuộc họp đang chốt ASR chạy xong trước khi bước chốt kết thúc (chỉ
      `ingestParsed` vào hàng đợi chung).
- [x] T020 [P] [US1] Test TRƯỚC `tests/unit/vault-backup-meeting.test.ts`: snapshot có `meetings/`; `VAULT_ITEMS` có `meetings`; bản sao lưu schema v11 ⇒ migrate lên v12;
      `expectedSchema(12)` khớp DB mới; ước lượng dung lượng ghi âm cho hộp sao lưu.
- [x] T021 [P] [US2] Test TRƯỚC (viết vào `tests/unit/source-viewer-audio.test.ts` — sửa kỳ vọng 049 cũ "tự phát" thay vì tạo tệp trùng) (jsdom): mở citation có `tStart` cho nguồn audio, video, meeting ⇒ `currentTime = tStart`,
      `play` KHÔNG được gọi; đổi citation khi đang phát ⇒ tua + `pause`.
- [x] T022 [P] [US1] Test TRƯỚC `tests/unit/meeting-service.test.ts` với fake writer/files/asr-client/repo/pipeline: start (sau prepare, cổng quyền, một phiên duy nhất,
      chặn khi đĩa < 10 phút) ⇒ tạo nguồn; audio batch ⇒ writer; pause/resume ⇒ đóng/mở phân đoạn + gap; stop ⇒ finalizing ⇒ ASR chốt từng phân đoạn với chồng lấn ⇒
      `replaceSpans` + `ingestParsed` ⇒ `done`; checkpoint `final/seg-*.json` bỏ qua phân đoạn đã xong; ASR lỗi không nháp ⇒ `incomplete` + `ready` 0 chunk;
      `recoverOnStartup` sửa header + tự hoàn tất mọi phiên dang dở; **worker treo/chết giữa phiên (SC-002)** ⇒ writer vẫn nhận đủ mẫu, thời lượng đúng, worker được
      fork lại; **không nhận lô > 5 s hoặc `rendererGone` (PR A)** ⇒ đóng phân đoạn, tự kết thúc + hoàn tất (`endedByUser=0`); xoá nguồn khi đang hoàn tất ⇒ huỷ; `notebook:delete` notebook đang ghi ⇒ `meetingRecording`.

### Implementation — main

- [x] T023 [US1] Append migration `version: 12` vào cuối `MIGRATIONS` trong `src/main/db/migrations.ts` theo data-model §2 (3 bảng + 2 index). T006 xanh.
- [x] T024 [US1] `src/shared/ipc/types.ts`: `SourceKind` thêm `"meeting"`; `SourceSummary.meetingPhase?`, `transcriptQuality?`; kiểu `MeetingPhase`, `MeetingState`,
      `MeetingPrepareResult`, `MeetingStartInput`, `MeetingMarker`, `LanguageMode` theo contracts/meeting-ipc.md.
- [x] T025 [US1] `src/main/services/meeting-capture/meeting-constants.ts`: hằng số R3/R13 (`SAMPLE_RATE`, `SEGMENT_SEC` có override `IV_MEETING_SEGMENT_SEC` khi chưa
      đóng gói, `FSYNC_SEC`, `CHECKPOINT_SEC`, `BATCH_MAX_BYTES`, `RENDERER_BUFFER_SEC`, `BYTES_PER_MIN`, `ARM_WINDOW_MS=15000`, `END_CONFIRM_MIN_SEC=300`,
      `FINAL_OVERLAP_SEC=5`, `FINAL_MODEL`).
- [x] T026 [P] [US1] `src/main/services/app-shell/permissions.ts`; trong `src/main/index.ts` `installSecurity` dùng `decideMediaPermission`/`decidePermissionCheck` với
      `armedUntil` lấy từ meeting-service, giữ `setDevicePermissionHandler(() => false)`, sửa comment ("chỉ mic audio khi người dùng bắt đầu ghi — 186"). T005 xanh.
- [x] T027 [P] [US1] `src/main/services/meeting-capture/session-state.ts`. T007 xanh.
- [x] T028 [P] [US1] `src/main/services/meeting-capture/wav.ts`. T008 xanh.
- [x] T029 [P] [US1] `src/main/services/meeting-capture/segments.ts`. T009 xanh.
- [x] T030 [P] [US1] `src/main/services/meeting-capture/audio-ingress.ts`. T010 xanh.
- [x] T031 [P] [US1] `src/main/services/meeting-capture/stitch.ts`. T011 xanh.
- [x] T032 [P] [US1] `src/main/services/meeting-capture/meeting-transcript.ts` (dùng lại `TimeMapEntry` của `ingestion/audio/audio-transcript.ts`). T012 xanh.
- [x] T033 [P] [US1] `src/main/services/meeting-capture/disk-guard.ts`. T013 xanh.
- [x] T034 [P] [US1] `src/main/services/meeting-capture/asr-protocol.ts`. T014 xanh.
- [x] T035 [P] [US1] `src/main/services/meeting-capture/fake-asr.ts`. T015 xanh.
- [x] T036 [US1] `src/main/services/meeting-capture/meeting-repo.ts` (SQL tham số hoá; sau T023). T018 xanh.
- [x] T037 [US1] `src/main/services/ingestion/pipeline.ts`: tách `indexParsed` khỏi `processFull`; thêm `createMeetingSource`, `ingestParsed`; `resumeInterrupted` bỏ
      `kind="meeting"`; `retry`/`relink` meeting ⇒ `UserFacingError("notSupported")`; `remove` gọi `onRemoveMeeting(sourceId)` (tiêm); `src/main/services/ingestion/source-repo.ts`
      `listByNotebook` LEFT JOIN `meeting_session`; `src/main/services/ingestion/parsers/index.ts` `SIZE_LIMITS.meeting`. T019 xanh.
- [x] T038 [US1] `src/main/services/meeting-capture/capture-writer.ts` (I/O): mở `seg-NNNN.wav` với header 0, append Int16, `fsync` mỗi `FSYNC_SEC`, đóng ⇒ ghi header
      đúng + fsync; xoay khi `segmentShouldRotate`.
- [x] T039 [US1] `src/main/services/meeting-capture/meeting-files.ts` (I/O): tạo/xoá thư mục phiên `<userData>/meetings/<sessionId>/`, ghép `meeting.wav` theo stream,
      xoá `seg-*.wav` + `final/` sau `ready`, `resolvePlayback(sourceId)` (dùng `playbackTarget`), ghi `final/seg-NNNN.json` nguyên tử (tmp→rename), sửa header phân
      đoạn mở (dùng `repairWavHeader`). Đường dẫn kiểm prefix `meetings/`.
- [x] T040 [US1] `src/main/services/meeting-capture/asr-worker.ts` (entry `utilityProcess`): nhận `init`, `final` (đọc phân đoạn + 5 s đuôi phân đoạn trước, resample
      không cần — đã 16 kHz), `cancel`; lazy pipeline `FINAL_MODEL` với `env.cacheDir`; báo `modelDownload{active}`; `IV_ASR_FAKE` ⇒ `fakeTranscribe`; thêm input
      `asr-worker: resolve("src/main/services/meeting-capture/asr-worker.ts")` trong `electron.vite.config.ts`.
- [x] T041 [US1] `src/main/services/meeting-capture/asr-client.ts` (I/O): `utilityProcess.fork(join(__dirname, "asr-worker.js"))`, request/response theo `reqId`,
      kiểm bằng `parseWorkerMessage`, restart ≤ 3 lần/5 phút, `modelDownload` ⇒ `setEgressActive(active, "model")`.
- [x] T042 [US1] `src/main/services/meeting-capture/meeting-service.ts`: `prepare` (quyền OS macOS `getMediaAccessStatus`/`askForMediaAccess`, model, đĩa qua
      `computeStorageInfo`, online, mở cổng), `start`, `acceptAudio`, `pause`, `resume`, `stop`, `status`, `rename`, `finalize` (R8 — ngôn ngữ bản chốt PR A: `vi`/`en` ⇒ khoá, `auto`/`multi` ⇒ `null`), `recoverOnStartup` (PR A: tự hoàn
      tất), `onSourceRemoved`, `isRecordingNotebook`, `onRendererGone` + giám sát "không lô > 5 s" (PR A: tự kết thúc + hoàn tất); push `meeting:state` mỗi 1 s và khi đổi phase chỉ tới `ownerWebContentsId`; tiến độ hoàn tất qua `source:progress`.
      T022 xanh.
- [x] T043 [US1] `src/main/services/source-viewer/media-serve.ts`: chấp nhận `kind="meeting"`, đường dẫn từ `meetingFiles.resolvePlayback` (không từ `origin`), Range/206
      giữ nguyên; path không ra renderer.
- [x] T044 [US1] `src/main/services/vault-backup/snapshot.ts` + `restore-swap.ts`: sao chép `meetings/`, `VAULT_ITEMS` thêm `meetings`, schema guard v12; hộp sao lưu hiện
      dòng "Ghi âm cuộc họp: N MB" (`dirSize`) — chuỗi i18n domain `backup`. T020 xanh.
- [x] T045 [US1] `notebook:delete` trong `src/main/ipc/register.ts` (hoặc service notebooks): trả `UserFacingError("meetingRecording")` khi
      `meetingService.isRecordingNotebook(id)`.
- [x] T046 [US1] `src/shared/ipc/channels.ts` (kênh PR A theo contract) + `src/preload/index.ts` (hàm từng kênh: `meetingPrepare`, `meetingStart`, `meetingSendAudio`,
      `meetingPause`, `meetingResume`, `meetingStop`, `meetingStatus`, `meetingRename`, `onMeetingState`) + `src/main/ipc/register.ts` (mục "meeting-capture",
      `safeHandleWithSender` cho start/pause/resume/stop, `ipcMain.on` cho `meeting:audio` chỉ nhận từ owner). T017 xanh.
- [x] T047 [US1] `src/main/index.ts`: tạo `asrClient` + `meetingService` (tiêm repo, pipeline, files, writer factory, storage, privacy, notification), gọi
      `recoverOnStartup()` sau `resumeInterrupted()`; `webContents.on("render-process-gone")` ⇒ `meetingService.onRendererGone()`; thông báo hệ điều hành (`Notification`) khi nguồn cuộc họp `ready` mà cửa sổ không focus (D15).
- [x] T048 [US1] `electron-builder.yml`: `mac.extendInfo.NSMicrophoneUsageDescription` (R11), `mac.entitlements`/`entitlementsInherit: build/entitlements.mac.plist`;
      tạo `build/entitlements.mac.plist` (`com.apple.security.device.audio-input`); `asarUnpack` `onnxruntime-node/**` nếu S1 yêu cầu.
- [x] T049 [US1] `vitest.config.ts`: thêm tệp thuần mới vào `coverage.include`, tệp I/O vào `exclude`.

### Implementation — renderer

- [x] T050 [P] [US1] `src/renderer/features/meeting-capture/default-title.ts` + `src/shared/meeting/format-duration.ts` (dùng chung main/renderer — bản xuất Markdown C2 cũng cần). T016 xanh.
- [x] T051 [US1] `src/renderer/features/meeting-capture/capture/pcm-worklet.ts` (AudioWorkletProcessor: Float32 → Int16, gom 16 000 mẫu, `postMessage` transfer, **lệnh `flush`
      xả lô lẻ** khi tạm dừng/kết thúc — S1) và `capture/mic-capture.ts` (I/O: `getUserMedia({audio:{deviceId}})`, AudioContext 16 kHz, `addModule` qua
      `import url from "./pcm-worklet.ts?worker&url"` — S1; seam `IV_E2E_FAKE_MIC` (unpackaged) thay `getUserMedia` bằng `AudioBufferSourceNode` phát lặp fixture; gửi lô qua `window.api.meetingSendAudio` với
      `seq`, đệm ≤ 30 s, tràn ⇒ báo lỗi; `stop()` dừng track thật; ánh xạ `NotAllowedError`/`NotFoundError`).
- [x] T052 [US1] `src/renderer/features/meeting-capture/RecordingProvider.tsx` (**cấp app, từ PR A** — đặt trong `src/renderer/main.tsx` quanh `RouterProvider`;
      giữ `mic-capture` + state phiên) + hook `useMeetingRecording.ts` (prepare → getUserMedia → start; pause/resume/stop; `onMeetingState`; `meetingStatus` khi mount
      để gắn lại) + `RecordingStatusBar.tsx` trong header `src/renderer/app/App.tsx` ("● Đang ghi 00:12:03 — Quay lại") ⇒ đổi notebook/route KHÔNG dừng mic (FR-041,
      FR-048).
- [x] T053 [US1] `src/renderer/features/meeting-capture/StartRecordingDialog.tsx`: tên mặc định, notebook đích, chọn micro khi > 1 (`enumerateDevices`), ngôn ngữ (4 lựa
      chọn; PR A chỉ lưu, chưa phát hiện), thông điệp riêng tư + phụ chú online / thiếu model (C6), `canStart=false` ⇒ giải thích, quyền bị từ chối ⇒ hướng dẫn theo
      hệ điều hành (không tạo nguồn); nhớ micro + ngôn ngữ lần trước qua **electron-store ở main** (`lastDeviceLabel`/`lastLanguageMode` của `meeting:prepare`, lưu khi `meeting:start` — D15);
      không có thiết bị thu (`enumerateDevices` rỗng) ⇒ nút Bắt đầu vô hiệu + giải thích (Edge Case).
- [x] T054 [US1] `src/renderer/features/meeting-capture/RecordingView.tsx` (đọc state từ `RecordingProvider`): thanh đầu `● Đang ghi · hh:mm:ss · Lưu trên máy` (chữ + chấm, đồng hồ nổi bật,
      `aria-live` không đọc mỗi giây), vùng nội dung (PR A: placeholder "Transcript sẽ có sau khi kết thúc"), thanh dưới: Tạm dừng↔Tiếp tục ("Đã tạm dừng — không thu
      âm"), Kết thúc ghi tách biệt + hộp xác nhận khi ≥ `END_CONFIRM_MIN_SEC` (dùng lại component xác nhận sẵn có).
- [x] T055 [US1] `src/renderer/features/meeting-capture/FinalizeView.tsx`: tiêu đề sửa được (`meetingRename`), tổng thời lượng, "Đang chốt transcript và lập chỉ mục" +
      tiến độ từ `onSourceProgress`, nút Về notebook, Mở khi hoàn tất (còn ở màn ⇒ tự mở viewer; đã rời ⇒ toast "Cuộc họp … đã sẵn sàng — Mở").
- [x] T056 [US1] `src/renderer/features/sources/SourceList.tsx`: nút icon 🎙 cạnh `+` (`data-testid="record-meeting-btn"`, tooltip + `aria-label`), nhãn theo
      `meetingPhase` ("Đang ghi", "Đã tạm dừng", "Đang hoàn tất", "Chưa hoàn thiện"); `src/renderer/features/sources/Workspace.tsx`: chế độ tập trung hiển thị
      `RecordingView`/`FinalizeView` thay cột giữa khi có phiên của notebook.
- [x] T057 [US2] `src/renderer/features/source-viewer/SourceViewer.tsx`: bỏ `play()` ở effect citation (`:105-106`), khi đổi citation thì `pause()` + tua; `kind="meeting"`
      ⇒ player audio như `audio`. T021 xanh.
- [x] T058 [US1] Điền chuỗi vi + en cho mọi UI PR A vào `src/shared/i18n/domains/meeting.ts` (+ mã lỗi `meetingRecording`, `meetingAlreadyRecording`, `meetingDiskLow`,
      `notSupported` vào domain tương ứng); `tests/unit/i18n-catalog.test.ts` xanh.
- [x] T059 [US1] Thông báo live region (`announce`, `src/renderer/shared/a11y/messages.ts`): bắt đầu ghi, tạm dừng, tiếp tục, kết thúc, cuộc họp sẵn sàng — không đọc đồng hồ.

### E2E

- [x] T060 [US1] `tests/e2e/helper.ts`: `launchMeeting(opts)` đặt `IV_E2E_FAKE_MIC=tests/fixtures/meeting/speech-16k.wav` + `IV_ASR_FAKE=1` (S1: cờ fake audio của
      Chromium treo chờ quyền micro trên macOS nên không dùng); `IV_E2E_MIC_DENIED=1` cho kịch bản từ chối quyền.
- [x] T061 [P] [US1] (gộp T062/T063/T064 vào cùng tệp; thêm `tests/e2e/meeting-backend.spec.ts` cho đường phía main) `tests/e2e/meeting-record.spec.ts` theo quickstart dòng PR A (vi + một lượt en); thêm assert: **SC-004** từ mở hộp đến đang ghi ≤ 2 lần
      bấm; **SC-010** gắn `session.defaultSession.webRequest.onBeforeRequest` qua `electronApp.evaluate` đếm request không phải `file:`/`iv-media:`/`devtools:` = 0 và
      `getPrivacyState()` luôn `local` suốt ghi → hoàn tất → mở viewer (AI online tắt, `IV_ASR_FAKE`); **FR-041** đổi sang notebook khác giữa phiên ⇒ đồng hồ vẫn chạy,
      thanh "Đang ghi" hiện, quay lại được.
- [x] T062 [P] [US1] (gộp vào `tests/e2e/meeting-record.spec.ts`) kịch bản `IV_E2E_MIC_DENIED=1`: quyền bị từ chối ⇒ hướng dẫn, số nguồn không đổi.
- [x] T063 [P] [US2] (gộp: e2e `meeting-record.spec.ts` mở kết quả tìm toàn văn của nguồn cuộc họp ⇒ không tự phát; mp3/mp4 phủ bởi `source-viewer-audio.test.ts` jsdom — không có Whisper thật trong e2e) `tests/e2e/citation-seek-only.spec.ts`: nguồn mp3 + mp4 sẵn có, bấm `[n]` ⇒ `paused === true`, `currentTime` trong khoảng đoạn trích.
- [x] T064 [P] [US1] (gộp vào `tests/e2e/meeting-record.spec.ts`) kịch bản xoá nguồn cuộc họp ⇒ thư mục `meetings/<sessionId>` không còn.

### ADR + glossary

- [ ] T065 [US1] Hoàn thiện ADR thực thi `docs/04-decisions/2026-10-12-meeting-capture.md` (research R16 mục 1: thay 049 #3, ngoại lệ 049 #2, diễn giải Constitution III (không phải ngoại lệ),
      chính sách quyền, utilityProcess ASR, kết quả S1) + thêm dòng `docs/04-decisions/INDEX.md` bằng script.
- [X] T066 [US1] Append thuật ngữ mới phát sinh khi code (nếu có, vd `meeting:audio`, cổng quyền `armedUntil`) vào `docs/00-glossary.md` bằng script — chỉ THÊM dòng.

### Cổng review PR A

- [X] T067 [US1] Gọi **code-reviewer** đối chiếu constitution + spec + plan + tasks; xử lý mọi Blocking.
- [X] T068 [US1] Gọi **glossary-steward**; append term thiếu.
- [X] T069 [US1] Gọi **security-reviewer** (BẮT BUỘC): `installSecurity`/quyền OS, kênh nhị phân `meeting:audio` (sender, kích thước, tần suất), kênh mới whitelist,
      FS `meetings/` (prefix, xoá), worker (đường dẫn, tin nhắn), không log nội dung, CSP. Mọi Blocking phải sửa.
- [X] T070 [US1] Test gate: `npm run lint && npm run test && npm run build && npx playwright test tests/e2e/meeting-record.spec.ts tests/e2e/meeting-permission.spec.ts
    tests/e2e/citation-seek-only.spec.ts tests/e2e/meeting-delete.spec.ts` + toàn bộ e2e cũ xanh; coverage ≥ 80%; chạy tay quickstart bước 2, 5, 6 trên bản đóng gói
      mac; mở PR A — mô tả PR ghi chú lệch tạm D8 (bảo trì vector bị chặn khi đang ghi cho tới PR C1, T116).

**Checkpoint**: PR A merge — ghi cuộc họp thành nguồn dùng được, citation chỉ tua.

---

## Phase 2: PR B — Transcript gần thời gian thực (User Story 3 P2, User Story 4 P2) · 🔒 security-reviewer BẮT BUỘC

**Goal**: nháp hiện dần có timestamp, cập nhật tại chỗ, tự cuộn thông minh, bấm timestamp nghe lại, meter, bỏ tồn đọng; ngôn ngữ auto/khoá/gợi ý/multi; đánh dấu.

**Independent Test**: ghi 3 phút với fixture ⇒ nháp xuất hiện có timestamp, chỉ cửa sổ mới nhất có "Đang nhận dạng"; cuộn lên ⇒ "Quay về hiện tại"; 3 đánh dấu còn sau
hoàn tất; "Tiếng Việt · Tự động" trong 30 s đầu.

### Spike S2 — CỔNG (chặn T073 trở đi)

- [ ] T071 [US3] Spike S2: tạo `vitest.spike.config.ts`, `tests/spike/asr-rtf.spike.ts`, script `"spike:asr"` trong `package.json` (dev-only, không vào `test`/CI); đo
      RTF `Xenova/whisper-tiny` và `Xenova/whisper-base` (q8, fp32) cửa sổ 10 s và phân đoạn 5 phút trên Mac Apple Silicon + một máy Windows x64 chỉ CPU; thử phát hiện
      ngôn ngữ một bước decoder giới hạn {vi, en} (R2) trên 10 mẫu 30 s; nếu không khả thi thử phương án dự phòng.
- [ ] T072 [US3] ADR `docs/04-decisions/2026-10-xx-meeting-asr-spike.md` + dòng INDEX: bảng số đo, model nháp chọn theo quy tắc RTF ≤ 0,5, có giữ lượt 5 s pending không,
      phương pháp phát hiện ngôn ngữ; cập nhật `DRAFT_MODEL`/`DRAFT_PARTIAL_PASS` trong `meeting-constants.ts`. ⛔ Mọi task PR B sau đây chờ task này.

### Tests trước (FAIL rồi mới code)

- [ ] T073 [P] [US3] Test TRƯỚC `tests/unit/meeting-vad.test.ts` cho `isSpeechWindow(pcm, thresholdDbfs=-45, minSpeechRatio=0.1)`: im lặng, nhiễu nền thấp, lời nói,
      tiếng ồn lớn ngắn.
- [ ] T074 [P] [US3] Test TRƯỚC `tests/unit/meeting-hallucination.test.ts` cho `dedupeHallucination(segments)`: bỏ rỗng/chỉ dấu câu, gộp cụm lặp ≥ 3 lần liên tiếp,
      giữ lặp hợp lệ 2 lần.
- [ ] T075 [P] [US3] Test TRƯỚC `tests/unit/meeting-draft-queue.test.ts` cho `planDraftQueue(pending, nowSec)`: tồn > 3 ⇒ bỏ cũ nhất, bật `lagging`; ≤ 1 ⇒ tắt; thứ tự ưu
      tiên detectLanguage > draft > final.
- [ ] T076 [P] [US4] Test TRƯỚC `tests/unit/meeting-language-policy.test.ts` cho `languagePolicy(state, event)` theo R7: khoá sau 30 s lời nói, đánh giá mỗi 120 s, gợi ý sau 2
      lần liên tiếp confidence ≥ 0,7, chấp nhận ⇒ `languageChanges` thêm `{atSec}`, từ chối ⇒ không gợi ý lại, khoá tay ⇒ dừng phát hiện, `multi` ⇒ `language: null`;
      `languageForSegment(changes, segStart, segEnd)` (phần lớn).
- [ ] T077 [P] [US3] Test TRƯỚC `tests/unit/meeting-draft-merge.test.ts` cho `mergeDraft(prev, incoming)` (renderer): thay theo id, giữ thứ tự theo `tStart`, không mutate,
      cửa sổ mới append.
- [ ] T078 [P] [US3] Test TRƯỚC `tests/unit/meeting-auto-scroll.test.ts` cho `shouldAutoScroll({scrollTop, scrollHeight, clientHeight, threshold})` và trạng thái nút
      "Quay về hiện tại".
- [ ] T079 [P] [US3] Test TRƯỚC `tests/unit/meeting-level.test.ts` cho `levelState({rmsDbfs, peakDbfs})`: < −50 ⇒ `weak`, peak > −1 ⇒ `clipping`, còn lại `ok`; trễ chuyển
      trạng thái để không nhấp nháy.
- [ ] T080 [P] [US3] Test TRƯỚC `tests/unit/meeting-service-draft.test.ts`: lịch cửa sổ 10 s (+ lượt 5 s pending nếu bật), VAD bỏ im lặng, push `meeting:draft` chỉ tới
      owner, append `draft.jsonl`, `transcriptLagging`, thiếu model ⇒ ghi tiếp + `modelReady=false`; hoàn tất lỗi/thiếu model chốt mà có nháp ⇒ `done` +
      `quality="draft"`; bản chốt dùng `languageForSegment`.
- [ ] T081 [P] [US4] Test TRƯỚC trong `tests/unit/meeting-service-draft.test.ts` (mục marker/language): `mark` hợp lệ khi `recording`/`paused` (tạm dừng ⇒ điểm dừng),
      kiểm `tStart ≤ tEnd ≤ duration+1`, kind enum; `setLanguage` lock/accept/dismiss; `listMarkers`.
- [ ] T082 [P] [US3] Mở rộng `tests/unit/meeting-asr-protocol.test.ts` (tin `draft`, `detectLanguage`, `language`) và `tests/unit/meeting-channels-whitelist.test.ts`
      (kênh PR B).

### Implementation

- [ ] T083 [P] [US3] `src/main/services/meeting-capture/vad.ts`. T073 xanh.
- [ ] T084 [P] [US3] `src/main/services/meeting-capture/hallucination.ts`. T074 xanh.
- [ ] T085 [P] [US3] `src/main/services/meeting-capture/draft-queue.ts`. T075 xanh.
- [ ] T086 [P] [US4] `src/main/services/meeting-capture/language-policy.ts`. T076 xanh.
- [ ] T087 [US3] `asr-protocol.ts` + `asr-worker.ts`: tin `draft` (PCM cửa sổ qua message, model nháp), `detectLanguage` (phương pháp ADR spike), hàng ưu tiên; VAD + khử ảo
      giác áp ở worker cho cả nháp và chốt. T082 xanh.
- [ ] T088 [US3] `meeting-service.ts`: bộ đệm cửa sổ 10 s từ lô audio, lập lịch qua `planDraftQueue`, push `meeting:draft`, append `draft.jsonl`, cờ lagging trong
      `MeetingState`, `modelReady`, `downloadModel`; finalize dự phòng nháp (`quality="draft"`), ngôn ngữ theo phân đoạn. T080 xanh.
- [ ] T089 [US4] `meeting-service.ts` + `meeting-repo.ts`: `mark`, `listMarkers`, `setLanguage` (lock/accept/dismiss), chạy `languagePolicy`, ghi `language_changes_json`.
      T081 xanh.
- [ ] T090 [US3] `channels.ts` + `preload/index.ts` + `register.ts`: `meeting:draft` (push), `meeting:setLanguage`, `meeting:mark`, `meeting:listMarkers`,
      `meeting:downloadModel`.
- [ ] T091 [US3] `media-serve.ts`: `iv-media://source/<id>?seg=n` cho meeting chưa ghép — phân đoạn mở dựng header theo kích thước hiện tại (`buildWavHeader`) và phục vụ
      header + dữ liệu đã fsync; `seg` ngoài phạm vi ⇒ 404.
- [ ] T092 [P] [US3] `src/renderer/features/meeting-capture/draft-merge.ts`, `auto-scroll.ts`, `level.ts`. T077, T078, T079 xanh.
- [ ] T093 [US3] `capture/pcm-worklet.ts` gửi RMS/peak mỗi 100 ms qua `port`; `LevelMeter.tsx` 3 trạng thái có nhãn chữ + `aria-label`.
- [ ] T094 [US3] `DraftTranscript.tsx` trong `RecordingView`: dòng có timestamp lề trái (`formatDuration`), nhãn "Đang nhận dạng" cho `pending`, key = id (cập nhật tại
      chỗ), tự cuộn theo `shouldAutoScroll` + nút "Quay về hiện tại", bấm timestamp ⇒ `<audio>` phụ phát `?seg=n` tại `offsetSec` (`locateInSegments` phía renderer trên
      `MeetingState.segments`), dòng phân cách "Tạm dừng N phút"; trạng thái "Đang xử lý bản ghi — audio vẫn được lưu an toàn" khi lagging; "Chưa có model nhận
      dạng — …" khi thiếu model.
- [ ] T095 [US3] `StartRecordingDialog.tsx`: nút "Tải model (~N MB)" khi `modelReady=false` (`meetingDownloadModel`), trạng thái tải.
- [ ] T096 [US4] `LanguageControl.tsx` ở thanh dưới: "Đang nhận dạng ngôn ngữ…" ⇒ "<Ngôn ngữ> · Tự động", chọn khoá tay, banner gợi ý "Có vẻ cuộc họp đang dùng English.
      Chuyển transcript sang English?" (Đồng ý / Không), ghi chú `multi`.
- [ ] T097 [US4] `MarkerMenu.tsx`: nút Đánh dấu (3 nhãn) dễ tiếp cận; bôi chọn trong `DraftTranscript` ⇒ menu gắn nhãn với khoảng thời gian của các dòng được chọn;
      danh sách đánh dấu gọn trong màn ghi.
- [ ] T098 [US3] i18n vi + en cho UI PR B; `announce` cho: phát hiện ngôn ngữ, gợi ý đổi ngôn ngữ, transcript chậm (một lần mỗi lần bật) — không đọc từng câu.
- [ ] T099 [US3] `tests/e2e/meeting-draft.spec.ts` theo quickstart dòng PR B; assert **SC-008**: "Tiếng Việt · Tự động" xuất hiện trước 45 s kể từ lời nói đầu
      (fake ASR trả `vi`).

### Cổng review PR B

- [ ] T100 [US3] Gọi **code-reviewer**; xử lý Blocking.
- [ ] T101 [US3] Gọi **glossary-steward**; append term thiếu.
- [ ] T102 [US3] Gọi **security-reviewer** (BẮT BUỘC): `meeting:draft` chỉ tới owner, `mark`/`setLanguage` kiểm đầu vào, `?seg=n` (không lộ path, chỉ meeting), tải model
      (egress đúng chỉ báo), worker nhận PCM từ main (kích thước). Mọi Blocking phải sửa.
- [ ] T103 [US3] Test gate: `npm run lint && npm run test && npm run build && npx playwright test tests/e2e/meeting-*.spec.ts` + e2e cũ; coverage ≥ 80%; chạy tay quickstart
      bước 1, 3 (rút gọn 20 phút) trên Windows CPU; mở PR B.

**Checkpoint**: PR B merge — transcript gần thời gian thực, ngôn ngữ, đánh dấu.

---

## Phase 3: PR C1 — Độ bền (User Story 5 P2, User Story 6 P2) · 🔒 security-reviewer BẮT BUỘC

**Goal**: checkpoint + thẻ phục hồi, xác nhận khi thoát, renderer chết ⇒ interrupted, máy không ngủ, mất thiết bị ⇒ tự tạm dừng + đổi thiết bị, cảnh báo đĩa, ghi tiếp
khi điều hướng, chặn thao tác xung đột, phím tắt, "Hoàn tất transcript"/"Chốt lại".

**Independent Test**: ghi 20 s → SIGKILL → mở lại ⇒ thẻ phục hồi, 3 hành động đúng, mất ≤ 5 s; rút thiết bị ⇒ tự tạm dừng ⇒ chọn thiết bị khác ⇒ ghi tiếp cùng phiên.

### Tests trước (FAIL rồi mới code)

- [ ] T104 [P] [US5] Test TRƯỚC `tests/unit/meeting-checkpoint.test.ts` cho `serializeCheckpoint`/`parseCheckpoint`: khứ hồi đủ trường (phân đoạn, gap, ngôn ngữ, đánh dấu,
      offset nháp, `endedByUser`), JSON hỏng/thiếu trường/phiên bản lạ ⇒ `null` không ném.
- [ ] T105 [P] [US5] Test TRƯỚC `tests/unit/meeting-recovery.test.ts` cho `classifyOnStartup(phase, endedByUser)` ⇒ `autoFinalize` | `recoveryCard` | `none` (đủ bảng
      data-model §5).
- [ ] T106 [P] [US6] Test TRƯỚC `tests/unit/meeting-shortcuts.test.ts` cho `matchShortcut(event, platform)`: `Mod+Shift+P|M|E` trên mac (Cmd) và Windows (Ctrl), bỏ qua khi
      thiếu Shift, phím lặp (`repeat`), ô nhập văn bản không chặn tổ hợp Mod+Shift.
- [ ] T107 [P] [US5] Test TRƯỚC `tests/unit/meeting-service-durability.test.ts`: checkpoint mỗi 30 s + khi đóng phân đoạn; `rendererGone` / không lô > 5 s ⇒ `interrupted`;
      `stopForQuit` ⇒ `stopping` + `endedByUser`; `recover(finalize|keepIncomplete|discard)`; `finalizeAgain` cho `incomplete` và `quality=draft`; `pause({reason:
    "deviceLost"})` ⇒ gap `deviceLost`; đĩa `stop` ⇒ tự kết thúc ⇒ `finalizing`; `listRecoverable` theo notebook.
- [ ] T108 [P] [US6] Test TRƯỚC `tests/unit/vault-lock-meeting.test.ts`: bảo trì vector KHÔNG bị chặn bởi phiên `recording|paused`, VẪN bị chặn bởi `finalizing`; sao
      lưu/khôi phục bị chặn khi đang ghi.
- [ ] T109 [P] [US5] Mở rộng `tests/unit/meeting-channels-whitelist.test.ts` cho kênh PR C1.

### Implementation

- [ ] T110 [P] [US5] `src/main/services/meeting-capture/checkpoint.ts`. T104 xanh.
- [ ] T111 [P] [US5] `src/main/services/meeting-capture/recovery.ts`. T105 xanh.
- [ ] T112 [US5] `src/main/services/meeting-capture/session-store.ts` (I/O): ghi `session.json` tmp→rename + fsync; đọc khi khởi động.
- [ ] T113 [US5] `meeting-service.ts`: checkpoint định kỳ, `recoverOnStartup` theo `classifyOnStartup` (thay tự hoàn tất của PR A cho phiên không do người dùng kết thúc),
      `listRecoverable`, `recover`, `finalizeAgain`, `stopForQuit`, đổi hành vi "không lô > 5 s" / `onRendererGone` của PR A từ tự hoàn tất sang `interrupted` + thẻ phục hồi, đĩa (cảnh báo + tự dừng), `pause` lý do `deviceLost`.
      T107 xanh.
- [ ] T114 [US5] `channels.ts` + `preload/index.ts` + `register.ts`: `meeting:listRecoverable`, `meeting:recover`, `meeting:finalizeAgain`, push `meeting:recoverable`.
      T109 xanh.
- [ ] T115 [US5] `src/main/index.ts`: `before-quit` + `close` của cửa sổ chính khi đang ghi ⇒ `dialog.showMessageBox` (chuỗi i18n main theo ngôn ngữ UI) ⇒ đồng ý
      `stopForQuit()` rồi thoát/đóng; `powerSaveBlocker.start("prevent-app-suspension")` khi start, `stop`
      khi kết thúc; seam `IV_E2E_DIALOG_PATH`-style cho e2e (unpackaged only).
- [ ] T116 [US6] Wiring khoá vault (`src/main/index.ts:520-528`): `hasActiveSources({ excludeRecording: true })` chỉ cho bảo trì vector (116). T108 xanh.
- [ ] T117 [US6] Nâng cấp `RecordingProvider.tsx` / `RecordingStatusBar.tsx` (đã có từ PR A, T052): thanh trạng thái hiện thêm tạm dừng vì mất thiết bị và mức cảnh
      báo đĩa; khi phiên `interrupted` thì chuyển sang thẻ phục hồi thay vì tự hoàn tất.
- [ ] T118 [US6] Mất thiết bị: `mic-capture.ts` nghe `track.onended`, `navigator.mediaDevices.ondevicechange`, lỗi ⇒ `meetingPause({reason:"deviceLost"})`;
      `DeviceLostBanner.tsx` "Mất microphone — chọn thiết bị khác để tiếp tục, hoặc Kết thúc" ⇒ `meetingResume({deviceLabel})`.
- [ ] T119 [US6] `DiskWarning.tsx` theo `MeetingState.diskLevel/minutesRemaining` (vàng < 30, khẩn < 5, thông báo tự dừng); `StartRecordingDialog` giải thích khi
      `canStart=false` vì đĩa.
- [ ] T120 [US5] `RecoveryCard.tsx` ở đầu `SourceList` (mỗi phiên dang dở một thẻ: tiêu đề, thời lượng; Hoàn tất transcript / Giữ như nguồn chưa hoàn thiện / Xoá bản ghi
      có xác nhận) + huy hiệu notebook trong `src/renderer/features/notebooks/` (theo `meeting:recoverable`).
- [ ] T121 [US5] `SourceViewer.tsx` (meeting): nguồn `incomplete` ⇒ nút "Hoàn tất transcript"; `transcriptQuality="draft"` ⇒ nhãn "Transcript nháp" + nút "Chốt lại"
      (`meetingFinalizeAgain`); nhãn tương ứng trong `SourceList`.
- [ ] T122 [US6] `src/renderer/features/meeting-capture/shortcuts.ts` (thuần, T106 xanh) + `useMeetingShortcuts.ts` (keydown ở `window` khi có phiên; `E` chỉ mở hộp
      xác nhận) + `aria-keyshortcuts` và tooltip trên nút Tạm dừng/Đánh dấu/Kết thúc.
- [ ] T123 [US6] Chặn thao tác xung đột ở UI: nút Ghi cuộc họp vô hiệu khi đã có phiên; xoá notebook đích/nguồn đang ghi, sao lưu/khôi phục ⇒ hiện mã lỗi đã dịch.
- [ ] T124 [US5] i18n vi + en cho UI PR C1 (kể cả hộp thoại thoát ở main); `announce`: mất thiết bị, cảnh báo đĩa (mỗi mức một lần), ghi tự dừng, phục hồi xong.

### E2E

- [ ] T125 [P] [US5] `tests/e2e/meeting-recovery.spec.ts` theo quickstart dòng PR C1.
- [ ] T126 [P] [US5] `tests/e2e/meeting-quit.spec.ts` theo quickstart dòng PR C1.
- [ ] T127 [US5] Seam `IV_E2E_AUDIO_PUMP` (unpackaged only) trong `meeting-service.ts`: main tự sinh lô PCM từ fixture (lặp) nhanh gấp N lần cho phiên đang ghi;
      `tests/e2e/meeting-soak.spec.ts` gồm (a) **180 phút audio** bơm tăng tốc với phân đoạn mặc định 300 s ⇒ 36 phân đoạn, thời lượng ±1 s, hoàn tất thành công
      (**SC-001**); (b) `IV_MEETING_SEGMENT_SEC=5` × 120 phân đoạn ⇒ xoay tệp đúng; (c) kill tiến trình `asr-worker` giữa phiên ⇒ không mất mẫu (**SC-002**); (d) kill
      app giữa chừng ⇒ phục hồi.

### Cổng review PR C1

- [ ] T128 [US5] Gọi **code-reviewer**; xử lý Blocking.
- [ ] T129 [US5] Gọi **glossary-steward**; append term thiếu.
- [ ] T130 [US5] Gọi **security-reviewer** (BẮT BUỘC): `meeting:recover` `discard` xoá vĩnh viễn (kiểm sessionId thuộc meeting, prefix đường dẫn), checkpoint parse dữ liệu
      không tin cậy, `before-quit`, seam test không lọt vào bản đóng gói, `powerSaveBlocker` được giải phóng. Mọi Blocking phải sửa.
- [ ] T131 [US5] Test gate: `npm run lint && npm run test && npm run build && npx playwright test tests/e2e/meeting-*.spec.ts` + e2e cũ; coverage ≥ 80%; chạy tay quickstart
      bước 4, 8, 9, 11 trên mac + Windows; mở PR C1.

**Checkpoint**: PR C1 merge — độ bền đầy đủ cho cuộc họp dài.

---

## Phase 4: PR C2 — Trình xem cuộc họp (User Story 7 P3)

**Goal**: player cố định, tô câu đang phát, bấm câu tua, tìm trong transcript, danh sách đánh dấu (tua/đổi nhãn/xoá), sao chép, xuất Markdown.

**Independent Test**: mở nguồn cuộc họp `Sẵn sàng` ⇒ câu đang phát có `aria-current`; bấm câu ⇒ tua; tìm ⇒ đếm + trước/sau; xuất Markdown đủ tiêu đề, đánh dấu,
`[hh:mm:ss]`, dòng tạm dừng.

### Tests trước (FAIL rồi mới code)

- [ ] T132 [P] [US7] Test TRƯỚC `tests/unit/meeting-span-at-time.test.ts` cho `spanAtTime(spans, t)` (tìm nhị phân, giữa hai span, trước span đầu, sau span cuối).
- [ ] T133 [P] [US7] Test TRƯỚC `tests/unit/meeting-transcript-search.test.ts` cho `searchTranscript(text, query)` (fold dấu như FTS 073 — dùng lại hàm fold sẵn có;
      nhiều kết quả, query rỗng, ký tự đặc biệt).
- [ ] T134 [P] [US7] Test TRƯỚC `tests/unit/meeting-markdown.test.ts` cho `buildMeetingMarkdown(meta, text, spans, markers, gaps, tr)` + `markerExcerpt`: tiêu đề, ngày,
      thời lượng, ngôn ngữ, danh sách đánh dấu, `[hh:mm:ss]` mỗi đoạn, dòng tạm dừng, escape Markdown trong tiêu đề, vi + en.
- [ ] T135 [P] [US7] Test TRƯỚC `tests/unit/meeting-service-viewer.test.ts`: `getTranscript` (chỉ `kind="meeting"`), `updateMarker`/`deleteMarker` (markerId thuộc meeting),
      `exportMarkdown` dựng nội dung ở main; mở rộng `meeting-channels-whitelist.test.ts`.

### Implementation

- [ ] T136 [P] [US7] `src/renderer/features/meeting-capture/viewer/span-at-time.ts` + `transcript-search.ts`. T132, T133 xanh.
- [ ] T137 [P] [US7] `src/main/services/meeting-capture/meeting-markdown.ts`. T134 xanh.
- [ ] T138 [US7] `meeting-service.ts` + `meeting-repo.ts`: `getTranscript`, `updateMarker`, `deleteMarker`, `exportMarkdown` (tái dùng `exportMarkdown` của
      `src/main/services/studio/export.ts` + `sanitizeName` của `studio/export-name.ts`). T135 xanh.
- [ ] T139 [US7] `channels.ts` + `preload/index.ts` + `register.ts`: `meeting:getTranscript`, `meeting:updateMarker`, `meeting:deleteMarker`, `meeting:exportMarkdown`.
- [ ] T140 [US7] `viewer/MeetingViewer.tsx` + `viewer/TranscriptPane.tsx`: player cố định ở đầu, transcript chia theo span, `aria-current` + tô câu đang phát
      (`timeupdate` + `spanAtTime`), cuộn theo khi người dùng không tự cuộn, bấm câu ⇒ tua và giữ nguyên trạng thái phát/dừng hiện tại,
      dòng phân cách tạm dừng, citation `[n]` tô đoạn trích như cũ.
- [ ] T141 [US7] `viewer/TranscriptSearch.tsx`: ô tìm, tô kết quả, đếm "k/N", trước/sau, phím Enter/Shift+Enter.
- [ ] T142 [US7] `viewer/MarkerList.tsx`: nhãn + mốc + trích đoạn, bấm ⇒ tua, đổi nhãn, xoá (xác nhận).
- [ ] T143 [US7] Thanh công cụ viewer: Sao chép transcript có timestamp (clipboard qua cơ chế sẵn có), Xuất Markdown (`meetingExportMarkdown`, toast như Studio).
- [ ] T144 [US7] `SourceViewer.tsx`: `kind="meeting"` ⇒ `MeetingViewer` (giữ nút Hoàn tất transcript/Chốt lại của PR C1).
- [ ] T145 [US7] i18n vi + en; nhãn trình đọc màn hình cho câu đang phát (không đọc liên tục), kết quả tìm ("k trên N").
- [ ] T146 [US7] `tests/e2e/meeting-viewer.spec.ts` theo quickstart dòng PR C2.

### Cổng review PR C2

- [ ] T147 [US7] Gọi **code-reviewer**; xử lý Blocking.
- [ ] T148 [US7] Gọi **glossary-steward**; append term thiếu.
- [ ] T149 [US7] Gọi **security-reviewer** (theo quy trình chung — kênh mới, xuất tệp): agent tự in `SKIPPED` nếu không liên quan.
- [ ] T150 [US7] Test gate: `npm run lint && npm run test && npm run build && npx playwright test tests/e2e/meeting-*.spec.ts` + e2e cũ; coverage ≥ 80%; chạy tay quickstart
      bước 7; mở PR C2.

**Checkpoint**: PR C2 merge — feature hoàn tất.

---

## Phase 5: Polish & phát hành (sau khi PR C2 merge)

- [ ] T151 Chạy **checklist tay 120 phút** của `quickstart.md` (bước 1–11) trên bản đóng gói mac arm64 + Windows x64; ghi kết quả vào mô tả release.
- [ ] T152 [P] PR glossary RIÊNG (steward duyệt, rule 5) nếu cần SỬA dòng cũ: "Nguồn" (thêm `meeting` vào danh sách loại), "player"/"seek" (citation chỉ tua — C1) trong
      `docs/00-glossary.md`.
- [ ] T153 [P] Cập nhật `README.md` (EN) + `README.vi.md`: mục Ghi cuộc họp (local, 120+ phút, phục hồi, phím tắt), ghi chú quyền micro macOS bản chưa ký.
- [ ] T154 Bump version + release notes song ngữ (một lần cho cả 4 PR); cập nhật memory dự án (roadmap).

---

## Dependencies & Execution Order

- **Giữa phase (tuần tự)**: PR A → PR B → PR C1 → PR C2 → Polish. PR A chứa migration v12 duy nhất (mọi bảng/cột cho PR sau). PR B cần worker + writer của A. PR C1 cần
  nháp/đánh dấu của B (checkpoint gồm chúng). PR C2 cần span (A) + đánh dấu (B) + nút chốt lại (C1).
- **Cổng cứng**: T001–T002 (S1) chặn T051 trở đi của renderer capture và T040/T048 (worker, asarUnpack); T071–T072 (S2) chặn toàn bộ T073–T103.
- **Trong phase**: setup → test TRƯỚC (FAIL) → migration (T023) → repo (T036) → module thuần → pipeline/service → IPC → renderer (thuần → hook → component) → e2e →
  ADR/glossary → cổng review.
- **Phụ thuộc chính PR A**: T023 → T036 → T042; T037 trước T042; T038, T039, T040, T041 trước T042; T046 sau T042; T047 sau T042 + T046; T051 sau S1; T052 sau T046 +
  T051; T053–T056 sau T052.
- US2 (T021, T057, T063) độc lập với US1 trong PR A — làm song song được.

## Parallel Opportunities

- **PR A**: T005–T022 song song (khác tệp test); T026–T035 song song (khác tệp module thuần); T050 ‖ T038–T041; T061 ‖ T062 ‖ T063 ‖ T064.
- **PR B**: T073–T082 song song; T083–T086 song song; T092 ‖ T087–T091.
- **PR C1**: T104–T109 song song; T110 ‖ T111; T125 ‖ T126.
- **PR C2**: T132–T135 song song; T136 ‖ T137.

Ví dụ PR A: chạy cùng lúc "test WAV header" (T008), "test stitch" (T011), "test disk guard" (T013), "test protocol worker" (T014) — khác tệp, không phụ thuộc.

## Implementation Strategy

- **MVP = PR A (US1 + US2)**: ghi cuộc họp thành nguồn có trích dẫn theo mốc — đã giao giá trị lõi và an toàn dữ liệu (tự hoàn tất sau sự cố).
- Mỗi PR: spike (nếu có) → TDD → cổng review → test gate → merge → cắt branch PR kế từ `main` mới.
- Phát hành MỘT lần sau PR C2 (T154), sau checklist tay 120 phút (T151).
