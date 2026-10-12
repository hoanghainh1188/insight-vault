# Implementation Plan: Meeting Capture — ghi âm cuộc họp, transcript gần thời gian thực, nguồn cuộc họp trích dẫn theo timestamp

**Branch**: `186-meeting-capture` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/20261012-072338-meeting-capture/spec.md`; quyết định `docs/04-decisions/2026-10-12-meeting-capture-clarify.md` (A1–A10, C1–C6, D1–D17); intake
`docs/intake/186-meeting-capture.md`; kế thừa 045 (bóc băng), 049 (player + `iv-media`), 085 (sao lưu + khoá vault), 103 (chỉ báo riêng tư), 123 (i18n), 091 (live
region), 025 (export Markdown), 073 (fold tìm kiếm), 116 (bảo trì vector).

## Summary

Giao **4 PR theo thứ tự, mỗi PR ship độc lập**, một spec (D1):

1. **PR A — Ghi âm thành nguồn** (US1, US2). **Spike S1** là task đầu (PCM 16 kHz qua AudioWorklet trong bản đóng gói `file://` + CSP). Migration **v12 (duy nhất
   của feature)**: `meeting_session`, `meeting_marker`, `transcript_span`; `SourceKind "meeting"`. Quyền micro audio-only có cổng 15 s (`installSecurity` tách
   `permissions.ts`), `NSMicrophoneUsageDescription` + entitlements. Renderer: nút 🎙 cạnh `+`, hộp bắt đầu, màn đang ghi (đồng hồ, tạm dừng/tiếp tục, kết thúc có xác
   nhận ≥ 5 phút), màn hoàn tất; **`RecordingProvider` cấp app + thanh "Đang ghi" toàn cục** (đổi notebook không dừng mic — analyze P1). Main: `meeting-service`, writer WAV phân đoạn 5 phút (fsync 5 s, sửa header khi khôi phục), `asr-worker` (`utilityProcess`) chạy **ASR
   chốt** từng phân đoạn có chồng lấn 5 s + checkpoint; `pipeline.createMeetingSource` / `ingestParsed` (chunk/embed/store qua hàng đợi chung); `iv-media` phục vụ
   meeting; citation **chỉ tua** cho mọi audio/video (thay 049 #3); xoá nguồn xoá thư mục; sao lưu gồm `meetings/`; khởi động tự hoàn tất phiên dang dở. ADR thực thi.
   **security-reviewer bắt buộc.**
2. **PR B — Transcript gần thời gian thực** (US3, US4). **Cổng: spike S2** (RTF tiny/base q8 trên Mac Apple Silicon + Windows CPU; phát hiện ngôn ngữ) ⇒ ADR spike. Nháp
   cửa sổ 10 s (lượt 5 s pending), chính sách bỏ tồn đọng, VAD năng lượng + khử ảo giác, `meeting:draft` push, cập nhật tại chỗ, tự cuộn + "Quay về hiện tại", bấm
   timestamp phát `?seg=n`, meter 3 mức, chính sách ngôn ngữ (auto/khoá/gợi ý/multi), đánh dấu (nút, bôi chọn), tải model trước. **security-reviewer bắt buộc.**
3. **PR C1 — Độ bền** (US5, US6). `session.json` checkpoint, thẻ phục hồi (3 hành động) + huy hiệu Notebooks, phân loại khởi động, `before-quit`/đóng cửa sổ xác nhận,
   `render-process-gone`/mất lô 5 s ⇒ `interrupted` (thay hành vi tự hoàn tất của PR A), `powerSaveBlocker`, mất thiết bị ⇒ tự tạm dừng + đổi thiết bị cùng phiên, cảnh báo đĩa theo phút còn lại, chặn thao tác xung đột, phím tắt cố định `Mod+Shift+P/M/E`, "Chốt lại"/"Hoàn tất transcript", soak test. **security-reviewer
   bắt buộc.**
4. **PR C2 — Trình xem cuộc họp** (US7). `MeetingViewer`: player cố định, tô câu đang phát, bấm câu tua, tìm trong transcript, danh sách đánh dấu (tua/đổi nhãn/xoá),
   sao chép, xuất Markdown (tái dùng `exportMarkdown`). security-review theo quy trình chung (kênh mới `meeting:exportMarkdown`/sửa đánh dấu — mức thường).

Không đổi: engine Whisper/transformers.js (045), thuật toán chunk + locator, RAG/Studio (chỉ nguồn `ready`), chỉ báo riêng tư 3 trạng thái, nạp file audio thường.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Electron 43 (Node 24.18 — S1, `node:sqlite` `DatabaseSync`, `utilityProcess`), React 18.

**Primary Dependencies**: có sẵn — `@huggingface/transformers` ^4.2 (Whisper), `audio-decode` (không cần cho meeting), `electron-store`. **Không thêm dependency.**
Model nháp (`Xenova/whisper-tiny` dự kiến, chốt bằng spike S2) tải lúc chạy về `<userData>/models` như 045.

**Storage**: SQLite migration v12 (3 bảng mới, không rebuild `source`); tệp `<userData>/meetings/<sessionId>/` (phân đoạn WAV, checkpoint, nháp, kết quả chốt,
`meeting.wav`). Chi tiết [data-model.md](./data-model.md).

**Testing**: vitest (unit + jsdom) TDD cho hàm thuần; Playwright e2e với cờ Chromium fake mic + `IV_ASR_FAKE`; soak tăng tốc (`IV_MEETING_SEGMENT_SEC`,
`IV_E2E_AUDIO_PUMP`); checklist tay 120 phút ([quickstart.md](./quickstart.md)). Spike dev-only `npm run spike:asr`.

**Target Platform**: macOS arm64 + Windows x64 (ngang nhau, D13). Bản mac chưa ký ở v1.

**Project Type**: desktop-app (Electron main / utilityProcess / preload / renderer).

**Performance Goals**: ghi không mất mẫu khi ASR chậm/chết (SC-002); nháp xuất hiện trong vài giây khi máy theo kịp (mục tiêu, SC-007); hoàn tất ≈ RTF_chốt × thời lượng
(chạy nền, có checkpoint); hoàn tất không chặn nguồn khác quá bước lập chỉ mục cuối (SC-012); IPC audio 32 KB/s.

**Constraints**: không egress mới (ASR luôn cục bộ; tải model = egress `model` sẵn có); không log nội dung audio/transcript/tiêu đề/đánh dấu; đường dẫn không ra renderer;
renderer sandbox giữ nguyên; CSP PROD giữ `script-src 'self'` (worklet là tệp bundle); quyền mic chỉ audio + cổng 15 s; UI vừa cột 262 px ở vi + en;
`prefers-reduced-motion` cho chấm ghi/auto-scroll.

**Scale/Scope**: một phiên ghi tại một thời điểm; ≥ 120 phút (kiểm 180 phút mô phỏng), không trần cứng; 5 phút/phân đoạn ⇒ 24 phân đoạn/2 giờ; ≈ 115 MB/giờ.

Không còn NEEDS CLARIFICATION. Hai ẩn số đo đạc (S1, S2) là **task spike có cổng** với phương án dự phòng định sẵn ([research.md](./research.md) R1, R2).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc | Đánh giá | Sau Phase 1 |
|---|---|---|
| I. Local-first | ASR nháp + chốt chạy cục bộ trong `asr-worker`; không kết nối mới; tải model lần đầu ⇒ worker báo `modelDownload` ⇒ main `setEgressActive(…, "model")` (103); hộp bắt đầu nói đúng phạm vi + phụ chú khi AI online bật (C6); mic tắt thật khi tạm dừng (D11), trạng thái mic luôn hiện bằng chữ (FR-048). | ✅ |
| II. Verifiable Citations | Locator `tStart/tEnd` tính từ transcript **chốt** bằng `timeForCharRange` ngay lúc chunk (không ước lượng sau); `transcript_span` lưu bền mức câu; nháp không bao giờ được trích dẫn (nguồn chưa `ready`); khoảng ngừng là metadata, không vào văn bản; đánh dấu neo thời gian; `[n]` tua đúng mốc, không tự phát. | ✅ |
| III. Desktop Security Boundary | **Không vi phạm, không cần ngoại lệ**: câu MUST "tài liệu & vector thô không đi qua renderer" (constitution.md:70) cấm tài liệu/vector **đã lưu** đi main→renderer. PCM micro là **đầu vào người dùng sinh tại renderer** (chỉ renderer có `getUserMedia`), đi renderer→main qua `meeting:audio` — đúng hướng của ranh giới. Biện pháp kiểm soát: main kiểm sender/session/seq/kích thước/tần suất, không log, audio không bao giờ gửi ngược ra renderer (phát lại qua `iv-media`). Diễn giải ghi ADR (R16). FS/DB/model chỉ ở main/worker; kênh mới whitelist + preload từng hàm; quyền OS chỉ `media`/audio, cửa sổ chính, cổng 15 s; worker chỉ nhận đường dẫn trong `meetings/`. **security-reviewer PR A, B, C1.** | ✅ contract |
| IV. Test-First & Coverage | TDD cho mọi hàm thuần (bảng dưới); I/O loại khỏi coverage như 045; e2e fake mic + fake ASR; soak; checklist tay. Ngưỡng 80% giữ nguyên. | ✅ |
| V. Phased Delivery | Pha 1 lõi đã ổn; tính năng mở rộng Pha 2 audio (045/049) đã ship. 4 PR tuần tự, mỗi PR ship được và an toàn dữ liệu (PR A đã có tự hoàn tất sau sự cố). | ✅ |
| Terminology | Đã append 17 thuật ngữ (tag 186) trên branch; tên code bám glossary (`CaptureSegment`, `MeetingSession`, …). Thêm thuật ngữ mới phát sinh khi code ⇒ append trong PR tương ứng. | ✅ |
| Source-of-truth | Mâu thuẫn design ↔ 049/085/code đã qua clarify (C1–C6) và ghi ADR; prototype không sửa. | ✅ |

**Complexity Tracking**: không có vi phạm. Diễn giải nguyên tắc III cho luồng audio micro ghi ở ADR thực thi; nếu muốn ghi thẳng vào constitution ⇒ PR riêng qua steward (rule 5), ngoài #186.

## Project Structure

### Documentation (this feature)

```text
specs/20261012-072338-meeting-capture/
├── plan.md · research.md · data-model.md · quickstart.md · contracts/meeting-ipc.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (theo PR)

Cô lập theo feature: `src/main/services/meeting-capture/`, `src/renderer/features/meeting-capture/`. Chạm vùng chung tối thiểu, commit nhỏ riêng.

```text
# PR A — ghi âm thành nguồn (+ migration v12 duy nhất)
src/main/db/migrations.ts                                   # SỬA — append v12 (meeting_session, meeting_marker, transcript_span)
src/shared/ipc/types.ts                                     # SỬA — SourceKind "meeting"; SourceSummary.meetingPhase/transcriptQuality; Meeting* types
src/shared/ipc/channels.ts                                  # SỬA — meeting:prepare/start/audio/pause/resume/stop/status/rename/state
src/preload/index.ts                                        # SỬA — hàm preload từng kênh meeting
src/main/ipc/register.ts                                    # SỬA — handler meeting:* (mục "meeting-capture")
src/main/index.ts                                           # SỬA — installSecurity dùng permissions.ts; wiring meeting-service, asr-client; recoverOnStartup
src/main/services/app-shell/permissions.ts                  # MỚI (thuần) — decideMediaPermission / decidePermissionCheck
src/main/services/meeting-capture/
  meeting-constants.ts                                      # MỚI — hằng số một chỗ (R3, R13)
  session-state.ts                                          # MỚI (thuần) — máy trạng thái phiên (data-model §5)
  wav.ts                                                    # MỚI (thuần) — buildWavHeader, repairWavHeader
  segments.ts                                               # MỚI (thuần) — rotate, offsets, locateInSegments, duration
  audio-ingress.ts                                          # MỚI (thuần) — validateAudioBatch (R4)
  stitch.ts                                                 # MỚI (thuần) — stitchSegments (chồng lấn 5 s)
  meeting-transcript.ts                                     # MỚI (thuần) — buildMeetingTranscript ⇒ text + spans + timeMap
  disk-guard.ts                                             # MỚI (thuần) — diskLevel / canStart (dùng từ A cho canStart; cảnh báo ở C1)
  meeting-repo.ts                                           # MỚI — DB meeting_session / marker / span
  capture-writer.ts                                         # MỚI (I/O) — ghi WAV tăng dần, fsync, xoay phân đoạn
  meeting-files.ts                                          # MỚI (I/O) — thư mục phiên, ghép meeting.wav, xoá, resolvePlayback
  meeting-service.ts                                        # MỚI — điều phối start/pause/resume/stop/finalize/recoverOnStartup
  asr-protocol.ts                                           # MỚI (thuần) — kiểu + parseWorkerMessage
  asr-client.ts                                             # MỚI (I/O) — fork utilityProcess, request/response, restart
  asr-worker.ts                                             # MỚI (I/O, entry utilityProcess) — pipeline Whisper, hàng ưu tiên, fake seam
  fake-asr.ts                                               # MỚI (thuần) — IV_ASR_FAKE
src/main/services/ingestion/pipeline.ts                     # SỬA — createMeetingSource, ingestParsed (tách indexParsed), resumeInterrupted bỏ meeting, remove/retry/relink meeting
src/main/services/ingestion/source-repo.ts                  # SỬA — listByNotebook LEFT JOIN meeting_session
src/main/services/ingestion/parsers/index.ts                # SỬA — SIZE_LIMITS meeting
src/main/services/source-viewer/media-serve.ts              # SỬA — kind meeting (+ ?seg=n)
src/main/services/vault-backup/{snapshot,restore-swap}.ts   # SỬA — meetings/; dòng dung lượng
src/main/services/notebooks/*                               # SỬA — notebook:delete chặn khi đang ghi (meetingRecording)
src/renderer/main.tsx · src/renderer/app/App.tsx                  # SỬA — RecordingProvider cấp app + RecordingStatusBar (từ PR A — analyze P1)
src/renderer/features/meeting-capture/
  RecordingProvider.tsx · RecordingStatusBar.tsx · StartRecordingDialog.tsx · RecordingView.tsx · FinalizeView.tsx · useMeetingRecording.ts
  capture/mic-capture.ts (I/O) · capture/pcm-worklet.ts (worklet, bundle)
  default-title.ts (thuần) · format-duration.ts (thuần)
src/renderer/features/sources/SourceList.tsx                # SỬA — nút 🎙 cạnh +, nhãn meetingPhase
src/renderer/features/sources/Workspace.tsx                 # SỬA — chế độ tập trung RecordingView/FinalizeView
src/renderer/features/source-viewer/SourceViewer.tsx        # SỬA — bỏ play() khi mở citation (C1); kind meeting
src/shared/i18n/domains/meeting.ts                          # MỚI — vi + en; đăng ký vào vi.ts/en.ts
electron.vite.config.ts                                     # SỬA — main input asr-worker
electron-builder.yml · build/entitlements.mac.plist         # SỬA/MỚI — NSMicrophoneUsageDescription, entitlements (asarUnpack onnxruntime nếu S1 cần)
docs/04-decisions/2026-10-12-meeting-capture.md (+INDEX)    # MỚI — ADR thực thi (R16)
tests/unit/{permissions,meeting-session-state,meeting-wav,meeting-segments,meeting-audio-ingress,meeting-stitch,meeting-transcript,
            meeting-disk-guard,meeting-asr-protocol,meeting-repo,migration-meeting,meeting-default-title,…}.test.ts
tests/e2e/{meeting-record,meeting-permission,citation-seek-only,meeting-delete}.spec.ts · tests/fixtures/meeting/

# PR B — transcript gần thời gian thực (sau spike S2 + ADR spike)
tests/spike/asr-rtf.spike.ts · vitest.spike.config.ts · package.json "spike:asr"   # dev-only
src/main/services/meeting-capture/{vad.ts, hallucination.ts, draft-queue.ts, language-policy.ts}   # MỚI (thuần)
src/main/services/meeting-capture/{meeting-service.ts, asr-worker.ts, asr-client.ts}              # SỬA — nháp, detectLanguage, setLanguage, mark
src/renderer/features/meeting-capture/{DraftTranscript.tsx, draft-merge.ts, auto-scroll.ts, LevelMeter.tsx, level.ts, MarkerMenu.tsx, LanguageControl.tsx}
src/shared/ipc/channels.ts · preload · register.ts                                               # SỬA — meeting:draft/setLanguage/mark/listMarkers/downloadModel
docs/04-decisions/2026-10-xx-meeting-asr-spike.md (+INDEX)

# PR C1 — độ bền
src/main/services/meeting-capture/{checkpoint.ts (thuần), recovery.ts (thuần classifyOnStartup), session-store.ts (I/O)}
src/main/index.ts                                          # SỬA — before-quit, close, render-process-gone, powerSaveBlocker
src/main/services/vault-backup/vault-lock wiring           # SỬA — bảo trì vector không tính phiên recording/paused (D8)
src/renderer/features/meeting-capture/{RecordingProvider.tsx, RecordingStatusBar.tsx (nâng cấp), RecoveryCard.tsx, DeviceLostBanner.tsx, DiskWarning.tsx,
                                       useMeetingShortcuts.ts, shortcuts.ts (thuần)}
src/renderer/features/notebooks/*                          # SỬA — huy hiệu phiên dang dở
tests/e2e/{meeting-recovery,meeting-quit,meeting-soak}.spec.ts

# PR C2 — trình xem cuộc họp
src/main/services/meeting-capture/{meeting-markdown.ts (thuần), export wiring}
src/renderer/features/meeting-capture/viewer/{MeetingViewer.tsx, TranscriptPane.tsx, MarkerList.tsx, TranscriptSearch.tsx, span-at-time.ts, transcript-search.ts}
src/renderer/features/source-viewer/SourceViewer.tsx       # SỬA — kind meeting ⇒ MeetingViewer
tests/e2e/meeting-viewer.spec.ts
```

**Structure Decision**: Electron 3 tầng hiện có + một entry `utilityProcess` mới (`out/main/asr-worker.js`). Logic nghiệp vụ là hàm thuần trong
`services/meeting-capture/` (coverage), I/O mỏng (writer, files, worker, mic) loại khỏi coverage như 045.

## Giao từng PR — điểm chốt

| PR | Bắt đầu bằng | Ship được vì | security-review | ADR |
|---|---|---|---|---|
| A | **Spike S1** (đóng gói mac + win) | Ghi → nguồn ready → hỏi đáp/trích dẫn; sự cố ⇒ tự hoàn tất lần mở sau; sao lưu có audio | **Bắt buộc** (quyền OS, kênh nhị phân, FS mới, worker) | `2026-10-12-meeting-capture.md` |
| B | **Spike S2 = cổng** | Nháp + ngôn ngữ + đánh dấu trên nền A; tắt được nếu worker lỗi | **Bắt buộc** (kênh push nháp, mark, setLanguage, tải model) | `…-meeting-asr-spike.md` |
| C1 | — | Phục hồi đầy đủ + lỗi thiết bị/đĩa + phím tắt | **Bắt buộc** (before-quit, recover/discard xoá dữ liệu, checkpoint) | cập nhật ADR thực thi nếu có quyết định mới |
| C2 | — | Trình xem nâng cao trên dữ liệu A/B | Thường (theo quy trình) | — |

## Hàm thuần — TDD (Constitution IV)

`decideMediaPermission`, `decidePermissionCheck`, `sessionTransition`, `buildWavHeader`, `repairWavHeader`, `segmentShouldRotate`, `segmentOffsets`,
`locateInSegments`, `validateAudioBatch`, `stitchSegments`, `buildMeetingTranscript`, `diskLevel`, `parseWorkerMessage`, `fakeTranscribe`, `defaultMeetingTitle`,
`formatDuration`, `isSpeechWindow`, `dedupeHallucination`, `planDraftQueue`, `languagePolicy`, `mergeDraft`, `shouldAutoScroll`, `levelState`,
`serializeCheckpoint`/`parseCheckpoint`, `classifyOnStartup`, `matchShortcut`, `spanAtTime`, `searchTranscript`, `markerExcerpt`, `buildMeetingMarkdown`; cộng
migration v12 (DB tạm), `meeting-repo`, catalog i18n vi↔en, whitelist kênh mới.

## Rủi ro & dự phòng

| Rủi ro | Dự phòng |
|---|---|
| AudioWorklet/16 kHz không chạy trong bản đóng gói | **S1: chạy được trên bản đóng gói mac** (worklet qua `?worker&url`); còn chờ Windows + micro thật chạy tay |
| onnxruntime không nạp trong `utilityProcess` từ asar | **S1: đã nạp được từ `app.asar`, không cần `asarUnpack`** |
| RTF nháp > 0,5 trên Windows CPU | Bỏ lượt 5 s, cửa sổ bị bỏ khi tồn đọng; bản chốt vẫn đầy đủ (A2) |
| Hoàn tất 2 giờ lâu | Chạy nền, checkpoint từng phân đoạn, tiến độ trên danh sách nguồn |
| Cờ fake audio treo chờ quyền micro trên macOS (S1) | Seam `IV_E2E_FAKE_MIC` phát fixture qua cùng chuỗi AudioContext/worklet/IPC (unpackaged only) |
| Chưa ký app mac ⇒ quyền micro gắn với bản chưa ký | Ghi rõ trong release notes; entitlements sẵn cho lúc ký |
