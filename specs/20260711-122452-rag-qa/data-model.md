# Data Model — 013-rag-qa (Phase 1)

KHÔNG schema/migration mới (lịch sử hội thoại in-memory). Chỉ đọc `chunk`/`source` (011) + LanceDB search.
Định nghĩa các type trao đổi + type nội bộ main.

## Shared types (`src/shared/ipc/types.ts` — THÊM)

```ts
export type RagMode = "grounded" | "open"; // Theo nguồn / Mở rộng

/** 1 lượt hội thoại gửi kèm để multi-turn (renderer giữ, gửi ~6 gần nhất). */
export interface RagTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RagAskInput {
  notebookId: string;
  question: string;
  mode: RagMode;
  history: RagTurn[]; // các lượt trước trong phiên (có thể rỗng)
}

/** Trích dẫn: số [n] trong câu trả lời → chunk/nguồn/vị trí thật. Dữ liệu cho source-viewer (006). */
export interface Citation {
  n: number; // số hiển thị trong chip [n]
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  locator: Locator; // {page, charStart, charEnd} — tái dùng từ 011
}

export interface RagAnswer {
  answer: string; // đã hậu kiểm (gỡ chip lỗi)
  citations: Citation[]; // chỉ [n] hợp lệ & thực xuất hiện, dedup theo n
  notFound: boolean; // true khi grounded không đủ căn cứ
  modeUsed: RagMode;
}
```

## Type nội bộ main (không qua IPC)

```ts
// Chunk đã truy hồi + điểm số + đánh số [n] để ghép context và hậu kiểm citation.
export interface RetrievedChunk {
  n: number; // 1-based, thứ tự đưa vào context
  chunk: Chunk; // id, sourceId, ordinal, text, locator (từ 011)
  sourceTitle: string;
  score: number; // = _distance từ LanceDB
}

// Kết quả build context: chuỗi context + bảng ánh xạ n → RetrievedChunk.
export interface BuiltContext {
  contextText: string; // "[1] (Nguồn: ..., trang ..)\n<text>\n\n[2] ..."
  map: Map<number, RetrievedChunk>; // n → chunk (nguồn sự thật cho hậu kiểm citation)
}
```

## VectorStore.search (mở rộng interface 011 — `vector-store.ts`)

```ts
export interface VectorSearchHit {
  id: string;        // = chunk.id
  sourceId: string;
  score: number;     // _distance (nhỏ = liên quan hơn)
}
// thêm vào interface VectorStore:
search(queryVector: number[], notebookId: string, topK: number): Promise<VectorSearchHit[]>;
```

Impl: bảng chưa tồn tại → `[]`; ngược lại `table.search(queryVector).where(\`notebook_id = '<escape>'\`)
`.limit(topK).toArray()` → map `{id, source_id→sourceId, _distance→score}`.

## source-repo.getChunksByIds (mở rộng 011 — `source-repo.ts`)

```ts
getChunksByIds(ids: string[]): Chunk[]; // SELECT * FROM chunk WHERE id IN (?,...); trả theo thứ tự ids
```

## Hằng số (ADR retrieval-strategy)

| Hằng số                  | Giá trị | Ý nghĩa                                               |
| ------------------------ | ------- | ----------------------------------------------------- |
| `RETRIEVAL_TOP_K`        | 6       | số chunk truy hồi/câu hỏi                             |
| `RELEVANCE_MAX_DISTANCE` | ~1.0    | ngưỡng loại hit kém liên quan (tinh chỉnh theo model) |
| `CONTEXT_CHAR_BUDGET`    | ~6000   | ngân sách ký tự ghép context                          |
| `MAX_QUESTION_LEN`       | 2000    | giới hạn độ dài câu hỏi                               |
| `MAX_HISTORY_TURNS`      | 6       | số lượt hội thoại gần nhất gửi cho chat               |

## Luồng dữ liệu (1 câu hỏi)

```
RagAskInput → validate(≤2000) → embed(question) → vectorStore.search(vec, notebookId, 6)
  → lọc score ≤ ngưỡng → getChunksByIds(hitIds) → RetrievedChunk[] (đánh số n)
  → buildContext → prompt(mode) + history + question → LLMProvider.chat → rawAnswer
  → citation.postprocess(rawAnswer, map) → RagAnswer{answer, citations, notFound, modeUsed}
```

Grounded + 0 chunk (sau lọc) → notFound=true, answer="Không tìm thấy trong nguồn", citations=[].
