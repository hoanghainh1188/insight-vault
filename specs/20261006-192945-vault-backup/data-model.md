# Data model — 085 vault-backup

**Không có migration SQLite mới.** Mọi thực thể dưới đây là file trên đĩa hoặc trạng thái in-memory ở main.

## BackupManifest (`manifest.json`, entry đầu trong tar)

| Field                   | Type                  | Ràng buộc                                                     |
| ----------------------- | --------------------- | ------------------------------------------------------------- |
| `formatVersion`         | number                | = 1 (khác ⇒ `unsupportedFormat`)                              |
| `appVersion`            | string                | phiên bản app tạo bản sao lưu (hiển thị)                      |
| `schemaVersion`         | number (int ≥ 1)      | `PRAGMA user_version` của snapshot; > app max ⇒ `newerSchema` |
| `embeddingModelVersion` | string \| null        | từ config; khác hiện tại ⇒ reindex nền sau khôi phục (059)    |
| `createdAt`             | string (ISO 8601 UTC) | thời điểm tạo                                                 |
| `encrypted`             | boolean               | khớp cờ header                                                |
| `notebookCount`         | number (int ≥ 0)      | `SELECT count(*) FROM notebook` trên snapshot                 |
| `sourceCount`           | number (int ≥ 0)      | `SELECT count(*) FROM source` trên snapshot                   |

Validate thủ công ở boundary (kiểu + phạm vi); field thừa bị bỏ qua; thiếu/sai kiểu ⇒ `notBackup`.

## BackupFile (`*.ivbackup`)

`header ‖ body ‖ trailer` — chi tiết byte ở [research R4](research.md#r4-container--mã-hoá).

- Nội dung tar (allowlist): `manifest.json`, `insightvault.db`, `config.json`, `vectors/**` (chỉ File/Directory).
- Header hở chỉ lộ: magic, formatVersion, cờ mã hoá (+ tham số KDF/salt/iv nếu mã hoá) — FR-021a.

## BackupOperationState (in-memory, main)

| Field       | Type                            | Ghi chú                                          |
| ----------- | ------------------------------- | ------------------------------------------------ |
| `running`   | `"backup" \| "restore" \| null` | 1 thao tác 1 lúc                                 |
| `vaultLock` | boolean                         | true trong pha snapshot & sau xác nhận khôi phục |

`VaultBackupState` (trả renderer): `{ busy: boolean; reason: "processing" \| "reindexing" \| "operation" \| null }`.

## PendingRestoreToken (in-memory, main)

`Map<token(uuid), { filePath; encrypted; stagingDir?; manifest? }>` — token chỉ sống trong phiên; xoá khi
cancel/confirm/lỗi; stagingDir bị xoá khi token huỷ.

## Thư mục trên đĩa (`<userData>/…`)

```text
backups/pre-restore-YYYYMMDD-HHmmss.ivbackup   # giữ 3 bản mới nhất (R8)
restore/
  staged/      # insightvault.db (đã migrate + quick_check), vectors/, config.json, manifest.json
  previous/    # vault cũ trong lúc hoán đổi (xoá khi xong)
  state.json   # RestoreState
  result.json  # RestoreResult (one-shot, đọc xong xoá)
tmp/backup-<uuid>/  # snapshot tạm của 1 lần sao lưu (xoá khi xong/lỗi)
```

## RestoreState (`restore/state.json`) — state machine

| Field             | Type                                  |
| ----------------- | ------------------------------------- |
| `phase`           | `"staged" \| "movingOut" \| "movingIn" \| "rollingBack"` |
| `backupCreatedAt` | string (ISO, từ manifest)             |
| `preRestorePath`  | string \| null (bản tự sao lưu)       |

```text
(confirm) ──► staged ──boot──► movingOut (A) ──► movingIn (B) ──► result{ok:true} ; dọn staged/previous/state
                                   │ lỗi A/B
                                   └──► rollback ──► result{ok:false, reason} ; dọn
lỗi A/B ⇒ ghi rollingBack{rollbackFrom} TRƯỚC khi rollback; crash ở bất kỳ pha ⇒ boot kế chạy tiếp pha đó (idempotent)
rollback cũng lỗi ⇒ NÉM (fatal startup dialog), giữ state — không bao giờ mở DB rỗng
state.json hỏng/không đọc được ⇒ coi như không có restore; nếu previous/ còn mà mục sống thiếu ⇒ rollback
```

## RestoreResult (`restore/result.json`, FR-016a)

`{ ok: true; backupCreatedAt: string; preRestorePath: string | null } | { ok: false; reason: "swapFailed" }`
