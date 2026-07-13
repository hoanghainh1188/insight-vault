# Intake — 055-rag-enhance

- Issue: #55
- Slug: `rag-enhance`
- Ngày intake: 2026-07-13
- Loại: nâng cấp nội bộ (KHÔNG phải loại nguồn mới) — cải thiện chất lượng **retrieval** của RAG
  (013-rag-qa) đã có. Chưa có code cho feature này (`src/main/services/rag/` hiện tại là baseline
  cần sửa, không phải scaffold sẵn của 055).

## Input sources

- `docs/OVERVIEW.md` — mục 3 (3 điểm bất biến: Local-first, Kiểm chứng được, Offline & tự chủ), mục 5
  (hỏi đáp có trích dẫn), mục 6 (ràng buộc bất biến — đặc biệt #3 "trích dẫn phải map được về vị trí
  chính xác").
- `docs/04-decisions/2026-07-13-rag-enhance-clarify.md` — **quyết định chính** cho feature này (đã đọc
  kỹ, xem tóm tắt bên dưới).
- `docs/04-decisions/INDEX.md` — tra cứu; các quyết định liên quan đã dùng:
  - `2026-07-11-rag-qa-clarify.md` + `2026-07-11-rag-retrieval-strategy.md` (013) — nền retrieval gốc
    (top-k=6, ngưỡng distance, context 6000 ký tự, hậu kiểm citation, 1 kênh `rag:ask`).
  - `2026-07-12-chat-history-clarify.md` (027) — nguồn chat history dùng để giải tham chiếu khi rewrite.
  - `2026-07-12-online-provider-clarify.md` (031) — cơ chế active provider + badge egress, áp dụng
    tương tự cho bước rewrite khi provider online đang bật.
  - `2026-07-11-sqlite-migrations.md` — quy ước migration runner (append-only, `PRAGMA user_version`,
    1 transaction/bước) mà migration #7 (FTS5) phải theo.
- `.specify/memory/constitution.md` — Principle I (local-first/no default egress), II (verifiable
  citations — NON-NEGOTIABLE), III (desktop security boundary — main process only, không log nội dung),
  IV (test-first, coverage ≥80%), V (phased delivery — 055 nằm sau Pha 1 ổn định, không phá Pha 1).
- Code hiện có (đọc để mô tả điểm tích hợp, KHÔNG phải nguồn thiết kế mới):
  - `src/main/services/rag/retrieval.ts` — hàm `retrieve()` hiện tại: embed câu hỏi → `search()` vector
    top-k → lọc theo `RELEVANCE_MAX_DISTANCE` → map `ScoredChunk[]`. Đây là điểm sẽ được thay/bọc bởi
    query rewriting + hybrid search + RRF + MMR.
  - `src/main/services/rag/rag-service.ts` — `compute()` gọi `retrieve()` rồi `buildContext()` →
    `systemPromptFor()` → chat → `postprocessCitations()`. Điểm nối `history` (đã có `MAX_HISTORY_TURNS`)
    dùng cho query rewriting.
  - `src/main/services/rag/rag-types.ts` — `ScoredChunk { chunk, sourceTitle, score }`,
    `RetrievedChunk`, `BuiltContext` — các type retrieval phải tiếp tục thoả để không phá `context-builder.ts`
    và `citation.ts` hạ nguồn.
  - `src/main/services/rag/constants.ts` — `RETRIEVAL_TOP_K=6`, `RELEVANCE_MAX_DISTANCE=0.75`,
    `CONTEXT_CHAR_BUDGET=6000`, `MAX_HISTORY_TURNS=6`. Giữ nguyên theo giả định ADR (RRF lấy top-K mỗi
    nhánh, ví dụ 10, rồi MMR chọn ~6 vào context).
  - `src/main/db/migrations.ts` — migration runner; `MIGRATIONS` mảng hiện dừng ở `version: 6`
    (053-image, bbox trên `chunk`). Migration #7 (FTS5 cho `chunk.text`) là bước tiếp theo, phải
    append-only theo đúng convention (transaction/bước, không sửa migration cũ).
- Không có Figma cho feature này (thuần backend/retrieval, không có UI mới theo ADR — "UI hiện truy vấn
  viết lại" nằm ngoài phạm vi 055).

## Prompt for /speckit-specify

Nâng cấp chất lượng truy xuất (retrieval) của tính năng hỏi đáp có trích dẫn (013-rag-qa) hiện có,
KHÔNG thêm loại nguồn mới, KHÔNG đổi UI Chat. Retrieval hiện tại chỉ đơn truy vấn, chỉ vector: embed
câu hỏi (`embed`) → tìm top-k trong LanceDB (`RETRIEVAL_TOP_K=6`) → lọc theo ngưỡng distance
(`RELEVANCE_MAX_DISTANCE=0.75`) → ghép ngữ cảnh (`context`, `CONTEXT_CHAR_BUDGET=6000` ký tự) → gửi LLM.

Bổ sung 2 cải tiến, chạy tuần tự trước khi ghép ngữ cảnh:

1. **Query rewriting (viết lại câu hỏi) bằng LLM cục bộ (local)**, dùng nhà cung cấp AI đang hoạt động
   (`active provider` — Ollama local mặc định, hoặc provider online nếu người dùng đang bật, tương tự
   cơ chế egress ở 031-online-provider). Mục tiêu viết lại:
   - **Giải tham chiếu hội thoại (coreference resolution)**: đại từ như "nó", "cái đó", "vấn đề trên"
     được thay bằng chủ thể thật, dựa vào vài lượt gần nhất của lịch sử hội thoại (`chat history`, 027).
   - **Mở rộng câu ngắn/mơ hồ** thành truy vấn đầy đủ hơn để truy hồi tốt hơn.
   - Kết quả là **1 câu truy vấn đã viết lại**, dùng chung cho cả nhánh vector và nhánh từ khoá (BM25).
   - Mặc định **luôn chạy** kể cả với câu hỏi đầu tiên (không có lịch sử) — prompt phải được thiết kế để
     **giữ nguyên câu hỏi nếu nó đã đủ rõ**, tránh viết lại làm sai lệch ý định người dùng.
   - Không dùng HyDE (sinh giả thuyết trả lời trước khi truy vấn) — bị loại vì chậm hơn, không cần thiết.

2. **Hybrid search: kết hợp tìm kiếm ngữ nghĩa (vector) và tìm kiếm từ khoá (BM25)**, hợp nhất bằng
   **RRF (Reciprocal Rank Fusion)**, sau đó đa dạng hoá kết quả bằng **MMR (Maximal Marginal Relevance)**:
   - **Nhánh vector**: giữ nguyên cơ chế embed + LanceDB search hiện có.
   - **Nhánh từ khoá (BM25)**: dùng **SQLite FTS5** (`node:sqlite` đã verify hỗ trợ FTS5, bao gồm hàm
     xếp hạng `bm25()`), tạo virtual table full-text trên `chunk.text`. Tokenizer dùng
     `unicode61 remove_diacritics 2` để khớp tìm kiếm không phân biệt dấu tiếng Việt (ví dụ "hop dong"
     vẫn khớp "hợp đồng"). Yêu cầu **migration schema mới** (tiếp theo migration hiện có, đang dừng ở
     `version: 6`) để tạo bảng FTS5 và **backfill** toàn bộ `chunk` hiện có vào bảng FTS5 đó; đồng thời
     đảm bảo bảng FTS5 luôn đồng bộ với `chunk` khi có insert/delete chunk sau này (ví dụ nạp nguồn mới,
     xoá nguồn) — cách đồng bộ cụ thể (external-content table với `content_rowid` hay bảng thường +
     đồng bộ thủ công ở tầng insert/delete chunk) để `/speckit-plan` quyết định kỹ thuật, miễn đạt yêu
     cầu "luôn khớp dữ liệu, migration append-only, không phá schema cũ".
   - **Hợp nhất bằng RRF** (Reciprocal Rank Fusion, hằng số k=60 theo công thức chuẩn): gộp thứ hạng từ
     danh sách kết quả vector và danh sách kết quả BM25 thành 1 danh sách hợp nhất, nhằm bắt được cả
     mức độ liên quan ngữ nghĩa lẫn các từ khoá/tên riêng/thuật ngữ chính xác mà embedding có thể bỏ sót.
   - **Đa dạng hoá bằng MMR** (Maximal Marginal Relevance, hệ số cân bằng λ≈0.7) trên tập đã hợp nhất,
     để giảm việc chọn các chunk gần trùng lặp nội dung nhau, trước khi đưa vào ngân sách ngữ cảnh cuối
     cùng (giữ nguyên `CONTEXT_CHAR_BUDGET` hiện có).
   - **Không** làm LLM-rerank và **không** dùng cross-encoder model — giữ tốc độ phản hồi nhanh vì model
     local vốn đã chạy chậm hơn dịch vụ đám mây.

**Ràng buộc bất biến phải giữ nguyên (Constitution II — Kiểm chứng được, NON-NEGOTIABLE):** query
rewriting, hybrid search, RRF, và MMR chỉ được phép ảnh hưởng đến **việc chọn CHUNK nào** đưa vào ngữ
cảnh trả lời. Mỗi chunk vẫn giữ nguyên `locator` gốc đã gắn từ lúc chunk hoá (013/011) — chip trích dẫn
`[n]` vẫn phải map chính xác 1-1 về đúng nguồn + vị trí, không được bịa nội dung. Khi hybrid search trả
về rỗng (không có chunk đủ liên quan), hành vi "không tìm thấy trong nguồn" (chế độ theo nguồn) phải
giữ nguyên như hiện tại — không được vì có thêm bước rewrite mà làm mất cờ `notFound`.

**Xử lý lỗi/fallback** (đọc là gợi ý baseline từ ADR, `/speckit-plan` cụ thể hoá): nếu bước query
rewriting bằng LLM lỗi hoặc timeout, retrieval phải **rơi về dùng câu hỏi gốc** (không chặn luồng hỏi
đáp). Nếu bước tìm kiếm từ khoá FTS5 lỗi, retrieval phải **rơi về chỉ dùng vector search** (như hành vi
hiện tại) thay vì làm hỏng toàn bộ câu trả lời.

**Kế thừa, không phá vỡ:** feature 013 (`retrieve`, `buildContext`, cơ chế citation hậu kiểm), 027 (chat
history — dùng để giải tham chiếu), 031 (Ollama local + `ProviderRegistry.getActive()` — dùng cho bước
rewrite). Không đổi kênh IPC `rag:ask` hiện có, không đổi UI Chat.

**Assumptions** (trỏ về ADR `docs/04-decisions/2026-07-13-rag-enhance-clarify.md`, dùng làm baseline khi
`/speckit-clarify` không nêu lại):

- Query rewriting luôn chạy, kể cả câu hỏi đầu tiên; prompt bảo toàn câu hỏi đã rõ.
- Truy vấn đã viết lại KHÔNG hiển thị cho người dùng trong UI (có thể log debug nội bộ, không log nội
  dung nhạy cảm ra ngoài theo Constitution III).
- Ngân sách: giữ `CONTEXT_CHAR_BUDGET` và ngưỡng liên quan hiện có; RRF lấy top-K mỗi nhánh (ví dụ 10),
  MMR chọn khoảng 6 chunk cuối cùng vào ngữ cảnh — con số cụ thể do `/speckit-plan` tinh chỉnh trong
  giới hạn "không đổi ngân sách ngữ cảnh cuối cùng đưa cho LLM".
- Provider cho bước rewrite = active provider hiện tại của app (Ollama local mặc định; nếu người dùng
  đã bật provider online thì rewrite cũng đi qua provider online đó — nhất quán với badge egress 031).

## Ambiguities to raise in /speckit-clarify

Các điểm dưới đây **đã có mặc định trong ADR** (`2026-07-13-rag-enhance-clarify.md`, mục "Giả định /
mặc định") nhưng ADR tự ghi rõ "clarify xác nhận nếu intake nêu" — nên vẫn đưa vào `/speckit-clarify` để
chốt chính thức vào spec (không phải mâu thuẫn basic/detail/Figma vì feature này không có 3 nguồn song
song, mà là các quyết định kỹ thuật cần xác nhận rõ trước khi viết task):

1. **Query rewriting có luôn chạy hay chỉ chạy khi có chat history?** Mặc định theo ADR: **luôn chạy**
   (kể cả câu hỏi đầu tiên, không có lịch sử) — vì còn giúp cả việc mở rộng câu ngắn/mơ hồ, không chỉ
   giải tham chiếu. Cần xác nhận vì ảnh hưởng độ trễ mọi câu hỏi (kể cả câu đã rõ ràng, không cần viết
   lại).
2. **Có hiển thị "câu truy vấn đã viết lại" cho người dùng trong UI Chat không?** Mặc định theo ADR:
   **không hiện** (giữ UI gọn, giữ nguyên như hiện tại). Cần xác nhận vì ảnh hưởng tính minh bạch — người
   dùng có thể thắc mắc tại sao câu trả lời "hiểu" được câu hỏi mơ hồ của họ.
3. **Cách đồng bộ bảng FTS5 với `chunk`**: external-content table (`content='chunk', content_rowid=...`,
   tự động qua SQLite trigger) hay bảng FTS5 độc lập + đồng bộ thủ công ở tầng insert/delete chunk
   (ingestion 011, xoá nguồn). ADR để ngỏ, thiên về quyết định kỹ thuật ở `/speckit-plan` — nêu ở clarify
   để chốt rõ trách nhiệm (ai đảm bảo đồng bộ, có cần transaction chung insert chunk + insert FTS5 không)
   trước khi viết task migration.
4. **Có cần toggle bật/tắt cải tiến này ở màn Cài đặt (Settings) không**, hay áp dụng ngầm cho mọi câu
   hỏi không có lựa chọn tắt? ADR không đề cập tới UI Settings cho 055 (điều này nằm ngoài phạm vi được
   liệt kê — "tinh chỉnh tham số qua Settings" ghi rõ **ngoài 055**). Mặc định suy ra: **không có toggle,
   luôn bật**. Cần xác nhận minh thị vì ảnh hưởng đến việc có cần thêm setting mới hay không.
5. **Bước query rewriting khi provider online đang active** — có cần hiển thị/áp dụng "chỉ báo riêng tư"
   (privacy indicator / badge egress) riêng cho bước rewrite hay dùng chung badge egress đã có ở 031 (vì
   theo Constitution I, "mọi request ra ngoài phải phản ánh đúng trạng thái hiện tại")? Mặc định theo
   ADR: dùng lại cơ chế badge/egress hiện có của 031 (không tạo badge mới) — câu hỏi rời máy khi rewrite
   qua provider online tương tự cách câu hỏi/chat hiện đã rời máy khi online active. Cần xác nhận để
   tránh hiểu nhầm là cần UI egress riêng cho bước rewrite.

## Thuật ngữ mới (append vào glossary)

Đây là thuật ngữ **kỹ thuật RAG/thuật toán** (không phải thuật ngữ nghiệp vụ đặc thù khách hàng), nhưng
xuất hiện trong ADR quyết định và sẽ dùng làm tên hàm/module trong code — theo rule "gặp thuật ngữ mới →
liệt kê để người phụ trách append vào glossary trước khi đặt tên", đề xuất bổ sung các dòng sau vào
`docs/00-glossary.md` (English column dùng làm tên hàm/type chuẩn trong code):

| 日本語 | Tiếng Việt (đề xuất)                                         | English (đề xuất, dùng trong code) | Ghi chú                                                                                                                |
| ------ | ------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| —      | Viết lại câu hỏi (giải tham chiếu + mở rộng, trước truy hồi) | query rewriting (`rewriteQuery`)   | LLM local (provider active); dùng chat history 027 — 055                                                               |
| —      | Tìm kiếm kết hợp (ngữ nghĩa + từ khoá)                       | hybrid search                      | vector (LanceDB) + BM25 (FTS5) — 055                                                                                   |
| —      | Xếp hạng từ khoá BM25                                        | BM25                               | Hàm `bm25()` của SQLite FTS5 — 055                                                                                     |
| —      | Bảng full-text SQLite                                        | FTS5 (virtual table)               | `CREATE VIRTUAL TABLE ... USING fts5`, tokenizer `unicode61 remove_diacritics 2` trên `chunk.text` — migration #7, 055 |
| —      | Hợp nhất thứ hạng đối ứng                                    | RRF (Reciprocal Rank Fusion)       | Hợp nhất rank vector-list + BM25-list, hằng số k=60 — 055                                                              |
| —      | Đa dạng hoá kết quả cực đại biên                             | MMR (Maximal Marginal Relevance)   | Giảm chunk trùng lặp trong top-N đã hợp nhất, λ≈0.7 — 055                                                              |

Ghi chú thêm: các viết tắt BM25/FTS5/RRF/MMR là thuật ngữ chuẩn ngành IR (information retrieval), có thể
giữ nguyên tiếng Anh trong cả code lẫn tài liệu Việt — cột "Tiếng Việt" chỉ để giải nghĩa, không cần dịch
ép sang thuần Việt. Người phụ trách cân nhắc mức độ cần thiết append đầy đủ 6 dòng hay gộp bớt (ví dụ
BM25/FTS5 có thể gộp chung 1 dòng "tìm kiếm từ khoá") khi thực hiện trong branch feature.

## Suggested constitution amendments

Không đề xuất sửa constitution. Feature này **không** đòi hỏi nguyên tắc mới — nó là một biến thể áp
dụng chặt Principle II (Verifiable Citations) vào một kỹ thuật retrieval phức tạp hơn, và Principle I
(rewrite qua provider active, tuân theo cơ chế egress badge đã có ở 031). ADR `2026-07-13-rag-enhance-clarify.md`
đã tự nêu rõ ràng buộc "Kiểm chứng được — bất biến" khớp 100% với Principle II hiện có, không cần diễn
giải thêm ở tầng constitution. Nếu về sau có thêm nhiều bước "biến đổi câu hỏi/truy vấn trước khi truy
hồi" (không chỉ 055), có thể cân nhắc bổ sung 1 câu tường minh vào Principle II kiểu: "Mọi bước tiền xử
lý truy vấn (rewriting, mở rộng, dịch...) chỉ được thay đổi _chunk nào được chọn_, không được thay đổi
hoặc bỏ qua yêu cầu locator/citation của chunk đã chọn" — nhưng chưa cần thiết ngay tại 055 vì đã đủ rõ
trong ADR + spec sắp sinh.
