import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

// Bản tự sao lưu trước khi khôi phục (085, R8): `<userData>/backups/pre-restore-YYYYMMDD-HHmmss.ivbackup`.

export const PRE_RESTORE_KEEP = 3;
const PRE_RESTORE_RE = /^pre-restore-\d{8}-\d{6}\.ivbackup$/;

const pad = (n: number): string => String(n).padStart(2, "0");

/** Tên file theo giờ địa phương — sắp xếp chuỗi = sắp xếp thời gian. */
export function preRestoreFileName(d: Date): string {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `pre-restore-${date}-${time}.ivbackup`;
}

/** Giữ `keep` bản mới nhất; bỏ qua file khác. KHÔNG ném (dọn thất bại không chặn luồng chính). */
export async function pruneBackups(
  dir: string,
  keep: number,
): Promise<{ removed: number }> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return { removed: 0 };
  }
  const old = names
    .filter((n) => PRE_RESTORE_RE.test(n))
    .sort()
    .reverse()
    .slice(keep);
  let removed = 0;
  for (const n of old) {
    try {
      await rm(join(dir, n), { force: true });
      removed += 1;
    } catch {
      // bỏ qua — lần sau dọn tiếp
    }
  }
  return { removed };
}
