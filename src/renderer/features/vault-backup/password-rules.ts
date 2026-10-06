// Luật mật khẩu sao lưu (085, FR-018): tối thiểu 8 ký tự (đếm code point), nhập 2 lần khớp. Main validate lại.

export const MIN_BACKUP_PASSWORD_LEN = 8;

export type PasswordCheck =
  { ok: true } | { ok: false; reason: "tooShort" | "mismatch" };

export function validatePassword(
  password: string,
  confirm: string,
): PasswordCheck {
  if ([...password].length < MIN_BACKUP_PASSWORD_LEN) {
    return { ok: false, reason: "tooShort" };
  }
  if (password !== confirm) return { ok: false, reason: "mismatch" };
  return { ok: true };
}
