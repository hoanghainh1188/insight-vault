# IPC Contract — 011-ingestion (`source:*`)

Bám khuôn 15 kênh hiện có (`app:*`/`ai:*`/`notebook:*`). THÊM vào `src/shared/ipc/channels.ts` +
`WHITELISTED_CHANNELS` + `ChannelResponse`; main đăng ký qua `safeHandle` (không catch-all); preload expose
per-function (không `invoke(channel)` chung). Constitution III: renderer KHÔNG chạm FS/DB/LanceDB trực tiếp.

## 5 kênh invoke (renderer → main → response qua ChannelResponse)

| Kênh (CHANNELS key)    | Tên chuỗi               | Request payload          | Response (`ChannelResponse`)   |
| ---------------------- | ----------------------- | ------------------------ | ------------------------------ |
| `sourceAdd`            | `source:add`            | `AddSourceInput`         | `AddSourceResult`              |
| `sourceListByNotebook` | `source:listByNotebook` | `{ notebookId: string }` | `Source[]`                     |
| `sourceGet`            | `source:get`            | `{ id: string }`         | `Source \| null`               |
| `sourceDelete`         | `source:delete`         | `{ id: string }`         | `{ deleted: true }`            |
| `sourceRetry`          | `source:retry`          | `{ id: string }`         | `Source` (trạng thái `queued`) |

- `source:add`: validate input ở boundary (notebookId tồn tại, kind hợp lệ, url/filePath đúng dạng). Tính
  `content_hash`; nếu trùng trong notebook → `duplicateWarning: true` nhưng VẪN tạo nguồn `queued` và đẩy
  hàng đợi. Trả ngay (không chờ pipeline xong) — tiến độ theo dõi qua event.
- `source:delete`: dọn SQLite (cascade chunk) + LanceDB `deleteBySource`. Idempotent (xoá id không tồn tại →
  `{ deleted: true }` hoặc lỗi nghiệp vụ thân thiện, thống nhất với notebook:delete).
- `source:retry`: chỉ hợp lệ khi status='error'; dọn dữ liệu một phần (chunk/vector nếu có) rồi re-queue.

## 1 kênh event (main → renderer, push — KHÔNG phải invoke)

| Kênh             | Tên chuỗi         | Hướng         | Payload               |
| ---------------- | ----------------- | ------------- | --------------------- |
| `sourceProgress` | `source:progress` | main→renderer | `SourceProgressEvent` |

- Main phát qua `webContents.send('source:progress', event)` mỗi lần trạng thái/tiến độ một nguồn đổi.
- Whitelist RIÊNG cho kênh event (guard chiều nhận ở preload); KHÔNG đăng ký như `ipcMain.handle`.
- Preload expose `onSourceProgress(cb: (e: SourceProgressEvent) => void): () => void` — trả hàm unsubscribe
  (gỡ listener khi component unmount). Chỉ forward payload đã kiểm kiểu, không lộ `ipcRenderer` thô.

## Bổ sung `ChannelResponse` (thêm dòng)

```ts
[CHANNELS.sourceAdd]: AddSourceResult;
[CHANNELS.sourceListByNotebook]: Source[];
[CHANNELS.sourceGet]: Source | null;
[CHANNELS.sourceDelete]: { deleted: true };
[CHANNELS.sourceRetry]: Source;
// source:progress KHÔNG vào ChannelResponse (event push, không phải invoke)
```

## Preload surface (`window.api.source`)

```ts
source: {
  add(input: AddSourceInput): Promise<AddSourceResult>;
  listByNotebook(notebookId: string): Promise<Source[]>;
  get(id: string): Promise<Source | null>;
  delete(id: string): Promise<{ deleted: true }>;
  retry(id: string): Promise<Source>;
  onProgress(cb: (e: SourceProgressEvent) => void): () => void;  // unsubscribe
}
```

## Whitelist test (bổ sung `tests/unit/source-ipc-whitelist.test.ts`)

- 5 kênh `source:*` invoke + `source:progress` đều whitelisted; tên ngoài danh sách (vd `source:rawQuery`,
  `source:dropTable`) bị từ chối; tổng kênh ≥ 21 (15 cũ + 6 mới); không trùng tên.
