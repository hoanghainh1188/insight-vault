# Tasks: Audio transcription (045, Pha 2a-core)

- [x] T001 [P] `audio/resample.ts` + test (thuần).
- [x] T002 [P] `audio/audio-transcript.ts` (buildTranscript+timeForCharRange) + test (thuần).
- [x] T003 `shared/ipc/types.ts` — Locator+tStart/tEnd; SourceKind+audio.
- [x] T004 `db/migrations.ts` #5 (chunk t_start/t_end; source bỏ CHECK — backup/restore) + test migration.
- [x] T005 `audio/decode.ts` (audio-decode) + `audio-decode.d.ts` (I/O).
- [x] T006 `audio/transcribe.ts` (transformers.js Whisper + progress + cacheDir) (I/O).
- [x] T007 `parsers/audio.ts` (decode→resample→transcribe→transcript) + `parsers/index.ts` detectKind audio.
- [x] T008 `pipeline.ts` parseFile onProgress + gắn timestamp chunk (timeMap); `source-repo.ts` t_start/t_end.
- [x] T009 `ingestion.ts` tạo transcriber + wire parseFile audio.
- [x] T010 `size-limits.ts` audio; `AddSourceModal.tsx` (ext/accept/hint); `SourceItem.tsx` icon/subLabel.
- [x] T011 Verify E2E thủ công (jfk.wav) + gate lint/test/build/e2e.

MVP: US1 (nạp audio→RAG→chip transcript). 2a-player (audio player+seek) = PR sau.
