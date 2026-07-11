# Research — 011-ingestion (Phase 0)

Mọi quyết định lớn đã chốt ở 3 ADR (`docs/04-decisions/2026-07-11-ingestion-clarify.md`,
`-chunking-strategy.md`, `-lancedb-integration.md`). File này ghi phần **best-practice/verify kỹ thuật** cho
các dependency mới + rủi ro tích hợp, theo format Decision/Rationale/Alternatives.

## R1 — Trích text PDF ở main process (không DOM/canvas)

- **Decision**: Dùng `pdfjs-dist` bản **legacy build** (`pdfjs-dist/legacy/build/pdf.mjs`) trong Electron
  main. Chỉ dùng `getDocument().getPage(n).getTextContent()` để lấy text theo từng trang → KHÔNG cần render
  canvas, KHÔNG cần worker DOM. Ghép các item text theo trang, giữ mốc offset đầu mỗi trang → map `page`
  cho locator.
- **Rationale**: Text extraction của pdf.js không cần canvas; legacy build tránh phụ thuộc `DOMMatrix`/ESM
  API trình duyệt. Thống nhất với ADR D4 (pdf.js map locator) → dùng lại được ở source-viewer 006.
- **Alternatives**: `pdf-parse` (bọc pdf.js cũ, kém bảo trì, khó lấy ranh giới trang chuẩn) — loại.
  `unpdf` (mới, wrap pdfjs serverless) — cân nhắc nếu legacy build vướng, nhưng pdfjs-dist chuẩn hơn cho
  map trang.
- **Verify lúc cài (task Setup)**: import legacy build chạy trong Node/Electron main không lỗi `DOMMatrix`;
  nếu cần, polyfill tối thiểu hoặc set `disableWorker`. Fixture PDF 2–3 trang khẳng định `pages.length` +
  text mỗi trang.

## R2 — @lancedb/lancedb tương thích Electron 43 + CI Node 24

- **Decision**: Dùng `@lancedb/lancedb` (napi-rs, prebuilt theo `@lancedb/lancedb-<platform>`). Mở/ghi/xoá
  ở main process. Bảng `chunks` với `vector` kiểu fixed-size-list<float32, dim>.
- **Rationale**: Prebuilt napi → thường KHÔNG cần `electron-rebuild` (khác better-sqlite3). ABI napi ổn định
  giữa Node versions. Dữ liệu embedded, local-first.
- **Alternatives**: `vectordb` (package cũ của LanceDB) — đã đổi tên sang `@lancedb/lancedb`, dùng bản mới.
  SQLite-BLOB tự tính cosine — loại ở ADR (không index ANN).
- **Verify lúc cài (task Setup, RỦI RO CAO)**: `npm i @lancedb/lancedb` rồi smoke test mở bảng + add + search
  trong **cả** vitest (Node 24) **và** Electron main (`npm run dev`). Kiểm prebuilt có cho `darwin-arm64`
  (dev) + `linux-x64` (CI). Nếu Electron ABI vướng: cấu hình `asarUnpack` cho `.node`, hoặc thêm bước
  `electron-rebuild`. Nếu bế tắc như từng gặp với better-sqlite3 → escalate ADR (đổi kho vector), KHÔNG tự ý
  đổi sang giải pháp không ADR.

## R3 — Trích nội dung chính từ URL

- **Decision**: `fetch` (global Node 24) lấy HTML → `jsdom` dựng DOM → `@mozilla/readability`
  (`new Readability(doc).parse()`) lấy `article.content` (HTML nội dung chính) → `turndown` chuyển sang
  markdown sạch → đưa vào pipeline như văn bản. `article.title` làm tiêu đề nguồn.
- **Rationale**: Readability là chuẩn de-facto (engine reader-mode Firefox), loại nav/quảng cáo tốt.
  turndown cho markdown ổn định để chunk. jsdom thuần JS.
- **Alternatives**: Cheerio (không có heuristic reader) — loại. Giữ HTML thô rồi strip tag — nhiều nhiễu.
- **Verify**: jsdom parse HTML thật không treo; giới hạn body 10MB áp TRƯỚC khi dựng DOM (đọc theo stream/độ
  dài `content-length` + cắt). readability trả null (trang không có article) → nguồn `error` "Lỗi trích xuất".

## R4 — SSRF guard cho fetch URL

- **Decision**: Trước mỗi request (kể cả mỗi hop redirect): (a) chỉ chấp nhận scheme `http`/`https`;
  (b) phân giải hostname → IP, **từ chối** nếu IP thuộc dải: loopback (127.0.0.0/8, ::1), private
  (10/8, 172.16/12, 192.168/16, fc00::/7), link-local (169.254/16, fe80::/10), unspecified (0.0.0.0),
  và hostname `localhost`; (c) tự xử lý redirect thủ công (`redirect: 'manual'`), tối đa 5 hop, kiểm lại IP
  mỗi hop; (d) timeout + giới hạn body.
- **Rationale**: Chặn SSRF tới dịch vụ nội bộ máy/mạng LAN (Constitution I + III). Kiểm mỗi hop chống
  redirect-to-internal.
