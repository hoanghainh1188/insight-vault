# Quickstart / Validation — 051-video

## Prerequisites

- `npm ci` (cài `ffmpeg-static` — postinstall tải binary nền tảng host).
- 045 + 049 đã merge. (Manual) Ollama + 1 file video có tiếng nói.

## Automated gate (bắt buộc xanh)

```bash
npm run lint
npm run test          # coverage ≥ 80%; test mới: extract-audio (mock spawn), video-mime, parseVideo (DI),
                      #   size-limit video/m4a/aac, source-viewer-video (jsdom)
npm run build         # PHẢI kiểm binary ffmpeg lọt vào app.asar.unpacked (xem dưới)
npx playwright test security no-egress source-viewer shell   # e2e cũ xanh
```

### Kiểm đóng gói ffmpeg (rủi ro chính — làm ở gate)

```bash
npm run build         # electron-builder
# Xác nhận binary ffmpeg nằm ngoài asar:
ls release/**/app.asar.unpacked/node_modules/ffmpeg-static/   # phải có ffmpeg(.exe)
```

- `resolveFfmpegPath()` (unit test) khẳng định thay `app.asar`→`app.asar.unpacked` khi đóng gói.

## Manual validation (cần ffmpeg + audio thật)

1. `npm run dev`. Mở modal Thêm nguồn → thấy tab **Audio/Video** đã bật + **ghi chú** "video phát từ vị trí
   file gốc…".
2. **US1**: nạp 1 video mp4 có tiếng nói → tiến độ hiện bước **tách audio → bóc băng → lập chỉ mục** →
   `ready`. Hỏi 1 câu → câu trả lời có chip `[n]` trỏ transcript video.
3. **US2**: bấm chip `[n]` → Source Viewer mở `<video>`, tua tới mốc đoạn + phát; transcript highlight.
   Bấm `[n]` khác cùng nguồn → nhảy mốc.
4. **US3**: nạp 1 file `.m4a` có tiếng nói → xử lý như audio; mở nguồn → `<audio>` (không phải video).
5. **Edge no-audio**: nạp video screen-record câm → nạp thành công, báo nhẹ "không có audio để bóc băng";
   video vẫn phát/xem được.
6. **Edge file mất**: xoá file video gốc → mở nguồn → `<video>` báo lỗi; transcript vẫn xem.
7. **Egress**: giám sát mạng khi nạp/tách/phát → 0 request ngoài; badge "Chạy cục bộ".

## Rollback

Không migration → revert commit đủ. Gỡ dep `ffmpeg-static` + mục asarUnpack nếu cần.
