# Intake — 085-vault-backup

- Issue: #85
- Slug: `vault-backup`
- Ngày intake: 2026-10-06
- Loại: cải tiến sản phẩm (KHÔNG có tài liệu thiết kế khách hàng mới, KHÔNG có Figma). Thêm khả năng
  **sao lưu / khôi phục toàn bộ vault** (dữ liệu cục bộ) trong Cài đặt → Lưu trữ cục bộ. Nguồn: backlog cải
  tiến 2026-07-15 + 4 quyết định người dùng đã chốt.

## Input sources

- `docs/OVERVIEW.md` — 3 điểm bất biến (Local-first, Kiểm chứng được, Offline & tự chủ).
- `.specify/memory/constitution.md` — Principle I (local-first, không egress mặc định), II (trích dẫn kiểm chứng
  được), III (ranh giới bảo mật desktop: FS/crypto ở main, preload whitelisted), IV (test-first, coverage ≥80%),
  V (phased delivery).
- `docs/04-decisions/2026-10-06-vault-backup-clarify.md` — **quyết định chính** (nội dung bản sao lưu, khôi phục
  thay toàn bộ + tự sao lưu trước, chỉ thủ công v1, mã hoá mật khẩu tuỳ chọn). Đã đọc toàn bộ.
- `docs/04-decisions/INDEX.md` — quyết định liên quan đã áp dụng (không hỏi lại):
  - `2026-07-11-data-dir-path.md` (001): data dir = `app.getPath('userData')`; backup/di chuyển dir đã ghi là mối
    quan tâm tương lai.
  - `2026-07-11-sqlite-migrations.md`: `PRAGMA user_version`, append-only → cơ sở cho kiểm tra tương thích schema.
  - `2026-07-13-embed-in-process-clarify.md` (059): `embeddingModelVersion` + reindex nền lúc boot → tự dựng lại
    `vectors/` nếu lệch version.
  - `2026-07-11-lancedb-integration.md` (011): vectors ở `userData/vectors/`, bảng `chunks`.
  - `2026-07-12-audio-player-clarify.md` (049) / video (051) / image (053): nguồn media **tham chiếu file gốc**
    theo đường dẫn, không copy → hành vi 404 + báo lỗi khi thiếu file gốc.
  - `2026-07-12-online-provider-clarify.md` (031): API key ở keychain (keytar), không nằm trên đĩa.
- `docs/03-ui/prototype.html` — màn Cài đặt (S5), section "Lưu trữ cục bộ" (icon hộp lưu trữ, `.sec` > `.sh` +
  `.sbody` > `.row`, nút `.btn.sm`, `.note` cho cảnh báo, thanh `.diskbar`). Nút Sao lưu/Khôi phục đặt vào
  section này, giữ văn phong tiếng Việt, ngắn gọn.
- Code hiện có (chỉ để mô tả điểm tích hợp, không phải thiết kế mới):
  - `src/renderer/features/app-shell/SettingsStorageSection.tsx` — section "Lưu trữ cục bộ" hiện chỉ đọc
    (đường dẫn, dung lượng đã dùng/còn trống qua `getStorageInfo`); sẽ thêm khối Sao lưu / Khôi phục.
  - `src/main/index.ts` — đã có `requestSingleInstanceLock`; `src/main/db/migrations.ts` — `SchemaVersionError`
    khi `user_version` > schema app; `startup-error.ts` xử lý lỗi này lúc boot.
- Figma: không dùng. Design token: không đổi so với theme hiện có.
- Glossary: đã tra `docs/00-glossary.md` — chưa có thuật ngữ backup/restore (xem mục thuật ngữ mới).

## Prompt for /speckit-specify

Thêm tính năng **sao lưu (backup) và khôi phục (restore) toàn bộ vault** cho InsightVault — ứng dụng desktop
Electron local-first — để người dùng không mất dữ liệu khi hỏng máy/xoá nhầm và có thể chuyển sang máy mới.
Giao diện đặt trong màn **Cài đặt → section "Lưu trữ cục bộ"** (đã có, hiện chỉ hiển thị thư mục dữ liệu và
dung lượng), thêm hai nút **"Sao lưu…"** và **"Khôi phục…"** theo văn phong/bố cục của prototype (S5). Chỉ làm
**thủ công** ở v1; sao lưu tự động định kỳ để pha sau. Không có cloud: toàn bộ chạy trên máy, KHÔNG network
egress.

