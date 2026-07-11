# IPC Contract — 019-source-viewer (`source:getContent`)

Bám khuôn 22 kênh hiện có. THÊM 1 kênh invoke. Renderer KHÔNG chạm FS/DB — qua kênh whitelisted.

## Kênh invoke

| Kênh (CHANNELS key) | Tên chuỗi           | Request payload    | Response (`ChannelResponse`) |
| ------------------- | ------------------- | ------------------ | ---------------------------- |
| `sourceGetContent`  | `source:getContent` | `sourceId: string` | `SourceContent \| null`      |

- Đọc `source-repo.getById(sourceId)` + `listChunks(sourceId)` ở main → tái dựng `SourceContent`.
- `sourceId` không tồn tại / không có chunk → trả `null` (A7 — viewer báo "Nguồn không còn tồn tại").
- Handler KHÔNG đưa `text`/nội dung vào `logEvent` (Constitution III). Vector thô KHÔNG bao giờ trả.
- Validate boundary: `sourceId` phải là chuỗi non-empty (ngược lại → null hoặc lỗi thân thiện).

## Bổ sung `ChannelResponse`

```ts
[CHANNELS.sourceGetContent]: SourceContent | null;
```

## Preload surface (`window.api.sourceGetContent`)

```ts
sourceGetContent(sourceId: string): Promise<SourceContent | null>;
```

## Whitelist test (`tests/unit/source-getcontent-whitelist.test.ts`)

- `source:getContent` whitelisted; tên ngoài (`source:rawFile`, `source:readDisk`) bị từ chối; tổng ≥23
  (22 cũ + 1); không trùng tên.
