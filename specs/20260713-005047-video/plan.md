# Implementation Plan: Nạp nguồn Video (Pha 2b)

**Branch**: `051-video` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260713-005047-video/spec.md`. Bám ADR
`docs/04-decisions/2026-07-13-video-clarify.md`.

## Summary

Nạp video (mp4/mov/webm/mkv) + audio m4a/aac. Main dùng **ffmpeg-static** (binary bundled) tách track audio
→ **wav 16kHz mono** (file tạm data-dir, xoá sau) → tái dùng **nguyên** pipeline bóc băng Whisper (045) →
`kind=video` (m4a/aac=`kind=audio`). Source Viewer render `<video controls>` khi `kind=video`, tái dùng
giao thức **`iv-media://`** (049) + effect seek/onError (đổi `<audio>`→`<video>`, thêm video MIME). Tham
chiếu file gốc (không copy). **KHÔNG migration** (045 bỏ CHECK `kind`), **CSP không đổi**. Rủi ro chính:
**đóng gói ffmpeg-static cross-platform** (mac arm64 + win x64).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18, Electron + electron-vite.

**Primary Dependencies**: **`ffmpeg-static` ^5.3.0** (MỚI — binary ffmpeg tiền biên dịch + export path);
`node:child_process` `spawn`; `node:fs`/`node:os` (file tạm); kế thừa `@huggingface/transformers` +
`audio-decode` (045), `electron.protocol` (049). KHÔNG thêm dep khác.

**Storage**: `node:sqlite` — cột `origin`/`kind` sẵn có; **KHÔNG migration**. File wav tạm ở
`<dataDir>/tmp/` (xoá sau transcribe).

**Testing**: Vitest (node + jsdom) — extract-audio (mock `spawn`), video-MIME (thuần), parseVideo (DI mock
extractor+transcriber), size-limit, SourceViewer video (jsdom); Playwright e2e cũ giữ xanh. Luồng ffmpeg
thật (extract) → integration có điều kiện + manual.

**Target Platform**: Desktop Electron (macOS arm64 + Windows x64) — bản đóng gói phải kèm binary ffmpeg.

**Project Type**: Desktop app 3 tiến trình; cô lập feature `src/main/services/ingestion/video/`.

**Performance Goals**: Tua video không tải lại toàn bộ (Range/206 — 049); nạp video xử lý nền, tiến độ
theo bước (tách → bóc băng → index).

**Constraints**: Offline (ffmpeg bundled, không tải khi dùng); không egress; renderer sandbox không đọc FS/
không spawn; file <400 dòng; coverage ≥80%.

**Scale/Scope**: video ≤1GB/nguồn; audio/m4a/aac ≤200MB. ~4 file main mới + sửa pipeline/parsers/SourceKind/
media-range/SourceViewer/AddSourceModal + config đóng gói.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Local-first & No Default Egress** — ✅ ffmpeg-static + Whisper chạy local ở main; video không rời
  máy; ffmpeg **bundled** (không tải khi dùng → offline thật). `iv-media://` cục bộ; CSP không đổi.
- **II. Verifiable Citations** — ✅ tStart/tEnd từ transcribe (045) map chip `[n]`; seek `<video>` tới
  tStart; file gốc mất → giữ transcript + chip.
- **III. Desktop Security Boundary** — ✅ ffmpeg **spawn bằng MẢNG THAM SỐ** (không shell string → chống
  injection); path video từ DB (không từ renderer); extract/đọc/stream CHỈ ở main; renderer chỉ gán
  `<video src>`; không log path/nội dung. File tạm trong data-dir, xoá sau.
- **IV. Test-First & Coverage** — ✅ hàm thuần (video MIME, size-limit) + parseVideo (DI) test-first; mock
  spawn cho extract; jsdom cho `<video>`.
- **V. Phased Delivery** — ✅ Pha 2b sau 2a (045+049 merged); không nhảy cóc.
- **Additional** — ✅ ADR + clarify (4 điểm) ghi `docs/04-decisions/`; intake `docs/intake/051-video.md`;
  KHÔNG migration; security review sẽ chạy (spawn process + FS + protocol). Glossary: thêm video/demux.

→ **Không vi phạm.** Complexity Tracking trống.

## Project Structure

### Documentation (this feature)

```text
specs/20260713-005047-video/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (ffmpeg-extract-contract.md, video-mime.md)
└── tasks.md  (/speckit-tasks)
```

### Source Code (repository root)

```text
src/main/services/ingestion/
├── video/
│   ├── ffmpeg-path.ts          # MỚI: resolve binary ffmpeg — dev (ffmpeg-static) vs đóng gói
│   │                           #   (app.asar → app.asar.unpacked). Export resolveFfmpegPath().
│   └── extract-audio.ts        # MỚI (I/O): spawn ffmpeg [-i in -vn -ac 1 -ar 16000 -f wav tmp] → path wav
│                               #   tạm; phát hiện video KHÔNG audio (exit/stderr) → trả null; xoá tmp.
├── parsers/
│   └── video.ts                # MỚI: parseVideo(path, extractor, transcriber, onProgress) → extract →
│                               #   tái dùng parseAudio(045) trên wav; no-audio → ParseResult rỗng.
├── pipeline.ts                 # SỬA: kind=video → parseVideo; tiến độ thêm bước 'extract'; m4a/aac→audio.
├── size-limits.ts              # SỬA: video: 1GB; audio thêm m4a/aac (200MB).
└── source-repo.ts              # KHÔNG đổi.

src/main/services/source-viewer/
└── media-range.ts              # SỬA: mở rộng MIME map cho video (mp4/mov/webm/mkv); giữ hàm thuần.

src/shared/ipc/types.ts         # SỬA: SourceKind thêm "video".

src/renderer/features/
├── source-viewer/SourceViewer.tsx   # SỬA: kind=video → <video> (tái dùng ref/effect seek/onError 049).
├── source-viewer/source-viewer.css  # SỬA: .vvideo (khung video) hoặc tái dùng .vaudio.
└── sources/AddSourceModal.tsx       # SỬA: bật tab Audio/Video; nhận m4a/aac/mp4/mov/webm/mkv; ghi chú UX.

# Config / packaging (RỦI RO CHÍNH)
package.json                    # SỬA: dependencies += ffmpeg-static.
electron-builder.yml            # SỬA: asarUnpack node_modules/ffmpeg-static/** (binary ngoài asar).
```

**Structure Decision**: Feature-isolated `src/main/services/ingestion/video/`. Tách **ffmpeg-path.ts**
(resolve, test được) khỏi **extract-audio.ts** (spawn I/O, mock trong test). `parseVideo` tái dùng
`parseAudio` (045) — chỉ thêm bước extract phía trước → tối đa hoá tái dùng, không đụng transcribe/chunk.
`<video>` tái dùng nguyên logic player 049 (cùng `iv-media://`, cùng effect seek/onError).

## Complexity Tracking

> Không vi phạm Constitution — trống. (Rủi ro đóng gói ffmpeg ghi ở research.md, là rủi ro kỹ thuật, không
> phải vi phạm nguyên tắc.)
