# vault-backup clarify (085)

- Ngày: 2026-10-06
- Feature: `085-vault-backup` (issue #85)
- Nguồn: backlog cải tiến 2026-07-15 (mục TRUNG BÌNH "backup/restore vault"); người dùng chốt 4 câu hỏi.
- Tiếp nối: 001 app-shell (data dir `app.getPath('userData')` — quyết định 2026-07-11 đã ghi "backup/di
  chuyển dir là mối quan tâm tương lai"), migrations (`PRAGMA user_version`), 059 embed-in-process
  (`embeddingModelVersion` + reindex lúc boot), 037 Settings "Lưu trữ".

## Bối cảnh kỹ thuật (khảo sát code)

- Dữ liệu ở `<userData>`: `insightvault.db` (+ `-wal`/`-shm`, WAL mode) · `vectors/` (LanceDB, bảng
  `chunks`) · `config.json` (electron-store: `ai.modelSelection`, `ai.onlineConfig`, `onboardingComplete`,
  `embeddingModelVersion`) · `models/` (whisper/e5/tesseract — tải lại được) · `tmp/` (wav tạm).
- API key online ở **keychain OS** (keytar), không nằm trên đĩa.
- Nguồn **tham chiếu file gốc** theo đường dẫn (`source.origin`), không copy. Xem văn bản + trích dẫn +
  highlight chạy hoàn toàn từ `chunk` trong DB; chỉ **phát audio/video, xem ảnh, "Thử lại"** cần file gốc.
- Không có đường đóng/mở lại DB lúc chạy (`db` là const bị mọi repo giữ) → khôi phục KHÔNG hoán đổi nóng.

## Quyết định (người dùng chốt)

**1. Nội dung bản sao lưu = DB + vectors + config.** Khôi phục xong dùng được ngay, không phải embed lại.

- SQLite lấy **snapshot nhất quán** (vd `VACUUM INTO` — không copy file đang mở + WAL).
- KHÔNG gồm: file gốc (media cần file gốc còn đúng chỗ; thiếu → hành vi 404 + báo lỗi hiện có),
  `models/` (tải lại), `tmp/`, API key (keychain — người dùng nhập lại nếu sang máy mới), localStorage
  renderer (độ rộng cột, notebook gần nhất — vặt).
- _Loại bỏ:_ "chỉ DB + config" (phải embed lại toàn bộ); "gồm file gốc" (file khổng lồ + phải viết lại
  `origin`).

**2. Khôi phục = thay TOÀN BỘ vault + tự sao lưu vault hiện tại trước.**

- Hỏi xác nhận (nêu rõ ghi đè toàn bộ) → tự tạo bản sao lưu vault hiện tại (đường lùi) → dàn dựng
  (stage) bản sao lưu → **khởi động lại app** → hoán đổi file TRƯỚC khi mở DB/LanceDB → chạy migration.
- Hoán đổi thất bại giữa chừng → rollback về vault cũ (không để vault nửa vời).
- _Loại bỏ:_ ghi đè không đường lùi; gộp notebook (trùng ID, ghép vectors/FTS — để pha sau).

**3. Chỉ thủ công ở v1.** Nút "Sao lưu…" / "Khôi phục…" trong Cài đặt → Lưu trữ. Tự động định kỳ: pha sau.

**4. Mã hoá tuỳ chọn bằng mật khẩu.** Người dùng có thể đặt mật khẩu khi sao lưu → file mã hoá
(AES-256, khoá dẫn xuất từ mật khẩu bằng KDF chậm có salt). Khôi phục file mã hoá → hỏi mật khẩu.

- Không lưu/ghi log mật khẩu; không có cơ chế khôi phục mật khẩu → **quên mật khẩu = mất bản sao lưu**,
  UI cảnh báo rõ + bắt nhập lại 2 lần.
- Sai mật khẩu / file bị sửa → báo lỗi rõ, KHÔNG đụng vault hiện tại (xác thực toàn vẹn trước khi hoán đổi).
- Không mã hoá → cảnh báo file chứa toàn bộ nội dung tài liệu dạng đọc được.

## Bất biến (Constitution)

- **Local-first:** sao lưu/khôi phục hoàn toàn trên máy, KHÔNG network egress (không cloud).
- **Ranh giới bảo mật:** mọi FS/crypto ở main; renderer chỉ gọi kênh whitelisted; hộp thoại chọn file do
  main mở (renderer không truyền đường dẫn tuỳ ý để ghi/đọc).
- **Kiểm chứng được:** khôi phục giữ nguyên chunk + locator → chip `[n]` vẫn trỏ đúng.

## Giả định / để plan quyết (research)

- **Định dạng file:** 1 file đơn `.ivbackup` (lưu trữ + manifest). Thư viện archive + định dạng container
  mã hoá → plan research (ưu tiên lib phổ biến; crypto dùng `node:crypto` built-in).
- **Manifest:** phiên bản app, `schemaVersion` (`user_version`), `embeddingModelVersion`, thời điểm tạo,
  cờ mã hoá, số notebook/nguồn (để hiện cho người dùng trước khi xác nhận).
- **Tương thích phiên bản:** schema bản sao lưu > app → từ chối (không thì boot ra `SchemaVersionError`);
  schema cũ hơn → migration tự nâng khi mở. `embeddingModelVersion` khác → reindex lúc boot sẵn có tự dựng
  lại `vectors/` từ chunk.
- **Đang có nguồn xử lý (ingestion/reindex chạy):** chặn sao lưu/khôi phục cho tới khi xong (tránh
  snapshot vectors lệch DB) — plan xác nhận.
- **Bản sao lưu tự động trước khi khôi phục** lưu ở `<userData>/backups/` (không mã hoá, vì nằm cùng máy
  với vault vốn không mã hoá); giữ N bản gần nhất — plan chốt N.

## Mặc định chốt cho câu hỏi mở của intake (2026-10-06, agent đề xuất — người dùng có thể đảo)

- **Số bản tự sao lưu trước khôi phục:** giữ **3** bản gần nhất trong `<userData>/backups/`, xoá bản cũ
  hơn. v1 KHÔNG có UI quản lý (chỉ hiện đường dẫn thư mục để người dùng tự mở/khôi phục từ đó).
- **Đang có ingestion/reindex chạy:** **chặn cứng** — nút Sao lưu/Khôi phục bị vô hiệu + lý do ("Đang xử lý
  nguồn…"), không xếp hàng chờ.
- **Sai mật khẩu vs file hỏng/bị sửa:** AEAD (vd AES-GCM) không phân biệt được 2 trường hợp → **1 thông
  báo chung** "Sai mật khẩu hoặc file sao lưu bị hỏng". File không đúng định dạng/không phải `.ivbackup`
  (magic/manifest sai) → thông báo riêng.
- **Tiến trình:** hiển thị **theo bước** (Đang chụp dữ liệu → Đang nén → Đang mã hoá → Xong), không cần %.

## Clarify spec (2026-10-06) — mặc định lấp khoảng trống nhỏ

- File mã hoá: phần hở chỉ gồm nhận diện định dạng + cờ mã hoá; manifest chỉ hiện SAU khi giải mã đúng.
- Mật khẩu tối thiểu **8 ký tự**, không ép quy tắc phức tạp.
- Lần mở app đầu sau khôi phục: thông báo kết quả (thành công: ngày tạo bản đã khôi phục + vị trí bản tự sao
  lưu; thất bại: lý do + vault cũ giữ nguyên).
