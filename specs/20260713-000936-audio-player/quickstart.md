# Quickstart / Validation — 049-audio-player

Hướng dẫn kiểm chứng feature chạy đúng end-to-end. Chi tiết hợp đồng ở
[contracts/iv-media-protocol.md](./contracts/iv-media-protocol.md); entity ở [data-model.md](./data-model.md).

## Prerequisites

- Đã cài deps: `npm ci`.
- 045-audio-transcribe đã merge (nguồn `kind=audio` + `Locator.tStart`).
- (Chỉ cho kiểm thử thủ công phát/seek) Ollama chạy + ít nhất 1 file audio (wav/mp3/flac/ogg) đã nạp và
  bóc băng xong trong một notebook.

## Automated gate (bắt buộc xanh trước merge)

```bash
npm run lint          # prettier + eslint + tsc (node + web)
npm run test          # Vitest: unit + integration + component; coverage ≥ 80%
npm run build         # electron-vite build 3 target
npx playwright test security no-egress source-viewer shell   # e2e cũ giữ xanh (CSP/protocol không phá)
```

**Kỳ vọng**: tất cả xanh; coverage ≥ 80%; các test 049 mới:

- `tests/unit/media-range.test.ts` — 16 pass (extOf/mimeForAudioExt/parseRange biên).
- `tests/unit/media-serve.test.ts` — 6 pass (404 id-không-có / không-audio / file-mất; 200 full; 206
  Range đúng lát byte; id encoded).
- `tests/unit/source-viewer-audio.test.ts` — 4 pass (render `<audio>` src encoded; seek tới tStart sau
  `loadedmetadata`; onError hiện thông báo; nguồn non-audio không render player).

## Manual validation (luồng phát/seek thật — cần audio đã transcribe)

1. `npm run dev` (hoặc chạy bản build). Mở notebook có nguồn audio đã bóc băng.
2. **US1 — seek theo trích dẫn**: hỏi 1 câu trả về trích dẫn từ nguồn audio → bấm chip `[n]`.
   - ✅ Source Viewer mở; player `<audio controls>` hiện sticky trên transcript; vị trí phát nhảy tới
     `tStart` của đoạn (sai ≤1s); tự phát (nếu autoplay không bị chặn); transcript highlight đúng đoạn.
   - ✅ Bấm chip `[n]` khác cùng nguồn → vị trí phát nhảy tới mốc mới.
3. **US2 — mở trực tiếp**: bấm tên nguồn audio ở cột Nguồn → player hiện, phát từ đầu khi bấm play.
   - ✅ Mở nguồn không phải audio (pdf/txt…) → KHÔNG có player.
4. **US3 — file gốc mất**: đóng app, xoá/di chuyển file audio gốc trên đĩa, mở lại app → mở nguồn đó.
   - ✅ Player hiện thông báo "Không phát được file âm thanh gốc (có thể đã bị xoá hoặc di chuyển). Bản
     bóc băng bên dưới vẫn xem được."; transcript + chip `[n]` + highlight vẫn hoạt động.
5. **Bảo mật / egress (Constitution I)**: mở DevTools Network hoặc để ý privacy indicator khi phát/tua.
   - ✅ Không có request ra ngoài Internet; indicator vẫn "Chạy cục bộ".

## Rollback

Feature không migration, không kênh IPC mới → revert commit là đủ (không cần down-migration). Nếu chỉ
muốn tắt player mà giữ transcript: gỡ nhánh `content.kind==="audio"` trong `SourceViewer.tsx` +
`protocol.handle("iv-media")` trong `index.ts`.
