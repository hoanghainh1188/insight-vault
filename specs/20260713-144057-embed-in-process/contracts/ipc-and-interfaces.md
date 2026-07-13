# Contracts — 059 embed-in-process

## Interface nội bộ (main)

### Embedder (embed-model.ts) — I/O

```ts
type EmbedRole = "query" | "passage";
interface Embedder {
  /** Nhúng in-process. onProgress(0..1): tải model (lần đầu) → nhúng. role gắn tiền tố e5. */
  embed(
    texts: string[],
    role: EmbedRole,
    onProgress?: (f: number) => void,
  ): Promise<number[][]>;
}
function createEmbedder(opts: {
  cacheDir: string;
  model?: string; // mặc định Xenova/multilingual-e5-small
  setOnline?: (online: boolean) => void; // badge egress khi TẢI model lần đầu (031/045)
}): Embedder;
```

### Hàm thuần (test-first)

```ts
// e5-prefix.ts
function withE5Prefix(text: string, role: EmbedRole): string; // "query: "/"passage: "

// model-version.ts
const EMBEDDING_MODEL_VERSION: string; // "e5-small-384"
function matchesVersion(stored: string | undefined): boolean;

// vector-normalize.ts
function l2normalize(v: number[]): number[]; // ‖v‖₂ = 1 (v=0 → giữ nguyên)

// reindex-plan.ts
function planReindexBatches(chunkIds: string[], batchSize: number): string[][];

// model-recommend.ts
type ChatTier = "small" | "medium" | "large";
function recommendChatModel(totalMemBytes: number): {
  tier: ChatTier;
  label: string;
  examples: string[];
};
```

### Reindex runner (reindex-runner.ts) — I/O

```ts
interface ReindexDeps {
  listAllChunkIds(): string[]; // từ SQLite chunk
  getChunkText(id: string): string | undefined; // chunk.text
  chunkMeta(id: string): { notebookId: string; sourceId: string };
  vectorStore: VectorStore; // add/getVectorsByIds/dropTable
  embed: Embedder["embed"];
  onProgress?: (done: number, total: number) => void;
  markComplete(): void; // bump electron-store version khi XONG
}
/** Idempotent + resume: bỏ chunk đã có vector; drop bảng cũ nếu dim lệch trước lô đầu. */
async function runReindex(deps: ReindexDeps): Promise<void>;

/** Kiểm phải reindex không (startup). */
function needsReindex(storedVersion: string | undefined): boolean;
```

### Ollama health (ollama-health.ts) — I/O

```ts
interface OllamaHealth {
  running: boolean;
  models: string[];
  modelPulled: boolean;
}
function checkOllama(deps: {
  listTags(): Promise<string[]>;
  selectedModel(): string | undefined;
}): Promise<OllamaHealth>;
```

## IPC (preload contextBridge — whitelisted)

| Kênh                    | Hướng         | Payload → Kết quả                                             |
| ----------------------- | ------------- | ------------------------------------------------------------- |
| `ai:recommendModel`     | renderer→main | `()` → `{ tier, label, examples, totalMemGb }`                |
| `ai:ollamaHealth`       | renderer→main | `()` → `OllamaHealth`                                         |
| `embed:reindexStatus`   | renderer→main | `()` → `{ inProgress: boolean; done: number; total: number }` |
| `embed:reindexProgress` | main→renderer | event `{ done, total }` (như `source:*` progress 011)         |

- **KHÔNG kênh mới cho embedding thường** (ingestion/retrieval dùng embedder trực tiếp ở main).
- Có thể **mở rộng `ai:getRuntimeStatus` (007)** thay vì thêm `ai:ollamaHealth` nếu gọn hơn — quyết định
  lúc implement, miễn giữ hợp đồng dữ liệu trên.

## Bất biến hợp đồng

- Kênh RAG (`rag:ask`), source (`source:*`), studio (`studio:*`) **KHÔNG đổi chữ ký**. Khi đang reindex,
  `rag:ask` trả về trạng thái "đang tái lập chỉ mục" trong answer (không đổi shape kênh).
- Renderer KHÔNG nhận model/vector thô; chỉ nhận trạng thái/tiến độ (Constitution III).
