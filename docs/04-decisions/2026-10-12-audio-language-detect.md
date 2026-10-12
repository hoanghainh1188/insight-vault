# Phát hiện ngôn ngữ trước khi bóc băng audio (194)

- Ngày: 2026-10-12
- Feature: `194-audio-language-detect` (issue #194, bug). Liên quan: 045 (nạp audio), spike S2 của #186
  (`2026-10-12-meeting-asr-spike.md`, PR #198, mục Quyết định 1, 2, 6), `meeting-capture/language-detect.ts` (#192).

## Vấn đề

`src/main/services/ingestion/audio/transcribe.ts` gọi pipeline Whisper (`Xenova/whisper-base`) với
`{ return_timestamps: true, chunk_length_s: 30 }` và **không có `language`**. Ở transformers.js 4.x (đang dùng 4.2.0), thiếu
`language` **không** kích hoạt tự nhận dạng: thư viện log `No language specified - defaulting to English (en)` rồi bóc băng như
tiếng Anh ⇒ audio tiếng Việt ra câu tiếng Anh ảo giác, lặp lại. Tái hiện trên `tests/fixtures/meeting/speech-16k.wav` (30 s đầu
tiếng Việt): "Hello everyone, today we are going to talk about the most popular Chinese cuisine in Taiwan…".

## Quyết định

1. **Phát hiện ngôn ngữ bằng MỘT bước decoder giới hạn {vi, en}**, đúng phương pháp đã kiểm chứng ở spike S2 (12/12 đúng,
   ≈ 0,2 s): encoder trên **30 s đầu** + một bước decoder với `decoder_input_ids = [<|startoftranscript|>]`, so logits vị trí cuối
   của `<|vi|>` và `<|en|>` (id lấy bằng `tokenizer.convert_tokens_to_ids`), softmax trên 2 token ⇒ `P(vi)`; `P(vi) ≥ 0,5` ⇒ `vi`.
2. **Luôn truyền `language` tường minh** (`"vietnamese"` / `"english"`) + `task: "transcribe"` cho pipeline. Không bao giờ để
   pipeline tự chọn.
3. **Dùng lại processor / tokenizer / model của chính pipeline ASR** (chúng chính là `AutoProcessor` + `AutoTokenizer` +
   `WhisperForConditionalGeneration` của cùng model) ⇒ không tải, không giữ weight hai lần.
4. **Dùng lại logic của Meeting Capture** (#186 PR A đã lên `main` trong lúc làm — #192): phần chọn ngôn ngữ (softmax trên
   2 token + độ tin cậy) là `pickLanguage(logitVi, logitEn)` của `meeting-capture/language-detect.ts`, không viết bản thứ hai.
   Phần thêm cho nạp audio, tách thành helper dùng chung:
   - `audio/whisper-language.ts` — phần THUẦN: `lastStepLanguageLogits` (đọc logits `<|vi|>`/`<|en|>` vị trí cuối, kiểm
     dạng `[1, steps, vocab]` + id trong vocab), `requireTokenId`, `detectionWindow` (30 s đầu), `asrLanguageOptions`.
   - `audio/language-detector.ts` — `createLanguageDetector({ processor, tokenizer, model })`; nhận các phần ĐÃ NẠP nên unit test
     chạy bằng phần giả, không cần model thật.
   - `asr-worker.ts` của Meeting Capture vẫn giữ hàm `languageLogits` riêng (cùng phương pháp); gộp worker sang
     `createLanguageDetector` để PR sau của #186, không đụng vùng feature khác trong bug fix này.
5. **Bước phát hiện lỗi (bất thường: thiếu token, logits không hữu hạn ⇒ `pickLanguage` trả `null`) ⇒ dùng tiếng Việt** (ngôn ngữ nguồn của sản phẩm) và
   `logError("audio.whisper.language_failed")`; không làm hỏng cả lượt nạp, và không rơi lại mặc định tiếng Anh (chính là bug).
6. **Log:** chỉ `audio.whisper.language` với `lang`, `confidence`, `ms` — KHÔNG log nội dung transcript.

## Kiểm chứng

- Unit test (viết trước — TDD): `tests/unit/audio-whisper-language.test.ts`, `tests/unit/audio-language-detector.test.ts`.
- Chạy tay với model thật (`Xenova/whisper-base`, Mac M4 Pro) trên fixture: trước sửa ⇒ tiếng Anh ảo giác; sau sửa ⇒ `vi`
  (`P(vi)` = 0,997, ≈ 0,26 s) "Chào mọi người, hôm nay chúng ta họp để rà soát tiến độ…" (base vẫn sai chính tả vài từ — giới
  hạn model); đoạn tiếng Anh của fixture (từ 32,8 s) ⇒ `en` (`P(vi)` ≈ 0), transcript tiếng Anh đúng.

## Giới hạn đã biết

- Ngôn ngữ chốt từ **30 s đầu cho cả tệp**: tệp trộn Việt–Anh sẽ bóc băng phần còn lại theo ngôn ngữ đầu (đoạn tiếng Anh trong
  tệp tiếng Việt có thể bị phiên âm kiểu Việt). Phát hiện theo từng cửa sổ 30 s (như chế độ `multi` của Meeting Capture, ADR
  spike mục 6) để pha sau nếu cần.
- Chỉ phân biệt {vi, en} — ngôn ngữ khác sẽ bị ép về một trong hai (đúng phạm vi người dùng mục tiêu hiện tại).
