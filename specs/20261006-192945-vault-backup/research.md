# Research — 085 vault-backup

Spike thật (Node 24 = dòng Node của Electron 43, `tar@7.5.22`): tạo vault giả (SQLite WAL 20k dòng đang mở +
`vectors/` 1 MB + `config.json`) → snapshot → đóng gói + mã hoá → giải mã + giải nén vào staging. Kết quả ghi
từng mục dưới.

## R1. Snapshot SQLite nhất quán

- **Decision:** `db.exec("VACUUM INTO '<tmp>/insightvault.db'")` trên `DatabaseSync` đang mở (escape `'` trong
  path).
- **Rationale:** spike: snapshot đủ 20000/20000 dòng, giữ `user_version=8`, file ra ở `journal_mode=delete` (không
  kéo theo `-wal/-shm`), không chặn app (là 1 read transaction). Gộp sẵn nội dung WAL.
- **Alternatives:** copy file thô + `-wal`/`-shm` (rủi ro bản ghi dở, cần checkpoint + chặn ghi); SQLite backup API
  (`node:sqlite` có `backup()` async nhưng không thêm lợi ích so với VACUUM INTO ở quy mô này).

## R2. Kho vector (LanceDB) + config

- **Decision:** `fs.cp(<userData>/vectors, <tmp>/vectors, {recursive})`; config ghi từ `store.store` (object
  electron-store) ra `<tmp>/config.json` thay vì copy file đang có thể bị ghi.
- **Rationale:** LanceDB ghi file dữ liệu rồi commit manifest version; copy lúc đang ghi có thể bắt fragment lệch.
  Chặn bằng **vault lock** (R7) + chặn khi đang xử lý nguồn/reindex (FR-026) → không có writer nào trong lúc copy.
- **Alternatives:** bỏ vectors và reindex sau khôi phục (người dùng đã loại — mất thời gian embed lại).

## R3. Định dạng lưu trữ

- **Decision:** `tar@7` (isaacs; pure JS, stream, đã ở Node ≥18) + gzip (`tar.c({gzip:true, portable:true})`),
  entry đầu `manifest.json`.
- **Rationale:** thư viện phổ biến nhất cho tar trong Node (npm CLI dùng), stream nên không nạp vault vào RAM;
  spike đóng gói + giải nén OK. `portable` bỏ uid/gid/mtime cá nhân.
- **Alternatives:** zip (`archiver`/`yauzl` — 2 lib, mã hoá zip AES cần plugin riêng và đọc lại cần lib khác);
  tự viết container nhiều file (không cần thiết).

## R4. Container + mã hoá

- **Decision:** file `.ivbackup` = **header hở** ‖ **body** ‖ **trailer**.
  - Header v1: `"IVBK"`(4) · `formatVersion`=1 (u8) · `flags` (u8, bit0 = mã hoá). Nếu mã hoá thêm: `kdfId`=1
    scrypt (u8) · `log2N` (u8) · `r` (u8) · `p` (u8) · `salt` (16) · `iv` (12). → 6 B (hở) / 38 B (mã hoá).
  - Body = tar.gz; nếu mã hoá → AES-256-GCM(tar.gz) với **AAD = header** (sửa header bị phát hiện).
  - Trailer: mã hoá → GCM tag 16 B; không mã hoá → SHA-256(header ‖ body) 32 B (phát hiện file hỏng, FR-010).
- **KDF:** `crypto.scrypt`, N=2^17, r=8, p=1, `maxmem` 256 MB, key 32 B; tham số nằm trong header để nâng sau.
  Spike: ~170 ms/lần dẫn xuất.
- **Rationale:** chỉ dùng `node:crypto` built-in (không thêm lib crypto). GCM = AEAD → toàn vẹn + bí mật.
- **Kết quả spike (verify-before-commit):**
  - Mật khẩu đúng → giải nén đủ, đọc DB 20000 dòng.
  - Mật khẩu sai → lỗi ngay ở tar (dữ liệu rác: `invalid base256 encoding`) — staging bị xoá.
  - Sửa 1 byte giữa body → lỗi tar `checksum failure`. Sửa **byte cuối ciphertext** (tar vẫn hợp lệ) → lỗi
    `unable to authenticate data` ở `decipher.final()` — pipeline reject → staging xoá. ⇒ **mọi lỗi trong
    pipeline giải mã/giải nén map về 1 mã `badPasswordOrCorrupt`** (khớp quyết định "1 thông báo chung").
  - Lưu ý: GCM nhả plaintext chưa xác thực trong lúc stream. **Cập nhật lúc implement:** stream thẳng vào
    `tar.x` gây race (lệnh ghi tar còn treo tạo lại thư mục đích sau khi đã dọn — test chập chờn khi tải nặng) và
    để trình phân tích tar đọc dữ liệu chưa xác thực. ⇒ **Xác thực trước, giải nén sau:** giải mã / kiểm SHA-256
    body ra file tạm `payload` (chỉ hợp lệ khi qua `final()`/so hash) → `tar.t` liệt kê kiểm allowlist toàn bộ
    entry → `tar.x` từ file đã xác thực (filter giữ làm phòng thủ chiều sâu). Tốn thêm 1 lần ghi cỡ file nén.
- **Alternatives:** chunked AEAD (STREAM) — phát hiện sớm hơn nhưng phức tạp, không cần vì đã stage + verify
  trọn trước khi xác nhận; `age`/libsodium — thêm native/lib ngoài.

## R5. Chống path traversal / symlink / entry lạ

