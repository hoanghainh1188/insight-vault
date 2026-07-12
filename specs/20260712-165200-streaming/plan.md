# Implementation Plan: Streaming Chat (039)

**Branch**: `039-streaming` · **Spec**: [spec.md](./spec.md)

## Technical Context

Kế thừa: `LLMProvider.chat` (007) + OllamaClient/3 online provider, `rag-service.compute`/`postprocessCitations`
(013), IPC event-push mẫu `source:progress` (`webContents.send` + preload `ipcRenderer.on`), `useChat`/
`MessageBubble` (013/029), chat-repo saveTurn (027). KHÔNG migration.

**Constitution:** I (local mặc định, online opt-in) · II (chip hậu kiểm toàn văn — không đổi) · III (stream
đọc chỉ ở main; token qua IPC whitelisted; không log) · IV (parse NDJSON/SSE thuần ≥80%).

## Cấu trúc

### Provider stream (main)

- `provider.ts` (SỬA): `chat(req, opts?: {onToken?:(d:string)=>void; signal?:AbortSignal}): Promise<ChatResult>`.
  onToken có → stream; không → như cũ. Caller Studio không truyền opts → không đổi.
- `online/stream-parse.ts` (MỚI, THUẦN): `parseOllamaLine(line)→delta|null`; `sseDeltaOpenAI/Anthropic/Gemini(dataJson)→delta`.
  Test kỹ (crux).
- `online/online-http.ts` (SỬA): `streamLines(fetchFn,{...,signal}, onLine)` — đọc `response.body` (ReadableStream)
  → decode → tách dòng → onLine. I/O (exclude coverage).
- `ollama-client.ts` (SỬA): `chat(req, opts?)` — onToken → POST stream:true, đọc NDJSON qua streamLines +
  parseOllamaLine → onToken + tích luỹ; signal→abort. Không onToken → giữ.
- `anthropic/gemini/openai-provider.ts` (SỬA): `chat(req, opts?)` — onToken → build request stream + endpoint
  SSE (Anthropic `stream:true`; OpenAI `stream:true`; Gemini `streamGenerateContent?alt=sse`) qua streamLines
  - sseDelta* → onToken + tích luỹ. Không onToken → giữ (non-stream cũ).

### rag-service (main)

- `rag-service.ts` (SỬA): thêm `askStream(input, {onToken, signal})` — như compute nhưng `deps.chatStream`
  (tích luỹ raw + onToken mỗi delta) thay `deps.chat`; abort → finalize phần đã nhận; `postprocessCitations`
  toàn văn → RagAnswer; persist turn cuối (saveTurn). deps thêm `chatStream`.

### IPC (main + preload)

- `shared/ipc/{types,channels}.ts`: `RagStreamTokenEvent{streamId,delta}`, `RagAskStreamInput` (= RagAskInput
  - streamId); kênh `rag:askStream` (invoke), `rag:streamToken` (event push), `rag:stop` (invoke).
- `main/index.ts`: wire `chatStream: (messages,opts)=>registry.getActive().chat({messages},opts).then(r=>r.content)`;
  ragService.askStream; đăng ký; emit token qua webContents.send; registry AbortController theo streamId.
- `register.ts`: `safeHandle(ragAskStream)` (tạo controller, chạy askStream với onToken=emit, resolve final,
  xoá controller); `safeHandle(ragStop)` (abort controller theo streamId). KHÔNG log.
- `preload/index.ts`: `ragAskStream(input)`, `onRagStreamToken(cb)→off`, `ragStop(streamId)`.

### Renderer

- `useChat.ts` (SỬA): `send` → tạo streamId (crypto.randomUUID), thêm message {streaming:true,content:""},
  sub onRagStreamToken(streamId)→nối delta, gọi ragAskStream; resolve→thay message final (citations); huỷ
  stream cũ khi gửi mới/đổi notebook (ragStop + unsub). `stop()` → ragStop(streamId hiện tại).
- `MessageBubble.tsx` (SỬA): message.streaming → render text thô + con trỏ (CSS, tôn trọng reduced-motion);
  không streaming → MarkdownContent + chip như cũ.
- `ChatColumn.tsx`/composer (SỬA): đang stream → nút Dừng thay nút Gửi (gọi stop).

## Coverage

- Include: `stream-parse.ts` (ollama line + 3 sse delta). rag-service askStream (accumulate/finalize/abort)
  qua unit với fake chatStream. Exclude: online-http streamLines (I/O), ai-runtime/index wiring.

## Test

- Unit: parseOllamaLine (delta/done/rác) · sseDelta OpenAI/Anthropic/Gemini (delta/[DONE]/rỗng) ·
  rag-service askStream (nối onToken, finalize citations, abort giữ phần đã nhận, grounded-notfound) ·
  IPC whitelist +3 kênh. e2e: GIỮ e2e cũ xanh; THÊM whitelist ragAskStream/ragStop + (stream thật cần model
  → thủ công/unit).

## Phases

1. stream-parse (thuần) + types/channels.
2. online-http streamLines + ollama/3 online chat(opts) stream.
3. rag-service askStream + IPC + preload + index wiring.
4. useChat stream + MessageBubble + composer Dừng + CSS.
5. Test + gate.
