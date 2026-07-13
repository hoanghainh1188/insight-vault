# Research — 059 embed-in-process

Giải quyết các unknown ở Technical Context. Mọi quyết định kỹ thuật lớn đã chốt ở ADR 059; đây là chi tiết
triển khai + kết quả VERIFY.

## R1. Embedding in-process qua transformers.js (feature-extraction)

- **Decision**: Tái dùng đúng hạ tầng model-load của **045** (`src/main/services/ingestion/audio/transcribe.ts`):
  `pipeline("feature-extraction", "Xenova/multilingual-e5-small", {progress_callback})`, `env.cacheDir =
<data dir>`, `setOnline?(true/false)` bao quanh lần tải model đầu (badge egress dùng chung 031/045).
  Nhúng: `await extractor(texts, { pooling: "mean", normalize: true })` → `number[][]`.
- **Rationale**: Whisper (`automatic-speech-recognition`) đã chạy production qua chính đường này → onnxruntime
  đã bundle & asarUnpack (`**/*.node`), transformers là dependency. `feature-extraction` chỉ khác tên task
  → rủi ro đóng gói ~0. Đã VERIFY Node CLI: dim **384**, `pooling:mean + normalize:true`.
- **Alternatives**: Ollama embed (bỏ — mục tiêu là bỏ phụ thuộc); bge-m3 in-process (bỏ — 1024d ~2GB nặng);
  gọi model qua worker riêng (bỏ — 045 đã chứng minh main-process ổn cho model nhỏ).

## R2. Tiền tố e5 + chuẩn hoá

- **Decision**: Bắt buộc tiền tố — `withE5Prefix(text,"query")="query: "+text`,
  `withE5Prefix(text,"passage")="passage: "+text`. Retrieval embed **query**, ingestion/reindex embed
  **passage**. `normalize:true` của transformers cho vector L2≈1 → cosine ổn định; vẫn thêm
  `vector-normalize.ts` (l2normalize) như lớp phòng vệ cho MMR (055) và test được.
- **Rationale**: e5 được huấn luyện với 2 tiền tố này; thiếu → tụt chất lượng. Hàm thuần → test dễ.

## R3. LanceDB đổi dim 768→384: drop + recreate

- **Decision**: `conn.dropTable("chunks")` rồi để `add()` tạo lại bảng với vector 384d (schema suy từ hàng
  đầu — như code hiện tại). Thêm method `recreate()`/`dropTable()` vào `vector-store.ts`; interface
  `search/add/getVectorsByIds/deleteBy*` (055) **giữ nguyên**.
- **VERIFY (đã chạy)**: `conn.dropTable('chunks')` → `tableNames()` rỗng → `createTable` dim 4 OK. Xác nhận
  đổi dim không kẹt schema cũ.
- **Rationale**: Vector cũ (768d, không gian Ollama) vô nghĩa với e5 → không giữ lại. Drop sạch tránh trộn
  dim. **Idempotent**: reindex chỉ `add` chunk chưa có trong bảng mới.
- **Alternatives**: Thêm bảng thứ 2 song song (bỏ — phức tạp, tốn ổ đĩa gấp đôi); alter dim (LanceDB không
  hỗ trợ đổi dim cột tại chỗ).

## R4. Lưu phiên bản model + trạng thái tái lập chỉ mục (resume)

- **Decision**:
  - `EMBEDDING_MODEL_VERSION = "e5-small-384"` (hằng trong `model-version.ts`).
  - Lưu version đã áp dụng ở **electron-store** (tái dùng pattern `model-selection.ts` — `StoreLike`
    inject được để test). **KHÔNG cần migration SQLite mới** cho việc này.
  - **Resume KHÔNG cần bảng state riêng**: chunk "đã nhúng lại" ⇔ **đã có vector trong bảng LanceDB mới**.
    `runReindex` lấy danh sách chunk id từ SQLite (`chunk` table), bỏ qua id đã có trong bảng mới
    (`getVectorsByIds`/count), nhúng phần còn lại theo lô. Tắt giữa chừng → mở lại tiếp tục phần thiếu.
  - **Per-notebook "đang reindex"**: notebook N sẵn sàng ⇔ mọi chunk của N đã có vector trong bảng mới
    (so `COUNT(chunk WHERE notebook)` với số vector của N). Version electron-store chỉ **bump khi TOÀN BỘ
    xong** → trước đó retrieval thấy version lệch ⇒ guard "đang tái lập chỉ mục".