**Nội dung bản sao lưu** = (1) ảnh chụp nhất quán (snapshot) của cơ sở dữ liệu SQLite `insightvault.db` (không
copy thô file đang mở kèm `-wal`/`-shm`; dùng cơ chế snapshot nhất quán, ví dụ `VACUUM INTO`), (2) thư mục kho
vector `vectors/` (LanceDB), (3) cấu hình `config.json` (model đã chọn, cấu hình online, cờ onboarding,
`embeddingModelVersion`). Nhờ có vectors, sau khôi phục dùng được ngay, không phải embed lại. **KHÔNG gồm**:
file gốc của nguồn (media âm thanh/video/ảnh tham chiếu đường dẫn gốc), thư mục `models/` (tải lại được), `tmp/`,
API key online (nằm ở keychain OS — người dùng nhập lại nếu sang máy mới), localStorage của renderer (độ rộng
cột, notebook gần nhất). Bản sao lưu là **1 file đơn** (đề xuất đuôi `.ivbackup`: lưu trữ + manifest); thư viện
archive và định dạng container do plan quyết, ưu tiên thư viện phổ biến, crypto dùng `node:crypto` built-in.
**Manifest** gồm: phiên bản app, `schemaVersion` (`user_version`), `embeddingModelVersion`, thời điểm tạo, cờ mã
hoá, số notebook/số nguồn — để hiển thị cho người dùng trước khi xác nhận khôi phục.

**Khôi phục** = **thay TOÀN BỘ vault hiện tại** bằng nội dung bản sao lưu (KHÔNG gộp notebook — để pha sau).
Luồng: người dùng chọn file → hệ thống kiểm tra toàn vẹn + tương thích và hiện manifest tóm tắt → hộp thoại
xác nhận nêu rõ **ghi đè toàn bộ vault hiện tại** → app **tự sao lưu vault hiện tại trước** (đường lùi, lưu ở
`<userData>/backups/`, không mã hoá, giữ N bản gần nhất — plan chốt N) → **dàn dựng (stage)** nội dung bản sao
lưu → **khởi động lại app** → ở lần khởi động kế, **hoán đổi file TRƯỚC khi mở DB/LanceDB** (vì kiến trúc hiện
tại không đóng/mở lại DB lúc chạy nên không hoán đổi nóng) → chạy migration như thường. Nếu hoán đổi thất bại
giữa chừng → **rollback về vault cũ**, không để vault nửa vời, và báo lỗi rõ.

**Mã hoá tuỳ chọn bằng mật khẩu.** Khi sao lưu, người dùng có thể đặt mật khẩu → file mã hoá AES-256, khoá dẫn
xuất từ mật khẩu bằng KDF chậm có salt. Phải nhập mật khẩu 2 lần để xác nhận; UI cảnh báo rõ **quên mật khẩu =
mất bản sao lưu** (không có cơ chế khôi phục mật khẩu). Mật khẩu không được lưu và không được ghi log. Nếu
không đặt mật khẩu, UI cảnh báo file chứa toàn bộ nội dung tài liệu ở dạng đọc được. Khi khôi phục file mã hoá
→ hỏi mật khẩu; **xác thực toàn vẹn trước khi hoán đổi**: sai mật khẩu hoặc file bị sửa/hỏng → báo lỗi rõ và
KHÔNG đụng vào vault hiện tại.

**Tương thích phiên bản.** Bản sao lưu có `schemaVersion` mới hơn app đang chạy → **từ chối** (kèm thông báo
cần cập nhật app), không để boot ra `SchemaVersionError`. Schema cũ hơn → migration tự nâng khi mở. Nếu
`embeddingModelVersion` khác bản hiện tại → cơ chế reindex nền lúc boot đã có (059) tự dựng lại `vectors/` từ
chunk.

**Khi đang có nguồn xử lý** (ingestion hoặc reindex đang chạy): chặn sao lưu/khôi phục cho tới khi xong (tránh
snapshot vectors lệch DB) — hiển thị lý do rõ ràng; plan xác nhận.

**Ràng buộc từ Constitution (bất biến):**

- Principle I — Local-first: không network egress; không cloud; không phụ thuộc Internet.
- Principle III — Ranh giới bảo mật: mọi thao tác FS/crypto/snapshot ở **main process**; renderer chỉ gọi kênh
  IPC whitelisted qua preload; **hộp thoại chọn file lưu/mở do main mở** (renderer không truyền đường dẫn tuỳ ý
  để ghi/đọc); không log nội dung tài liệu hay mật khẩu; validate input ở boundary (kể cả đường dẫn/manifest
  trong file — chống path traversal khi giải nén).
- Principle II — Kiểm chứng được: khôi phục giữ nguyên chunk + locator → chip `[n]` vẫn trỏ đúng nguồn/vị trí.
- Principle IV — Test-first, coverage ≥80% (snapshot nhất quán, round-trip backup→restore, mã hoá/giải mã, rollback).

### User stories (ưu tiên)

