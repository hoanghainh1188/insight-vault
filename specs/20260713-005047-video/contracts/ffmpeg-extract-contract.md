# Contract — Tách audio bằng ffmpeg (051)

## ffmpeg-path.ts (resolve binary)

```
resolveFfmpegPath(): string
```

- **Dev** (không đóng gói): trả path `ffmpeg-static` export nguyên vẹn.
- **Đóng gói**: trả `ffmpegStatic.replace("app.asar", "app.asar.unpacked")`.
- Không nhận input từ renderer.

## extract-audio.ts (I/O)

```
extractAudioTo16kWav(videoPath: string, outDir: string, opts?): Promise<string | null>
```

- **Input**: `videoPath` = path file GỐC (từ DB, KHÔNG từ renderer); `outDir` = `<dataDir>/tmp`.
- **Hành vi**: `spawn(resolveFfmpegPath(), ["-nostdin","-i",videoPath,"-vn","-ac","1","-ar","16000","-f",
"wav","-y",outPath])` (mảng tham số — chống injection). `outPath = <outDir>/<uuid>.wav`.
- **Return**:
  - Thành công (có audio) → **path wav tạm**.
  - Video KHÔNG có audio stream (exit ≠ 0 + stderr "does not contain any stream", hoặc out rỗng) → **null**
    (KHÔNG ném — FR-011).
  - Lỗi thật khác (ffmpeg không chạy được / file hỏng) → **throw** (pipeline chuyển source sang `error`).
- **Bất biến**: KHÔNG log `videoPath`/stderr chứa path; xoá wav tạm do caller (`parseVideo` `finally`).

## parsers/video.ts

```
parseVideo(videoPath, extractor, transcriber, onProgress): Promise<ParseResult>
```

- `extractor(videoPath, tmpDir)` → wavPath | null.
- `null` → `ParseResult` **rỗng** (text "", 0 segment/chunk) — video vẫn nạp `ready`, phát được.
- wavPath → gọi **parseAudio (045)** trên wav → ParseResult (text + timeMap + chunk tStart/tEnd).
- `finally`: xoá wavPath nếu tồn tại.
- `onProgress`: phát bước `extract` → `transcribe` (map vào `SourceProgressEvent`).

## Test contract (mock, không cần ffmpeg thật)

- `extract-audio`: mock `child_process.spawn` → giả exit 0 + tạo file out (thành công); exit 1 + stderr
  "does not contain any stream" → null; exit 1 lỗi khác → throw.
- `parseVideo`: DI `extractor` giả (trả path/null) + `transcriber` giả → khẳng định rỗng khi null, đầy đủ
  khi có wav, và wav tạm được xoá.
- `resolveFfmpegPath`: giả cờ đóng gói → khẳng định thay `app.asar`→`app.asar.unpacked`.
