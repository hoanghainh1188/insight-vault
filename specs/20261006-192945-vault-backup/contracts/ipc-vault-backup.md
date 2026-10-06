# IPC contract — 085 vault-backup

Thêm vào `src/shared/ipc/channels.ts` (CHANNELS + WHITELISTED_CHANNELS + ChannelResponse), types ở
`src/shared/ipc/types.ts`, bridge ở `src/preload/index.ts`, handler ở `src/main/ipc/register.ts` qua `safeHandle`.
Renderer **không bao giờ** gửi đường dẫn file; mật khẩu chỉ đi renderer → main, không log, không lưu.

## Kiểu chung

```ts
type VaultBackupErrorCode =
  | "busy" // đang xử lý nguồn / reindex / thao tác khác (FR-026)
  | "passwordTooShort" // < 8 ký tự (main validate lại)
  | "notBackup" // sai magic / manifest thiếu-sai (thông báo riêng)
  | "unsupportedFormat" // formatVersion lạ
  | "badPasswordOrCorrupt" // mọi lỗi giải mã / toàn vẹn / tar / entry ngoài allowlist (1 thông báo chung)
  | "passwordRequired" // file mã hoá mà không gửi mật khẩu
  | "newerSchema" // schema bản sao lưu > app (FR-011)
  | "diskFull" // ENOSPC
  | "tokenInvalid" // token hết hạn/không tồn tại
  | "ioError"; // còn lại (không kèm path/nội dung)

type VaultBackupState = {
  busy: boolean;
  reason: "processing" | "reindexing" | "operation" | null;
};
type VaultBackupStep = "snapshot" | "pack" | "decrypt" | "verify" | "preBackup";
type BackupSummary = {
  createdAt: string;
  appVersion: string;
  notebookCount: number;
  sourceCount: number;
  encrypted: boolean;
  needsReindex: boolean;
};
```

## Kênh

| Channel                     | Request                        | Response                                                                                          |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `backup:getState`           | —                              | `VaultBackupState`                                                                                |
| `backup:create`             | `{ password?: string }`        | `{ status:"ok"; fileName; sizeBytes; dir } \| { status:"cancelled" } \| { status:"error"; code }` |
| `backup:progress` _(event)_ | —                              | `{ op:"backup" \| "restore"; step: VaultBackupStep }`                                             |
| `restore:pick`              | —                              | `{ status:"ok"; token; encrypted } \| { status:"cancelled" } \| { status:"error"; code }`         |
| `restore:prepare`           | `{ token; password?: string }` | `{ status:"ok"; summary: BackupSummary } \| { status:"error"; code }`                             |
| `restore:confirm`           | `{ token }`                    | `{ status:"error"; code }` _(thành công ⇒ app relaunch, không trả về)_                            |
| `restore:cancel`            | `{ token }`                    | `{ ok: true }` (idempotent, dọn staging)                                                          |
| `app:getRestoreResult`      | —                              | `RestoreResult \| null` (one-shot: đọc rồi xoá)                                                   |

- `backup:create`: main kiểm busy → mở save dialog (tên gợi ý `InsightVault-YYYYMMDD-HHmm.ivbackup`) → snapshot
  (lock) → pack (+mã hoá) vào `<file>.part` → rename. `fileName`/`dir` chỉ để hiển thị cho người dùng (chính họ
  vừa chọn trong hộp thoại).
- `restore:prepare` lỗi `badPasswordOrCorrupt` với file mã hoá ⇒ token **vẫn sống** để nhập lại mật khẩu (US3-4);
  các lỗi khác ⇒ token bị huỷ.
- `restore:confirm`: tự sao lưu vault hiện tại (`preBackup`) → ghi `restore/state.json` phase `staged` →
  `app.relaunch(); app.exit(0)`.
- Validate boundary: `password` là string ≤ 1024 ký tự; `token` là UUID string; payload không đúng hình ⇒ `ioError`.

## Chặn ghi khi vault lock (R7)

Các kênh hiện có trả lỗi khi `vaultLock`: thêm nguồn (file/URL), thử lại nguồn, xoá nguồn, xoá notebook. Mã
lỗi theo kiểu lỗi sẵn có của từng kênh + nhãn "Đang sao lưu/khôi phục — thử lại sau giây lát".
