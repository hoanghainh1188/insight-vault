# Research — 116 vector-maintenance

Mọi số đo dưới đây chạy THẬT trên `@lancedb/lancedb` **0.31.0** đã cài trong repo (Node, macOS, Apple Silicon),
vector 384 chiều ngẫu nhiên, lọc `notebook_id`, top-6, cosine; script ở scratchpad phiên làm việc (không commit).

## R1 — API `optimize` / `stats` / `listVersions` của LanceDB 0.31

- **Decision**: dùng `table.optimize({ cleanupOlderThan: Date })` (không truyền `deleteUnverified` ⇒ mặc định `false`),
  `table.stats()` (lấy `fragmentStats.numFragments`, `numRows`) và `table.listVersions()` (đếm phiên bản có
  `timestamp` cũ hơn biên giữ lại).
- **Typings đã xác minh** (`dist/table.d.ts`, `dist/native.d.ts`):
  - `optimize(options?: Partial<{ cleanupOlderThan: Date; deleteUnverified: boolean }>): Promise<OptimizeStats>`;
    mặc định `cleanupOlderThan` = **7 ngày** ⇒ PHẢI truyền tường minh (khớp clarify #3).
  - `OptimizeStats = { compaction: { fragmentsRemoved, fragmentsAdded, filesRemoved, filesAdded }, prune: { bytesRemoved, oldVersionsRemoved } }`.
  - `stats(): Promise<{ totalBytes, numRows, numIndices, fragmentStats: { numFragments, numSmallFragments, lengths } }>`.
  - `listVersions(): Promise<{ version, timestamp: Date, metadata }[]>`.
- **Lưu ý đo được**: `numSmallFragments` luôn = `numFragments` ở quy mô app (ngưỡng "nhỏ" của Lance ~1 triệu hàng)
  ⇒ KHÔNG dùng làm cổng; dùng `numFragments`.
- **Alternatives**: `deleteUnverified: true` (dọn cả tệp chưa xác minh) — bị loại (tài liệu cảnh báo có thể hỏng bảng
  nếu có giao dịch đang dở; clarify #3).

## R2 — Tác động đo được của `optimize`

Bảng 20 000 vector ghi theo lô 32 (đúng cỡ lô `embedAndStore`/reindex), rồi xoá 10/40 nguồn (còn 15 000 hàng):

| Thời điểm                                    | Fragment | Phiên bản | `vectors/` | Search p50 / p95 |
| -------------------------------------------- | -------- | --------- | ---------- | ---------------- |
| Trước bảo trì                                | 625      | 635       | 54,9 MB    | 21,4 / 22,6 ms   |
| Sau `optimize` (biên 10 phút — chỉ gộp)      | 1        | 637       | 78,3 MB    | 2,6 / 3,6 ms     |
| Sau `optimize` (biên đã qua — dọn phiên bản) | 1        | 1         | 23,3 MB    | 2,7 / 3,0 ms     |

- Gộp mất ~0,2 s; dọn 636 phiên bản ~0,5 s. Lần gọi lặp lại là no-op (idempotent).
- Kết quả `search` (id + khoảng cách 6 chữ số) và `countRows` **giống hệt** trước/sau.
- **Hệ quả thiết kế**: với biên 10 phút, lần chạy ngay sau đợt ghi chỉ **gộp** (độ trễ cải thiện ngay) và **tạm tăng
  dung lượng** (+43% ở ví dụ trên — tệp cũ còn được phiên bản cũ tham chiếu); dung lượng được thu hồi ở **lần chạy
  sau khi qua biên** ⇒ lịch phải có **lần kiểm tiếp theo** sau `RETENTION + 1 phút` khi lần trước có gộp (R5).
  Tăng tạm thời này cũng là lý do kiểm `freeBytes ≥ 2 × vectors/` (clarify #8).

## R3 — Ngưỡng kích hoạt (số fragment)

Độ trễ search theo số fragment (dữ liệu chia đều):

| N vector | F=1  | F=10 | F=25 | F=50 | F=100 | F=200 | F=400 |
| -------- | ---- | ---- | ---- | ---- | ----- | ----- | ----- |
| 20 000   | 4,2  | 3,4  | 3,5  | 3,9  | 5,3   | 8,2   | 13,9  |
| 100 000  | 13,8 | 13,2 | 10,2 | 10,1 | 10,5  | 12,3  | 17,5  |

(p50, ms). Độ trễ phẳng tới ~50 fragment, xấu rõ từ ~100.

- **Decision**: `FRAGMENT_THRESHOLD = 64` (gộp khi ≥ 64 fragment). `PRUNABLE_VERSIONS_THRESHOLD = 20` (dọn khi ≥ 20
  phiên bản cũ hơn biên giữ lại — mỗi lô ghi/xoá là 1 phiên bản; một tài liệu vài trăm chunk đã tạo ≥ 20).
- **Rationale**: dưới 64 fragment gộp không cải thiện độ trễ đáng kể và chỉ ghi đĩa vô ích; LanceDB tự khuyên chạy
  optimize sau "≥ 20 thao tác sửa đổi" (khớp ngưỡng phiên bản).
- **Alternatives**: theo tỉ lệ hàng chết (không có API đếm hàng bị xoá mềm rẻ) — loại; theo `totalBytes` — không phản
  ánh phân mảnh — loại.

## R4 — Tính nguyên tử khi tắt app giữa lúc bảo trì

- Thử `SIGKILL` tiến trình con đang `optimize` (bảng 300 fragment) ở 20/60/90/120/150 ms: mọi lần mở lại đều đọc đủ
  `countRows` + kết quả search giống trước; khi bị giết trước commit bảng còn 300 fragment, sau commit còn 1;
  `optimize` lần sau chạy bình thường.
- **Decision**: KHÔNG cần chờ bảo trì khi thoát app (Lance commit theo manifest nguyên tử). `will-quit` chỉ huỷ hẹn giờ.
- **Alternatives**: chờ bảo trì xong khi thoát (trần thời gian) — thừa, làm chậm thoát — loại.

## R5 — Ghi đồng thời trong lúc bảo trì

- Thử `optimize` song song với 5 lần `add` + 1 `delete` trên cùng handle: cả hai thành công; số hàng đúng kỳ vọng
  (29 005), nguồn bị xoá còn 0 hàng. Lance tự rebase compaction với ghi đồng thời.
- **Decision**: không chặn ghi trong lúc bảo trì; bảo trì vẫn chỉ BẮT ĐẦU khi kho yên (clarify #2) để giảm tranh tài
  nguyên. Lỗi xung đột commit (nếu có) ⇒ phân loại "hoãn" (`reason: "conflict"`) theo tên lỗi/thông điệp chứa
  `conflict`/`retry`.

## R6 — Điều kiện "bận" dùng chung

- **Decision**: thêm hàm thuần `isVaultBusy(lock)` = `lock.getState().busy || lock.isLocked()` trong `vault-lock.ts`
  (bao trọn: nguồn queued/processing/reprocessing, reindex nền, thao tác sao lưu/khôi phục đang mở, khoá chụp, khoá
  vĩnh viễn sau xác nhận khôi phục). Bảo trì dùng `isVaultBusy(vaultLock) || vectorStore.activeReads() > 0`.
- **Alternatives**: định nghĩa song song trong module bảo trì — loại (dễ lệch).

## R7 — Sao lưu/khôi phục không chụp `vectors/` giữa lúc bảo trì

- **Decision**: `BackupServiceDeps` thêm `waitVectorIdle?: () => Promise<boolean>` (tuỳ chọn ⇒ test cũ không đổi).
  `writeBackup` gọi nó **bên trong** `lock.withLock` trước `createSnapshot`: khoá đã đặt ⇒ không lần bảo trì mới nào
  bắt đầu; chỉ chờ lần đang chạy xong. Quá `BACKUP_WAIT_TIMEOUT_MS = 120 s` ⇒ `VaultBackupFailure("busy")` (mã đã có,
  UI đã có câu thông báo). Áp dụng cho cả sao lưu thường và bản tự sao lưu trước khi khôi phục. Khôi phục thật (hoán
  đổi thư mục) chạy lúc khởi động TRƯỚC khi tạo kho vector ⇒ không xung đột.
- **Alternatives**: thêm `reason: "maintenance"` vào `VaultBackupState` — đổi kiểu dùng chung + chuỗi UI — loại.

## R8 — Đếm thao tác ghi (bộ đếm "bẩn")

- **Decision**: decorator thuần `trackVectorWrites(store, onWrite)` bọc `VectorStore` trong `createIngestion` (tham số
  mới `onVectorWrite`); mọi `add`/`deleteBy*`/`dropTable` thành công gọi `onWrite()`. Pipeline (nạp/xử lý lại/xoá),
  `register.ts` (xoá notebook) và reindex 059 cùng dùng `ingestion.vectorStore` ⇒ không phải sửa từng điểm ghi.
- **Alternatives**: gọi `notifyWrite` thủ công ở từng điểm ghi — dễ sót — loại.

## R9 — Dung lượng trống

- **Decision**: `freeBytes` qua `statfs(dataDir)` (`bavail × bsize`, cùng cách `storage-info`), kích thước kho qua
  `dirSize(vectors/)` (hàm thuần sẵn có ở `storage-info.ts`). `FREE_SPACE_FACTOR = 2` (R2 cho thấy gộp tạm cần thêm
  ~kích thước dữ liệu sống). Thiếu ⇒ hoãn `reason: "lowDisk"`.

## R10 — Hằng số thời gian / lỗi

| Hằng số                       | Giá trị            | Nguồn                       |
| ----------------------------- | ------------------ | --------------------------- |
| `DEBOUNCE_MS`                 | 60 000             | clarify #1                  |
| `STARTUP_DELAY_MS`            | 45 000             | clarify #1                  |
| `MIN_INTERVAL_MS`             | 600 000            | clarify #1 (trần 1 lần/10') |
| `RETENTION_MS`                | 600 000            | clarify #3                  |
| `FOLLOW_UP_MS`                | RETENTION + 60 000 | R2 (thu hồi sau biên)       |
| `FRAGMENT_THRESHOLD`          | 64                 | R3                          |
| `PRUNABLE_VERSIONS_THRESHOLD` | 20                 | R3                          |
| `FREE_SPACE_FACTOR`           | 2                  | clarify #8 + R2             |
| `MAX_CONSECUTIVE_FAILURES`    | 3                  | clarify #5                  |
| `BACKOFF_BASE_MS`             | 600 000 (×2ⁿ⁻¹)    | clarify #5                  |
| `BACKUP_WAIT_TIMEOUT_MS`      | 120 000            | R7                          |

## R11 — Điều kiện xem lại ANN (ADR)

Theo clarify #9: p95 search brute-force **sau bảo trì** > 50 ms trên máy tham chiếu, hoặc một notebook ~1 triệu
vector. Số đo trong issue #116 (2,1 / 5,5 / 12,8 ms @10k/50k/200k; IVF_PQ Recall 0,34 @200k; HNSW_SQ 0,98; bitmap
`notebook_id` chậm hơn) + R2/R3 đưa vào ADR `docs/04-decisions/2026-10-07-vector-maintenance.md`.
