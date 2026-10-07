# Intake — 116-vector-maintenance

- Issue: #116 (repo `hoanghainh1188/insight-vault`) — "Bảo trì kho vector LanceDB (gộp phân mảnh + dọn phiên bản cũ), hoãn ANN"
- Slug: `vector-maintenance`
- Ngày intake: 2026-10-07
- Loại: bảo trì/hiệu năng nội bộ của kho vector có sẵn (LanceDB, 011). KHÔNG phải loại nguồn mới, KHÔNG có Figma,
  KHÔNG có basic/detail design của khách hàng (`docs/01-basic-design/` và `docs/02-detail-design/` chỉ có README).
  Chủ yếu là việc ở main process; mặc định KHÔNG đổi UI và KHÔNG thêm kênh IPC (xem ambiguity #4).

## Input sources

- **GitHub issue #116** — brief chính + QUYẾT ĐỊNH NGƯỜI DÙNG (mục "Đã chốt"). Nội dung issue do điều phối viên cung
  cấp (phiên intake không có Bash); số liệu đo ở mục "Số liệu đo" do điều phối viên điền lại từ body issue.
- `docs/OVERVIEW.md` — 3 điểm bất biến (Local-first, Kiểm chứng được, Offline & tự chủ).
- `.specify/memory/constitution.md` (v1.0.0) — I (không egress mới; bảo trì chạy hoàn toàn cục bộ), II (không đổi
  `id`/locator; bảo trì KHÔNG được làm mất/đổi vector hay chunk id), III (mọi truy cập LanceDB ở main; kênh IPC mới —
  nếu có — phải whitelist ở preload; không log nội dung/đường dẫn), IV (test-first, coverage >= 80% business logic;
  adapter native `vector-store.ts` đã loại khỏi coverage nên phần LÊN LỊCH phải là hàm thuần).
- `docs/00-glossary.md` — đã tra: có `vector store`, `vault`, `vault lock`, `backup`, `restore`, `reindex`, `log`
  (`logEvent`, `main.log`, 088). **Chưa có** thuật ngữ về phân mảnh/gộp/dọn phiên bản/brute-force/ANN (xem mục thuật
  ngữ mới).
- `docs/04-decisions/INDEX.md` + ADR đã đọc:
  - `2026-07-11-lancedb-integration.md` (011) — một bảng `chunks(id,notebook_id,source_id,vector,dim)` cho toàn app,
    lọc theo notebook; **đoạn "Tìm kiếm" nói "MVP brute-force… tạo index ANN (IVF_PQ) lazily khi > 50k vector (vd)"** —
    đây là đoạn sẽ bị thay thế. Xoá đồng bộ SQLite↔LanceDB, `deleteBySource` idempotent.
  - `2026-07-11-ingestion-clarify.md` dòng 30 — cũng ghi "brute-force search, tạo index ANN sau khi đủ lớn" ⇒ ADR mới
    phải nêu đã thay thế cả mục này (không chỉ lancedb-integration).
  - `2026-10-06-vault-backup-clarify.md` (085) — sao lưu chụp `vectors/` cùng DB; **chặn cứng** sao lưu/khôi phục khi
    còn nguồn `queued/processing` hoặc reindex nền (không xếp hàng chờ); `vaultLock` chặn các kênh GHI vault trong
    pha chụp và sau xác nhận khôi phục.
  - `2026-07-13-embed-in-process-clarify.md` (059) — đổi model ⇒ `dropTable()` rồi re-embed nền theo lô 32 (nhiều lần
    `add` nhỏ ⇒ nhiều fragment); cài mới/đổi model làm bảng bị tạo lại.
  - `2026-10-07-pdf-layout.md` (112) — `reprocess` = add vector mới → `replaceChunks` → `deleteByIds` cũ ⇒ mỗi lần xử
    lý lại sinh thêm phiên bản + vector bị xoá mềm (deletion file).
  - `2026-10-07-relevance-calibration.md` (108) — bộ đo `tests/eval/` + `npm run eval:retrieval`, dùng làm hồi quy
    (xem ambiguity #6).
  - Quét INDEX: KHÔNG có quyết định nào về bảo trì/compaction/cleanup kho vector, về lịch bảo trì nền, hay về index
    vô hướng ⇒ toàn bộ thuộc phạm vi 116.
- Code hiện có (chỉ để mô tả điểm tích hợp, KHÔNG phải thiết kế mới):
  - `src/main/services/ingestion/vector-store.ts` — `interface VectorStore` (`add`, `deleteBySource`, `deleteByIds`
    (lô 500), `deleteByNotebook`, `countBy*`, `search` (cosine, `where notebook_id`, **brute-force, không index**),
    `getVectorsByIds`, `dropTable`, `close`). Adapter `createLanceVectorStore(dir)` giữ MỘT handle `table` cache; chỉ
    `getTable()` mở/cache, `dropTable()` reset về `null`. Interface `LanceTable` là kiểu tối thiểu tự khai báo
    (**chưa có `optimize`**) ⇒ cần mở rộng. Hiện **không có bất kỳ thao tác bảo trì nào** (không `optimize`, không
    `createIndex`).
  - `src/main/services/ingestion/ingestion.ts` — tạo `createLanceVectorStore(join(dataDir,"vectors"))` MỘT lần lúc
    khởi động, trả `Ingestion{ vectorStore, pipeline, ... }`.
  - `src/main/services/ingestion/pipeline.ts` — các điểm GHI vector: `embedAndStore` (nạp/retry/resume:
    `deleteBySource` rồi `add`), `reprocessReady` (112: `add` mới → `replaceChunks` → `deleteByIds` cũ; lỗi/huỷ →
    `deleteByIds(newIds)`; nhánh mồ côi chỉ `logEvent("ingest.reprocess.orphanVectors")`), `retry`, `remove`
    (`deleteBySource`). **`createSerialQueue()` được tạo BÊN TRONG pipeline và không lộ ra ngoài**; pipeline chỉ lộ
    `isReprocessing()`.
  - `src/main/ipc/register.ts` — `notebookDelete`: `vectorStore.deleteByNotebook` rồi xoá SQLite; `assertVaultWritable`
    chặn khi `vaultLock.isLocked()`.
  - `src/main/services/embedding/reindex-runner.ts` — `runReindex` dùng interface hẹp riêng `ReindexVectorStore`
    (`add`, `getVectorsByIds`, `dropTable`); chạy NGOÀI hàng đợi ingestion, trạng thái ở `reindex.inProgress`
    (`src/main/index.ts`).
  - `src/main/services/vault-backup/vault-lock.ts` — `hasActiveSources` (queued/processing/reprocessing),
    `isReindexing`, `isLocked()` (`depth>0` hoặc vĩnh viễn sau xác nhận khôi phục), `getState()` →
    `VaultBackupState{ busy, reason: "operation"|"processing"|"reindexing"|null }`.
  - `src/main/index.ts` (≈dòng 265–606) — thứ tự khởi động: `applyPendingRestore` (hoán đổi `vectors/` TRƯỚC khi mở) →
    DB → `createIngestion` → … → `createVaultLock` → `registerIpc` → `createWindow` → `resumeInterrupted/resumeAwaiting` →
    reindex nền nếu lệch version. **Không có hook `before-quit` nào đóng/chờ `vectorStore`.**
  - `src/main/services/app-shell/storage-info.ts` + `src/shared/ipc/types.ts` (`StorageInfo{path,usedBytes,freeBytes}`) +
    `SettingsStorageSection.tsx` — kênh read-only `app:getStorageInfo` (037) chỉ trả **tổng dung lượng thư mục dữ
    liệu** (`dirSize` cả `<userData>`), **KHÔNG có số liệu riêng cho `vectors/`**.
  - `src/main/logging.ts` — `logEvent(event, meta)` / `logError`, `redact` + `maskHome`; quy ước 088 chỉ log loại lỗi
    (`errorType`), không `message` thô, không đường dẫn.
  - `tests/unit/vector-store-delete-by-ids.test.ts` — tiền lệ test LanceDB THẬT trên `mkdtemp` (mẫu cho integration test
    bảo trì). `tests/eval/` + `npm run eval:retrieval` (`EVAL_MODE=current`).
  - `package.json`: `@lancedb/lancedb ^0.31.0`, app `0.2.8`.
- Figma: không dùng. Design token: không đổi.

## Số liệu đo (từ issue #116, benchmark 2026-10-07: LanceDB 0.31, 384 chiều, 20 notebook, top-6, lọc `notebook_id`, trung bình 30 truy vấn)

**Tốc độ tìm (ms/truy vấn) — recall so với brute-force:**

| Số vector | Brute-force | IVF_PQ             | IVF_PQ + refine (×5, nprobes 40) | HNSW_SQ        |
| --------- | ----------- | ------------------ | -------------------------------- | -------------- |
| 10k       | 2,1         | —                  | —                                | —              |
| 50k       | 5,5         | 1,8 · recall 0,71  | 2,1 · 1,00                       | 1,9 · 1,00     |
| 200k      | 12,8        | 4,8 · recall 0,34  | 6,3 · 0,85                       | 5,4 · 0,98     |

Thời gian tạo index: IVF_PQ 7,4 s (50k) / 10,9 s (200k); HNSW_SQ 2,5 s / 9,6 s. Index bitmap trên `notebook_id`: brute-force **chậm hơn** (50k: 5,5 → 12,2 ms; 200k: 12,8 → 66,4 ms) — ngoài phạm vi (Sự kiện #7).

**Phân mảnh (trước → sau `optimize()`):**

| Bộ đo                               | Fragment  | Tìm (ms)    | Thời gian optimize |
| ----------------------------------- | --------- | ----------- | ------------------ |
| 20k vector, lô 50, xoá 10% nguồn    | 360 → 1   | 12,8 → 2,5  | 0,2 s              |
| 100k vector, lô 200, xoá 10% nguồn  | 450 → 1   | 17,3 → 6,3  | 0,3 s              |

**Dung lượng thư mục vector:** 100 nguồn × 200 vector (20k) = 31,2 MB → xử lý lại 3 lần (xoá + nạp lại) = 130,8 MB (vẫn 20k hàng) → xoá nửa số nguồn = 131,4 MB (10k hàng) → `optimize({ cleanupOlderThan: now })` = **14,8 MB**.

## Sự kiện cần ghi nhận (từ code, để spec không phải đoán)

1. **Mỗi thao tác ghi tạo một phiên bản (version) mới của bảng.** Theo cơ chế LanceDB (cần xác nhận bằng số đo ở
   issue): mỗi `add` thêm ít nhất một fragment + một phiên bản; mỗi `delete` ghi deletion file + một phiên bản (hàng
   không bị xoá vật lý). Hệ quả với app: nạp 1 nguồn = 1+ `add`; **xoá nguồn/notebook/xử lý lại = `delete` ⇒ vector chết
   vẫn nằm trên đĩa**; re-embed 059 = nhiều `add` lô 32 ⇒ rất nhiều fragment nhỏ. Không có gì trong app gộp hay dọn.
2. **Brute-force là đúng-chính-xác (exact).** Không index ⇒ `search` quét toàn bộ (lọc `notebook_id` rồi sắp theo cosine)
   ⇒ kết quả KHÔNG xấp xỉ. Hoãn ANN nghĩa là giữ nguyên tính chính xác và không đụng tới hiệu chuẩn 108 (ngưỡng đo trên
   brute-force). Bảo trì (gộp/dọn) KHÔNG được phép đổi thứ tự/giá trị kết quả — là bất biến kiểm chứng ở ambiguity #6.
3. **Một bảng chung mọi notebook; xoá notebook chỉ là `delete notebook_id=…`.** Dung lượng chết tích luỹ xuyên notebook.
4. **Handle `table` được cache trong adapter** (`getTable()`); `dropTable()` đặt `table=null`. Bảo trì phải đi qua
   `getTable()` và chịu được "bảng chưa tồn tại" (no-op), và không được chạy chồng với `dropTable`/re-embed 059.
5. **Hàng đợi ingestion là riêng của pipeline và không lộ ra ngoài; reindex 059 chạy NGOÀI hàng đợi**; không có khái
   niệm "app rảnh" sẵn có, và `search` (hỏi đáp/Studio/tìm kiếm) không được theo dõi. Muốn gác "đang bận" phải gom các
   điều kiện sẵn có (đã có mẫu ở `createVaultLock`: `hasActiveSources` + `isReindexing` + `isLocked`).
6. **Sao lưu 085 chụp thư mục `vectors/`**; chụp giữa lúc gộp/dọn có thể ra snapshot không toàn vẹn. Hiện sao lưu chỉ
   biết 3 lý do bận (`operation`/`processing`/`reindexing`) — không biết "đang bảo trì".
7. **Phát hiện bổ sung (điều phối viên, 2026-10-07):** thử tạo index bitmap (vô hướng) trên cột `notebook_id` làm truy
   vấn lọc theo notebook CHẬM hơn thay vì nhanh hơn ⇒ **không tạo index vô hướng**; ghi nhận làm bằng chứng trong ADR,
   KHÔNG điều tra/sửa thêm ở 116.
8. **`StorageInfo` không tách `vectors/`.** Người dùng hiện không thể thấy kho vector chiếm bao nhiêu hay nó có phình
   to không (liên quan ambiguity #4).
9. **Không có `before-quit` cho kho vector** ⇒ nếu app tắt giữa lúc gộp/dọn, độ an toàn dựa hoàn toàn vào cam kết
   commit nguyên tử của LanceDB (cần xác minh ở plan — ambiguity #5).

## Đã chốt (USER DECISIONS 2026-10-07) — KHÔNG hỏi lại ở clarify

1. **Giữ brute-force, HOÃN ANN.** Không tạo index vector (IVF_PQ/HNSW) ở 116. Ghi **ADR kèm số liệu đo**, **thay thế
   (supersede) đoạn "index ANN (IVF_PQ) lazily khi > 50k" trong `docs/04-decisions/2026-07-11-lancedb-integration.md`**
   (và câu tương ứng ở `2026-07-11-ingestion-clarify.md`), append dòng vào `docs/04-decisions/INDEX.md`.
2. **Làm bảo trì TỰ ĐỘNG** (không chỉ nút tay): gộp phân mảnh (compaction) + dọn phiên bản cũ (cleanup old versions)
   bằng `table.optimize({ cleanupOlderThan })` của `@lancedb/lancedb` 0.31.
3. **Phạm vi:** không đổi schema bảng, không index vô hướng, không đổi model/embedding, không đổi truy xuất (108).

## Prompt for /speckit-specify

Thêm cơ chế **bảo trì tự động kho vector** (LanceDB, bảng `chunks` ở `<userData>/vectors/`) cho InsightVault để dung
lượng và độ trễ truy vấn không xuống cấp theo thời gian sử dụng, đồng thời **hoãn (không làm) index ANN**. Hiện nay
(giới hạn đã đo, số liệu nằm trong issue #116 và sẽ được ghi vào ADR) mỗi lần nạp nguồn, xoá nguồn/notebook, "Xử lý
lại" PDF (112) hoặc tái lập chỉ mục khi đổi model nhúng (059) đều tạo thêm phiên bản và phân mảnh (fragment) mới của
bảng, còn vector bị xoá chỉ bị đánh dấu chứ chưa được giải phóng; app không có bước nào gộp hay dọn, nên thư mục
`vectors/` phình dần và bảng bị phân mảnh. KHÔNG thêm loại nguồn mới; KHÔNG đổi schema bảng, model nhúng, cách truy xuất
hay ngưỡng đã hiệu chuẩn (108); KHÔNG tạo bất kỳ index nào (kể cả index vô hướng trên `notebook_id` — đã đo thấy làm
chậm hơn).

**Hành vi mong muốn:**

- **Bảo trì tự động ở nền, hoàn toàn ngầm:** khi đủ điều kiện (thời điểm kích hoạt, debounce và ngưỡng kích hoạt chốt ở
  clarify), app gọi `table.optimize({ cleanupOlderThan })` (`@lancedb/lancedb` 0.31) trên bảng `chunks` để **gộp
  fragment** (compaction) và **dọn các phiên bản cũ**, giải phóng dung lượng của vector đã xoá. Bảo trì chỉ chạy khi
  kho "yên": không có nguồn đang `queued/processing` hoặc đang "Xử lý lại", không có tái lập chỉ mục nền, không có khoá
  vault (sao lưu/khôi phục, 085); nếu đang bận thì hoãn và thử lại ở lần kích hoạt sau, không xếp hàng chặn người dùng.
  Sao lưu/khôi phục không được chụp thư mục `vectors/` giữa lúc bảo trì đang chạy (cách phối hợp chốt ở clarify).
- **Giữ một biên an toàn cho phiên bản cũ** (`cleanupOlderThan` = một khoảng thời gian, không phải 0) để truy vấn đang
  đọc đồng thời không mất tệp; giá trị cụ thể chốt ở clarify và ghi trong ADR.
- **An toàn dữ liệu:** bảo trì KHÔNG được làm mất, đổi hay nhân đôi vector hay `id` chunk; kết quả `search`, `countBy*`
  và `getVectorsByIds` trước và sau bảo trì phải giống hệt (brute-force là đúng-chính-xác). Mọi lỗi bảo trì (kể cả bảng
  chưa tồn tại, xung đột ghi đồng thời, thiếu dung lượng, tắt app giữa chừng) phải bị nuốt có kiểm soát: ghi một dòng
  nhật ký (088, `logEvent`/`logError`, chỉ số đếm và `errorType`, không đường dẫn/nội dung), KHÔNG ảnh hưởng nạp/hỏi
  đáp/sao lưu, và thử lại ở lần kích hoạt sau (có chặn lặp lỗi liên tục).
- **Phần lên lịch là hàm thuần** (quyết định "có chạy bây giờ không" từ: thời điểm ghi cuối, số thao tác ghi tích luỹ,
  số fragment/phiên bản đo được, trạng thái bận, kết quả lần trước, đồng hồ tiêm vào) để kiểm thử không cần LanceDB; adapter
  `vector-store.ts` chỉ thêm các phương thức mỏng (bảo trì + đo số fragment/dung lượng) vào `VectorStore`.
- **Hiển thị:** mặc định KHÔNG có giao diện mới và KHÔNG có kênh IPC mới (ngầm hoàn toàn, quan sát qua nhật ký). Nếu
  `/speckit-clarify` chọn thêm nút "Dọn dẹp ngay" hoặc dòng dung lượng vector ở Cài đặt › Lưu trữ thì: nút phải là một
  kênh mới được **whitelist ở `preload`, không nhận tham số** (main tự quyết bảng/đường dẫn), tôn trọng `vaultLock`;
  dòng dung lượng chỉ là trường chỉ-đọc bổ sung vào `app:getStorageInfo` hiện có (không kênh mới).
- **Quyết định hoãn ANN:** ghi một ADR mới kèm số liệu đo (số vector, độ trễ brute-force theo quy mô, so sánh có/không
  index, kết quả index bitmap làm chậm), nêu ngưỡng/điều kiện xem lại việc dùng ANN, và thay thế đoạn "IVF_PQ lazily khi
  vượt 50k" của `2026-07-11-lancedb-integration.md`; mọi quyết định của clarify sẽ chốt ở
  `docs/04-decisions/2026-10-07-vector-maintenance-clarify.md`.

**Ràng buộc bất biến phải giữ (Constitution):**

- **I — Local-first:** bảo trì chạy hoàn toàn cục bộ, không network egress, không telemetry; không đổi privacy badge.
- **II — Kiểm chứng được:** không đổi/mất `chunk.id`, vector hay locator; chip `[n]` và truy xuất giữ nguyên; kết quả
  truy vấn trước/sau bảo trì tương đương (kể cả ngưỡng 108, `RELEVANCE_CALIBRATION`).
- **III — Biên bảo mật:** mọi truy cập LanceDB ở main; renderer không gọi trực tiếp; không log nội dung tài liệu hay
  đường dẫn (chỉ số đếm, kích thước, thời lượng, `errorType`); kênh IPC mới (nếu có) whitelist, không tham số.
- **IV — Test-first:** logic lên lịch/ngưỡng/backoff là hàm thuần có test trước (coverage >= 80%); test tích hợp với
  LanceDB thật trên thư mục tạm đo được fragment và dung lượng thư mục giảm sau bảo trì; hồi quy
  `EVAL_MODE=current npm run eval:retrieval` không đổi số liệu; adapter native vẫn loại khỏi coverage như hiện có.

**Kế thừa, không phá vỡ:** `VectorStore` giữ nguyên các phương thức hiện có và hợp đồng của chúng (chỉ thêm); interface hẹp
`ReindexVectorStore` (059) không đổi; hàng đợi ingestion tuần tự, `vaultLock` và trạng thái `VaultBackupState` giữ ngữ
nghĩa hiện có (nếu cần phối hợp thì mở rộng tối thiểu); 112 `reprocess` (add → hoán đổi → xoá cũ) và dọn vector mồ côi
giữ nguyên.

**Ngoài phạm vi:** index ANN (IVF_PQ/HNSW) hay bất kỳ index vector nào; index vô hướng (bitmap/btree) trên `notebook_id`;
đổi schema/tách bảng theo notebook; đổi model nhúng hay thuật toán truy xuất; sao lưu tự động (085 pha sau); UI quản
lý kho vector ngoài mức tối thiểu được clarify chấp nhận; điều tra nguyên nhân index bitmap chậm.

## Ambiguities to raise in /speckit-clarify

Đã loại: giữ brute-force/hoãn ANN, bảo trì tự động qua `optimize({cleanupOlderThan})`, không đổi schema/index vô hướng
(3 quyết định trên); một bảng chung, xoá đồng bộ SQLite↔LanceDB, `dropTable` khi đổi model (ADR lancedb-integration,
059); `vaultLock` chặn ghi và sao lưu bị chặn cứng khi bận (085); tiền lệ log 088 (không nội dung/đường dẫn). Còn lại
(mỗi mục kèm phương án và **đề xuất khuyên dùng**; các con số cụ thể là đề xuất ban đầu, phải chốt lại theo số đo ở
issue #116):

1. **Thời điểm kích hoạt bảo trì và debounce.**
   Phương án: (a) sau MỖI xoá/xử lý lại/đổi model — đơn giản nhưng chạy quá dày và tranh tài nguyên với nạp liên tục;
   (b) chỉ khi app "rảnh" (đã yên N giây kể từ thao tác ghi/truy vấn cuối); (c) theo ngưỡng đo được (số fragment >= F,
   số phiên bản >= V, hoặc tỉ lệ hàng chết >= p%); (d) lúc khởi động (trễ vài chục giây sau khi cửa sổ lên) để bắt
   kịp vault cũ; (e) kết hợp.
   **Đề xuất: (e)** — bộ đếm "bẩn" trong RAM (số lần ghi/xoá từ lần bảo trì cuối) + **debounce theo yên lặng** (đề
   xuất ~60 s sau thao tác ghi cuối) + **cổng ngưỡng** (chỉ chạy nếu fragment/phiên bản/hàng chết vượt ngưỡng đo được,
   tránh `optimize` vô ích) + **một lần bắt kịp lúc khởi động** (trễ ~30–60 s, không chặn cửa sổ) + **một lần sau khi
   reindex 059 xong**. Không chạy theo từng thao tác. Có trần tần suất tối thiểu (vd không quá 1 lần/10 phút). Ngưỡng
   F/V/p và các con số thời gian lấy từ số đo ở issue.
2. **Tương tác với hàng đợi ingestion, truy vấn đang chạy, sao lưu/khôi phục.**
   Phương án: (a) xếp bảo trì vào CHÍNH `SerialQueue` của pipeline (hiện không lộ ra; bảo trì không phải việc theo
   `sourceId`, và một lần gộp dài sẽ chặn mọi lần nạp); (b) khoá/mutex riêng cho bảo trì, chạy khi "kho yên" và hoãn
   nếu bận; (c) cho phép chạy chồng với ghi, dựa vào cơ chế commit lạc quan của LanceDB.
   **Đề xuất: (b)** — một bộ điều phối `single-flight` riêng, chỉ BẮT ĐẦU khi `!(nguồn queued/processing/reprocessing
|| reindex.inProgress || vaultLock.isLocked())` (tái dùng đúng các điều kiện của `createVaultLock`, tách thành một
   hàm `isStoreBusy` dùng chung để khỏi lệch) và chưa có `search` đang chạy (adapter tự đếm số thao tác đang bay).
   Nếu đang bận ⇒ hoãn, KHÔNG xếp hàng. Chiều ngược lại: **sao lưu/khôi phục phải chờ bảo trì đang chạy xong**
   (có trần thời gian, rồi mới `beginOperation`) thay vì thêm lý do mới vào `VaultBackupState` — tránh đổi kiểu dùng
   chung và copy UI; xác nhận lại với plan nếu thời lượng bảo trì dài. Ghi (nạp/xoá) bắt đầu giữa lúc bảo trì: để
   LanceDB xử lý xung đột; nếu bảo trì lỗi vì xung đột ⇒ coi là "hoãn" (không phải lỗi nghiêm trọng).
3. **Giữ phiên bản cũ bao lâu (`cleanupOlderThan`).**
   Phương án: (a) 0/ngay lập tức — thu hồi tối đa nhưng truy vấn đọc đồng thời có thể mất tệp, và nếu crash giữa lúc
   gộp+dọn thì không còn đường lùi; (b) biên an toàn vài phút; (c) vài giờ–ngày (an toàn nhưng dung lượng thu hồi
   chậm); (d) mặc định thư viện (cần xác minh giá trị — nhiều khả năng dài vài ngày ⇒ gần như không thu hồi gì).
   **Đề xuất: (b)** — hằng số được đặt tên (đề xuất 10 phút), truyền TƯỜNG MINH (không dựa mặc định thư viện), và
   KHÔNG bật `deleteUnverified`. Vì bảo trì lặp lại nên lần sau sẽ thu hồi phần còn lại. App không dùng "time
   travel" nên không cần giữ lâu. Ghi giá trị + lý do vào ADR.
4. **Có hiển thị gì cho người dùng không, và log ra sao.**
   Phương án: (a) hoàn toàn ngầm + chỉ ghi nhật ký; (b) thêm dòng chỉ-đọc "Kho vector: X MB" ở Cài đặt › Lưu trữ
   (thêm trường tuỳ chọn vào `StorageInfo`, KHÔNG kênh mới); (c) thêm nút "Dọn dẹp ngay" (kênh IPC mới, whitelist,
   không tham số, tôn trọng `vaultLock`, có trạng thái đang chạy/kết quả).
   **Đề xuất: (a)** cho 116 (khớp "làm bảo trì tự động" và giữ phạm vi nhỏ, không IPC mới); (b) là phần bổ sung rẻ nếu
   muốn minh bạch — để làm việc riêng nếu cần; (c) không làm ở v1. Log: sự kiện `vector.maintenance.start|done|skip|error`
   qua `logEvent/logError` với meta chỉ gồm `trigger`, `fragmentsBefore/After`, `versionsRemoved`, `bytesFreed`,
   `durationMs`, `reason` (lý do hoãn) và `errorType` — KHÔNG đường dẫn, KHÔNG nội dung, KHÔNG `message` thô (theo
   quy ước 088 / `index.ts` reindex.error).
5. **Xử lý lỗi bảo trì.**
   Phương án: (a) nuốt + log + thử lại ở lần kích hoạt sau; (b) thử lại có backoff theo cấp số nhân, ngưng sau K lần
   liên tiếp tới khi khởi động lại; (c) báo lỗi cho người dùng.
   **Đề xuất: (a)+(b)** — không bao giờ ném ra ngoài tầng gọi, không ảnh hưởng dữ liệu hay thao tác khác; phân biệt
   "hoãn" (bận/xung đột/bảng chưa có ⇒ không tính lỗi) với "lỗi" (tính vào bộ đếm, backoff, dừng sau K lần, vd K=3, cho
   tới lần khởi động sau). Không UI. Phải xác minh ở plan cam kết nguyên tử của `optimize` khi tắt app giữa chừng (hiện
   không có `before-quit` cho kho vector) — nếu không đủ chắc thì thêm "chờ bảo trì xong (trần thời gian)" khi thoát.
6. **Chiến lược kiểm thử.**
   Phương án/đề xuất (cả ba): (i) **unit** với `VectorStore` mock + đồng hồ tiêm vào — hàm thuần lên lịch (debounce,
   ngưỡng, bận/hoãn, backoff, trần tần suất, K lần lỗi) test-first đạt >= 80%; (ii) **integration** với LanceDB THẬT trên
   `mkdtemp` (theo mẫu `vector-store-delete-by-ids.test.ts`): tạo nhiều lô `add` + `delete`, đo số fragment và
   `dirSize(vectors/)` trước/sau `optimize` (phải giảm), và chứng minh `search`/`countBy*`/`getVectorsByIds` giống hệt
   trước/sau; (iii) **hồi quy** `EVAL_MODE=current npm run eval:retrieval` — số liệu không đổi so với `RELEVANCE_CALIBRATION`
   (không nằm trong test gate tự động nếu quá nặng; chạy tay và ghi vào ADR). Câu hỏi mở: integration test có nằm trong
   `npm test` (chậm hơn) hay tách script riêng; có cần test đồng thời "ghi trong lúc bảo trì" không.
7. **Mở rộng interface và độ ổn định API của thư viện.** Cần thêm vào `VectorStore` ít nhất `optimize(opts)` (và,
   nếu chọn cổng theo ngưỡng ở #1, một phương thức đo `stats()` — số fragment/phiên bản/hàng chết) và vào kiểu tối
   thiểu `LanceTable`. Chữ ký, kiểu kết quả và mặc định của `optimize`/stats ở `@lancedb/lancedb` 0.31 **chưa được xác
   minh trong intake này** (không dùng được Context7/Bash). **Đề xuất:** xác minh bằng tài liệu chính thức + chạy thử
   ở bước `/speckit-plan` (research), thêm phương thức làm TUỲ CHỌN hay bắt buộc? — đề xuất bắt buộc và cập nhật mọi mock
   `VectorStore` trong `tests/unit/*` (để trình biên dịch bắt sót); `ReindexVectorStore` giữ nguyên.
8. **Vault hiện hữu đã phình sẵn và bảo vệ dung lượng trống.** Lần bảo trì đầu trên vault cũ có thể rất lâu và, vì gộp
   ghi tệp mới trước khi dọn tệp cũ, **cần tạm thêm dung lượng ổ đĩa** (cỡ kích thước bảng). Có ngân sách thời gian/dừng
   giữa chừng? Có kiểm `freeBytes` (đã có `statfs` ở `storage-info`) trước khi gộp và bỏ qua nếu ổ gần đầy?
   **Đề xuất:** chạy nền không chặn UI; trước khi chạy kiểm dung lượng trống >= hệ số × kích thước `vectors/` (hệ số theo số
   đo), thiếu ⇒ hoãn + log `reason: "lowDisk"`; không đặt trần thời gian cứng cho `optimize` (không ngắt giữa chừng được an
   toàn) nhưng chỉ khởi chạy khi kho yên.
9. **Tiêu chí xem lại ANN ghi trong ADR.** Hoãn ANN cần "điều kiện kích hoạt xem lại" cụ thể để quyết định không bị
   bỏ quên (thay cho "> 50k" cũ chưa có số đo). **Đề xuất:** ngưỡng theo độ trễ đo được (p95 `search` brute-force vượt X
   ms ở quy mô N vector, X/N lấy từ số đo trong issue) chứ không theo số vector tuyệt đối; kèm lời nhắc rằng index vô
   hướng trên `notebook_id` đã được đo là làm chậm; ANN (nếu làm) phải đo lại Recall theo harness 108 vì ngưỡng đã hiệu
   chuẩn trên brute-force chính xác.
10. **Phạm vi hiển thị dung lượng vector (nếu chọn #4(b)).** Nếu có dòng dung lượng: tính bằng `dirSize(join(dataDir,"vectors"))`
    ở main, thêm trường tuỳ chọn `vectorsBytes` vào `StorageInfo` (tương thích ngược). Không cần trả lời nếu #4 chọn (a).

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md` (đã grep brute/ANN/fragment/compaction/phân mảnh/rảnh). Đề xuất append (không sửa
term cũ; cột 日本語 để `—`). Tên English dùng làm tên hàm/type/sự kiện log chuẩn trong code:

| 日本語 | Tiếng Việt (đề xuất)                                                 | English (đề xuất, dùng trong code)                               | Ghi chú                                                                             |
| ------ | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| —      | Bảo trì kho vector (gộp phân mảnh + dọn phiên bản cũ, tự động ở nền) | vector maintenance (`VectorMaintenance`, `vector.maintenance.*`) | Gọi `table.optimize({cleanupOlderThan})`; chỉ chạy khi kho yên — 116                |
| —      | Phân mảnh của bảng LanceDB (tệp dữ liệu nhỏ do mỗi lần ghi tạo ra)   | fragment                                                         | Nhiều fragment nhỏ làm chậm quét và tốn dung lượng — 116                            |
| —      | Gộp phân mảnh                                                        | compaction                                                       | Phần "gộp" của `optimize` — 116                                                     |
| —      | Phiên bản bảng (mỗi lần ghi/xoá tạo một phiên bản)                   | table version                                                    | App không dùng time travel ⇒ phiên bản cũ có thể dọn — 116                          |
| —      | Dọn phiên bản cũ (giải phóng tệp của vector đã xoá + manifest cũ)    | cleanup old versions (`cleanupOlderThan`)                        | Biên an toàn thời gian để truy vấn đồng thời không mất tệp — 116                    |
| —      | Tìm kiếm vét cạn (quét toàn bộ, kết quả chính xác, không index)      | brute-force search                                               | Cách tìm kiếm hiện tại và được GIỮ sau 116; ngưỡng 108 hiệu chuẩn trên nó — 011/116 |
| —      | Chỉ mục láng giềng gần đúng (hoãn)                                   | ANN index (IVF_PQ/HNSW)                                          | HOÃN ở 116 theo ADR kèm số liệu đo, có điều kiện xem lại — 116                      |
| —      | Kho "yên" (không ghi, không tái lập chỉ mục, không khoá vault)       | store idle (`isStoreBusy`)                                       | Điều kiện để bắt đầu bảo trì — 116                                                  |

Ghi chú: "fragment", "compaction", "ANN" là thuật ngữ chuẩn của LanceDB/IR, giữ tiếng Anh; cột Tiếng Việt chỉ giải
nghĩa. Người phụ trách có thể gộp bớt dòng khi append trong branch feature (rule 5 `CLAUDE.md`: THÊM term được làm
ngay trong branch). Tên sự kiện log `vector.maintenance.*` bám quy ước đặt tên 088 (`ingest.reprocess.orphanVectors`).

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa đổi constitution phải qua PR riêng được steward duyệt, rule 5). Có thể cân nhắc về
sau, không bắt buộc ở 116: một dòng trong "Development Workflow" hoặc Principle IV rằng "mọi **tác vụ nền định kỳ** chạm
dữ liệu người dùng (bảo trì kho vector, tái lập chỉ mục, dọn bản sao lưu) MUST (a) chỉ chạy khi không có thao tác
ghi/sao lưu/khôi phục, (b) không bao giờ làm hỏng thao tác ở tiền cảnh khi lỗi, (c) log chỉ số đếm và `errorType`, không
nội dung" — vì mẫu "việc nền + vaultLock + log an toàn" đang lặp lại ở 059, 085 và 116 mà chưa thành nguyên tắc chung.
