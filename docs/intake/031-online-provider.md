# Intake — 031-online-provider

> Feature này **không có tài liệu design riêng từ khách hàng** (không basic/detail design .docx/.xlsx/.pdf,
> không Figma node riêng). Nội dung dưới đây được suy ra từ tài liệu GỐC của dự án + code kế thừa của
> feature 007-ai-runtime, theo đúng chỉ dẫn trong yêu cầu tạo intake này.

## Input sources

- `docs/OVERVIEW.md` — mục 1 ("Có tùy chọn dùng AI online bằng API key của chính người dùng"), mục 5
  ("Chọn mô hình... hoặc bật provider online + nhập API key; kiểm tra kết nối"; "Chỉ báo riêng tư"),
  mục 6 ràng buộc bất biến #1–#2 (không rời máy mặc định; online opt-in, key lưu an toàn không plaintext).
- `docs/04-decisions/2026-07-10-tech-stack.md` — D3 (AI runtime: `ProviderRegistry` + `LLMProvider{chat,embed,test}`,
  "online provider (Anthropic/OpenAI/Gemini) hoán đổi sau cùng interface"), D5 (bảo mật: API key qua keytar,
  mặc định không network egress, chỉ khi bật online mới gọi ra ngoài + luôn hiện chỉ báo riêng tư), D8
  (thứ tự pha: `... → 007 studio → 008 online-provider`; slug lịch sử "008" — feature này chạy dưới
  issue #31 nên thư mục `docs/intake/` và branch dùng `031-online-provider`, không đổi ADR).
- `.specify/memory/constitution.md` — Principle I (Local-first & No Default Egress), II (Verifiable
  Citations — vẫn phải giữ chip `[n]` khi trả lời bằng provider online), III (Desktop Security Boundary —
  main-only network/secret, keytar, không log nội dung/secret).
- `docs/03-ui/prototype.html` dòng 481–521 (màn Cài đặt / Settings, section `#s5`) — đã có sẵn khối
  **"AI cục bộ (Ollama)"** và khối **"AI online (tùy chọn)"** với 3 hàng provider: Anthropic Claude,
  OpenAI, Google Gemini — mỗi hàng có ô nhập/hiển thị khóa API dạng che (`sk-ant-•••••4a2f`), trạng thái
  "Đã xác thực ✓", và toggle bật/tắt riêng từng provider. Có khối note cảnh báo: "Khi bật, nội dung câu
  hỏi và đoạn nguồn liên quan sẽ được gửi tới máy chủ nhà cung cấp. Dùng khóa API của chính bạn." Badge
  riêng tư ở header (`localBadge`) đổi giữa "Chạy cục bộ · dữ liệu không rời máy" ↔ "AI online đang bật ·
  một số dữ liệu sẽ gửi ra ngoài" khi có ít nhất 1 toggle provider online bật.
- `docs/00-glossary.md` — đã tra trước khi soạn intake này (xem mục Thuật ngữ mới bên dưới cho các
  term chưa có).
- `docs/04-decisions/INDEX.md` — đã quét toàn bộ; **không có quyết định nào trước đây về online provider
  cụ thể** (007-ai-runtime clarify chỉ nói về Ollama local). Mọi ambiguity bên dưới đều là mới, chưa có
  quyết định để tái dùng.
- **Code kế thừa (007-ai-runtime), đã đọc để bám pattern — KHÔNG đổi kiến trúc:**
  - `src/main/services/ai-runtime/provider.ts` — interface `LLMProvider { id, chat(req), embed(req), test() }`.
  - `src/main/services/ai-runtime/registry.ts` — `ProviderRegistry { register, setActive, getActive, list }`.
  - `src/main/services/ai-runtime/ollama-provider.ts` — implementation mẫu cho provider mới bám theo
    (đọc `ModelSelection` qua hàm inject, ném lỗi rõ ràng khi thiếu model).
  - `src/main/services/ai-runtime/ai-runtime.ts` — `AiRuntime` assembly, nơi IPC handler gọi vào; expose
    `registry: ProviderRegistry` — bề mặt để feature này cắm thêm provider.
  - `src/main/services/ai-runtime/model-selection.ts` — lưu `ModelSelection` qua electron-store, có
    validate tên model ở boundary (regex, max length) — mẫu cho validate input mới (API key, provider id...).
  - `src/main/services/ai-runtime/runtime-status.ts` — `computeRuntimeStatus` (check-on-demand, không cache).
  - `src/shared/ipc/channels.ts` dòng 34–38 — 5 kênh `ai:*` hiện có
    (`ai:listModels`, `ai:testConnection`, `ai:getSelectedModels`, `ai:setSelectedModels`, `ai:getRuntimeStatus`).
  - `src/shared/ipc/types.ts` dòng 1–70 — `PrivacyState{mode,label}`, `Model`, `ModelSelection`,
    `RuntimeStatus`, `ChatMessage/ChatRequest/ChatResult`, `EmbedRequest/EmbedResult` — types dùng chung
    mà provider mới phải tương thích.
  - Renderer: chưa tìm thấy thư mục `src/renderer/features/settings*` cụ thể qua Glob
    (`src/renderer/features/**/settings*/**` không khớp) — cần Grep rộng hơn (`"Ollama"`, `"ai:"`,
    `"ProviderRegistry"`) khi vào `/speckit-plan` để định vị chính xác màn Settings hiện tại trước khi
    thêm section "AI online".

## Tóm tắt CÁI GÌ cần xây

Thêm khả năng dùng **AI online tùy chọn** (opt-in) bên cạnh AI cục bộ (Ollama) đã có, mà **không đánh mất
3 điểm khác biệt bất biến**:

- **Local-first vẫn là mặc định:** app tiếp tục chạy đầy đủ offline bằng Ollama; online provider chỉ được
  gọi khi người dùng chủ động bật + nhập API key của chính họ.
- **Kiểm chứng được không đổi:** dù trả lời bằng provider online, chip trích dẫn `[n]` vẫn phải map đúng
  về locator nguồn — cơ chế hậu kiểm citation hiện có (rag-qa/studio) tiếp tục áp dụng, không phụ thuộc
  provider nào đang active.
- **Chỉ báo riêng tư trung thực:** UI luôn phản ánh đúng đang chạy cục bộ hay đang gửi dữ liệu ra ngoài —
  không được lệch giữa hiển thị và hành vi thực (Principle I).

Cụ thể: cắm thêm 3 implementation của `LLMProvider` (Claude/Anthropic, Gemini/Google, OpenAI) vào
`ProviderRegistry` đã có từ 007-ai-runtime, gọi mạng **chỉ ở main process** (fetch tiêm vào + timeout,
theo mẫu `OllamaProvider`/`ollama-client.ts`), đọc API key từ **keytar** (OS keychain), không log
key/nội dung câu hỏi/đoạn nguồn. Thêm section "AI online" vào màn Cài đặt (đã có khung trong prototype)
để chọn provider, nhập/xoá API key, chọn model, và kiểm tra kết nối (`test()` — tái dùng pattern
`ai:testConnection`).

## Prompt for /speckit-specify

**Prompt for /speckit-specify:**

> Xây tính năng "AI online (tùy chọn)" cho InsightVault: bổ sung 3 nhà cung cấp AI online phổ biến —
> **Claude (Anthropic)** qua Messages API (`https://api.anthropic.com/v1/messages`, header `x-api-key`
>
> - `anthropic-version`), **Google Gemini** qua Generative Language API
>   (`generativelanguage.googleapis.com`, key qua query hoặc header), và **OpenAI** qua Chat Completions
>   API (`https://api.openai.com/v1/chat/completions`, header `Authorization: Bearer`) — bên cạnh AI cục
>   bộ (Ollama) đã có sẵn từ feature 007-ai-runtime.
>
> Mỗi provider là một implementation mới của interface `LLMProvider { id, chat, embed, test }` (đã có ở
> `src/main/services/ai-runtime/provider.ts`), đăng ký vào `ProviderRegistry` hiện có — nơi gọi AI ở các
> feature khác (rag-qa, studio) chỉ lấy `registry.getActive()`, không cần sửa gì để hoạt động với
> provider mới (kế thừa nguyên vẹn kiến trúc, không đổi interface).
>
> Gọi mạng ra ngoài **chỉ được thực hiện ở main process** — renderer không bao giờ chạm trực tiếp vào
> API key hay HTTP client của provider online, đúng ranh giới bảo mật Electron đã áp dụng cho
> `OllamaProvider`/`ollama-client.ts` (fetch tiêm vào được để test, có timeout).
>
> API key của từng provider đọc/ghi qua **keytar** (OS keychain / Credential Manager) — **không bao giờ**
> lưu plaintext trong SQLite/electron-store/JSON. Không được log nội dung API key, câu hỏi người dùng,
> hay đoạn nguồn (đúng Constitution III và pattern hiện có ở `ai-runtime`).
>
> Thêm section **"AI online"** vào màn **Cài đặt (Settings)**, đúng bố cục đã phác trong
> `docs/03-ui/prototype.html` (khối `#s5` — đã có sẵn khung 3 hàng Anthropic Claude / OpenAI / Google
> Gemini, mỗi hàng gồm: hiển thị trạng thái khóa API (che một phần, "Đã xác thực ✓" hoặc "Chưa nhập khóa
> API"), nút nhập/xoá khóa, và toggle bật/tắt riêng từng provider), bổ sung: chọn model cho provider đang
> bật, và nút "Kiểm tra kết nối" (tái dùng pattern `LLMProvider.test()` + kênh `ai:testConnection` đã có,
> mở rộng để test được cả provider online đang chọn).
>
> Khi có ít nhất 1 provider online đang bật, **chỉ báo riêng tư** (badge ở header, `PrivacyState`) phải
> đổi từ "Chạy cục bộ · dữ liệu không rời máy" sang trạng thái phản ánh đúng việc dữ liệu sẽ gửi ra
> ngoài — đúng hành vi demo đã có trong prototype (`localBadge` đổi text/class khi toggle online bật) và
> đúng Constitution Principle I (chỉ báo phải luôn khớp hành vi thực, không được lệch).
>
> Trích dẫn `[n]` phải tiếp tục kiểm chứng được (Constitution Principle II) bất kể câu trả lời đến từ
> provider local hay online — cơ chế hậu kiểm citation hiện có ở rag-qa/studio không đổi, chỉ nguồn sinh
> văn bản trả lời (`chat()`) đổi sang provider đang active.
>
> **Ngoài phạm vi (out of scope) của feature này:**
>
> - Streaming câu trả lời (rag-qa hiện tại chờ trọn, không streaming — giữ nguyên hành vi này).
> - Thu phí / license / đồng bộ đám mây (chưa xây ở v1, theo OVERVIEW mục 7).
> - Tự động tải/cài model cho provider online (không áp dụng — model online không tải về máy).
> - Thêm provider ngoài 3 cái nêu trên (Claude, Gemini, OpenAI) — không mở rộng danh sách provider ở
>   feature này.
> - Đổi hành vi Ollama/local hiện có (007-ai-runtime) — chỉ cắm thêm, không sửa lại provider local.

## Ambiguities to raise in /speckit-clarify

1. **Embedding cho RAG khi dùng online provider:** Anthropic (Claude) **không có API embedding** công
   khai. Nếu người dùng chọn Claude làm provider chat, thì bước embedding (dùng cho ingestion + retrieval
   RAG) lấy từ đâu? Phương án cần quyết:
   - (a) Giữ **embedding LUÔN LOCAL qua Ollama** bất kể provider chat đang active là gì — online provider
     chỉ đảm nhận `chat()`, không đảm nhận `embed()`.
   - (b) Dùng embedding của chính provider online đang chọn khi provider đó có embedding API (OpenAI có
     `text-embedding-*`; Google Gemini có `embedding-001`) — nhưng khi chọn Claude thì bắt buộc rơi về
     Ollama cho embedding (fallback không đồng nhất giữa 3 provider).
   - (c) Cả hai — cho người dùng chọn nguồn embedding độc lập với nguồn chat.
     → Ảnh hưởng trực tiếp tới việc `LLMProvider.embed()` của `AnthropicProvider` implement thế nào (ném
     lỗi "không hỗ trợ"? hay không implement provider Anthropic cho embed và luôn fallback registry khác?).

2. **Phạm vi áp dụng online provider:** chỉ dùng cho **Chat (rag-qa)**, hay cả **Studio** (Tóm tắt/Ý
   chính/FAQ/Dàn ý), hay cả hai? Cả hai hiện đều gọi qua `LLMProvider.chat()` nên về kỹ thuật dễ áp dụng
   đồng thời, nhưng cần xác nhận ý định sản phẩm (ví dụ: có thể muốn Studio luôn local vì xử lý toàn bộ
   nguồn — payload lớn hơn — trong khi Chat online chấp nhận được vì chỉ gửi câu hỏi + vài chunk).

3. **Chọn provider ở đâu — global hay theo từng tính năng:** 1 provider "active" áp dụng cho toàn app
   (giống `ProviderRegistry.setActive()` hiện tại — chỉ 1 active tại 1 thời điểm), hay cho phép chọn
   provider khác nhau cho Chat vs Studio? Prototype hiện chỉ vẽ toggle bật/tắt riêng từng provider (có
   thể bật nhiều đồng thời?) chứ chưa rõ cơ chế "active" khi nhiều provider cùng bật — mâu thuẫn tiềm ẩn
   giữa "3 toggle độc lập" (prototype UI) và "1 active tại 1 thời điểm" (`ProviderRegistry.setActive`,
   ADR D3) cần làm rõ.

4. **Model:** cho nhập tay tên model (text input, giống cách Ollama model name được validate ở
   `model-selection.ts`), hay preset danh sách cố định mỗi provider (ví dụ Claude: `claude-sonnet-4-5`,
   `claude-opus-4-5`...), hay cả hai (dropdown preset + tuỳ chọn "khác")? Ảnh hưởng tới UI (dropdown vs
   input) và tới validate boundary (regex cố định theo từng nhà cung cấp, hay danh sách whitelist).

5. **Xử lý lỗi/timeout mạng, key sai, rate limit:** hành vi & thông báo cụ thể khi:
   - Key sai/hết hạn (401/403 từ provider) — có tự động fallback về Ollama không, hay chỉ báo lỗi và
     dừng câu trả lời?
   - Rate limit (429) — retry có backoff hay báo lỗi ngay?
   - Timeout mạng — ngưỡng timeout bao lâu (theo mẫu `ollama-client.ts` có timeout, cần số cụ thể cho
     online HTTP call)?
   - Provider online mất mạng giữa chừng khi grounded mode đang chờ trả lời — có rơi về báo lỗi rõ ràng
     hay silent fail?
     Cần quyết định để viết spec cho error state/thông báo người dùng (tương tự cách 007 xử lý
     `RuntimeStatus.reason` cho Ollama).

6. **Mức độ chỉ báo egress:** ngoài đổi badge trạng thái (đã có trong prototype), có cần **confirm/cảnh
   báo tường minh trước lần gửi đầu tiên** ra ngoài không (ví dụ modal "Bạn sắp gửi dữ liệu tới OpenAI,
   tiếp tục?")? Prototype hiện chỉ có 1 khối `.note` cảnh báo tĩnh trong Settings, không có confirm dialog
   tại thời điểm gửi request thực tế. Constitution Principle I chỉ yêu cầu "chỉ báo phải phản ánh đúng
   trạng thái hiện tại" — không nói rõ có cần confirm theo từng lần gửi hay không.

7. **Đơn — nhiều provider online cùng bật:** prototype vẽ 3 toggle độc lập (Anthropic đang "on" trong ảnh
   demo, OpenAI/Gemini "off") — có cho phép bật đồng thời nhiều provider online (rồi người dùng chọn 1
   cái "active" ở đâu đó khác), hay bật 1 provider tự động tắt 2 cái còn lại (radio-like qua toggle UI)?
   Liên quan trực tiếp câu hỏi #3 ở trên nhưng tách riêng vì đây là hành vi UI cụ thể (toggle exclusivity)
   cần `/speckit-clarify` chốt trước khi thiết kế component Settings.

_(Không có mâu thuẫn nào giữa OVERVIEW / ADR / prototype cần liệt kê riêng — 3 nguồn này nhất quán về
việc online provider là opt-in, dùng API key người dùng, key lưu an toàn, có 3 nhà cung cấp cụ thể; các
điểm chưa rõ ở trên là do tài liệu GỐC chưa đủ chi tiết, không phải do mâu thuẫn giữa các nguồn.)_

## Thuật ngữ mới (append vào glossary)

Các term dưới đây **chưa có** trong `docs/00-glossary.md` (đã tra trước, cột 日本語 tiếp tục để `—` vì dự
án không có nguồn Nhật). Đề xuất bản dịch để người phụ trách append khi vào branch feature:

| Tiếng Việt (đề xuất)                                     | English (đề xuất, dùng trong code)                        | Ghi chú                                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Nhà cung cấp AI online cụ thể                            | `AnthropicProvider` / `GeminiProvider` / `OpenAIProvider` | 3 implementation mới của `LLMProvider` (interface đã có tên trong glossary)                                   |
| Khóa API (của provider online)                           | `apiKey`                                                  | Field nhập ở Settings; lưu qua keytar, KHÔNG vào SQLite/electron-store                                        |
| Lưu trữ khóa an toàn (OS keychain)                       | `secret storage` (keytar)                                 | Đã nhắc ở ADR D5/Constitution III nhưng chưa có dòng riêng trong glossary                                     |
| Nhà cung cấp đang hoạt động (được chọn để xử lý request) | `active provider`                                         | Đã có `ProviderRegistry.getActive()`/`setActive()` trong code nhưng glossary chưa có dòng thuật ngữ tương ứng |
| Egress ra mạng ngoài (khi bật provider online)           | `network egress`                                          | Đã dùng trong ADR D5 nhưng chưa có dòng glossary riêng                                                        |

## Suggested constitution amendments

Không đề xuất sửa `constitution.md` — các nguyên tắc I (Local-first & No Default Egress), II (Verifiable
Citations), III (Desktop Security Boundary) đã bao trùm đầy đủ ràng buộc cho feature này (opt-in, keytar,
main-only network, chỉ báo riêng tư trung thực, citation không đổi theo provider). Feature này là một
minh hoạ áp dụng nguyên tắc đã có, không phát sinh nguyên tắc mới cấp dự án.
