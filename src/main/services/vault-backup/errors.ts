import type { VaultBackupErrorCode } from "@shared/ipc/types";

/**
 * Lỗi nghiệp vụ sao lưu/khôi phục (085) mang MÃ an toàn để trả renderer. KHÔNG chứa path/nội dung/mật khẩu
 * (message cố định theo mã) — tầng IPC chỉ trả `code`.
 */
export class VaultBackupFailure extends Error {
  constructor(readonly code: VaultBackupErrorCode) {
    super(`vault-backup: ${code}`);
    this.name = "VaultBackupFailure";
  }
}

/** Mã của lỗi Node (`ENOSPC`…) nếu có — không đọc message (có thể chứa path). */
export function errnoCode(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e) {
    const c = (e as { code: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

/** SQLite "database or disk is full" (SQLITE_FULL = 13) từ node:sqlite — vd VACUUM INTO/migrate hết đĩa. */
export function isSqliteFull(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "errcode" in e &&
    ((e as { errcode: unknown }).errcode as number) % 256 === 13
  );
}

/**
 * Chuẩn hoá lỗi bất kỳ về VaultBackupFailure: giữ mã nếu đã là failure; hết dung lượng ⇒ `diskFull`;
 * còn lại ⇒ `fallback` (vd `ioError` khi ghi, `badPasswordOrCorrupt` khi giải mã/giải nén).
 */
export function toFailure(
  e: unknown,
  fallback: VaultBackupErrorCode,
): VaultBackupFailure {
  if (e instanceof VaultBackupFailure) return e;
  if (errnoCode(e) === "ENOSPC" || isSqliteFull(e)) {
    return new VaultBackupFailure("diskFull");
  }
  return new VaultBackupFailure(fallback);
}
