# Contract — Giao thức `iv-media://` (049-audio-player)

Đây KHÔNG phải REST API. Là **custom protocol scheme** của Electron do main phục vụ, renderer tiêu thụ
qua thuộc tính `src` của `<audio>`. Hợp đồng dưới đây định nghĩa request/response.

## Đăng ký (main)

```
protocol.registerSchemesAsPrivileged([
  { scheme: "iv-media", privileges: { stream: true, supportFetchAPI: true } }
])   // top-level, TRƯỚC app.whenReady()

protocol.handle("iv-media", createMediaHandler(sourceRepo))   // trong whenReady, sau khi có sourceRepo
```

Privileges: CHỈ `stream` + `supportFetchAPI`. KHÔNG `corsEnabled`, `bypassCSP`, `allowServiceWorkers`.

## Request

- **URL shape**: `iv-media://source/<sourceId>`
  - `<sourceId>` = `Source.id` (đã `encodeURIComponent` ở renderer; handler `decodeURIComponent`).
  - Không có bất kỳ đường dẫn file nào trong URL (chống path traversal).
- **Headers**: tùy chọn `Range: bytes=<start>-<end>` | `bytes=<start>-` | `bytes=-<suffix>`.

## Response

| Điều kiện                                     | Status | Headers                                                                                                  | Body                      |
| --------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------- |
| Không Range, nguồn audio hợp lệ, file tồn tại | `200`  | `Content-Type` (theo đuôi), `Accept-Ranges: bytes`, `Content-Length: <size>`                             | toàn bộ file (stream)     |
| Range hợp lệ                                  | `206`  | `Content-Type`, `Accept-Ranges: bytes`, `Content-Range: bytes <s>-<e>/<size>`, `Content-Length: <e-s+1>` | lát byte `[s,e]` (stream) |
| `getById(id) == null`                         | `404`  | —                                                                                                        | rỗng                      |
| `source.kind !== "audio"`                     | `404`  | —                                                                                                        | rỗng                      |
| `getOrigin(id)` rỗng hoặc file không tồn tại  | `404`  | —                                                                                                        | rỗng                      |

- **Content-Type** = `mimeForAudioExt(extOf(path))`: `mp3→audio/mpeg`, `wav→audio/wav`, `flac→audio/flac`,
  `ogg→audio/ogg`, mặc định `audio/mpeg`.
- **Range không hợp lệ** (malformed / `start>=size` / `start>end` / `size<=0`) → `parseRange` trả `null`
  → coi như không có Range → `200` full (fallback an toàn).

## Bất biến bảo mật (Constitution I & III)

- Handler KHÔNG nhận/ghép đường dẫn file từ renderer — chỉ tra `sourceId` qua DB (SQL parameterized).
- Handler KHÔNG log path hay nội dung file.
- Phục vụ hoàn toàn cục bộ → KHÔNG network egress; privacy indicator không đổi.
- CSP: chỉ `media-src 'self' iv-media:` (không `connect-src`, không `unsafe-*`, không origin ngoài).

## Hàm thuần hỗ trợ (media-range.ts) — hợp đồng đơn vị

- `extOf(path: string): string` — đuôi file thường hoá; `""` nếu không có/kết thúc bằng `.`.
- `mimeForAudioExt(ext: string): string` — map như trên; không phân biệt hoa thường.
- `parseRange(header: string | null, size: number): { start: number; end: number } | null` — kẹp
  `[0,size)`; `null` nếu `header` rỗng / `size<=0` / malformed / `start>end` / `start>=size`; suffix
  `bytes=-N` → `N` byte cuối; `bytes=start-` → tới hết file.
