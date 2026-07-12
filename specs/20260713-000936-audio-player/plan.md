# Implementation Plan: Audio player + seek tới trích dẫn (2a-player)

**Branch**: `049-audio-player` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260713-000936-audio-player/spec.md`

**Note**: Feature này **đã được implement**; plan mô tả đúng kiến trúc code hiện có (artifact hồi tố để
chuẩn hoá pipeline Spec Kit). Bám ADR `docs/04-decisions/2026-07-12-audio-player-clarify.md`.

## Summary

Bổ sung phát lại audio + tua (seek) tới đúng đoạn trích dẫn trong Trình xem nguồn, cho nguồn `kind=audio`
đã bóc băng ở 045. Cách tiếp cận: main process đăng ký giao thức tùy biến `iv-media://` (privileged
`stream`+`supportFetchAPI`, least-privilege) và phục vụ file audio **gốc** (tham chiếu vị trí, không copy)
theo **ID nguồn** tra trong DB, hỗ trợ HTTP Range/206 để tua; renderer chỉ gán `<audio src="iv-media://
source/<id>">` trong Source Viewer, effect tua tới `locator.tStart` (giây, 045 đã lưu) khi mở chip `[n]`,
`onError` báo file gốc mất mà transcript vẫn dùng được. CSP nới đúng một chỉ thị `media-src`. KHÔNG
migration, KHÔNG kênh IPC mới.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18

**Primary Dependencies**: Electron + electron-vite (main/preload/renderer); `electron.protocol`
(registerSchemesAsPrivileged + handle); Web Streams (`node:stream` `Readable.toWeb`); `node:fs`
(createReadStream/statSync/existsSync). KHÔNG thêm dependency mới.

**Storage**: `node:sqlite` (better path qua `source-repo` 045/011) — dùng cột `origin` (path file gốc) +
`kind` sẵn có; KHÔNG migration. LanceDB không đụng.

**Testing**: Vitest (node + jsdom per-file) — unit thuần `media-range`, integration `media-serve` (fake
repo + temp file), component jsdom `SourceViewer`; Playwright `_electron` cho e2e cũ (giữ xanh).

**Target Platform**: Desktop Electron (macOS + Windows).

**Project Type**: Desktop app (Electron 3 tiến trình) — cô lập theo feature (`src/main/services/source-
viewer/`, `src/renderer/features/source-viewer/`).

**Performance Goals**: Bấm chip `[n]` → player sẵn sàng ở đúng mốc ≤ 2s (file gốc còn); tua bất kỳ vị trí
không tải lại toàn bộ (Range/206).

**Constraints**: Offline-capable, không network egress khi phát (`iv-media://` cục bộ); renderer sandbox
không đọc FS; file <400 dòng; coverage ≥ 80% business logic.

**Scale/Scope**: 1 feature nhỏ nối tiếp 045; ~2 file main mới (1 thuần, 1 I/O), sửa `SourceViewer.tsx` +
CSS + 3 file config; 3 file test (26 test).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Local-first & No Default Egress (NON-NEGOTIABLE)** — ✅ PASS. `iv-media://` do main phục vụ file
  cục bộ (đọc đĩa, trả renderer cùng máy) → KHÔNG network egress; privacy indicator "Chạy cục bộ" không
  đổi. CSP chỉ nới `media-src` (KHÔNG `connect-src`, KHÔNG origin ngoài, KHÔNG `unsafe-*`).
- **II. Verifiable Citations (NON-NEGOTIABLE)** — ✅ PASS. Seek dùng `locator.tStart` đã lưu lúc tạo chunk
  (045), map xác định `n → chunk → source + tStart`; file gốc mất → vẫn giữ transcript + chip + highlight
  (kiểm chứng ở mức văn bản không mất), báo rõ, KHÔNG bịa.
- **III. Desktop Security Boundary (NON-NEGOTIABLE)** — ✅ PASS. Đọc/stream file CHỈ ở main; renderer
  sandbox chỉ gán `<audio src>`; handler tra `sourceId → DB` (SQL parameterized), KHÔNG nhận/ghép path từ
  renderer (chống path traversal); chỉ phục vụ `kind=audio`; least-privilege (không cors/bypassCSP); KHÔNG
  log path/nội dung. `iv-media://` không phải IPC → preload/whitelist không đổi.
- **IV. Test-First & Coverage (NON-NEGOTIABLE)** — ✅ PASS. Logic thuần (`media-range`) test-first, biên
  Range/MIME; handler integration; component jsdom cho render/seek/onError; gate lint+test+build+e2e.
- **V. Phased Delivery** — ✅ PASS. Đúng Pha 2a-player, nối tiếp 2a-core (045 đã merge); không nhảy cóc.
- **Additional Constraints** — ✅ ADR tồn tại (`2026-07-12-audio-player-clarify.md` + INDEX); intake hồi
  tố `docs/intake/049-audio-player.md`; glossary không có thuật ngữ nghiệp vụ mới (`iv-media://` là tên kỹ
  thuật nội bộ). Không migration. Security review sẽ chạy (đụng FS + protocol).

→ **Không có vi phạm** — Complexity Tracking để trống.

## Project Structure

### Documentation (this feature)

```text
specs/20260713-000936-audio-player/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (giao thức iv-media:// — không phải REST API)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/main/
├── index.ts                              # SỬA: registerSchemesAsPrivileged(iv-media) top-level +
│                                         #      protocol.handle("iv-media", createMediaHandler(...))
└── services/
    ├── source-viewer/
    │   ├── media-range.ts                # MỚI (THUẦN): extOf · mimeForAudioExt · parseRange
    │   └── media-serve.ts                # MỚI (I/O): createMediaHandler(sourceRepo)
    └── ingestion/
        └── source-repo.ts                # KHÔNG đổi (dùng getById/getOrigin sẵn có)

src/renderer/features/source-viewer/
├── SourceViewer.tsx                      # SỬA: <audio> player + effect seek + onError khi kind=audio
├── source-viewer.css                     # SỬA: .vaudio / .vaudio-el / .vaudio-err
└── useSourceViewer.ts                    # KHÔNG đổi (openCitation/openSource sẵn có)

# Config
electron.vite.config.ts                   # SỬA: CSP thêm media-src 'self' iv-media: (DEV+PROD)
vitest.config.ts                          # SỬA: include media-range.ts; exclude media-serve.ts
tsconfig.node.json                        # SỬA: include src/renderer/env.d.ts (test import window.api)

tests/unit/
├── media-range.test.ts                   # MỚI: 16 test hàm thuần (biên Range/MIME/ext)
├── media-serve.test.ts                   # MỚI: 6 test integration handler (404/200/206/encoded)
└── source-viewer-audio.test.ts           # MỚI: 4 test jsdom (render/seek/onError/non-audio)
```

**Structure Decision**: Cô lập theo feature — code main riêng ở `src/main/services/source-viewer/` (thêm
media-range/media-serve cạnh reconstruct/source-content sẵn có), UI ở `src/renderer/features/source-
viewer/`. Tách **hàm thuần** (`media-range.ts`, test + coverage) khỏi **wiring I/O** (`media-serve.ts`,
exclude coverage nhưng có integration test) theo đúng pattern dự án (vd `export-name.ts` vs `export.ts`,
`resample.ts` vs `decode.ts`).

## Complexity Tracking

> Không có vi phạm Constitution — bảng để trống.
