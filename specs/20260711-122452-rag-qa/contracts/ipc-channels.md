# IPC Contract — 013-rag-qa (`rag:*`)

Bám khuôn 21 kênh hiện có. THÊM 1 kênh invoke vào `channels.ts` + `WHITELISTED_CHANNELS` +
`ChannelResponse`; main đăng ký qua `safeHandle` (KHÔNG log payload — Constitution III). Renderer KHÔNG
chạm embed/search/DB/chat trực tiếp.

## Kênh invoke

| Kênh (CHANNELS key) | Tên chuỗi | Request payload | Response (`ChannelResponse`) |
| ------------------- | --------- | --------------- | ---------------------------- |
| `ragAsk`            | `rag:ask` | `RagAskInput`   | `RagAnswer`                  |

- `rag:ask`: validate ở boundary (`notebookId` non-empty string; `question` trim non-empty, ≤2000 ký tự;
  `mode ∈ {grounded, open}`; `history` mảng). Vượt giới hạn → ném lỗi thân thiện (renderer hiển thị).
- Không streaming → 1 invoke trả trọn `RagAnswer`. Không kênh event/cancel/history ở MVP (lịch sử do
  renderer giữ).
- Handler KHÔNG đưa `question`/`answer`/context vào `logEvent` (chỉ metadata an toàn nếu cần: `mode`,
  số citation).

## Bổ sung `ChannelResponse`

```ts
[CHANNELS.ragAsk]: RagAnswer;
```

## Preload surface (`window.api.ragAsk`)

```ts
ragAsk(input: RagAskInput): Promise<RagAnswer>;
```

## Whitelist test (`tests/unit/rag-ipc-whitelist.test.ts`)

- `rag:ask` whitelisted; tên ngoài (`rag:rawQuery`, `rag:eval`) bị từ chối; tổng kênh ≥ 22 (21 cũ + 1);
  không trùng tên.
