# Bảo trì kho vector (gộp phân mảnh + dọn phiên bản cũ) — giữ brute-force, hoãn ANN (116)

- Ngày: 2026-10-07
- Feature liên quan: `116-vector-maintenance` (issue #116), spec `specs/20261007-222549-vector-maintenance/`
- Câu hỏi gốc: kho vector LanceDB (bảng `chunks`, ADR 011) chưa bao giờ được gộp hay dọn. Mỗi lần ghi tạo thêm một
  phiên bản và một fragment, còn vector bị xoá chỉ được đánh dấu. Vậy có cần index ANN như ADR 011 dự kiến ("IVF_PQ
  lazily khi > 50k") không, hay vấn đề thật nằm ở chỗ khác?
- Người quyết định: Hải (2026-10-07). Các tham số chi tiết đã chốt ở `2026-10-07-vector-maintenance-clarify.md`.
- **Thay thế**: đoạn "Tìm kiếm … index ANN (IVF_PQ) lazily khi > 50k" của `2026-07-11-lancedb-integration.md` và dòng 30
  ("tạo index ANN sau khi đủ lớn") của `2026-07-11-ingestion-clarify.md`.

## Quyết định

1. **Giữ tìm kiếm chính xác (brute-force, cosine, lọc `notebook_id`). Hoãn ANN.** Không tạo bất kỳ index nào: không
   index vector, và không index vô hướng (bitmap/btree) trên `notebook_id`.
2. **Bảo trì tự động, hoàn toàn ngầm** bằng `table.optimize({ cleanupOlderThan: now − 10 phút })`, không bật
   `deleteUnverified`:
   - Debounce: chờ kho yên 60 s sau lần ghi cuối.
   - Một lần bắt kịp sau khi khởi động 45 s, và một lần sau khi reindex 059 xong.
   - Trần tần suất: tối đa 1 lần / 10 phút.
   - Cổng: chỉ chạy khi có ≥ 64 fragment hoặc ≥ 20 phiên bản cũ hơn biên giữ lại.
   - Follow-up: lần chạy có gộp ⇒ kiểm lại sau 11 phút để dọn phiên bản cũ.
   - Chỉ bắt đầu khi `isVaultBusy` = false và không có truy vấn đang chạy. Kiểm bận lại ngay trước `optimize`.
   - Cần dung lượng trống ≥ 2 × `vectors/`.
   - Lỗi: nuốt, backoff 10 → 20 phút, ngưng sau 3 lỗi liên tiếp. Xung đột commit được coi là "hoãn", không tính lỗi.
   - Sao lưu/khôi phục chờ bảo trì đang chạy xong (tối đa 120 s) trước khi chụp `vectors/`.
   - Nhật ký: `vector.maintenance.start|done|skip|error`, chỉ ghi số đếm và `errorType`. Không UI, không IPC mới.
3. **Không cần chờ bảo trì khi thoát app**: `optimize` commit theo manifest nên nguyên tử (số đo R4 bên dưới).

## Số liệu

### Độ trễ brute-force và so sánh ANN (issue #116, LanceDB 0.31, 384 chiều e5-small, lọc notebook, top-6)

| Quy mô | Brute-force | Ghi chú ANN                                                      |
| ------ | ----------- | ---------------------------------------------------------------- |
| 10k    | 2,1 ms      | ANN chỉ nhanh hơn vài ms ở mọi quy mô                            |
| 50k    | 5,5 ms      |                                                                  |
| 200k   | 12,8 ms     | IVF_PQ: Recall 0,34 (mất phần lớn đáp án) · HNSW_SQ: Recall 0,98 |

- Index bitmap trên `notebook_id` làm truy vấn **chậm hơn**.
- Ngưỡng độ liên quan 108 (`RELEVANCE_CALIBRATION`) được hiệu chuẩn trên tìm kiếm chính xác. ANN làm lệch điểm và mất
  Recall, nên muốn dùng ANN thì phải hiệu chuẩn lại ngưỡng.

### Vấn đề thật: phân mảnh + phiên bản cũ (research 116)

- Issue #116 (200k vector, 360 fragment): search 12,8 ms → **2,5 ms** sau `optimize` (mất 0,2 s). Dung lượng đĩa
  131 MB → **14,8 MB**.
- Research R2: 20k vector ghi theo lô 32 (đúng cỡ lô `embedAndStore`), sau đó xoá 1/4 số nguồn.

| Thời điểm                         | Fragment | Phiên bản | `vectors/` | Search p50 |
| --------------------------------- | -------- | --------- | ---------- | ---------- |
| Trước bảo trì                     | 625      | 635       | 54,9 MB    | 21,4 ms    |
| Sau gộp (biên 10 phút)            | 1        | 637       | 78,3 MB    | 2,6 ms     |
| Sau dọn phiên bản (lần follow-up) | 1        | 1         | 23,3 MB    | 2,7 ms     |

- Research R3: độ trễ gần như không đổi tới ~50 fragment và xấu rõ từ ~100 fragment ⇒ chọn ngưỡng 64.

| N vector | F=1  | F=50 | F=100 | F=200 | F=400 |
| -------- | ---- | ---- | ----- | ----- | ----- |
| 20 000   | 4,2  | 3,9  | 5,3   | 8,2   | 13,9  |
| 100 000  | 13,8 | 10,1 | 10,5  | 12,3  | 17,5  |

(p50, ms)

- Research R4: `SIGKILL` tiến trình đang `optimize` ở 20/60/90/120/150 ms. Mọi lần mở lại, `countRows` và kết quả search
  đều giống trước. Giết trước khi commit thì bảng còn nguyên các fragment cũ, sau khi commit thì còn 1 fragment.
- Research R5: `add` + `delete` chạy đồng thời với `optimize` đều thành công và số hàng đúng.
- Kết quả truy vấn trước/sau bảo trì giống hệt: id, nguồn và điểm (test `tests/unit/vector-store-optimize.test.ts`).
- Hồi quy 108: `EVAL_MODE=current npm run eval:retrieval` ⇒ "Khớp số liệu ghi trong RELEVANCE_CALIBRATION (hồi quy
  OK)" (2026-10-07).

## Điều kiện xem lại ANN

Xem lại khi **một trong hai** điều kiện sau xảy ra (đo theo độ trễ thật, không theo số vector tuyệt đối):

- p95 của `search` brute-force **sau bảo trì** > **50 ms** trên máy tham chiếu (≈ 4 × mức đo @200k).
- Một notebook vượt khoảng **1 triệu vector**.

Khi đó: đo lại Recall bằng harness 108 (`npm run eval:retrieval`) cho từng loại index (ưu tiên HNSW), hiệu chuẩn lại
ngưỡng độ liên quan, và **không** dùng index vô hướng trên `notebook_id` nếu chưa đo lại.

## Hệ quả

- `VectorStore` có thêm `stats(retentionMs)`, `optimize(retentionMs)`, `activeReads()` (bắt buộc). `ReindexVectorStore`
  giữ nguyên.
- Thêm module mới `src/main/services/vector-maintenance/`. `createIngestion({ onVectorWrite })` bọc kho để đếm số lần
  ghi.
- `isVaultBusy` trong `vault-lock.ts` là định nghĩa "bận" dùng chung. `BackupServiceDeps.waitVectorIdle` để sao lưu
  chờ bảo trì.
- Ngay sau một đợt ghi, lần gộp **tạm tăng** dung lượng (tệp cũ còn được phiên bản cũ tham chiếu trong 10 phút). Dung
  lượng được thu hồi ở lần follow-up.
