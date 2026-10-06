# Tasks: Sao lưu / khôi phục vault

**Input**: `specs/20261006-192945-vault-backup/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: BẮT BUỘC theo Constitution IV (TDD) — mỗi task test viết trước và phải FAIL trước khi implement.

**Format**: `- [ ] [ID] [P?] [Story?] Mô tả + đường dẫn`

## Phase 1: Setup

- [ ] T001 Append thuật ngữ mới vào `docs/00-glossary.md` (danh sách đề xuất ở `docs/intake/085-vault-backup.md`: sao lưu/backup, khôi phục/restore, vault, bản sao lưu/backup file, manifest, ảnh chụp CSDL/DB snapshot, mã hoá bản sao lưu, mật khẩu sao lưu, dàn dựng/stage, hoán đổi/swap, bản tự sao lưu trước khôi phục/pre-restore backup, khoá vault/vault lock) — chỉ APPEND, không sửa dòng cũ
- [ ] T002 Thêm dependency `tar@^7` vào `package.json` (`npm i tar@^7`), xác nhận electron-vite bundle được main (không cần asarUnpack — pure JS)
- [ ] T003 [P] Cập nhật `vitest.config.ts`: thêm `src/main/services/vault-backup/**/*.ts` + `src/renderer/features/vault-backup/{password-rules,messages}.ts` vào coverage include; exclude `src/main/services/vault-backup/dialogs.ts` (adapter Electron)

## Phase 2: Foundational (chặn mọi story)

- [ ] T004 [P] Thêm types vào `src/shared/ipc/types.ts` theo `contracts/ipc-vault-backup.md` (`VaultBackupErrorCode`, `VaultBackupState`, `VaultBackupStep`, `BackupSummary`, `RestoreResult`, response unions)
- [ ] T005 Thêm 8 kênh vào `src/shared/ipc/channels.ts` (CHANNELS + WHITELISTED_CHANNELS + ChannelResponse): `backup:getState`, `backup:create`, `backup:progress`, `restore:pick`, `restore:prepare`, `restore:confirm`, `restore:cancel`, `app:getRestoreResult`; cập nhật test whitelist hiện có (`tests/unit/*ipc-whitelist*.test.ts`) cho các kênh mới
- [ ] T006 [P] Test `tests/unit/vault-backup-container.test.ts`: encode/parse header hở (6 B) và mã hoá (38 B), sai magic ⇒ `notBackup`, formatVersion ≠ 1 ⇒ `unsupportedFormat`, file ngắn hơn header+trailer ⇒ `notBackup`, tham số KDF đọc lại đúng
- [ ] T007 [P] Implement `src/main/services/vault-backup/container.ts` (MAGIC `IVBK`, FORMAT_VERSION=1, flags, KDF scrypt log2N=17 r=8 p=1 maxmem 256MB, `encodeHeader`, `parseHeader`, `deriveKey`) cho T006 xanh
- [ ] T008 [P] Test `tests/unit/vault-backup-manifest.test.ts`: `buildManifest` từ snapshot DB (đếm notebook/source, user_version, embeddingModelVersion, createdAt ISO), `validateManifest` (thiếu field/sai kiểu ⇒ `notBackup`, formatVersion lạ ⇒ `unsupportedFormat`, bỏ qua field thừa)
- [ ] T009 [P] Implement `src/main/services/vault-backup/manifest.ts` cho T008 xanh
- [ ] T010 Test `tests/unit/vault-backup-archive.test.ts` (tmp dir thật, KHÔNG mật khẩu): round-trip `packToFile`→`unpackToDir` giữ nguyên byte DB/vectors/config/manifest; trailer SHA-256 sai (sửa 1 byte body hoặc header) ⇒ `badPasswordOrCorrupt` + dest bị xoá; tar chứa `../x`, symlink, entry ngoài allowlist ⇒ `badPasswordOrCorrupt` (reject cả file); lỗi ghi giữa chừng ⇒ không còn `<out>.part`
- [ ] T011 Implement `src/main/services/vault-backup/archive.ts` (stream `tar.c({gzip,portable})` → hash → `<out>.part` → rename; `tar.x({strict, filter allowlist, onwarn ⇒ reject})`; map lỗi về `VaultBackupErrorCode`, ENOSPC ⇒ `diskFull`) cho T010 xanh
- [ ] T012 [P] Test `tests/unit/vault-backup-snapshot.test.ts`: DB WAL đang mở + đang có ghi ⇒ snapshot đủ dòng, giữ user_version, không kéo `-wal/-shm`; copy `vectors/`; ghi `config.json` từ object (không copy file); manifest có đếm đúng; path có dấu `'` vẫn chạy
- [ ] T013 [P] Implement `src/main/services/vault-backup/snapshot.ts` (`VACUUM INTO` escape `'`, `fs.cp` vectors, config từ object, gọi `buildManifest`) cho T012 xanh
- [ ] T014 [P] Test `tests/unit/vault-backup-lock.test.ts`: busy khi có source `queued`/`processing`, khi reindex.inProgress, khi đang 1 thao tác; `awaiting_embedding` KHÔNG tính busy; lock acquire/release + `withLock`
- [ ] T015 [P] Implement `src/main/services/vault-backup/vault-lock.ts` cho T014 xanh

**Checkpoint**: lõi đóng gói/giải nén không mã hoá + snapshot + busy chạy bằng unit test.

## Phase 3: User Story 1 — Sao lưu vault ra 1 file (P1) 🎯 MVP

**Goal**: bấm "Sao lưu…" ⇒ 1 file `.ivbackup` (chưa mã hoá) với tiến trình theo bước.
**Independent Test**: có notebook + nguồn + chat ⇒ Sao lưu ⇒ file tồn tại, `unpackToDir` ra manifest đếm đúng; app vẫn dùng được.

- [ ] T016 [P] [US1] Test `tests/unit/vault-backup-service-backup.test.ts` (DI fake dialog/emit/fs tmp): busy ⇒ `busy` không mở dialog; huỷ dialog ⇒ `cancelled`; thành công ⇒ emit step `snapshot`→`pack`, trả `{fileName,sizeBytes,dir}`, dọn `tmp/backup-*`; lock giữ trong pha snapshot và nhả sau; lỗi pack ⇒ `ioError`/`diskFull`, không còn file đích/.part; spy `logEvent` ⇒ không bao giờ chứa mật khẩu hay đường dẫn file (FR-022/027)
- [ ] T017 [US1] Implement phần sao lưu của `src/main/services/vault-backup/backup-service.ts` (`getState`, `createBackup({password?})`, tên gợi ý `InsightVault-YYYYMMDD-HHmm.ivbackup`) cho T016 xanh
- [ ] T018 [P] [US1] Implement adapter `src/main/services/vault-backup/dialogs.ts` (`showSaveDialog`/`showOpenDialog` filter `.ivbackup` gắn `BrowserWindow.getFocusedWindow()`; `IV_E2E_DIALOG_PATH` chỉ khi `!app.isPackaged`)
- [ ] T019 [US1] Nối `src/main/index.ts`: dựng `backupService` (db, dataDir, store, sourceRepo, reindex status, emit `backup:progress` tới mọi cửa sổ) và truyền vào `registerIpc`
- [ ] T020 [US1] `src/main/ipc/register.ts`: handler `backup:getState`, `backup:create` (validate payload: password string ≤1024 hoặc undefined); chặn ghi khi `vaultLock` ở kênh thêm nguồn file/URL, thử lại, xoá nguồn, xoá notebook (trả lỗi sẵn có + nhãn "Đang sao lưu/khôi phục — thử lại sau giây lát"); thêm test lock vào test register hiện có nếu có
- [ ] T021 [US1] `src/preload/index.ts`: `backupGetState`, `backupCreate`, `onBackupProgress(cb)` (trả unsubscribe) — theo mẫu `onSourceProgress`
- [ ] T022 [P] [US1] Test `tests/unit/vault-backup-messages.test.ts` + implement `src/renderer/features/vault-backup/messages.ts` (map mã lỗi + bước → câu tiếng Việt; `badPasswordOrCorrupt` = "Sai mật khẩu hoặc file sao lưu bị hỏng"; `notBackup` = "Không phải file sao lưu InsightVault"; `busy` = "Đang xử lý nguồn…")
- [ ] T023 [US1] UI `src/renderer/features/vault-backup/VaultBackupPanel.tsx` + `BackupDialog.tsx` (nút Sao lưu…/Khôi phục…, disabled + lý do khi busy, cảnh báo không mã hoá, tiến trình theo bước, kết quả kích thước + vị trí) và gắn panel vào `src/renderer/features/app-shell/SettingsStorageSection.tsx`; style dùng token sẵn có (không hardcode màu), `aria-live="polite"` cho trạng thái tiến trình

**Checkpoint**: US1 dùng được độc lập (sao lưu không mã hoá).

## Phase 4: User Story 2 — Khôi phục vault (P1)

**Goal**: chọn file ⇒ tóm tắt ⇒ xác nhận ⇒ tự sao lưu bản hiện tại ⇒ relaunch ⇒ hoán đổi trước khi mở DB ⇒ thông báo kết quả.
**Independent Test**: sao lưu A → đổi vault → khôi phục ⇒ sau relaunch vault = A, chip `[n]` mở đúng; lỗi hoán đổi ⇒ vault cũ nguyên vẹn.

- [ ] T024 [P] [US2] Test `tests/unit/vault-backup-prepare.test.ts`: staged DB schema cũ hơn ⇒ được migrate lên max; schema > app ⇒ `newerSchema`; DB hỏng ⇒ `badPasswordOrCorrupt` (quick_check); trả `BackupSummary` (đếm, createdAt, appVersion, `needsReindex` khi embeddingModelVersion khác)
- [ ] T025 [P] [US2] Implement `src/main/services/vault-backup/prepare.ts` (dùng `openDatabase`+`runMigrations` hiện có, đóng DB sau) cho T024 xanh
- [ ] T026 [P] [US2] Test `tests/unit/vault-backup-retention.test.ts` + implement `src/main/services/vault-backup/retention.ts` (giữ 3 `pre-restore-*.ivbackup` mới nhất theo tên; bỏ qua file khác; lỗi xoá không ném)
- [ ] T027 [US2] Test `tests/unit/vault-backup-swap.test.ts` (tmp dir thật + fs DI để tiêm lỗi): không có `restore/` ⇒ no-op; `staged` ⇒ hoán đổi đủ mục (db, -wal, -shm, vectors, config) + `result{ok:true}` + dọn; lỗi ở bước A hoặc B ⇒ rollback, vault cũ nguyên byte, `result{ok:false}`; crash giả lập giữa A/B (phase=`swapping`, một phần đã chuyển) ⇒ lần chạy sau hoàn tất đúng; `state.json` hỏng ⇒ không phá vault; `consumeRestoreResult` đọc 1 lần rồi xoá
- [ ] T028 [US2] Implement `src/main/services/vault-backup/restore-swap.ts` (`applyPendingRestore(dataDir, fs?)`, `consumeRestoreResult(dataDir)`) cho T027 xanh
- [ ] T029 [US2] Test `tests/unit/vault-backup-service-restore.test.ts`: `pick` huỷ ⇒ `cancelled`; file không phải backup ⇒ `notBackup`; `prepare` OK ⇒ summary + staging ở `restore/staged`; `prepare` lỗi (≠ mật khẩu) ⇒ token huỷ + staging xoá; token lạ ⇒ `tokenInvalid`; `cancel` idempotent dọn staging; `confirm` ⇒ step `preBackup`, tạo `backups/pre-restore-*`, gọi retention, ghi `state.json{phase:staged}`, gọi `relaunch` DI; busy ⇒ `busy`; spy `logEvent` ⇒ không chứa mật khẩu/đường dẫn (FR-022/027)
- [ ] T030 [US2] Implement phần khôi phục trong `src/main/services/vault-backup/backup-service.ts` (`pickRestore`, `prepareRestore`, `confirmRestore`, `cancelRestore`, `getRestoreResult`) cho T029 xanh
- [ ] T031 [US2] `src/main/index.ts`: gọi `applyPendingRestore(dataDir.path)` ngay sau `ensureDataDir` và TRƯỚC `new Store()`/`openDatabase` (log sự kiện không kèm path/nội dung); relaunch DI = `app.relaunch(); app.exit(0)`
- [ ] T032 [US2] `src/main/ipc/register.ts` + `src/preload/index.ts`: kênh `restore:pick|prepare|confirm|cancel`, `app:getRestoreResult` (validate token UUID, password string ≤1024)
- [ ] T033 [US2] UI `src/renderer/features/vault-backup/RestoreDialog.tsx` (tóm tắt, cảnh báo ghi đè toàn bộ, xác nhận/huỷ, lỗi theo `messages.ts`, huỷ ⇒ `restore:cancel`) + `RestoreResultNotice.tsx` gắn ở app shell (gọi `app:getRestoreResult` 1 lần khi mở app)

**Checkpoint**: US1 + US2 = vòng sao lưu → khôi phục hoàn chỉnh (không mã hoá).

## Phase 5: User Story 3 — Mã hoá bằng mật khẩu (P2)

**Goal**: đặt mật khẩu khi sao lưu; khôi phục cần đúng mật khẩu; sai/sửa file bị từ chối trước khi đụng vault.
**Independent Test**: sao lưu có mật khẩu ⇒ file không chứa magic gzip/tar ở body; khôi phục sai mật khẩu ⇒ lỗi chung, cho nhập lại; đúng ⇒ thành công.

- [ ] T034 [P] [US3] Test `tests/unit/vault-backup-crypto.test.ts`: round-trip có mật khẩu; mật khẩu sai ⇒ `badPasswordOrCorrupt`; sửa 1 byte header (AAD) / giữa body / byte cuối ciphertext / tag ⇒ `badPasswordOrCorrupt`; body không lộ chuỗi `manifest.json` dạng rõ; file mã hoá mà không gửi mật khẩu ⇒ `passwordRequired`
- [ ] T035 [US3] Mở rộng `src/main/services/vault-backup/archive.ts`: nhánh AES-256-GCM (AAD=header, tag 16 B cuối, iv 12 B, salt 16 B ngẫu nhiên mỗi file) cho T034 xanh
- [ ] T036 [P] [US3] Test `tests/unit/vault-backup-password-rules.test.ts` + implement `src/renderer/features/vault-backup/password-rules.ts` (≥8 ký tự, 2 lần khớp; trả lý do)
- [ ] T037 [US3] `backup-service.ts`: validate mật khẩu ở main (`passwordTooShort`); `prepareRestore` lỗi mật khẩu với file mã hoá ⇒ GIỮ token để nhập lại; thêm test vào `tests/unit/vault-backup-service-restore.test.ts`
- [ ] T038 [US3] UI: `BackupDialog.tsx` thêm tuỳ chọn mật khẩu (2 ô, cảnh báo "quên mật khẩu = không mở được bản sao lưu", nút tiếp tục disabled khi chưa hợp lệ); `RestoreDialog.tsx` bước nhập mật khẩu khi `encrypted`, lỗi cho nhập lại. Ô mật khẩu `type=password`, `autocomplete="new-password"`, xoá state sau khi gửi

## Phase 6: Polish & Cross-Cutting

- [ ] T039 E2E `tests/e2e/vault-backup.spec.ts` (Playwright `_electron`, `IV_EMBED_FAKE`, `IV_E2E_DIALOG_PATH`): sao lưu có mật khẩu → xoá notebook → khôi phục sai mật khẩu (thấy lỗi) → đúng → relaunch (khởi chạy lại electron trên cùng userData) → notebook trở lại + thông báo khôi phục + hỏi/bấm chip `[n]` mở Source Viewer đúng nguồn có highlight (FR-016) + `config.json` sau hoán đổi mang `embeddingModelVersion` của bản sao lưu (FR-017); nút disabled khi đang xử lý nguồn
- [ ] T040 [P] Test no-egress: thêm kịch bản sao lưu/khôi phục vào `tests/e2e/no-egress.spec.ts` (hoặc assert trong T039) — 0 request mạng
- [ ] T041 [P] Ghi ADR/decision cập nhật nếu có thay đổi so với `docs/04-decisions/2026-10-06-vault-backup-clarify.md`; README mục tính năng (Sao lưu/khôi phục, lưu ý không gồm file gốc/API key)
- [ ] T042 Chạy gate: `npm run lint`, `npm test -- --coverage` (≥80% business logic), `npm run build`, e2e; verify thủ công theo `quickstart.md` trên bản build `out/` (relaunch thật) + đo thời gian sao lưu vault ~500 MB < 2 phút (SC-001)

## Dependencies & Execution Order

- Setup (T001–T003) → Foundational (T004–T015) → US1 (T016–T023) → US2 (T024–T033) → US3 (T034–T038) → Polish.
- US2 phụ thuộc US1 (dùng chung `backup-service` + pre-restore backup dùng luồng sao lưu). US3 phụ thuộc archive (T011) và UI US1/US2.
- Trong mỗi phase: test trước → implement; `[P]` = file khác nhau, không phụ thuộc task chưa xong.

## Parallel Examples

- Foundational: T006/T007 ∥ T008/T009 ∥ T012/T013 ∥ T014/T015 (4 module độc lập), rồi T010→T011.
- US1: T016 ∥ T018 ∥ T022; sau đó T017 → T019 → T020 → T021 → T023.
- US2: T024/T025 ∥ T026 ∥ T027→T028; rồi T029→T030 → T031/T032 → T033.

## Implementation Strategy

MVP = Phase 1–3 (sao lưu không mã hoá). Tăng dần: + US2 (vòng hoàn chỉnh) → + US3 (mã hoá). Commit nhỏ theo
phase; vùng dùng chung (`shared/ipc`, `preload`, `register.ts`, `index.ts`) tách commit riêng.
