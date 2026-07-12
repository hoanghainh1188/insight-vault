# Implementation Plan: Audio transcription (045, Pha 2a-core)

**Branch**: `045-audio-transcribe` · **Spec**: [spec.md](./spec.md) · **Chi tiết kỹ thuật + research**:
`docs/04-decisions/2026-07-12-audio-transcribe-clarify.md` (nguồn sự thật cho plan này).

## Cấu trúc
- Deps: `@huggingface/transformers`, `audio-decode`.
- Thuần (coverage ≥80%): `audio/resample.ts` (resampleTo16k), `audio/audio-transcript.ts` (buildTranscript
  + timeForCharRange).
- I/O (exclude coverage): `audio/decode.ts` (audio-decode), `audio/transcribe.ts` (transformers.js Whisper +
  progress_callback + env.cacheDir=data dir), `parsers/audio.ts` (nối decode→resample→transcribe→transcript).
- Tích hợp: `parsers/index.ts` (detectKind +audio); `pipeline.ts` (parseFile onProgress + gắn timestamp
  chunk qua timeMap); `ingestion.ts` (tạo transcriber, wire parseFile audio); `source-repo.ts` (t_start/t_end);
  `db/migrations.ts` #5 (chunk cột t_start/t_end + source bỏ CHECK kind — backup/restore chunk né cascade);
  `shared/ipc/types.ts` (Locator+tStart/tEnd; SourceKind+audio); `size-limits.ts` (audio 200MB);
  `AddSourceModal.tsx` (FILE_EXT+audio, accept, hint); `SourceItem.tsx` (icon/subLabel audio).
- Viewer/RAG/chunker: KHÔNG đổi (transcript = text; tái dùng).

## Constitution
I (transcribe local, audio không rời máy; model tải 1 lần) · III (đọc file + inference chỉ main, không log)
· IV (resample/audio-transcript/migration test; decode/transcribe I/O exclude).

## Test
Unit: resample · buildTranscript/timeForCharRange · migration #5 (chunk giữ, kind audio, cascade) · parsers
detectKind audio. Verify E2E thủ công: jfk.wav → transcript "country" + timestamp (đã chạy, PASS). e2e: giữ
xanh (startup với transformers.js + ingestion regression).

## Phases
1. Thuần (resample, audio-transcript) + types. 2. I/O (decode, transcribe, parseAudio). 3. Tích hợp pipeline
+ migration #5 + repo. 4. UI (modal audio, icon). 5. Test + gate.
