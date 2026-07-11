# LanceDB integration — kho vector cục bộ (011-ingestion)

- Ngày: 2026-07-11
- Feature liên quan: `011-ingestion` (hiện thực hoá lần đầu; `005-rag-qa` truy hồi, `006-source-viewer` tra ngược)
- Câu hỏi gốc: ADR D2 chọn LanceDB ở mức khái niệm. Feature này là nơi đầu tiên tích hợp thật → cần chốt
  package, đường dẫn store, schema bảng, và chiến lược đồng bộ xoá với SQLite để 2 store không lệch nhau.
- Người quyết định: hoanghainh1188 (2026-07-11, ủy quyền "chốt khuyến nghị")

## Quyết định

**Package.** `@lancedb/lancedb` (binding napi-rs, có prebuilt binaries theo nền tảng → không cần rebuild
theo Electron ABI như better-sqlite3; nếu CI/Electron cần, xử lý ở bước plan/tasks). Chạy **chỉ ở main
process** (Constitution III) — renderer không import LanceDB.

**Đường dẫn store.** Thư mục `vectors/` trong data dir: `app.getPath('userData')/vectors/` (cùng gốc với
`insightvault.db` của SQLite, theo ADR data-dir 001). Kết nối mở một lần lúc `whenReady`, đóng khi thoát.

**Schema bảng `chunks`** (một bảng phẳng cho toàn app, lọc theo notebook/source):

- `id` (string) — **khớp 1-1 với `chunk.id` bên SQLite** (khoá tra ngược giữa 2 store).
- `notebook_id` (string) — để lọc/xoá cascade theo notebook.
- `source_id` (string) — để lọc/xoá cascade theo nguồn.
- `vector` (fixed-size list<float32>) — embedding của chunk.
- `dim` (int) — số chiều vector (phụ thuộc model, vd nomic-embed-text = 768) để phát hiện lệch model.

Metadata "nặng" (text, locator, ordinal) **KHÔNG lặp ở LanceDB** — chỉ ở SQLite; LanceDB giữ vector + khoá
lọc. Truy hồi: LanceDB trả `id` gần nhất → JOIN sang SQLite lấy text+locator.

**Đồng bộ xoá (nhất quán 2 store).** Mọi thao tác xoá chạy **cả hai** trong cùng luồng logic ở main:

- Xoá 1 nguồn: `DELETE FROM source WHERE id=?` (SQLite CASCADE dọn `chunk`) **và** LanceDB
  `delete("source_id = '<id>'")`.
- Xoá notebook (feature 009): mở rộng để **trước** khi xoá notebook, dọn LanceDB theo `notebook_id`
  (SQLite tự CASCADE source→chunk). Thứ tự: dọn vector trước, rồi xoá SQLite → không để vector mồ côi.
- Ghi vector cho một nguồn là bước cuối pipeline; nếu lỗi giữa chừng, `source:retry`/`source:delete` dọn cả hai.

**Tìm kiếm.** MVP dùng brute-force (LanceDB mặc định khi chưa tạo index) — đủ nhanh ở quy mô cá nhân. Tạo
index ANN (IVF_PQ) **lazily** khi số vector vượt ngưỡng (vd > 50k) — để dành, không bắt buộc cho MVP.

## Lý do

- LanceDB embedded, không server, dữ liệu nằm trên máy (Constitution I) — đúng tinh thần local-first.
- Không lặp text/locator sang LanceDB → tránh 2 nguồn sự thật cho metadata; SQLite là source-of-truth
  metadata, LanceDB chỉ là chỉ mục vector.
- Khoá `id` chung + cột `notebook_id`/`source_id` cho phép xoá cascade khớp FK SQLite mà không cần quét.

## Phương án loại bỏ

- Lưu vector trong SQLite (BLOB) + tự tính cosine: chậm, không có index ANN, không mở rộng — bỏ (đã chốt
  LanceDB ở D2).
- Mỗi notebook một bảng LanceDB riêng: nhiều bảng nhỏ, phức tạp quản lý lifecycle — dùng một bảng + lọc.
- Nhân bản text/locator sang LanceDB để đọc một store: phá nguyên tắc single-source-of-truth metadata — bỏ.

## Hệ quả

- Thêm dependency native `@lancedb/lancedb`; bước `/speckit-plan`/`tasks` kiểm tính tương thích Electron +
  CI (Node 24), thêm vào coverage-exclude nếu là wiring.
- `src/main/db/` (hoặc `src/main/services/ingestion/`) có module vector-store bọc LanceDB (mở/ghi/xoá/tìm),
  inject được để test (mock) — giữ ngưỡng coverage 80% cho business logic.
- Feature `009-notebooks` `delete` cần mở rộng dọn vector theo `notebook_id` (ghi chú cho bước implement).
