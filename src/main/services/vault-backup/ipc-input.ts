import { MAX_PASSWORD_LEN } from "./constants";

// Validate payload IPC sao lưu/khôi phục ở boundary (085, Constitution III). Không bao giờ nhận path từ renderer
// — field lạ bị bỏ qua. Sai hình ⇒ null (handler trả ioError).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalPassword(v: unknown): string | undefined | null {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || v.length > MAX_PASSWORD_LEN) return null;
  return v;
}

export function parseBackupCreateInput(
  input: unknown,
): { password?: string } | null {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const password = optionalPassword((input as { password?: unknown }).password);
  if (password === null) return null;
  return password === undefined ? {} : { password };
}

export function parseRestoreTokenInput(
  input: unknown,
): { token: string; password?: string } | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const { token, password: rawPw } = input as {
    token?: unknown;
    password?: unknown;
  };
  if (typeof token !== "string" || !UUID_RE.test(token)) return null;
  const password = optionalPassword(rawPw);
  if (password === null) return null;
  return password === undefined ? { token } : { token, password };
}
