# Quyết định — scheme `iv-media` đăng ký `standard` + `secure` (#186 PR C2)

- **Ngày:** 2026-10-14
- **Trạng thái:** Đã chốt (sửa lỗi phát hiện bởi e2e `meeting-viewer`)
- **Liên quan:** 049 (audio player), 051 (video), 053 (ảnh), 186 (cuộc họp); `src/main/index.ts` `registerSchemesAsPrivileged`,
  `src/main/services/source-viewer/media-serve.ts`.

## Bối cảnh

Khi viết e2e cho trình xem cuộc họp (PR C2), phát audio qua `iv-media://source/<id>` chạy khoảng 0,4 s rồi `<audio>` báo
`PIPELINE_ERROR_READ: FFmpegDemuxer: data source error`, ở yêu cầu Range kế tiếp (Chromium chia tải media thành nhiều Range).
Phản hồi của handler đúng (206, Content-Range/Length khớp — đã kiểm bằng log). Đã thử và loại trừ: stream so với buffer, chia nhỏ
phản hồi Range, phục vụ qua `net.fetch(file://)` (phát được nhưng thiếu Content-Length ⇒ `duration = Infinity`).

Scheme cũ chỉ có `{ stream: true, supportFetchAPI: true }`. Bộ tải media của Chromium chỉ xử lý Range đầy đủ cho scheme chuẩn.
Lỗi này nhiều khả năng ảnh hưởng mọi audio/video nhập vào từ 049/051 (các bản đã phát hành); e2e cũ chỉ kiểm tua tới mốc khi
dừng, không phát.

## Quyết định

`iv-media` đăng ký `{ standard: true, secure: true, stream: true, supportFetchAPI: true }`. Handler giữ nguyên cách phục vụ.

Kèm theo (review bảo mật PR C2): vì `iv-media://source` trở thành origin thật, mọi phản hồi của handler thêm
`X-Content-Type-Options: nosniff` và `Content-Security-Policy: default-src 'none'; sandbox` — lỡ bị điều hướng tới URL media
cũng không chạy được script/HTML. Handler chỉ trả MIME media đã biết (không HTML/SVG). Renderer vẫn không `fetch` được
(`connect-src 'self'`); `media-src`/`img-src iv-media:` không đổi. Mã hoá % hỏng trong đường dẫn ⇒ 404.

## Kiểm thử

- e2e `meeting-viewer`: tua tới câu cuối rồi phát — `currentTime` tiếp tục tăng, không lỗi media; e2e audio/ảnh/cuộc họp khác vẫn
  qua.
- **Kiểm tay trước khi phát hành:** phát trọn một tệp audio và một video nhập vào trên bản đóng gói (mac + Windows), tua giữa
  chừng; ảnh vẫn hiển thị kèm khung vùng chữ.
