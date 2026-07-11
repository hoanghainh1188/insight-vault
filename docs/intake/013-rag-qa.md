# Intake — 013-rag-qa (Hỏi đáp theo nguồn với trích dẫn kiểm chứng được)

> Output của subagent `design-intake`. Cầu nối giữa tài liệu thiết kế và Spec Kit.
> KHÔNG chứa spec — đó là việc của `/speckit-specify`.

## Input sources

- `docs/OVERVIEW.md` — mục 5 (MVP: hỏi đáp có trích dẫn, 2 chế độ), mục 6 (ràng buộc bất biến #3: trích
  dẫn map đúng vị trí), mục 10 (RAG: truy hồi, ghép ngữ cảnh, map `[n]` ngược về chunk/nguồn/vị trí).
- `docs/03-ui/prototype.html` — màn S2 Workspace, cột Chat, dòng **391–419** (khung composer + 2 chế độ
  - model chip + nút gửi), dòng **396–403** (mẫu thread: bong bóng user/AI, chip trích dẫn `<button
class="cite" data-cite>`, khối `.srcnote` liệt kê nguồn), dòng **417** (modehint — text mô tả chế độ
    theo nguồn), dòng **462–478** (S4 Source Viewer — đích đến khi bấm chip, tham chiếu nhưng NGOÀI phạm
    vi feature này/thuộc 006), dòng 526+547 (script demo: "citation chips -> open source viewer").
- `docs/04-decisions/2026-07-10-tech-stack.md` — D2 (LanceDB + SQLite), D3 (Ollama qua `ProviderRegistry`,
  interface `LLMProvider{chat,embed,test}`), D4 (locator gắn lúc chunk, KHÔNG tái tạo offset sau; map
  `[n] → chunk_id → source + locator`), D5 (main-only), D8 (thứ tự pha: `rag-qa` sau `ingestion`, trước
  `source-viewer`).
- `.specify/memory/constitution.md` — Principle I (local-first, no egress mặc định), **Principle II —
  Verifiable Citations (NON-NEGOTIABLE)**: mỗi chunk giữ locator ngay lúc tạo (đã có từ 011), chip `[n]`
  MUST map xác định `n → chunk_id → source + locator`, chế độ theo nguồn không có căn cứ → MUST báo
  "không tìm thấy trong nguồn" — **cấm bịa**; chế độ mở rộng phần ngoài tài liệu MUST gắn nhãn "không dựa
  trên nguồn". Principle III (retrieval/chat/embed/DB/LanceDB chỉ ở main; renderer qua IPC whitelisted;
  không log nội dung tài liệu/câu hỏi). Principle IV (TDD, coverage 80%). Principle V (phased — 005 sau
  004, trước 006).
- `docs/00-glossary.md` — đã có: `source`, `chunk`, `embedding`, `locator`, `citation`, `retrieval`,
  `grounded mode`, `open mode`, `ungrounded`, `provider`, `LLMProvider`, `ProviderRegistry`, `chat model`,
  `embedding model`, `vector store`, `chunking`. Quét kỹ — phần lớn thuật ngữ RAG đã tồn tại từ khi viết
  glossary ban đầu (dự đoán trước ADR); còn thiếu vài khái niệm vận hành cụ thể (xem mục "Thuật ngữ mới").
- `docs/04-decisions/INDEX.md` — đã quét. Không có quyết định nào riêng cho RAG/prompt/retrieval-topK/
  streaming/lịch sử hội thoại — toàn bộ ambiguity dưới đây là MỚI, chưa từng được trả lời.
- Không có Figma MCP nào được cấu hình cho phiên này và dự án không dùng Figma (theo `CLAUDE.md`, nguồn
  UI gốc là `docs/03-ui/prototype.html`, không phải Figma) — không áp dụng bước đọc Figma.

### Code hiện có (đọc để traceability + phát hiện gap)