- **Decision:** `tar.x({ cwd: staging, strict: true, filter, onwarn })`:
  - `filter`: chỉ `File`/`Directory`; tên phải thuộc allowlist `manifest.json`, `config.json`,
    `insightvault.db`, `vectors/` + con của nó. Entry ngoài allowlist hoặc loại khác (SymbolicLink, Link…) ⇒
    **đánh dấu từ chối toàn bộ file**.
  - `onwarn`: bất kỳ `TAR_ENTRY_ERROR` (spike: entry `../../a` → `path contains '..'`, tar tự bỏ qua) ⇒ từ chối
    toàn bộ file (không im lặng bỏ entry).
- **Rationale:** tar đã strip `..`/absolute mặc định; ta nâng lên "reject cả file" cho rõ ràng (FR-025).

## R6. Hoán đổi lúc khởi động (restore swap)

- **Decision:** ở `whenReady`, ngay sau `ensureDataDir` và **trước** `new Store()`/`openDatabase`, gọi
  `applyPendingRestore(dataDir)` — state machine trên thư mục `<userData>/restore/`:
  - `staged/` (đã giải nén + verify + migrate thử), `previous/` (vault cũ), `state.json {phase, …}`.
  - `phase: staged → movingOut → movingIn` (lỗi ⇒ `rollingBack`); mỗi bước **idempotent** (chạy lại sau crash an
    toàn). Tách 2 pha để biết chắc mục sống là cũ hay mới khi rollback:
    A) chuyển từng mục sống (`insightvault.db`, `-wal`, `-shm`, `vectors/`, `config.json`) → `previous/` nếu chưa
    có ở đó; B) chuyển mục từ `staged/` → vị trí sống. Lỗi ở A/B ⇒ **rollback**: xoá mục sống đến từ staged, trả
    `previous/` về chỗ cũ. Kết thúc ghi `result.json` (one-shot cho thông báo FR-016a) và dọn `staged/`,
    `previous/`.
  - `rename` cùng volume (cùng `userData`) → nguyên tử từng mục.
- **Migration risk:** loại bỏ ở bước **prepare** (trước xác nhận): mở DB staged bằng `openDatabase` +
  `runMigrations` + `PRAGMA quick_check` rồi đóng ⇒ schema mới hơn → `SchemaVersionError` → mã `newerSchema`;
  cũ hơn → nâng sẵn trong staging. Lúc boot DB đã ở schema hiện tại.
- **Relaunch:** `app.relaunch(); app.exit(0)` (lock single-instance nhả khi exit). Dev (`electron-vite dev`):
  relaunch có thể không bật lại renderer dev server ⇒ verify trên bản build (`out/`) / đóng gói.
- **Alternatives:** hot-swap (phải dựng lại composition root — mọi repo giữ `db` const); hoán đổi trong
  `before-quit` (app đang giữ handle DB/LanceDB mở ⇒ không an toàn trên Windows).

## R7. Vault lock + busy

- **Decision:** `vaultLock` (in-memory, main): giữ trong pha **snapshot** của sao lưu (VACUUM INTO + copy vectors +
  config — vài giây) và từ lúc xác nhận khôi phục tới khi exit. Handler IPC ghi vault (thêm nguồn file/URL, thử
  lại, xoá nguồn, xoá notebook) trả lỗi `vaultBusy` khi lock. Chat/Studio chỉ ghi SQLite → không chặn (VACUUM
  INTO là snapshot giao dịch).
- **Busy (FR-026):** `sourceRepo.listByStatus('queued'|'processing')` khác rỗng **hoặc** `reindex.inProgress`
  **hoặc** đang có 1 thao tác sao lưu/khôi phục khác ⇒ `getState().busy` + lý do. `awaiting_embedding` không tính
  (có thể chờ vô hạn khi runtime lỗi — không được khoá sao lưu vĩnh viễn).

## R8. Bản tự sao lưu trước khôi phục

- **Decision:** `<userData>/backups/pre-restore-<YYYYMMDD-HHmmss>.ivbackup`, không mã hoá, tạo bằng chính luồng
  sao lưu; sau khi tạo → giữ 3 bản mới nhất theo tên (prune lỗi ⇒ log, không chặn).
- `restore/`, `backups/`, `models/`, `tmp/` **không** nằm trong bản sao lưu (allowlist R5 + danh sách nguồn R1/R2).

## R9. Hộp thoại + đường dẫn (Constitution III)

- **Decision:** main mở `dialog.showSaveDialog` / `showOpenDialog` (filter `.ivbackup`). Restore: main giữ path theo
  **token** ngẫu nhiên (`randomUUID`) trong Map; renderer chỉ nhận token + cờ mã hoá. Token hết hạn khi
  cancel/confirm/lỗi.
- E2E: biến môi trường test `IV_E2E_DIALOG_PATH` chỉ có hiệu lực khi `!app.isPackaged` (cùng cách gác như
  `IV_EMBED_FAKE`, `embed-model.ts:67`) thay hộp thoại native — bản đóng gói luôn dùng hộp thoại thật.

## R10. Ước lượng hiệu năng (SC-001)

- Spike: 1 MB vectors + DB 20k dòng: snapshot 5 ms, đóng gói+mã hoá 23 ms (sau 170 ms scrypt). Nút thắt ở I/O +
  gzip (~50–100 MB/s 1 lõi) ⇒ vault 500 MB < 2 phút. Gzip level mặc định (6); vectors float32 nén kém — chấp
  nhận.