**US1 — Sao lưu vault (P1).** Là người dùng, tôi muốn xuất toàn bộ vault ra 1 file để giữ an toàn / mang sang máy
khác.

Acceptance scenarios:

1. Given đang ở Cài đặt → Lưu trữ, When bấm "Sao lưu…", Then main mở hộp thoại lưu file (tên gợi ý có ngày giờ,
   đuôi `.ivbackup`) và hỏi tuỳ chọn đặt mật khẩu.
2. Given chọn vị trí lưu hợp lệ, When xác nhận, Then tạo 1 file chứa DB snapshot + vectors + config + manifest,
   hiện tiến trình và thông báo thành công (kích thước, vị trí); app vẫn dùng bình thường trong lúc sao lưu.
3. Given đang ghi file, When người dùng huỷ giữa chừng, Then file dở dang bị xoá, không để file hỏng.
4. Given không đặt mật khẩu, Then UI hiện cảnh báo file không mã hoá chứa nội dung tài liệu đọc được.
5. Given vault rỗng (chưa có notebook), Then vẫn sao lưu được (manifest 0 notebook / 0 nguồn).

**US2 — Khôi phục vault (P1).** Là người dùng, tôi muốn nạp lại bản sao lưu để lấy lại toàn bộ dữ liệu.

Acceptance scenarios:

1. Given bấm "Khôi phục…", When chọn file `.ivbackup` hợp lệ, Then hiện tóm tắt manifest (ngày tạo, số notebook/
   nguồn, phiên bản, có mã hoá không) và hộp thoại xác nhận nêu rõ ghi đè toàn bộ vault hiện tại.
2. Given xác nhận, Then app tự sao lưu vault hiện tại vào `<userData>/backups/`, dàn dựng bản cần khôi phục,
   khởi động lại, hoán đổi trước khi mở DB, rồi vào app với dữ liệu của bản sao lưu.
3. Given khôi phục xong, Then notebook/nguồn/chat history/studio hiển thị đủ; hỏi đáp có trích dẫn hoạt động
   ngay không phải embed lại; chip `[n]` mở đúng nguồn + highlight.
4. Given hoán đổi thất bại giữa chừng, Then rollback về vault cũ nguyên vẹn, báo lỗi rõ.
5. Given người dùng huỷ ở bước xác nhận, Then vault không thay đổi và không tạo bản sao lưu tự động.

**US3 — Mã hoá bản sao lưu bằng mật khẩu (P2).** Là người dùng quan tâm riêng tư, tôi muốn bảo vệ file sao lưu
bằng mật khẩu.

Acceptance scenarios:

1. Given chọn đặt mật khẩu, When nhập 2 lần khớp nhau, Then file được mã hoá (AES-256, KDF chậm có salt); 2 lần
   không khớp hoặc rỗng → không cho tiếp tục.
2. Given UI đặt mật khẩu, Then hiện cảnh báo rõ "quên mật khẩu = mất bản sao lưu".
3. Given khôi phục file mã hoá, When nhập đúng mật khẩu, Then tiếp tục luồng khôi phục như US2.
4. Given nhập sai mật khẩu, Then báo lỗi rõ, KHÔNG đụng vault hiện tại, cho nhập lại.

### Edge cases / error states

- **Sai mật khẩu** → lỗi rõ, vault giữ nguyên; không lộ thông tin phân biệt "sai mật khẩu" với "file hỏng" quá mức cần thiết (plan chốt thông điệp).
- **File hỏng / bị sửa (tamper) / không phải `.ivbackup` / manifest thiếu** → xác thực toàn vẹn thất bại, từ chối, vault giữ nguyên.
- **Schema bản sao lưu mới hơn app** → từ chối kèm hướng dẫn cập nhật app.
- **Schema cũ hơn** → chấp nhận; migration tự nâng khi mở.
- **`embeddingModelVersion` khác** → chấp nhận; reindex nền lúc boot dựng lại vectors.
- **Đang ingestion/reindex** → chặn sao lưu/khôi phục tới khi xong, nêu lý do.
- **Hết dung lượng đĩa** (lúc sao lưu, lúc stage, lúc tự sao lưu trước khi khôi phục) → dừng sớm, dọn file dở, báo
  lỗi; kiểm tra dung lượng trống trước khi bắt đầu nếu ước lượng được. Không được xoá/hỏng vault hiện tại.
- **Máy mới, thiếu file gốc media** → văn bản/trích dẫn/highlight vẫn dùng được (chạy từ chunk trong DB); phát
  audio/video, xem ảnh, "Thử lại" bị lỗi theo hành vi 404 + báo lỗi hiện có (049/051/053).