- `src/main/services/ingestion/vector-store.ts` — interface `VectorStore` hiện có `add / deleteBySource /
deleteByNotebook / countBySource / close`. **CHƯA có `search`.** Bảng LanceDB `chunks(id, notebook_id,
source_id, vector, dim)`, brute-force MVP (theo ADR `2026-07-11-lancedb-integration.md`).
- `src/main/services/ingestion/source-repo.ts` — có `listChunks(sourceId)` (theo 1 source), CHƯA có hàm
  lấy nhiều chunk theo danh sách id bất kỳ (cần sau bước search trả về id không theo source).
- `src/main/services/ai-runtime/provider.ts` — `LLMProvider { id, chat(ChatRequest): Promise<ChatResult>,
embed(EmbedRequest): Promise<EmbedResult>, test() }`. `ChatRequest{messages, model?}`,
  `ChatResult{content}` — **không có trường streaming/callback**. `EmbedRequest{text, model?}` — nhận
  **1 text/lần**, không batch.
- `src/shared/ipc/{channels.ts,types.ts}` — 21 kênh hiện có (`app:*` ×5, `ai:*` ×5, `notebook:*` ×5,
  `source:*` ×5 invoke + 1 event). Chưa có `rag:*`. `Locator{page,charStart,charEnd}` đã định nghĩa dùng
  lại được nguyên trạng.
- `src/renderer/features/sources/Workspace.tsx` — cột Chat hiện là placeholder tĩnh ("Trò chuyện theo
  nguồn sẽ có ở bước RAG (005)"). Feature này thay bằng UI thật.

## Prompt for /speckit-specify

Xây dựng tính năng **hỏi đáp theo nguồn với trích dẫn kiểm chứng được** (RAG Q&A) cho notebook trong
InsightVault — đây là hiện thực hoá lời hứa cốt lõi #3 của sản phẩm ("kiểm chứng được") và là tính năng
trung tâm nối tiếp pipeline nạp nguồn (011-ingestion) đã hoàn thành.

Người dùng đang ở màn Workspace của 1 notebook (3 cột: Nguồn / Chat / Studio). Ở cột Chat, người dùng gõ
câu hỏi tự do vào ô nhập, chọn 1 trong 2 chế độ trả lời qua công tắc:

- **Theo nguồn** (mặc định, "grounded"): hệ thống chỉ được trả lời dựa trên nội dung các nguồn đã nạp
  trong notebook đó. Nếu không tìm được căn cứ trong nguồn, hệ thống phải trả lời rõ ràng "không tìm thấy
  trong nguồn" — **tuyệt đối không được bịa đặt thông tin**. Đây là yêu cầu bất di bất dịch (Constitution
  Principle II).
- **Mở rộng** ("open"): hệ thống được phép dùng thêm kiến thức chung của mô hình ngoài các nguồn đã nạp,
  nhưng phần nội dung không lấy từ tài liệu phải được gắn nhãn rõ ràng "không dựa trên nguồn" để người
  dùng phân biệt được đâu là thông tin có căn cứ, đâu là không.

Khi hệ thống trả lời, câu trả lời phải chèn các chip trích dẫn dạng số `[n]` ngay tại vị trí thông tin đó
được lấy từ nguồn nào (theo đúng mẫu ở prototype: bong bóng trả lời có nút trích dẫn nhỏ dạng số ngay sau
câu, và một dòng tóm tắt "Nguồn: ..." liệt kê từng số ứng với tên nguồn + số trang/vị trí ở cuối). Mỗi số
`[n]` phải ánh xạ xác định (deterministic) tới đúng 1 chunk cụ thể, từ đó suy ra đúng nguồn (source) và
đúng vị trí gốc (locator: trang/char offset) — việc bấm vào chip để mở nguồn và cuộn tới highlight đúng
đoạn đó là phạm vi của tính năng khác (source-viewer, làm sau); ở tính năng này chỉ cần đảm bảo dữ liệu
ánh xạ chip → chunk → locator là chính xác và được trả về đầy đủ cho renderer.

Luồng xử lý kỹ thuật đề xuất (main process — tuân thủ ranh giới bảo mật: mọi truy cập DB/vector
store/model AI CHỈ được thực hiện ở main process, renderer giao tiếp qua kênh IPC whitelisted, không có
quyền truy cập trực tiếp filesystem/DB):

