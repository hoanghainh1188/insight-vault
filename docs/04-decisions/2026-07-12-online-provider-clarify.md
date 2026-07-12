# online-provider clarify — chốt 6 quyết định (031-online-provider)

- Ngày: 2026-07-12
- Feature: `031-online-provider` (issue #31)
- Nguồn: `docs/intake/031-online-provider.md` (7 ambiguity) + yêu cầu người dùng (bổ sung 3 provider)
- Người quyết định: hoanghainh1188 (2026-07-12).

## Bối cảnh

Feature "AI online (tùy chọn)" — cắm 3 provider online (**Claude/Anthropic · Google/Gemini · OpenAI**) vào
`ProviderRegistry` sẵn có (007-ai-runtime), dùng **API key riêng của người dùng** qua **keytar**. Prototype
(`docs/03-ui/prototype.html` `#s5`) đã có sẵn khung section "AI online" với 3 hàng provider + toggle + badge
riêng tư đổi trạng thái. 7 ambiguity từ intake được chốt như dưới.

## Quyết định

**1. Embedding cho RAG: LUÔN dùng Ollama LOCAL — bất kể provider chat đang active.**
Online provider chỉ đảm nhận `chat()` (sinh câu trả lời/tổng hợp). `embed()` cho ingestion + retrieval
**luôn đi qua OllamaProvider**. Lý do CỐT LÕI: vector index phải **nhất quán** giữa lúc lập chỉ mục và lúc
truy vấn — trộn embedding khác nhà cung cấp (chiều/không gian vector khác nhau) sẽ **phá retrieval**. Giữ
embedding cố định ở Ollama → đổi provider chat KHÔNG cần tái lập chỉ mục toàn bộ. Hệ quả code: 3 provider
online **không dùng cho đường embedding**; nếu implement `embed()` thì ném lỗi "không hỗ trợ embedding" (hoặc
đường embed trong service luôn gọi thẳng Ollama, không qua active provider).

**2. Phạm vi áp online: CẢ Chat (rag-qa) + Studio.** Cả hai gọi qua `LLMProvider.chat()` → provider đang
active áp cho mọi câu trả lời (Chat và 4 loại Studio). Lưu ý ghi vào spec: Studio gửi payload lớn hơn (toàn
nguồn) ra ngoài khi online — nằm trong cảnh báo egress.

**3. Active provider: 1 provider active TOÀN APP, ĐỘC QUYỀN (radio-like).**
Bật 1 provider online → tự tắt các provider online còn lại (đúng `ProviderRegistry.setActive()` — 1 active
tại 1 thời điểm, ADR D3). Khi KHÔNG có provider online nào bật → về **local Ollama** (fallback mặc định).
Giải mâu thuẫn "3 toggle độc lập (prototype UI)" vs "1 active (registry)": UI 3 toggle nhưng hành vi
exclusivity (chọn 1 = tắt 2). (Chốt luôn ambiguity #7 toggle exclusivity.)

**4. Model: PRESET dropdown mỗi provider + tuỳ chọn "Khác" (nhập tay).**
Mỗi provider có danh sách preset model phổ biến (VD Claude: `claude-opus-4-5`, `claude-sonnet-4-5`; OpenAI:
`gpt-4o`…; Gemini: `gemini-2.5-pro`…) + mục "Khác" cho nhập tay (validate regex/max-len ở boundary như
`model-selection.ts` của Ollama). Cân bằng tiện dụng + linh hoạt khi model mới ra (tên đổi nhanh).

**5. Lỗi/timeout/rate-limit: BÁO LỖI RÕ, KHÔNG auto-fallback về Ollama.**
Khi provider online lỗi, KHÔNG âm thầm chuyển sang Ollama (giữ chỉ báo trung thực — người dùng phải biết
provider online của họ hỏng; im lặng đổi provider vi phạm Principle I). Hành vi cụ thể:

- 401/403 (key sai/hết hạn) → báo "Khóa API không hợp lệ hoặc đã hết hạn."
- 429 (rate limit) → báo "Nhà cung cấp đang giới hạn tốc độ, thử lại sau." (KHÔNG auto-retry ở v1)
- Timeout HTTP online → ngưỡng **60s** (chat online có thể chậm); quá → báo lỗi timeout.
- Mất mạng / lỗi khác → báo lỗi rõ ràng, dừng câu trả lời (KHÔNG silent fail). Truyền qua cơ chế lỗi hiện
  có (tương tự `RuntimeStatus.reason` của 007), không log nội dung/secret.

**6. Chỉ báo egress: badge trạng thái + note tĩnh + CONFIRM 1 LẦN khi BẬT (không confirm mỗi request).**

- Badge header (`PrivacyState`) đổi "Chạy cục bộ · dữ liệu không rời máy" ↔ "AI online đang bật · một số dữ
  liệu sẽ gửi ra ngoài" theo trạng thái active provider (đúng prototype + Principle I: chỉ báo khớp hành vi).
- Note tĩnh cảnh báo trong Settings (đã có trong prototype).
- **Confirm 1 lần khi người dùng BẬT** một provider online (modal: "Bật AI online: câu hỏi và đoạn nguồn liên
  quan sẽ được gửi tới máy chủ <provider>. Tiếp tục?"). KHÔNG confirm lặp mỗi lần gửi request (tránh phiền).

## Điểm chạm (dự kiến — chi tiết ở /speckit-plan)

- `src/main/services/ai-runtime/` (MỚI): `anthropic-provider.ts`, `gemini-provider.ts`, `openai-provider.ts`
  (mỗi cái implement `LLMProvider.chat`/`test`, fetch tiêm vào + timeout 60s); đăng ký vào `registry`.
- Secret: `src/main/services/ai-runtime/secret-store.ts` (MỚI) bọc **keytar** (get/set/delete apiKey theo
  provider id) — chỉ main, không log.
- Config active provider + model online: mở rộng `model-selection.ts`/electron-store (KHÔNG chứa key —
  key CHỈ ở keytar).
- IPC `ai:*`: thêm kênh whitelisted (VD `ai:setProviderKey`, `ai:deleteProviderKey`, `ai:hasProviderKey`,
  `ai:setActiveProvider`, `ai:listOnlineModels`/mở rộng `ai:testConnection`) — validate ở boundary, không
  log key. `PrivacyState` cập nhật theo active provider.
- Renderer Settings: section "AI online" (định vị màn Settings hiện tại bằng Grep khi plan) — 3 hàng
  provider, nhập/xoá key, dropdown model (preset + "Khác"), toggle exclusive, nút test, confirm khi bật.
- Embedding path: đảm bảo LUÔN gọi Ollama (không đổi theo active chat provider) — kiểm ở rag/ingestion.

## Hệ quả / ràng buộc

- **Constitution I:** online opt-in, mặc định local; badge trung thực + confirm khi bật. **II:** citations
  `[n]` không đổi theo provider (hậu kiểm giữ nguyên). **III:** network + keytar CHỈ main; renderer qua
  kênh whitelisted; KHÔNG log key/câu hỏi/đoạn nguồn. **IV:** test-first ≥80% (provider parse/validate/
  registry/secret-store thuần test được; wiring keytar/HTTP loại coverage như adapter I/O).
- Ngoài phạm vi: streaming, thu phí/license, tự tải model, provider khác 3 cái, đổi hành vi Ollama/local.
- Glossary: append 5 term mới (AnthropicProvider/GeminiProvider/OpenAIProvider, apiKey, secret storage,
  active provider, network egress) — làm trong branch feature.