- **Máy mới, thiếu API key online** → người dùng nhập lại khoá (keychain không nằm trong bản sao lưu); provider online không tự bật.
- **Máy mới, thiếu `models/`** → tải lại theo cơ chế sẵn có (Whisper/e5/tesseract).
- **Khôi phục thất bại / app tắt đột ngột giữa lúc hoán đổi** → lần khởi động sau phát hiện trạng thái dở dang và
  rollback/hoàn tất an toàn; không bao giờ để vault nửa vời.
- **Ghi/đọc đường dẫn bất thường trong archive** (path traversal, symlink) → từ chối.
- **Người dùng huỷ** ở bất kỳ bước nào trước khi hoán đổi → không đổi vault.
- **Dọn dẹp `<userData>/backups/`** theo giữ N bản gần nhất; thất bại dọn không chặn luồng chính.

## Open questions for clarify

(Hầu hết đã chốt trong decisions; chỉ còn các điểm nhỏ để plan/clarify xác nhận.)

1. **Số bản tự sao lưu giữ lại N** ở `<userData>/backups/` (decisions để plan chốt) và có cho người dùng mở thư mục / xoá thủ công trong UI không?
2. **Chặn khi đang ingestion/reindex**: chặn cứng (nút disable + lý do) hay cho "chờ xong rồi tiếp tục"? (decisions: chặn, plan xác nhận.)
3. **Thông điệp lỗi sai mật khẩu vs file hỏng**: tách riêng hay gộp chung (AEAD thường không phân biệt được)?
4. **Hiện tiến trình** ở UI: thanh tiến trình % hay chỉ trạng thái "Đang sao lưu…" (kích thước vault có thể lớn)?

(Không nêu lại các mục đã chốt: nội dung bản sao lưu, thay toàn bộ + tự sao lưu trước, thủ công v1, mã hoá tuỳ chọn, chặn schema mới hơn.)

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md`. Đề xuất append (không sửa term cũ), cột 日本語 để `—`:

| 日本語 | Tiếng Việt                                              | English (dùng trong code)   | Ghi chú                                                                                         |
| ------ | ------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| —      | Sao lưu (xuất toàn bộ vault ra file)                    | backup (`createBackup`)     | Nút "Sao lưu…"; DB snapshot + vectors + config; chỉ thủ công v1 — 085                           |
| —      | Khôi phục (nạp bản sao lưu thay toàn bộ vault)          | restore (`restoreBackup`)   | Nút "Khôi phục…"; thay toàn bộ + tự sao lưu trước + khởi động lại hoán đổi — 085                |
| —      | Vault (toàn bộ dữ liệu cục bộ của app trong data dir)   | vault                       | `<userData>`: DB + vectors + config; không gồm file gốc/models/API key — 085                    |
| —      | Bản sao lưu (file `.ivbackup`)                          | backup file (`.ivbackup`)   | 1 file đơn: lưu trữ + manifest, mã hoá tuỳ chọn — 085                                           |
| —      | Bản kê (siêu dữ liệu bản sao lưu)                       | manifest (`BackupManifest`) | appVersion, schemaVersion, embeddingModelVersion, createdAt, encrypted, số notebook/nguồn — 085 |
| —      | Ảnh chụp nhất quán (của SQLite)                         | DB snapshot                 | `VACUUM INTO` thay vì copy file đang mở + WAL — 085                                             |
| —      | Mã hoá bản sao lưu bằng mật khẩu                        | backup encryption           | AES-256 + KDF chậm có salt (`node:crypto`); quên mật khẩu = mất bản sao lưu — 085               |
| —      | Mật khẩu sao lưu                                        | backup password             | Không lưu, không log, nhập 2 lần — 085                                                          |
| —      | Dàn dựng (đặt bản khôi phục vào chỗ chờ trước khi swap) | stage (`stageRestore`)      | Giải nén/xác thực vào thư mục tạm cạnh vault trước khi khởi động lại — 085                      |
| —      | Hoán đổi vault (lúc khởi động, trước khi mở DB)         | swap (`applyStagedRestore`) | Thay file vault bằng bản đã stage trước khi mở DB/LanceDB; lỗi → rollback — 085                 |
| —      | Bản tự sao lưu trước khi khôi phục                      | pre-restore backup          | Lưu `<userData>/backups/`, không mã hoá, giữ N bản gần nhất — 085                               |

## Suggested constitution amendments

Không đề xuất sửa constitution (bất kỳ sửa đổi nào phải qua PR riêng, rule 5). Feature chỉ áp dụng Principle I
và III. Có thể cân nhắc về sau (không bắt buộc ở 085): một dòng tường minh trong Principle III rằng "mọi thao tác
nhập/xuất file chứa dữ liệu người dùng (backup/restore/export) phải mở hộp thoại ở main, validate đường dẫn ở
main, và không ghi log nội dung/bí mật".