1. Nhận câu hỏi từ renderer qua kênh IPC mới (nhóm `rag:*`), kèm `notebookId` + chế độ trả lời đã chọn.
2. Sinh vector embedding cho câu hỏi bằng `LLMProvider.embed` (qua `ProviderRegistry`, model embedding đã
   chọn ở Cài đặt — tái dùng cơ chế từ 007-ai-runtime).
3. Tìm kiếm các chunk liên quan nhất trong phạm vi `notebookId` đó bằng vector store (LanceDB) — đây là
   thao tác **search theo vector chưa tồn tại trong `VectorStore` interface hiện tại** (011-ingestion mới
   có add/delete/count), cần bổ sung method tìm kiếm mới cho interface này.
4. Lấy đầy đủ text + locator của các chunk trúng tuyển từ SQLite (source-repo hiện có `listChunks` theo
   1 source; cần khả năng lấy chunk theo danh sách id kết quả search — có thể là method mới hoặc ghép từ
   API hiện có, để speckit-plan quyết định).
5. Ghép các đoạn chunk trúng tuyển thành ngữ cảnh (context), kèm câu hỏi, gửi cho `LLMProvider.chat` theo
   đúng chế độ (theo nguồn / mở rộng) với chỉ dẫn hệ thống (system prompt) phù hợp buộc mô hình trích dẫn
   đúng cách và không bịa khi ở chế độ theo nguồn.
6. Hậu xử lý câu trả lời để đảm bảo mỗi chip `[n]` xuất hiện trong văn bản trả lời ánh xạ được xác định
   về đúng chunk/nguồn/locator tương ứng đã dùng làm ngữ cảnh — không tin tưởng mù quáng số do mô hình tự
   sinh nếu không kiểm chứng được (đây là điểm mấu chốt của Constitution Principle II, cần làm rõ ở
   `/speckit-clarify`).
7. Trả kết quả về renderer: nội dung câu trả lời (đã đánh dấu chip) + danh sách citation (số thứ tự →
   chunk id → source id/tên nguồn → locator) để render bong bóng chat + dòng tóm tắt nguồn giống prototype.
8. UI cột Chat: hiển thị luồng hội thoại (bong bóng người dùng/AI), ô nhập câu hỏi, công tắc 2 chế độ với
   dòng gợi ý mô tả chế độ đang chọn (như "modehint" trong prototype), hiển thị model đang dùng, trạng
   thái "đang trả lời" khi chờ kết quả, và xử lý khi notebook chưa có nguồn nào sẵn sàng hoặc khi runtime
   AI cục bộ (Ollama) chưa sẵn sàng (chưa cài/chưa chọn model) — tái dùng khái niệm `RuntimeStatus` /
   `runtime onboarding` đã có từ 007-ai-runtime.

Phạm vi feature này KHÔNG bao gồm: xem nguồn + highlight thật khi bấm chip (thuộc 006-source-viewer, chỉ
cần trả đủ dữ liệu để feature đó dùng), Studio (tóm tắt/FAQ, thuộc 007-studio), pipeline audio/video/ảnh
(Pha 2). Chế độ "mở rộng" — làm ngay trong feature này hay để lại thành công tắc UI hiển thị nhưng backend
chưa hỗ trợ đầy đủ là điều cần làm rõ ở clarify.

## Ambiguities to raise in /speckit-clarify

Đã quét `docs/04-decisions/INDEX.md` — không có quyết định nào từng trả lời các câu dưới đây; tất cả đều
MỚI với feature 013.

1. **Top-k retrieval / ngưỡng similarity** — truy hồi bao nhiêu chunk mỗi câu hỏi? Có ngưỡng similarity
   tối thiểu để loại chunk không liên quan, hay luôn lấy đúng top-k cố định? Ảnh hưởng trực tiếp tới
   "không tìm thấy trong nguồn" (nếu top-k luôn trả về gì đó dù không liên quan, mô hình dễ bịa).
