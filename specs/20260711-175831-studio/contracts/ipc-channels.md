# IPC Contract — Studio (021-studio)

THÊM 2 kênh **invoke** whitelisted vào `src/shared/ipc/channels.ts`. Không có event push. Mọi xử lý ở main;
renderer gọi qua preload; `register.ts` dùng `safeHandle` (không catch-all) và **KHÔNG log** `content`/
`citations`.

## Kênh mới

| Hằng (CHANNELS)  | Tên chuỗi         | Request               | Response         |
| ---------------- | ----------------- | --------------------- | ---------------- |
| `studioGenerate` | `studio:generate` | `StudioGenerateInput` | `StudioResult`   |
| `studioList`     | `studio:list`     | `{ notebookId }`      | `StudioResult[]` |

### `studio:generate`

- **Request**: `StudioGenerateInput { notebookId: string; kind: StudioKind }`.
- **Hành vi (main)**:
  1. Validate `kind` ∈ 4 giá trị; `notebookId` tồn tại.
  2. Gom chunk: `source-repo.listByNotebook(notebookId)` lọc `status==="ready"` (đã ORDER created_at) →
     mỗi source `listChunks(sourceId)` → `ScoredChunk[]` (`sourceTitle`=source.title, `score`=0), thứ tự
     source.created_at → chunk.ordinal.
  3. Nếu 0 chunk ready → ném lỗi thân thiện (UI đã vô hiệu nút; fail-fast).
  4. `buildContext(scored, STUDIO_CONTEXT_BUDGET)` → `{ contextText, map }`.
  5. Kiểm runtime ready; `LLMProvider.chat(systemPromptFor(kind), contextText)` → rawAnswer.
  6. `postprocessCitations(rawAnswer, map)` → `{ answer, citations }`; nếu `citations` rỗng và `answer`
     không rỗng → `citationsFromMap(map)`.
  7. `answer` rỗng → ném lỗi thân thiện (không lưu).
  8. `studio-repo.upsert(notebookId, kind, answer, citations)` (ON CONFLICT ghi đè cùng `(notebook,kind)`).
  9. Trả `StudioResult` với `truncated = map.size < tổng số chunk gom được`.
- **Response**: `StudioResult { id, notebookId, kind, content, citations, createdAt, truncated? }`.
- **Lỗi**: runtime chưa ready / chat lỗi / 0 nguồn ready / content rỗng → reject với thông báo thân thiện
  (tiếng Việt). KHÔNG bịa nội dung.

### `studio:list`

- **Request**: `{ notebookId: string }`.
- **Hành vi (main)**: `studio-repo.listByNotebook(notebookId)` → parse `citations_json` → `StudioResult[]`
  (≤ 4 phần tử, mỗi kind ≤ 1). Không gọi LLM.
- **Response**: `StudioResult[]` (rỗng nếu chưa có kết quả nào).

## Sửa đổi `channels.ts`

```ts
export const CHANNELS = {
  // …
  // studio (021) — tổng hợp tri thức
  studioGenerate: "studio:generate",
  studioList: "studio:list",
} as const;

export interface ChannelResponse {
  // …
  [CHANNELS.studioGenerate]: StudioResult;
  [CHANNELS.studioList]: StudioResult[];
}
```

`WHITELISTED_CHANNELS` tự bao gồm kênh mới (Set từ `Object.values(CHANNELS)`) → test whitelist kỳ vọng
`isWhitelisted("studio:generate") === true`, `isWhitelisted("studio:list") === true`, và tổng số kênh
`WHITELISTED_CHANNELS.size` tăng thêm 2.

## Preload (`src/preload/index.ts`)

```ts
studioGenerate: (input: StudioGenerateInput) => invoke(CHANNELS.studioGenerate, input),
studioList: (notebookId: string) => invoke(CHANNELS.studioList, { notebookId }),
```

## Bất biến bảo mật (Constitution III)

- Chỉ 2 kênh này expose Studio; không kênh đọc DB/model trực tiếp nào khác thêm.
- Vector thô KHÔNG ra renderer. Renderer chỉ nhận text + citations (đã có locator để mở viewer).
- `register.ts` log tối đa `notebookId`/`kind`/error-label; KHÔNG log `content`/`citations`/nội dung chunk.
