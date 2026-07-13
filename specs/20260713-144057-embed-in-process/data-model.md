# Data Model — 059 embed-in-process

Không thêm bảng SQLite mới (chốt research R4). Thay đổi tập trung ở **LanceDB** (đổi dim) + **electron-store**
(version) + trạng thái suy ra (derived).

## Thực thể

### 1. Vector record (LanceDB, bảng `chunks`) — SỬA dim

| Field         | Kiểu    | Ghi chú                                                 |
| ------------- | ------- | ------------------------------------------------------- |
| `id`          | string  | = `chunk.id` (khoá map locator — KHÔNG đổi)             |
| `notebook_id` | string  | lọc theo notebook                                       |
| `source_id`   | string  | trỏ nguồn                                               |
| `vector`      | float[] | **384 chiều** (trước: 768). Không gian e5, chuẩn hoá L2 |
| `dim`         | number  | = 384                                                   |

- **Interface `VectorStore` giữ nguyên** (`add/search/getVectorsByIds/deleteBy*/countBySource`); thêm
  `dropTable()` (drop bảng để tái tạo dim mới).
- `search` vẫn dùng `distanceType("cosine")`; `_distance` so với `RELEVANCE_MAX_DISTANCE` mới.

### 2. Embedding model version (electron-store) — MỚI

| Key                     | Kiểu   | Ghi chú                                                |
| ----------------------- | ------ | ------------------------------------------------------ |
| `embeddingModelVersion` | string | vd `"e5-small-384"`; **bump khi reindex TOÀN BỘ xong** |

- `EMBEDDING_MODEL_VERSION` = hằng code hiện tại. `matchesVersion(stored)` = `stored === current`.
- Lệch (hoặc thiếu) ⇒ cần tái lập chỉ mục.

### 3. Trạng thái tái lập chỉ mục — DERIVED (không lưu riêng)

- **Toàn cục**: `needsReindex = !matchesVersion(store.embeddingModelVersion)`.
- **Per-chunk done** ⇔ `chunk.id` có vector trong bảng LanceDB mới.
- **Per-notebook ready** ⇔ số vector của notebook = `COUNT(chunk WHERE notebook_id)` **và** version khớp.
- **Progress** = (số chunk đã có vector) / (tổng chunk) — phát qua event tiến độ.

### 4. Chat model recommendation — tĩnh (thuần)

| Tier     | Mốc RAM | Ví dụ            |
| -------- | ------- | ---------------- |
| `small`  | < 8 GB  | ~3B (qwen2.5:3b) |
| `medium` | 8–16 GB | 7–8B             |
| `large`  | > 16 GB | lớn hơn          |

### 5. Ollama health — DERIVED (runtime)

| Field         | Kiểu     | Nguồn                            |
| ------------- | -------- | -------------------------------- |
| `running`     | boolean  | `GET /api/tags` phản hồi được    |
| `models`      | string[] | tên model đã pull                |
| `modelPulled` | boolean  | model đang chọn (007) ∈ `models` |

## Bất biến

- `chunk.id` và mọi cột locator (`page/char_start/char_end/t_start/t_end/bbox_*`) **KHÔNG đổi** — chip `[n]`
  map như cũ (Constitution II).
- Không migration SQLite; `PRAGMA user_version` giữ ở **7**.
