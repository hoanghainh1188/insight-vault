# audio-transcribe clarify + research (045, Pha 2a)

- Ngày: 2026-07-12
- Feature: `045-audio-transcribe` (issue #45)
- Nguồn: thảo luận Pha 2 (2026-07-12) + research transformers.js (Context7)

## Quyết định (đã thảo luận)

**1. Engine:** `@huggingface/transformers` (transformers.js v3) — pipeline
`automatic-speech-recognition`, model **`Xenova/whisper-base`** (đa ngôn ngữ, tiếng Việt ổn; đổi small/tiny
ở Settings sau). Chạy **in-process ở MAIN** (Node; đã có onnxruntime từ lancedb). KHÔNG whisper.cpp/native.

**2. Phạm vi:** CHỈ **audio** (video 2b, ảnh 2c sau). Định dạng: **wav, mp3, flac, ogg** (m4a/aac cần
ffmpeg → 2b).

**3. Tải model:** tự động lần đầu gọi pipeline → tải về `env.cacheDir` = data dir; **tiến độ** qua
`progress_callback` → map vào bước "parse" của pipeline (tái dùng `source:progress` 037). Sau tải chạy offline.

**4. Timestamp/Locator:** `Locator` thêm `tStart?/tEnd?` (giây, backward-compat). Transcribe →
`segments:[{text,tStart,tEnd}]` → ghép thành 1 transcript + `timeMap` (char-offset ↔ time). Chunk theo char
như thường; tStart/tEnd mỗi chunk tính từ char-range qua `timeMap` (**hàm THUẦN**). Tái dùng chunker/viewer.

**5. Giải mã audio → PCM 16kHz mono:** dùng **CHỈ `audio-decode`** cho cả wav/mp3/flac/ogg (tự nhận định
dạng từ bytes → `{channelData: Float32Array[], sampleRate}`; lấy kênh 0) → resample về 16kHz (**hàm THUẦN
`resampleTo16k`**). _(Đơn giản hoá so với ý ban đầu dùng thêm `wavefile` cho wav — audio-decode phủ cả wav,
nên bỏ wavefile. Wiring decode = I/O.)_

**6. Scope chia đôi 2a (để shippable):**

- **2a-core (feature này):** transcribe → RAG → chip `[n]` mở **transcript trong Source Viewer sẵn có**
  (highlight theo charStart/charEnd — tái dùng nguyên). Bật tab Audio. Lưu timestamp sẵn.
- **2a-player (PR sau):** audio player + seek tới timestamp + giao thức media (`iv-media://` ở main) +
  copy file audio vào data dir.

## Research findings (transformers.js — Context7)

- `pipeline("automatic-speech-recognition","Xenova/whisper-base")` → `transcriber(float32,{return_timestamps:true,
chunk_length_s:30, language?})` → `{text, chunks:[{text, timestamp:[start,end]}]}`.
- `env.cacheDir` chỉnh nơi lưu model; `progress_callback` cho tiến độ tải.
- Input: Float32Array **16kHz mono**. wav: `wavefile` (`toBitDepth('32f')`+`toSampleRate(16000)`+`getSamples()`).
  mp3/khác: `audio-decode` → AudioBuffer (native rate) → resample tay.

## Điểm chạm (2a-core)

- Deps: `@huggingface/transformers`, `audio-decode`, `wavefile`.
- `src/shared/ipc/types.ts`: `Locator`+`tStart?/tEnd?`; `SourceKind`+`"audio"`.
- `src/main/services/ingestion/audio/` (MỚI): `resample.ts` (THUẦN), `audio-transcript.ts` (THUẦN:
  buildTranscript+timeForCharRange), `decode.ts` (I/O wav/mp3), `transcribe.ts` (I/O transformers.js + progress).
- `parsers/index.ts`: `detectKindFromPath` nhận audio ext.
- `pipeline.ts`: `parseFile(kind,bytes,onProgress?)`; nhánh audio → decode→transcribe→buildTranscript→ParseResult
  (+timeMap); sau chunk → gắn tStart/tEnd qua timeMap. Emit sub-progress bước parse.
- `AddSourceModal.tsx`: bật tab Audio (bỏ disabled) + nhận đuôi audio.
- Source Viewer/source-content: tái dùng (transcript = text). Không đổi.

## Constitution

I (model tải 1 lần như Ollama pull — báo tiến độ; nội dung audio KHÔNG rời máy khi transcribe local) ·
II (timestamp/char locator chính xác) · III (đọc file + inference CHỈ main; không log nội dung) · IV ≥80%
(resample + audio-transcript + detectKind thuần; decode/transcribe I/O loại coverage).

## Ngoài phạm vi (2a-core)

Audio player + seek (2a-player) · video/ffmpeg (2b) · ảnh (2c) · m4a/aac · streaming transcription · sửa model.
