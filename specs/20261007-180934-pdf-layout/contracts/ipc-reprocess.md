# Contract — IPC xử lý lại + nội dung nguồn (112)

Kênh mới đăng ký trong `src/shared/ipc/channels.ts` và whitelist ở `preload` (Constitution III). Renderer chỉ gửi
`sourceId` — không gửi đường dẫn tệp.

## `source:reprocess` (invoke)

```text
input:  sourceId: string
output: { status: "queued" }                       // đã xếp hàng; theo dõi qua source:progress (reprocess: true)
      | { status: "missing" }                      // tệp gốc không còn ⇒ renderer mở luồng "Chọn lại tệp gốc…" (101)
      | { status: "mismatch" }                     // tệp gốc đã bị sửa (SHA-256 ≠ content_hash) ⇒ chặn, hiện lý do
throws: VAULT_LOCKED_MESSAGE (đang sao lưu/khôi phục) · "Nguồn không tồn tại." · "Chỉ xử lý lại nguồn PDF."
        · "Nguồn đang được xử lý." · "Chỉ xử lý lại nguồn sẵn sàng hoặc lỗi."
```

- Nguồn `ready`: giữ `ready` suốt quá trình; hoán đổi nguyên tử khi xong (research R10).
- Nguồn `error`: tương đương "Thử lại" bằng cách trích mới.

## `source:reprocessCancel` (invoke)

```text
input:  sourceId: string
output: { cancelled: boolean }   // false nếu không có lần xử lý lại nào đang chờ/chạy
```

Huỷ ⇒ dữ liệu cũ giữ nguyên; phát `source:progress` kết thúc (`reprocess: true`, `step: "done"`, không lỗi).

## `source:progress` (event, mở rộng)

Thêm `reprocess?: true`. Bước `parse` gửi `progress` theo trang (`0.1 + 0.15 × trang/tổngTrang`). Lỗi ⇒ `errorLabel`
(vd "Xử lý lại thất bại — vẫn dùng bản cũ"), `status` vẫn `ready`.

## `source:getContent` (invoke, mở rộng tương thích ngược)

```text
input:  sourceId: string | { sourceId: string; chunkId?: string }
output: SourceContent & { citationValid?: boolean }   // citationValid chỉ có khi gửi chunkId
```

`citationValid === false` ⇒ viewer không highlight, hiện ghi chú "Nguồn đã được xử lý lại — vị trí trích dẫn cũ không
còn chính xác".
