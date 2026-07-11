# RAG retrieval & citation strategy (013-rag-qa)

- Ngày: 2026-07-11
- Feature liên quan: `013-rag-qa` (áp cho mọi feature dùng lại RAG/citation sau: `006-source-viewer`,
  `007-studio`)
- Câu hỏi gốc: rag-qa là nơi đầu tiên truy hồi + sinh câu trả lời có trích dẫn. Cần chốt top-k, ghép
  context, system prompt 2 chế độ, cơ chế đảm bảo chip `[n]` đúng chunk, và chữ ký `VectorStore.search` —
  vì các quyết định này ảnh hưởng trực tiếp Constitution II và được feature sau tái dùng.
- Người quyết định: hoanghainh1188 (2026-07-11)

## Quyết định

### 1. Retrieval

- **top-k = 6** chunk/câu hỏi (hằng số `RETRIEVAL_TOP_K`).
- `VectorStore.search(queryVector, notebookId, topK)` → `VectorSearchHit[] { id, sourceId, score }`, sắp
  theo `score` tăng dần (khoảng cách nhỏ = liên quan hơn). Lọc theo `notebook_id` (đã có cột ở LanceDB).
- **Khoảng cách = COSINE** (`.distanceType("cosine")`, bị chặn [0,2]) — KHÔNG dùng L2 mặc định của LanceDB
  vì vector embedding (vd `nomic-embed-text`) không chuẩn hoá → L2 không có ngưỡng ổn định (sửa issue #15).
- **Ngưỡng liên quan** `RELEVANCE_MAX_DISTANCE = 0.75` (cosine distance ⇔ cosine similarity ≥ 0.25): hit
  vượt ngưỡng bị loại. Đặt LỎNG để nội dung thật lọt; tính "không bịa" dựa thêm grounded prompt + ép
  `notFound` khi câu trả lời không có citation hợp lệ nào (mục 4). Nếu sau lọc còn 0 hit → "không tìm thấy".
- Chỉ truy hồi chunk thuộc source `ready` (nguồn chưa nhúng xong không có vector → tự nhiên không xuất hiện).

### 2. Ghép context

- Ngân sách **ký tự** `CONTEXT_CHAR_BUDGET ≈ 6000` (an toàn cho model ~8k token, chừa chỗ câu trả lời).
- Thêm chunk theo thứ tự `score` tốt→xấu tới khi đầy ngân sách; chunk không đủ chỗ → **bỏ NGUYÊN chunk**
  (không cắt giữa chunk → locator không lệch, giữ tính kiểm chứng).
- Mỗi chunk trong context render dạng:
  ```
  [n] (Nguồn: <title>, trang <page|—>)
  <text chunk>
  ```
  `n` là số thứ tự 1-based theo thứ tự đưa vào context — là khoá để hậu kiểm citation (mục 4).

### 3. System prompt (2 chế độ)

- **Theo nguồn (grounded)**: "Chỉ trả lời dựa trên các đoạn nguồn được đánh số `[n]` dưới đây. Khi dùng
  thông tin từ đoạn nào, chèn đúng `[n]` ngay sau ý đó. Nếu các đoạn không chứa câu trả lời, trả lời đúng
  một câu: 'Không tìm thấy trong nguồn.' Tuyệt đối không dùng kiến thức ngoài các đoạn này, không bịa."
- **Mở rộng (open)**: "Ưu tiên trả lời từ các đoạn nguồn `[n]` (chèn `[n]` cho phần lấy từ nguồn). Nếu cần
  dùng kiến thức chung ngoài các đoạn, được phép, nhưng ghi rõ phần đó là kiến thức chung (không gắn `[n]`)."
- Câu hỏi + lịch sử hội thoại (tối đa ~6 message gần nhất) đưa vào `ChatMessage[]`; context chunk đưa vào
  message `system` (hoặc đầu message user). KHÔNG log nội dung (Constitution III).

### 4. Đảm bảo chip `[n]` đúng chunk (crux Constitution II) — HẬU KIỂM

Không tin số LLM tự sinh một cách mù quáng:

1. Hệ thống đánh số context `[1..k]` (mục 2), giữ bảng `n → { chunkId, sourceId, sourceTitle, locator }`.
2. Sau khi có câu trả lời, **regex trích mọi `[n]`** trong văn bản.
3. Với mỗi `[n]`: nếu `n ∈ [1..k]` → hợp lệ, thêm vào danh sách citation (dedup theo `n`); nếu `n` ngoài
   phạm vi → **gỡ chip đó khỏi văn bản hiển thị** (thay `[5]` bằng rỗng), KHÔNG đưa vào citation.
4. Citation trả về renderer = các `[n]` hợp lệ & thực sự xuất hiện, kèm mapping đầy đủ về locator.
5. Grounded mode: nếu câu trả lời là "Không tìm thấy trong nguồn" (hoặc rỗng căn cứ) → citation rỗng, cờ
   `notFound=true`.

→ Chip hiển thị LUÔN trỏ tới chunk có thật trong context; không có đường để chip trỏ sai/không tồn tại.

### 5. `VectorStore.search` (interface dùng chung — mở rộng 011)

```ts
interface VectorSearchHit { id: string; sourceId: string; score: number; }
search(queryVector: number[], notebookId: string, topK: number): Promise<VectorSearchHit[]>;
```

Impl LanceDB: `table.search(queryVector).where(\`notebook_id = '<id>'\`).limit(topK)`→ map`_distance`→`score`.
Bảng chưa tồn tại (chưa nạp nguồn nào) → trả `[]`.

## Lý do

- top-k nhỏ + ngưỡng: giảm nhiễu context → model ít bịa; "không tìm thấy" đáng tin hơn.
- Ngân sách ký tự (không token): tất định, không phụ thuộc tokenizer — nhất quán với ADR chunking.
- Hậu kiểm citation là cách DUY NHẤT đảm bảo Principle II khi dùng LLM sinh tự do: số do model viết chỉ là
  "gợi ý", tính đúng đắn do hệ thống kiểm soát bằng bảng ánh xạ thật.
- Bỏ nguyên chunk (không cắt): locator `{charStart,charEnd}` vẫn trỏ đúng đoạn gốc đầy đủ.

## Phương án loại bỏ

- Tin số LLM tự sinh không hậu kiểm — vi phạm Constitution II (chip trỏ sai). Loại.
- Cắt text chunk cho vừa ngân sách — locator lệch, phá tính kiểm chứng. Loại.
- Ghép token-budget (tiktoken) — thêm dependency, phụ thuộc model. Loại (dùng ký tự).
- Streaming ở MVP — phải đổi interface `LLMProvider` dùng chung (007). Hoãn.

## Hệ quả

- `013-rag-qa`: thêm `VectorStore.search` + `source-repo.getChunksByIds` + service retrieval/context/prompt/
  citation-postprocess (thuần, test được bằng DI) + 1 kênh `rag:ask` + UI cột Chat.
- `006-source-viewer` tái dùng `Citation { chunkId, sourceId, locator }` để mở nguồn + highlight.
