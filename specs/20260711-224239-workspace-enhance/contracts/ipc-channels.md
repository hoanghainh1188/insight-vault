# IPC Contract — Workspace enhancements (025)

MỞ RỘNG `studio:generate` (thêm `sourceId?`) + THÊM 1 kênh invoke `studio:export`. Nhóm B/C (kéo cột, nav)
KHÔNG dùng IPC (localStorage renderer). Mọi xử lý ở main; `register.ts` `safeHandle` (không catch-all), KHÔNG
log `content`/`citations`.

## Kênh

| Hằng (CHANNELS)  | Tên chuỗi         | Request               | Response             |
| ---------------- | ----------------- | --------------------- | -------------------- |
| `studioGenerate` | `studio:generate` | `StudioGenerateInput` | `StudioResult`       | (MỞ RỘNG: request +`sourceId?`; response giữ 021) |
| `studioExport`   | `studio:export`   | `StudioExportInput`   | `StudioExportResult` | (MỚI)                                             |
| `studioList`     | `studio:list`     | `{ notebookId }`      | `StudioResult[]`     | (021, giữ)                                        |

### `studio:generate` (mở rộng)

- Request thêm `sourceId?`. Có → gom chunk chỉ nguồn đó; không → toàn bộ nguồn ready.
- Main: gom `ScoredChunk[]` → **luôn 1-lượt** `buildContext(scored, STUDIO_CONTEXT_BUDGET)` (ngân sách nới 16000) + chat + `postprocessCitations`/`citationsFromMap` + cờ `truncated` (như 021). Chip `[n]` chính xác
  tới đoạn. **KHÔNG map-reduce.**
- Response `StudioResult` (giữ nguyên 021 — có `truncated?`). Upsert (1 bản/loại/notebook).
- Lỗi: 0 chunk ready / runtime lỗi / content rỗng → reject thân thiện. KHÔNG bịa.

### `studio:export` (mới)

- Request `{ content: string; suggestedName: string }`.
- Main: `dialog.showSaveDialog` (mặc định `<sanitize(name)>.md`, filter Markdown); `canceled` →
  `{saved:false}`; else `fs.writeFile(path, content, 'utf8')` → `{saved:true, path}`. KHÔNG log `content`.
- Response `StudioExportResult`.

## Sửa `channels.ts`

```ts
export const CHANNELS = {
  // …
  studioGenerate: "studio:generate", // giữ tên (request mở rộng field)
  studioList: "studio:list",
  studioExport: "studio:export", // MỚI
} as const;

export interface ChannelResponse {
  // …
  [CHANNELS.studioExport]: StudioExportResult;
}
```

Whitelist tự bao gồm kênh mới → test kỳ vọng `isWhitelisted("studio:export")===true`,
`WHITELISTED_CHANNELS.size` +1.

## Preload

```ts
studioGenerate: (input: StudioGenerateInput): Promise<StudioResult> => invoke(CHANNELS.studioGenerate, input),
studioExport: (input: StudioExportInput): Promise<StudioExportResult> => invoke(CHANNELS.studioExport, input),
```

(`studioGenerate` chữ ký không đổi — `sourceId?` nằm trong `StudioGenerateInput`.)

## Renderer-only (không IPC)

- Kéo cột: `useColumnWidths` ↔ localStorage `workspace-col-widths`.
- Nav nhớ notebook: `lastNotebook` ↔ localStorage `last-notebook-id`.
- Copy: `navigator.clipboard.writeText`.

## Bất biến bảo mật (Constitution III)

- Ghi file CHỈ ở main qua `studio:export`; người dùng chủ động chọn nơi lưu (dialog). Không tự ghi/gửi.
- KHÔNG log `content`/`citations`/nội dung chunk (register + service + export).
- Vector thô không ra renderer.
