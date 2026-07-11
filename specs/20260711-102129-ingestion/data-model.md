# Data Model — 011-ingestion (Phase 1)

Hai kho: **SQLite** (metadata source/chunk, migration #2, source-of-truth) + **LanceDB** (vector).
Khớp nhau theo `chunk.id`. Bám ADR `2026-07-11-sqlite-migrations.md`, `-chunking-strategy.md`,
`-lancedb-integration.md`.

## SQLite — migration #2 (APPEND vào MIGRATIONS[], version=2, KHÔNG sửa #1)

### Bảng `source`

| Cột            | Kiểu    | Ràng buộc                                                                       | Ý nghĩa                                                 |
| -------------- | ------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `id`           | TEXT    | PRIMARY KEY                                                                     | uuid nguồn                                              |
| `notebook_id`  | TEXT    | NOT NULL, FK→`notebook(id)` **ON DELETE CASCADE**                               | notebook cha                                            |
| `kind`         | TEXT    | NOT NULL, CHECK in ('pdf','docx','txt','md','url')                              | loại nguồn                                              |
| `title`        | TEXT    | NOT NULL                                                                        | tên tệp / tiêu đề trang (hiển thị)                      |
| `origin`       | TEXT    | NOT NULL                                                                        | đường dẫn tệp gốc hoặc URL (tham chiếu, không nội dung) |
| `status`       | TEXT    | NOT NULL, CHECK in ('queued','processing','awaiting_embedding','ready','error') | trạng thái                                              |
| `error_label`  | TEXT    | NULL                                                                            | nhãn lỗi thân thiện khi status='error'                  |
| `page_count`   | INTEGER | NULL                                                                            | số trang (PDF), null với loại khác                      |
| `content_hash` | TEXT    | NOT NULL                                                                        | sha256 nội dung tệp / URL chuẩn hoá (dedup)             |
| `created_at`   | INTEGER | NOT NULL                                                                        | epoch ms                                                |
| `updated_at`   | INTEGER | NOT NULL                                                                        | epoch ms                                                |

Index: `CREATE INDEX idx_source_notebook ON source(notebook_id)`;
`CREATE INDEX idx_source_hash ON source(notebook_id, content_hash)` (dò trùng trong cùng notebook).

### Bảng `chunk`

| Cột          | Kiểu    | Ràng buộc                                       | Ý nghĩa                                       |
| ------------ | ------- | ----------------------------------------------- | --------------------------------------------- |
| `id`         | TEXT    | PRIMARY KEY                                     | uuid chunk (= khoá LanceDB)                   |
| `source_id`  | TEXT    | NOT NULL, FK→`source(id)` **ON DELETE CASCADE** | nguồn cha                                     |
| `ordinal`    | INTEGER | NOT NULL                                        | thứ tự 0-based trong nguồn                    |
| `text`       | TEXT    | NOT NULL                                        | nội dung đoạn (đã làm sạch)                   |
| `page`       | INTEGER | NULL                                            | số trang (PDF), null với loại khác            |
| `char_start` | INTEGER | NOT NULL                                        | offset đầu (half-open) vào toàn văn bản nguồn |
| `char_end`   | INTEGER | NOT NULL                                        | offset cuối (`char_end > char_start`)         |

Index: `CREATE INDEX idx_chunk_source ON chunk(source_id)`.
Locator = `{ page, char_start, char_end }` — gắn NGAY lúc tạo chunk (Constitution II).
Vector KHÔNG lưu ở SQLite (ở LanceDB).

### Cascade

- Xoá `source` → SQLite cascade xoá `chunk` của nó. Vector LanceDB dọn bằng `deleteBySource(source_id)`.
- Xoá `notebook` (feature 009) → SQLite cascade `source`→`chunk`. Vector dọn bằng `deleteByNotebook(notebook_id)`
  TRƯỚC khi xoá notebook (tránh vector mồ côi).

## LanceDB — bảng `chunks` (`userData/vectors/`)

| Cột           | Kiểu                         | Ý nghĩa                                    |
| ------------- | ---------------------------- | ------------------------------------------ |
| `id`          | string                       | = `chunk.id` (khớp ngược SQLite)           |
| `notebook_id` | string                       | lọc/xoá theo notebook                      |
| `source_id`   | string                       | lọc/xoá theo nguồn                         |
| `vector`      | fixed-size-list<float32,dim> | embedding của chunk                        |
| `dim`         | int                          | số chiều (đọc từ provider, không hardcode) |

KHÔNG lưu `text`/`locator` ở LanceDB (SQLite là nguồn sự thật metadata). Truy hồi (005): LanceDB trả `id`
gần nhất → JOIN SQLite lấy text + locator. MVP: brute-force; index ANN lazily khi lớn.

## Shared types (`src/shared/ipc/types.ts` — THÊM)

```ts
export type SourceKind = "pdf" | "docx" | "txt" | "md" | "url";
export type SourceStatus =
  "queued" | "processing" | "awaiting_embedding" | "ready" | "error";

export interface Locator {
  page: number | null; // PDF: số trang 1-based; loại khác: null
  charStart: number; // half-open [charStart, charEnd)
  charEnd: number;
}

export interface Source {
  id: string;
  notebookId: string;
  kind: SourceKind;
  title: string;
  status: SourceStatus;
  errorLabel: string | null;
  pageCount: number | null;
  createdAt: number;
  updatedAt: number;
  // KHÔNG expose origin/content_hash toàn văn ra renderer nếu không cần hiển thị
}

export interface Chunk {
  id: string;
  sourceId: string;
  ordinal: number;
  text: string;
  locator: Locator;
}

export type AddSourceInput =
  | { notebookId: string; kind: "url"; url: string }
  | { notebookId: string; kind: Exclude<SourceKind, "url">; filePath: string };

export interface AddSourceResult {
  source: Source;
  duplicateWarning: boolean; // true nếu trùng content_hash/URL trong cùng notebook
}

export interface SourceProgressEvent {
  sourceId: string;
  notebookId: string;
  status: SourceStatus;
  step: "parse" | "clean" | "chunk" | "embed" | "store" | "done";
  progress: number; // 0..1
  errorLabel?: string;
}
```

## State transitions (nguồn)

```
queued ──> processing ──(embed ok)──────────────> ready
              │                                     ▲
              ├──(provider offline)──> awaiting_embedding ──(runtime ready → auto embed)──┘
              └──(parse/fetch/size/embed fail)──> error ──(source:retry)──> queued
```

- `awaiting_embedding`: đã parse+chunk+lưu SQLite, chưa có vector. Khi runtime AI sẵn sàng, pipeline embed
  tiếp → `ready`.
- Xoá nguồn ở bất kỳ trạng thái nào → dọn SQLite (cascade chunk) + LanceDB (bySource).
