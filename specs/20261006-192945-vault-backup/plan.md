# Implementation Plan: Sao lưu / khôi phục vault

**Branch**: `085-vault-backup` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/20261006-192945-vault-backup/spec.md`

## Summary

Thêm "Sao lưu…" / "Khôi phục…" vào Cài đặt → Lưu trữ cục bộ. Sao lưu = snapshot SQLite (`VACUUM INTO`) + copy
`vectors/` + `config.json` (từ electron-store) + `manifest.json` → `tar.gz` → (tuỳ chọn) AES-256-GCM với khoá scrypt
→ 1 file `.ivbackup` (header hở + body + trailer tag/SHA-256). Khôi phục = chọn file → giải mã + giải nén vào
`<userData>/restore/staged/` (allowlist, reject cả file khi lỗi) → mở DB staged chạy migration + `quick_check` →
hiện tóm tắt → xác nhận → tự sao lưu vault hiện tại vào `backups/` (giữ 3) → `state.json` → relaunch → lúc boot
(trước Store/DB) hoán đổi bằng state machine idempotent có rollback → thông báo kết quả lần mở đầu. De-risk bằng
spike thật (xem [research.md](research.md)).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Electron 43 (Node 24 ở main)

**Primary Dependencies**: thêm `tar@^7` (pure JS). Crypto/gzip/sqlite dùng built-in `node:crypto`, `node:zlib` (qua
tar), `node:sqlite`. Không thêm native module.

**Storage**: file trên đĩa trong `userData` (`backups/`, `restore/`, `tmp/`); **không migration SQLite**.

**Testing**: vitest (unit, node env, tmp dir thật cho fs/sqlite/tar), Playwright `_electron` e2e (`IV_EMBED_FAKE` +
`IV_E2E_DIALOG_PATH` gác `!app.isPackaged`).

**Target Platform**: macOS (arm64) + Windows (x64) desktop.

**Project Type**: desktop-app (Electron main / preload / renderer).

**Performance Goals**: vault 500 MB sao lưu < 2 phút (SC-001); UI không treo (I/O stream, async).

**Constraints**: offline, không egress; FS/crypto chỉ ở main; RAM không tỉ lệ kích thước vault (stream); scrypt
`maxmem` 256 MB.

**Scale/Scope**: 1 người dùng, vault tới vài GB; 1 thao tác sao lưu/khôi phục tại một thời điểm.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                     | Đánh giá                                                                                                                                                                                                | Kết quả |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I. Local-first, no egress      | Toàn bộ chạy cục bộ; không gọi mạng; không telemetry. Không chạm privacy indicator.                                                                                                                     | PASS    |
| II. Verifiable citations       | Khôi phục bê nguyên `chunk` (locator `page/char/t/bbox`) + vectors ⇒ chip `[n]` không đổi. Không tái tạo locator.                                                                                       | PASS    |
| III. Security boundary         | FS/crypto/dialog ở main; renderer chỉ qua 8 kênh whitelisted; không truyền path; token thay path; mật khẩu không log/lưu; API key (keytar) không vào bản sao lưu; allowlist + reject traversal/symlink. | PASS    |
| IV. Test-first & coverage ≥80% | Logic thuần tách module có DI (container, manifest, swap state machine, retention, service) + test tmp-dir thật; composition root/dialog adapter loại khỏi coverage như tiền lệ.                        | PASS    |
| V. Phased delivery             | Pha 1+2 đã xong; tính năng hạ tầng dữ liệu, không nhảy pha.                                                                                                                                             | PASS    |
| ADR stack                      | Thêm 1 dep pure JS (`tar`) — không đổi stack nền; ghi trong research R3.                                                                                                                                | PASS    |
| Terminology                    | Thuật ngữ mới (sao lưu, khôi phục, bản sao lưu, manifest, …) append glossary trước khi đặt tên (task T001).                                                                                             | PASS    |

**Re-check sau Phase 1**: PASS — thiết kế không thêm kênh ngoài 8 kênh đã liệt kê, không migration, không egress.

## Project Structure

### Documentation (this feature)

```text
specs/20261006-192945-vault-backup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ipc-vault-backup.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/main/services/vault-backup/
├── container.ts        # header encode/parse, hằng số MAGIC/FORMAT/KDF, deriveKey (scrypt)
├── manifest.ts         # build + validate BackupManifest (thuần)
├── archive.ts          # packToFile(srcDir, out, password?) / unpackToDir(file, password?, dest) — stream tar+gzip+GCM/SHA-256, allowlist
├── snapshot.ts         # createSnapshot({db, dataDir, config, dest}) — VACUUM INTO + cp vectors + config.json + manifest
├── retention.ts        # pruneBackups(dir, keep=3)
├── restore-swap.ts     # applyPendingRestore(dataDir, fs?) — state machine boot-time + rollback; read/consume result.json
├── prepare.ts          # prepareStaged(stagingDir, appMaxSchema) — openDatabase+runMigrations+quick_check, đếm notebook/source
├── vault-lock.ts       # lock + busy state
├── backup-service.ts   # điều phối create / pick / prepare / confirm / cancel; DI dialog, relaunch, emit progress
└── dialogs.ts          # adapter dialog Electron + IV_E2E_DIALOG_PATH (loại khỏi coverage)

src/main/index.ts       # gọi applyPendingRestore ngay sau ensureDataDir; dựng backupService; truyền vào registerIpc
src/main/ipc/register.ts# 8 kênh + chặn ghi khi vaultLock ở source add/retry/delete, notebook delete
src/shared/ipc/{channels,types}.ts
src/preload/index.ts    # backup/restore API + onBackupProgress

src/renderer/features/vault-backup/
├── VaultBackupPanel.tsx    # nút + trạng thái busy, gắn vào SettingsStorageSection
├── BackupDialog.tsx        # chọn có mật khẩu? nhập 2 lần + cảnh báo, tiến trình theo bước, kết quả
├── RestoreDialog.tsx       # nhập mật khẩu (nếu mã hoá), tóm tắt, xác nhận ghi đè, lỗi
├── RestoreResultNotice.tsx # thông báo lần mở đầu sau khôi phục (app:getRestoreResult)
├── password-rules.ts       # validatePassword (thuần, test)
└── messages.ts             # map VaultBackupErrorCode → câu tiếng Việt (thuần, test)

tests/unit/vault-backup-*.test.ts
tests/e2e/vault-backup.spec.ts
```

**Structure Decision**: cô lập theo feature (`services/vault-backup` + `features/vault-backup`); chỉ chạm vùng dùng
chung ở `shared/ipc`, `preload`, `ipc/register.ts`, `main/index.ts` (boot hook) và `SettingsStorageSection.tsx`
(gắn panel) — commit nhỏ, tách riêng.

## Complexity Tracking

Không có vi phạm constitution cần biện minh.