- **Alternatives**: Tin `fetch` tự follow redirect — bỏ qua kiểm hop → không an toàn. Dùng lib `ssrf-req-filter`
  — thêm dependency; guard tự viết đủ nhỏ + test được, ưu tiên.
- **Verify**: unit test bảng IP (loopback/private/link-local/public) + hostname localhost + chuỗi redirect
  ra IP nội bộ đều bị chặn. Đây là hạng mục `security-reviewer` bắt buộc soi.

## R5 — Embedding dimension & tích hợp ProviderRegistry

- **Decision**: Gọi `provider.embed(texts)` (007) cho từng batch chunk; lấy độ dài vector đầu tiên làm `dim`,
  lưu vào cột `dim` của LanceDB + (tuỳ) `source`/config. Model mặc định v1: `nomic-embed-text` (dim 768) —
  nhưng KHÔNG hardcode 768, đọc từ vector trả về.
- **Rationale**: Tránh phụ thuộc cứng vào model; nếu người dùng đổi model embedding (dim khác) phát hiện được
  qua `dim`. Batch để giảm round-trip Ollama.
- **Alternatives**: Hardcode 768 — dễ vỡ khi đổi model. Embed từng chunk một — chậm.
- **Verify**: `LLMProvider.embed` hiện có nhận mảng text và trả mảng vector? Nếu chỉ nhận 1 text → lặp + note.
  Kiểm signature ở `src/main/services/ai-runtime/provider.ts` khi implement.

## R6 — Chunker & locator (bám ADR chunking)

- **Decision**: Recursive char splitter: thử cắt theo `\n\n` → `\n` → `. `/`! `/`? ` → cứng theo `CHUNK_SIZE`
  (~1000) khi khối vẫn dài; overlap ~150 ký tự giữa chunk liền kề. Với PDF: chunk trong phạm vi từng trang
  (không vắt trang). `charStart/charEnd` = offset half-open vào **toàn văn bản đã làm sạch** (với PDF là chuỗi
  ghép các trang, mỗi trang biết offset đầu → suy `page`). `ordinal` tăng dần.
- **Rationale**: Theo ADR chunking-strategy; ký tự → tất định, test không cần model.
- **Alternatives**: token-based (tiktoken) — loại ở ADR.
- **Verify**: test khẳng định (1) mọi chunk có `charEnd>charStart`, nằm trong `[0, len]`; (2) union các chunk
  phủ hết văn bản (trừ overlap); (3) PDF: mọi chunk `page` đơn trị, không có chunk chứa ranh giới trang.

## R7 — Hàng đợi tuần tự & báo tiến độ

- **Decision**: Queue FIFO trong bộ nhớ ở main; xử lý 1 nguồn/lần (async loop). Mỗi chuyển bước phát
  `SourceProgressEvent{ sourceId, notebookId, status, step, progress }` → `webContents.send('source:progress')`.
  Renderer nhận snapshot ban đầu qua `source:listByNotebook`, cập nhật realtime qua `onSourceProgress`.
  Nguồn đang chờ/đang xử lý bị xoá → đánh dấu huỷ, bỏ qua khi tới lượt / dừng giữa chừng + dọn.
- **Rationale**: Tuần tự (người dùng chọn) tránh nghẽn embed; event push mượt hơn polling.
- **Alternatives**: polling `getStatus` — tốn round-trip; song song — người dùng đã loại.
- **Verify**: test pipeline tất định bằng cách inject clock/steps giả; khẳng định thứ tự FIFO + trạng thái
  `awaiting_embedding` khi provider `test()` fail, tự resume khi provider sẵn sàng.

## R8 — Migration #2 (bám ADR migration + data-model)

- **Decision**: APPEND phần tử thứ 2 vào `MIGRATIONS[]`; `version=2`; tạo bảng `source`, `chunk` với FK
  `ON DELETE CASCADE`; KHÔNG sửa migration #1. Chi tiết cột ở `data-model.md`.
- **Rationale**: Đúng ADR migration append-only; xoá notebook → cascade source → cascade chunk (SQLite).
  Vector LanceDB dọn bằng lệnh riêng theo `notebook_id`/`source_id` (không có FK xuyên store).
- **Verify**: test migration chạy từ user_version=1 → 2 trên DB đã có bảng notebook (không mất dữ liệu).

## Tổng hợp dependency mới

| Package                | Loại                | Rủi ro  | Ghi chú                                |
| ---------------------- | ------------------- | ------- | -------------------------------------- |
| `pdfjs-dist`           | thuần JS            | Thấp–TB | dùng legacy build, chỉ text extraction |
| `mammoth`              | thuần JS            | Thấp    | `.docx` → text                         |
| `@mozilla/readability` | thuần JS            | Thấp    | cần jsdom                              |
| `jsdom`                | thuần JS            | TB      | nặng, chỉ dùng ở main khi parse URL    |
| `turndown`             | thuần JS            | Thấp    | HTML → markdown                        |
| `@lancedb/lancedb`     | **native prebuilt** | **CAO** | verify Electron 43 + CI Node 24 (R2)   |

Tất cả import ở **main process only** (Constitution III). Không package nào vào bundle renderer.
