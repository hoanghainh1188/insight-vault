# Research — 013-rag-qa (Phase 0)

Quyết định lớn đã chốt ở 2 ADR (`2026-07-11-rag-qa-clarify.md`, `2026-07-11-rag-retrieval-strategy.md`).
File này ghi phần verify kỹ thuật + best-practice cho các điểm phụ thuộc.

## R1 — LanceDB search API (đã VERIFY thực tế)

- **Decision**: `table.search(queryVector).where(\`notebook_id = '<id>'\`).limit(topK).toArray()`→ mỗi row
có`id, source_id, _distance`. Map `_distance`→`score` (nhỏ = liên quan hơn).
- **Verify (đã chạy probe Node 24)**: exact match → `_distance=0`; vector khác → distance lớn hơn; filter
  `notebook_id` loại đúng chunk ngoài notebook. Bảng chưa tồn tại (chưa nạp nguồn) → `tableNames()` rỗng →
  `search` trả `[]` (guard trong impl).
- **Rationale**: đúng ADR lancedb-integration (brute-force MVP, lọc theo cột `notebook_id`).
- **Alternatives**: tự tính cosine ngoài LanceDB — thừa, LanceDB đã có. Loại.

## R2 — Ngưỡng liên quan RELEVANCE_MAX_DISTANCE

- **Decision**: hằng số cấu hình `RELEVANCE_MAX_DISTANCE` (mặc định ~**1.0** cho model `nomic-embed-text`,
  L2 distance trên vector chuẩn hoá). Hit có `score > ngưỡng` bị loại. Nếu sau lọc còn 0 hit → "không tìm
  thấy trong nguồn" (grounded) / trả lời kiến thức chung (open).
- **Rationale**: ngăn context nhiễu → giảm bịa; "không tìm thấy" đáng tin hơn.
- **Lưu ý**: ngưỡng phụ thuộc model embedding + cách LanceDB tính distance. Đặt hằng số ở 1 nơi, ghi chú
  cách tinh chỉnh (quan sát distance của câu hỏi liên quan vs không liên quan trên tài liệu thật). MVP chọn
  bảo thủ; có thể nới. KHÔNG hardcode rải rác.
- **Alternatives**: không ngưỡng, luôn lấy top-k — model dễ bịa khi chunk không liên quan lọt vào. Loại.

## R3 — Multi-turn qua ChatRequest hiện có (đã đọc code)

- **Decision**: `ChatRequest { messages: ChatMessage[], model? }` (007) đã hỗ trợ nhiều lượt. Ghép:
  `[{role:'system', content: <system prompt + context>}, ...lịch sử ~6 message gần nhất, {role:'user',
content: <câu hỏi>}]`. KHÔNG cần đổi interface.
- **Retrieval chỉ dùng câu hỏi hiện tại** (embed câu hỏi mới) — không viết lại truy vấn theo ngữ cảnh (MVP;
  hạn chế đã ghi ở clarify A9).
- **Rationale**: tận dụng interface sẵn có, không đụng 007; multi-turn cho phần sinh câu trả lời là đủ.

## R4 — Đảm bảo chip [n] đúng chunk (crux Constitution II)

- **Decision**: theo ADR retrieval-strategy mục 4 — hệ thống đánh số context `[1..k]`, giữ bảng
  `n → {chunkId,sourceId,sourceTitle,locator}`; sau khi có câu trả lời, regex `\[(\d+)\]` trích mọi số;
  `n∈[1..k]` → hợp lệ (map, dedup); `n` ngoài → **gỡ token `[n]` khỏi văn bản hiển thị**, không vào citation.
- **Rationale**: số LLM viết chỉ là "gợi ý"; tính đúng đắn do hệ thống kiểm soát bằng bảng ánh xạ thật →
  không có đường để chip trỏ sai (Constitution II). Đây là logic THUẦN, test tất định (không cần model).
- **Alternatives**: tin số LLM — vi phạm II. Loại. Hệ thống tự chèn [n] (không để LLM đánh số) — khó biết
  câu nào dùng chunk nào; để LLM đánh số rồi hậu kiểm là cân bằng tốt.

## R5 — Không log câu hỏi/nội dung (Constitution III)

- **Decision**: `register.ts` đăng ký `rag:ask` qua `safeHandle` KHÔNG đưa payload vào `logEvent` (như các
  kênh hiện có). Trong `rag-service`/`retrieval`/`prompt` KHÔNG `console.*`/`logEvent` chứa câu hỏi, context,
  câu trả lời. Nếu cần log sự kiện (vd "rag.asked") chỉ log metadata an toàn (mode, số citation) qua `redact`.
- **Verify**: rà bằng grep khi implement + e2e/security-reviewer.

## R6 — getChunksByIds (mở rộng source-repo)

- **Decision**: `getChunksByIds(ids: string[]): Chunk[]` — `SELECT * FROM chunk WHERE id IN (?,?,...)`
  parameterized (sinh placeholder theo số lượng id). Trả theo thứ tự ids đầu vào (map lại, vì SQL IN không
  đảm bảo thứ tự) để giữ đúng thứ tự điểm số từ search.
- **Rationale**: search trả id không theo source; cần lấy text+locator nhiều chunk 1 lần. Parameterized
  (Constitution III / bảo mật).

## Tổng hợp

- KHÔNG thêm dependency, KHÔNG schema/migration mới. Mở rộng 2 file 011 (search, getChunksByIds) + không
  đổi provider 007.
- Rủi ro thấp (đã verify LanceDB search). Điểm cần test kỹ nhất: `citation.ts` (crux II) + ngưỡng liên quan
  (R2) tinh chỉnh khi chạy thật.