- **Rationale**: Trạng thái nguồn-sự-thật là chính LanceDB → không cần state trùng lặp (đỡ bug lệch trạng
  thái, khỏi migration #8). Đơn giản, idempotent tự nhiên.
- **Alternatives**: Bảng `reindex_state` SQLite (bỏ — thừa, dễ lệch với LanceDB); cột `embedded_at` trên
  `chunk` (bỏ — cần migration, vẫn có thể lệch với thực tế LanceDB).

## R5. Hiệu chỉnh RELEVANCE_MAX_DISTANCE cho e5

- **Bối cảnh**: `vector-store.search` dùng **cosine distance** (`_distance`, nhỏ = gần). Hiện
  `RELEVANCE_MAX_DISTANCE = 0.75` tuned cho nomic-embed (không chuẩn hoá). e5 chuẩn hoá → cosine distance =
  `1 - cos_sim`. VERIFY: cos_sim liên quan 0.862 → dist **0.138**; khác chủ đề 0.799 → dist **0.201**.
- **Decision**: Hạ ngưỡng xuống **`0.5`** (ban đầu) cho e5. Vì e5-small nén sim cao (khoảng cách hẹp), coi
  đây là **ngưỡng thô** — lớp hybrid RRF/MMR (055) + BM25 mới là bộ lọc chính. Ghi nhận **calibration
  task**: tinh chỉnh bằng dữ liệu thật sau implement (không chặn merge; test dùng ngưỡng cấu hình được).
- **Rationale**: Giữ 0.75 sẽ nhận gần như mọi thứ (dist thực tế 0.1–0.3) → "không tìm thấy" mất tác dụng.
  0.5 loại rõ nhiễu mà vẫn rộng rãi cho e5. Ngưỡng là **hằng ở constants** → chỉnh 1 chỗ.
- **Alternatives**: Giữ 0.75 (bỏ — mất hành vi "không tìm thấy"); ngưỡng động theo phân phối (bỏ — phức tạp,
  ngoài phạm vi).

## R6. Gợi ý chat model theo RAM

- **Decision**: `recommendChatModel(totalMemBytes)` (thuần):
  `< 8GB → {tier:"small", ~3B, vd qwen2.5:3b}` · `8–16GB → {tier:"medium", 7–8B}` · `> 16GB →
{tier:"large"}`. `detectRam()` ở main = `os.totalmem()` (I/O mỏng, tách riêng). Chỉ **gợi ý** (label +
  ví dụ tên model), KHÔNG tự tải.
- **Rationale**: Mốc RAM đơn giản, đủ hướng người dùng máy yếu tránh chọn model quá lớn. Thuần → test 3 mốc.

## R7. Health-check Ollama

- **Decision**: Tái dùng `ai-runtime/ollama-client.ts` (`DEFAULT_OLLAMA_URL`, `GET /api/tags`). `checkOllama`
  → `{ running: (tags gọi được), models: [...], modelPulled: (model đang chọn ∈ models) }`. Lỗi/không kết
  nối → `running:false` (client đã nuốt lỗi trả []). Model đang chọn lấy từ `model-selection` (007).
- **Rationale**: Không dựng client mới; `/api/tags` là cách chuẩn liệt kê model đã pull. "installed" khó
  phân biệt với "running" mà không dò tiến trình OS → v1 gộp thành `running` (tags phản hồi) + hướng dẫn.
- **Alternatives**: Dò tiến trình OS để biết "đã cài nhưng chưa chạy" (bỏ — phức tạp, đa nền tảng; v1 chỉ
  cần "đang phục vụ hay không" + hướng dẫn cài/chạy).

## Tổng hợp rủi ro

- **Chất lượng e5-small vs Ollama embed**: nén sim cao → dựa RRF/MMR (055) bù + calibration ngưỡng. Quan
  trắc bằng SC-003 (chất lượng không kém rõ rệt) khi test thật.
- **Thời gian reindex** dữ liệu lớn: chạy nền theo lô + resume → không chặn UI; hiện tiến độ.
- **Không có migration SQLite mới** → giảm rủi ro schema; LanceDB drop/recreate đã verify.
