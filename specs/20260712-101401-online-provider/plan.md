# Implementation Plan: AI online (031-online-provider)

**Branch**: `031-online-provider` · **Spec**: [spec.md](./spec.md) · **Decisions**:
`docs/04-decisions/2026-07-12-online-provider-clarify.md`

## Technical Context

- **Kế thừa 007-ai-runtime:** `LLMProvider{id,chat,embed,test}` (`provider.ts`), `ProviderRegistry`
  (`registry.ts`, đã có `setActive/getActive`), `OllamaProvider`/`ollama-client.ts` (mẫu fetch tiêm + timeout),
  `model-selection.ts` (mẫu validate boundary + electron-store), `ai-runtime.ts` (assembly), IPC `ai:*` +
  `safeHandle` whitelist, preload per-function, `SettingsAiSection.tsx`.
- **Wiring hiện tại (`src/main/index.ts`):** `embed` đi qua `getActive().embed` (dòng ~110) — **SỬA** thành
  luôn Ollama (FR-005); `chat` đã qua `getActive().chat` (dòng ~115) — GIỮ (đúng cho provider active).
- **PrivacyState:** `privacy-state.ts` đã có `mode:'online'` + refcount egress; THÊM cờ "online provider
  đang active" để badge phản ánh đúng (FR-008).
- **Secret:** thêm `keytar` (chưa cài) — chỉ main, wrap qua interface inject được để test.
- **KHÔNG migration DB** (config ở electron-store, key ở keytar).

**Constitution check:** I (online opt-in, badge trung thực + confirm khi bật) · II (citations không đổi —
không chạm hậu kiểm) · III (network+keytar chỉ main, renderer qua kênh whitelisted, không log key/nội dung)
· IV (test-first ≥80%: phần thuần map/parse/validate/registry/secret-logic; loại wiring keytar-native +
HTTP I/O như adapter). PASS — không cần sửa constitution.

## Cấu trúc (file < 400 dòng)

### Main — providers online

- `src/main/services/ai-runtime/online/online-error.ts` (MỚI, THUẦN): `mapOnlineError(status|cause)` →
  Error thân thiện (401/403 khóa sai · 429 giới hạn · timeout · mạng). Test kỹ.
- `src/main/services/ai-runtime/online/online-http.ts` (MỚI): `callJson(fetchFn,{url,headers,body,timeoutMs=60000})`
  → parse JSON hoặc throw qua `mapOnlineError`. AbortController + timeout (mẫu ollama-client). Wiring I/O.
- `src/main/services/ai-runtime/online/anthropic-provider.ts` (MỚI): `toAnthropicRequest(messages,model)`
  (THUẦN: tách `system` ra field riêng, messages user/assistant) + `parseAnthropicResponse(json)` (THUẦN) +
  class `AnthropicProvider implements LLMProvider` (chat/test; `embed()` ném "không hỗ trợ embedding online").
- `src/main/services/ai-runtime/online/gemini-provider.ts` (MỚI): `toGeminiRequest` (THUẦN: role
  assistant→model, system→systemInstruction, contents[].parts[].text) + `parseGeminiResponse` (THUẦN) + class.
- `src/main/services/ai-runtime/online/openai-provider.ts` (MỚI): `toOpenAIRequest` (THUẦN: messages nguyên
  dạng) + `parseOpenAIResponse` (THUẦN) + class.
- Mỗi provider nhận deps inject: `{ getKey:()=>Promise<string|null>, getModel:()=>string|null, fetchFn }`.
  `chat()`: đọc key (thiếu → ném "chưa nhập khóa"), model (thiếu → ném), build request thuần, gọi `callJson`.

### Main — secret + config + assembly

- `src/main/services/ai-runtime/online/secret-store.ts` (MỚI): wrap keytar qua `KeytarLike`
  (get/set/deletePassword). `createSecretStore(keytar, service="InsightVault")` → `{getKey,setKey,deleteKey,hasKey}`
  theo provider id. Logic thuần test được (fake keytar); KHÔNG log key.
- `src/main/services/ai-runtime/online/online-config.ts` (MỚI, THUẦN): electron-store
  `{ activeOnlineId: OnlineProviderId|null, models: Record<id,string|null> }`; validate id ∈ whitelist,
  model qua `validModelName` (tái dùng regex model-selection). Mẫu model-selection.
- `src/main/services/ai-runtime/online/presets.ts` (MỚI, THUẦN): `MODEL_PRESETS: Record<id,string[]>` +
  `PROVIDER_LABELS`.