2. **Chiến lược ghép context** — giới hạn tổng độ dài ngữ cảnh gửi cho LLM là bao nhiêu (theo token hay
   ký tự)? Nếu chunk trúng tuyển vượt giới hạn, cắt bớt theo cách nào (bỏ chunk điểm thấp nhất? cắt text
   từng chunk?)? Model chat local (vd `qwen2.5:7b` theo prototype) có context window giới hạn thực tế.
3. **Prompt template / system prompt** — nội dung chỉ dẫn hệ thống cho chế độ theo nguồn (buộc chỉ dùng
   context, báo "không tìm thấy trong nguồn" khi thiếu căn cứ) và chế độ mở rộng (buộc gắn nhãn "không
   dựa trên nguồn" cho phần ngoài tài liệu) cụ thể là gì? Đáng cân nhắc thành ADR riêng (xem mục dưới).
4. **Streaming câu trả lời hay chờ trọn** — prototype có trạng thái "đang trả lời" gợi ý có thể cần
   streaming, nhưng `LLMProvider.chat` hiện tại (007-ai-runtime) trả `Promise<ChatResult>` một lần, không
   hỗ trợ streaming/callback từng phần. Nếu cần streaming → phải mở rộng interface `LLMProvider` (đụng
   code dùng chung của 007, ngoài phạm vi cô lập feature 013) → cần quyết định trước khi plan.
5. **Cách gắn/parse chip `[n]`** — để mô hình tự đánh số `[n]` ngay trong văn bản trả lời (rồi hệ thống
   hậu kiểm ánh xạ đúng không), hay hệ thống tự hậu xử lý chèn số dựa trên chunk nào thực sự được dùng
   (không tin cậy số do LLM tự sinh)? Đây là điểm mấu chốt cho Constitution Principle II — cách nào đảm
   bảo chip không bao giờ trỏ sai chunk?
6. **Độ tin cậy trích dẫn khi model "bịa" số** — nếu LLM sinh ra chip `[5]` nhưng ngữ cảnh chỉ có 4 chunk
   (id 1-4), xử lý thế nào (loại bỏ chip lỗi? báo lỗi toàn bộ câu trả lời? fallback không trích dẫn đoạn
   đó)? Cần quy tắc rõ ràng để không vi phạm "cấm bịa" của Principle II.
7. **Chế độ mở rộng — làm trong feature này hay để UI-only trước?** Prototype đã vẽ sẵn công tắc 2 chế độ
   (dòng 409-412) nhưng OVERVIEW mục 5 liệt kê cả 2 là MVP Pha 1. Cần xác nhận: feature 013 triển khai đầy
   đủ backend cho cả 2 chế độ, hay chỉ "theo nguồn" trước và "mở rộng" để placeholder?
8. **Lưu lịch sử hội thoại** — có persist hội thoại vào SQLite (cần migration schema mới, bảng
   `conversation`/`message`) để giữ khi đóng/mở lại notebook, hay chỉ lưu tạm trong bộ nhớ phiên
   (in-memory, mất khi đóng app)? Ảnh hưởng scope + có cần multi-turn hay không (câu hỏi 9).
9. **Hành vi multi-turn / ngữ cảnh hội thoại trước đó** — câu hỏi tiếp theo có cần "nhớ" câu hỏi/trả lời
   trước trong cùng phiên (để hiểu ngữ cảnh như "còn điều khoản kia thì sao?") hay mỗi câu hỏi độc lập
   hoàn toàn? Ảnh hưởng cách ghép `ChatMessage[]` gửi cho provider.
10. **0 chunk truy hồi được / notebook rỗng hoặc chưa có nguồn `ready`** — hành vi chính xác khi notebook
    chưa có nguồn nào ở trạng thái `ready`, hay khi search không trả về chunk nào đủ liên quan? Thông báo
    gì hiển thị cho người dùng?
11. **Ollama offline / chưa chọn chat hoặc embedding model** — tái dùng `RuntimeStatus`/`runtime
onboarding` đã có (007) như thế nào trong luồng hỏi đáp — chặn gửi câu hỏi trước, hay cho gửi rồi báo
    lỗi? Có cần hiện banner riêng trong cột Chat hay dùng chung component `RuntimeOnboarding`?
12. **Danh sách kênh `rag:*` + payload cụ thể** — tối thiểu cần kênh gửi câu hỏi + nhận kết quả; có cần
    kênh riêng để lấy/list lịch sử hội thoại (phụ thuộc câu hỏi 8), kênh huỷ câu hỏi đang xử lý (nếu
    streaming/thời gian dài)? Cần chốt tên kênh theo đúng quy ước `rag:<verb>` trước khi viết `channels.ts`.
13. **Giới hạn độ dài câu hỏi người dùng nhập** — có giới hạn ký tự tối đa cho ô nhập không (để tránh
    context quá dài hoặc lạm dụng)? Prototype không thể hiện giới hạn.
14. **`VectorStore.search` — chữ ký & ngữ nghĩa cụ thể** — tham số (`vector`, `notebookId`, `topK`, có cần
    `sourceId` lọc thêm không?), giá trị trả về (chỉ `id`/`sourceId` như `VectorHit` hiện tại, hay cần
    thêm điểm số similarity để áp ngưỡng ở câu hỏi 1?). Đây là thay đổi ở vùng code dùng chung (011), nên
    chữ ký cần chốt sớm.
15. **Cách hiển thị "đang trả lời"** — spinner đơn giản, hay hiện từng phần câu trả lời dần (phụ thuộc
    quyết định streaming ở câu hỏi 4)?

## Traceability

| Yêu cầu                                                                     | Nguồn                                                                      |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Hỏi đáp có trích dẫn, chip `[n]` mở nguồn                                   | `docs/OVERVIEW.md` mục 5 "Hỏi đáp có trích dẫn"                            |
| 2 chế độ theo nguồn / mở rộng                                               | `docs/OVERVIEW.md` mục 5 "Hai chế độ trả lời"; prototype dòng 409-412, 417 |
| Trích dẫn phải map đúng vị trí nguồn                                        | `docs/OVERVIEW.md` mục 6.3 (ràng buộc bất biến #3)                         |
| UI cột Chat: composer, bong bóng, chip, srcnote                             | `docs/03-ui/prototype.html` dòng 391-419, 396-403                          |
| Model chip hiển thị model local đang dùng                                   | prototype dòng 413                                                         |
| Locator gắn lúc chunk, không tái tạo offset sau                             | ADR `2026-07-10-tech-stack.md` D4; Constitution Principle II               |
| retrieval/chat/embed chỉ ở main, IPC whitelisted                            | ADR D5; Constitution Principle III                                         |
| LLMProvider qua ProviderRegistry                                            | ADR D3; `src/main/services/ai-runtime/provider.ts`                         |
| Thứ tự pha: rag-qa sau ingestion, trước source-viewer                       | ADR D8; Constitution Principle V                                           |
| Chế độ theo nguồn không bịa; chế độ mở rộng gắn nhãn "không dựa trên nguồn" | Constitution Principle II                                                  |
| Chunk + Locator model tái dùng                                              | `src/shared/ipc/types.ts` (`Chunk`, `Locator`) — từ 011                    |

## Thuật ngữ mới (append vào glossary)

Phần lớn thuật ngữ RAG cốt lõi (`retrieval`, `chunk`, `locator`, `citation`, `grounded mode`, `open mode`,
`ungrounded`, `LLMProvider`) **đã có sẵn** trong `docs/00-glossary.md` (được thêm sẵn trước khi có ADR).
Các thuật ngữ vận hành cụ thể của feature 013 (nếu `/speckit-clarify` xác nhận cần) nên được append:

| 日本語 | Tiếng Việt                                           | English (đề xuất) | Ghi chú                                                             |
| ------ | ---------------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| —      | Truy hồi top-k                                       | top-k retrieval   | Số lượng chunk lấy ra mỗi lần search — cần chốt số cụ thể ở clarify |
| —      | Ngữ cảnh (ghép từ các chunk trúng tuyển gửi cho LLM) | context           | Phân biệt với `context window` của model                            |
| —      | Hội thoại (1 phiên hỏi đáp trong notebook)           | conversation      | Chỉ thêm nếu clarify xác nhận có lưu lịch sử (ambiguity #8)         |
| —      | Lượt hỏi-đáp (1 cặp câu hỏi + câu trả lời)           | turn / message    | Dùng nếu multi-turn được xác nhận (ambiguity #9)                    |
| —      | Chỉ dẫn hệ thống (định hướng hành vi LLM)            | system prompt     | Nội bộ main, không log nội dung                                     |

Ghi chú: KHÔNG tự thêm các dòng trên vào `docs/00-glossary.md` — để người phụ trách append trong branch
feature `013-rag-qa` sau khi xác nhận cần dùng (theo rule 5 CLAUDE.md, thêm dòng mới không cần PR riêng).

## Gap code phải mở rộng

Các vùng **code dùng chung** (không thuộc cô lập `src/*/services/rag-qa/` hay `features/rag-qa/`) cần
sửa — nên tách thành commit/PR nhỏ riêng để giảm blast radius và dễ review:

1. **`src/main/services/ingestion/vector-store.ts`** (đụng 011-ingestion) — interface `VectorStore` CHƯA
   có `search`. Cần thêm ví dụ `search(vector: number[], notebookId: string, topK: number):
Promise<VectorHit[]>` (chữ ký chính xác chờ clarify #14). Impl LanceDB hiện là brute-force theo ADR
   `2026-07-11-lancedb-integration.md` — search có thể tận dụng API `vectorSearch` của LanceDB SDK.
2. **`src/main/services/ai-runtime/provider.ts`** (đụng 007-ai-runtime) — nếu clarify #4 xác nhận cần
   streaming, `LLMProvider.chat` phải đổi chữ ký (thêm callback/AsyncIterable) — thay đổi breaking cho
   interface dùng chung, ảnh hưởng cả `OllamaProvider` hiện có.
3. **`src/main/services/ingestion/source-repo.ts`** (đụng 011-ingestion) — có thể cần thêm
   `getChunksByIds(ids: string[]): Chunk[]` để lấy nhiều chunk theo id kết quả search (khác `listChunks`
   hiện tại vốn lọc theo 1 `sourceId`).
4. **`src/shared/ipc/{channels.ts,types.ts}`** — thêm nhóm kênh `rag:*` + type liên quan (câu hỏi, câu
   trả lời có citation, có thể `Conversation`/`Message` nếu #8 xác nhận persist). File dùng chung nhưng
   chỉ **thêm**, không sửa kênh cũ — rủi ro conflict thấp.
5. **`src/renderer/features/sources/Workspace.tsx`** — thay placeholder cột Chat bằng component thật;
   file này thuộc `features/sources/` (do 011 tạo) chứ không phải `features/rag-qa/` — cân nhắc либо sửa
   trực tiếp (nhỏ, ít rủi ro) либо refactor để `Workspace.tsx` import component từ `features/rag-qa/`.

## Suggested ADR

Đề xuất tạo `docs/04-decisions/<ngày>-rag-retrieval-strategy.md` (theo đúng khuôn mẫu
`2026-07-11-chunking-strategy.md` đã có cho 011) để chốt các quyết định "crux" một lần, tránh phải hỏi lại
mỗi khi có feature liên quan đụng tới RAG sau này (vd source-viewer 006 dùng lại citation format). ADR nên
chốt tối thiểu:

- Top-k + ngưỡng similarity (ambiguity #1)
- Chiến lược ghép/cắt context theo giới hạn model (ambiguity #2)
- System prompt template cho 2 chế độ (ambiguity #3)
- Cơ chế đảm bảo chip `[n]` ánh xạ đúng chunk — hậu xử lý vs tin cậy LLM tự đánh số (ambiguity #5, #6)
- Chữ ký `VectorStore.search` (ambiguity #14) — vì đây là thay đổi interface dùng chung, nên chốt sớm
  trước khi nhiều feature khác phụ thuộc vào nó.

Đây cũng là ứng viên hợp lý để nêu qua `/speckit-clarify` trước, sau đó ghi kết quả thành ADR này (đúng
quy trình rule 2 CLAUDE.md: mọi câu trả lời clarify phải ghi vào `docs/04-decisions/`).
