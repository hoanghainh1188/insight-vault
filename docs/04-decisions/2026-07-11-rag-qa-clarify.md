# rag-qa clarify — chốt 15 ambiguity (013-rag-qa)

- Ngày: 2026-07-11
- Feature liên quan: `013-rag-qa` (pha 005, issue #13)
- Nguồn: `docs/intake/013-rag-qa.md` (15 ambiguity) + phiên chốt với hoanghainh1188
- Người quyết định: hoanghainh1188 (2026-07-11). 3 quyết định kiến trúc nặng do người dùng chọn trực tiếp
  (⭐); 12 mục còn lại ủy quyền "chốt luôn khuyến nghị".
- Chi tiết retrieval/prompt/citation tách ADR riêng: `2026-07-11-rag-retrieval-strategy.md`.

## Quyết định theo từng ambiguity

**1. Top-k / ngưỡng.** top-k = **6** chunk/câu hỏi. Áp **ngưỡng liên quan**: nếu 0 chunk (notebook rỗng/
chưa có nguồn ready) HOẶC mọi chunk vượt ngưỡng khoảng cách (không đủ liên quan) → chế độ theo nguồn trả
"Không tìm thấy trong nguồn". Hằng số cấu hình. → xem ADR.

**2. Ghép context.** Giới hạn theo **ký tự** (~6000, an toàn cho model 7B ~8k token, chừa chỗ cho câu trả
lời). Thêm chunk theo thứ tự điểm số tới khi đầy; chunk không đủ chỗ → **bỏ nguyên chunk điểm thấp nhất**
(KHÔNG cắt giữa chunk — giữ nguyên vẹn để locator không lệch). Mỗi chunk trong context gắn số `[n]` + nhãn
nguồn. → ADR.

**3. System prompt.** 2 template (theo nguồn / mở rộng) — nội dung cụ thể ở ADR. Theo nguồn: buộc chỉ dùng
context, chèn `[n]`, thiếu căn cứ → "Không tìm thấy trong nguồn", cấm bịa. Mở rộng: ưu tiên context (có
`[n]`), phần ngoài nguồn ghi rõ là kiến thức chung (không `[n]`).

**4. ⭐ Streaming — KHÔNG (chờ trọn + spinner).** Giữ nguyên `LLMProvider.chat(): Promise<ChatResult>`
(KHÔNG đụng interface 007). UI hiện "đang trả lời…" rồi show trọn câu. Streaming để pha sau.

**5. ⭐ Gắn chip [n] — HỆ THỐNG HẬU KIỂM + SỬA.** Hệ thống đánh số các chunk context `[1..k]`; LLM chèn
`[n]` trong câu trả lời. Sau khi có câu trả lời, hệ thống **trích mọi `[n]` (regex) và validate với tập
chunk thật**: `n ∈ [1..k]` → map về `{chunkId, sourceId, sourceTitle, locator}`; `n` ngoài phạm vi → **loại
bỏ chip lỗi** khỏi câu trả lời hiển thị. Danh sách citation chỉ gồm các `[n]` hợp lệ & thực sự xuất hiện.
→ đảm bảo chip KHÔNG BAO GIỜ trỏ sai/không tồn tại (Constitution II). → ADR.

**6. Model bịa số (vd [5] khi chỉ 4 chunk).** Chip `[n]` ngoài `[1..k]` bị **gỡ khỏi câu trả lời** (không
báo lỗi toàn bộ; câu trả lời vẫn hiển thị phần còn lại). Ghi log cảnh báo (redact, không log nội dung).

**7. ⭐ Chế độ mở rộng — LÀM CẢ 2.** Grounded + open đều hoạt động thật, khác nhau ở system prompt (#3) +
việc enforce citation (grounded: phải có `[n]` hoặc "không tìm thấy"; open: cho phép phần không `[n]` gắn
nhãn kiến thức chung).

**8. Lưu lịch sử hội thoại — IN-MEMORY PHIÊN (không persist).** MVP KHÔNG thêm migration/bảng
conversation. Hội thoại giữ ở **state renderer** (client), mất khi đóng notebook/app. Persist để pha sau →
tránh migration #3 + giữ feature cô lập.

**9. Multi-turn.** CÓ trong phiên: renderer giữ danh sách message, gửi **N lượt gần nhất** (cap ~6 message)
làm `ChatMessage[]` cho `chat`. **Retrieval chỉ dùng câu hỏi hiện tại** (embed câu hỏi mới; không tự viết
lại truy vấn theo ngữ cảnh — MVP). Ghi chú hạn chế: câu hỏi tiếp nối kiểu "còn cái kia?" có thể truy hồi
kém — chấp nhận cho MVP.

**10. 0 chunk / notebook chưa có nguồn ready.** Notebook không có nguồn `ready` → cột Chat vô hiệu ô nhập +
gợi ý "Nạp nguồn để bắt đầu hỏi đáp". Search 0 chunk liên quan → grounded: "Không tìm thấy trong nguồn";
open: trả lời từ kiến thức chung (gắn nhãn).

**11. Ollama offline / chưa chọn model.** Tái dùng `RuntimeStatus` (007): trước khi gửi, kiểm runtime; chưa
sẵn sàng → hiện **banner inline trong cột Chat** (tái dùng ý `RuntimeOnboarding`, hoặc thông báo gọn) + vô
hiệu gửi. KHÔNG gửi request chắc chắn lỗi.

**12. Kênh `rag:*`.** MVP chỉ **1 kênh invoke `rag:ask`** (`{notebookId, question, mode, history}` →
`{answer, citations, notFound, modeUsed}`). Không streaming → không cần kênh event. Lịch sử do renderer giữ
→ không cần kênh history. Không kênh cancel ở MVP.

**13. Giới hạn độ dài câu hỏi.** Tối đa **2000 ký tự**; vượt → từ chối với thông báo thân thiện (validate ở
boundary main).

**14. `VectorStore.search` (mở rộng 011).** `search(vector: number[], notebookId: string, topK: number):
Promise<VectorSearchHit[]>`, `VectorSearchHit = { id, sourceId, score }` (score = khoảng cách, để áp ngưỡng
#1). Thêm vào interface + impl LanceDB (dùng API vectorSearch). → ADR.

**15. "Đang trả lời".** Spinner/typing indicator đơn giản (không streaming — theo #4).

## Gap code mở rộng (đụng vùng dùng chung — additive, làm trong branch này)

- `src/main/services/ingestion/vector-store.ts`: thêm `search` (#14).
- `src/main/services/ingestion/source-repo.ts`: thêm `getChunksByIds(ids: string[]): Chunk[]`.
- `src/main/services/ai-runtime/provider.ts`: **KHÔNG đổi** (không streaming — #4).
- `src/shared/ipc/{channels,types}.ts`: thêm `rag:ask` + types (`RagAskInput`, `RagAnswer`, `Citation`).
- `src/renderer/features/rag-qa/`: cột Chat thật; `Workspace.tsx` (011) import component từ đây.

## Hệ quả

- `/speckit-plan` bám ADR `2026-07-11-rag-retrieval-strategy.md` (top-k/context/prompt/citation-mapping/
  search signature) + clarify này.
- `security-reviewer` bắt buộc (đụng model/DB/vector + xử lý input câu hỏi) — soi prompt-injection, không
  log câu hỏi/nội dung.
- Glossary: append term khi cần (top-k retrieval, context, system prompt; conversation/turn chỉ nếu dùng).