- `ai-runtime.ts` (SỬA): đăng ký 3 online provider vào registry; expose:
  `getOnlineState()` (3 provider view: id/label/hasKey/model/active — KHÔNG key), `setProviderKey`,
  `deleteProviderKey`, `setProviderModel`, `setActiveProvider(id|null)` (null→ollama; set exclusive +
  cập nhật `setOnlineProviderActive`), `testProvider(id)`, `embed` (LUÔN ollama — cho index.ts dùng).

### Main — IPC + privacy + wiring

- `src/shared/ipc/{types,channels}.ts` (SỬA): types `OnlineProviderId`, `OnlineProviderView`,
  `OnlineState`, `SetProviderKeyInput`, `SetProviderModelInput`; 6 kênh mới `ai:getOnlineState`,
  `ai:setProviderKey`, `ai:deleteProviderKey`, `ai:setProviderModel`, `ai:setActiveProvider`, `ai:testProvider`.
- `src/main/ipc/register.ts` (SỬA): `safeHandle` 6 kênh; validate boundary (id whitelist, key string ≤ N,
  model validate). KHÔNG log key.
- `src/main/services/app-shell/privacy-state.ts` (SỬA): thêm `setOnlineProviderActive(active)` + tính
  `mode:'online'` khi active online HOẶC egressDepth>0.
- `src/preload/index.ts` (SỬA): 6 hàm `aiGetOnlineState/aiSetProviderKey/...`.
- `src/main/index.ts` (SỬA): `embed` wiring → `aiRuntime.embed` (luôn ollama); khôi phục activeOnlineId từ
  config lúc khởi động (set exclusive + privacy).

### Renderer

- `src/renderer/features/ai-runtime/SettingsAiOnlineSection.tsx` (MỚI): section "AI online" — 3 hàng
  provider (label, trạng thái khóa che, nhập/xoá key, dropdown model preset+"Khác", toggle active exclusive,
  nút test). Confirm 1 lần khi BẬT (modal/confirm). Gọi 6 hàm window.api mới. Sau đổi → refresh PrivacyBadge.
- `src/renderer/features/ai-runtime/useOnlineProviders.ts` (MỚI): hook nạp/đổi state online (nạp
  getOnlineState, các setter). Logic thuần (rút gọn) test được nếu tách.
- `SettingsAiSection` đặt cạnh section mới ở màn Settings (định vị nơi render — grep khi implement).
- `PrivacyBadge.tsx` (SỬA nếu cần): refresh sau khi đổi active (đọc `getPrivacyState`).
- CSS: tái dùng `settings-ai*`; thêm style hàng provider/toggle/masked key.

## Coverage

- **Include (ngưỡng ≥80%):** online-error, anthropic/gemini/openai `toRequest`+`parseResponse`+`embed-throws`,
  secret-store (fake keytar), online-config, presets, privacy-state (online mode).
- **Exclude (adapter I/O / assembly):** online-http (HTTP thật), ai-runtime.ts (assembly), index.ts (wiring),
  keytar native. (Provider class chat() phần build+parse phủ qua unit với fetchFn giả.)

## Test

- Unit (vitest): online-error map · 3 provider toRequest/parseResponse (đặc biệt anthropic system-split,
  gemini role map) + embed ném + chat qua fetchFn giả (200 ok · 401 · 429 · timeout) · secret-store
  get/set/delete/has · online-config validate/normalize · privacy-state online · IPC whitelist (+6 kênh) ·
  boundary validate (setActiveProvider id lạ ném · model validate).
- e2e (Playwright): GIỮ mọi e2e cũ xanh (SC-007); THÊM: mở Settings thấy section AI online 3 hàng ·
  nhập key (mock) → provider hiện hasKey · bật provider → badge đổi 'online' + confirm · tắt → 'local' ·
  whitelist 6 kênh. (Gọi API online thật cần key → phủ unit + thủ công.)

## Phases

1. **P1 (foundation):** types/channels · online-error · online-http · secret-store · online-config · presets.
2. **P2 (providers):** 3 provider (toRequest/parse/class) + đăng ký registry + ai-runtime expose + embed-local.
3. **P3 (IPC+privacy):** register 6 kênh + preload + privacy-state + index.ts wiring.
4. **P4 (renderer):** SettingsAiOnlineSection + hook + confirm + badge refresh + CSS.
5. **P5 (polish):** e2e + coverage + glossary append.
