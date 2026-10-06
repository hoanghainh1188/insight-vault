import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { logFileNames } from "../app-log/log-file";
import type { MarkerFs } from "./session-marker";

// 093 — adapter node:fs (I/O thuần) cho báo lỗi: tệp đánh dấu phiên, đọc đuôi nhật ký, liệt kê minidump.

export function createNodeMarkerFs(): MarkerFs {
  return {
    exists: (p) => existsSync(p),
    write: (p) => writeFileSync(p, String(process.pid), { mode: 0o600 }),
    remove: (p) => rmSync(p, { force: true }),
  };
}

/** Đọc tối đa chừng này byte CUỐI mỗi tệp nhật ký (xoay vòng có thể lỗi ⇒ tệp lớn bất thường). */
const TAIL_BYTES = 256 * 1024;

/** Đuôi 1 tệp: chỉ tệp thường (không FIFO/symlink tới thiết bị); bỏ dòng đầu có thể bị cắt dở. */
function readTail(path: string): string[] {
  const st = lstatSync(path, { throwIfNoEntry: false });
  if (!st?.isFile()) return [];
  const len = Math.min(st.size, TAIL_BYTES);
  const buf = Buffer.alloc(len);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buf, 0, len, st.size - len);
  } finally {
    closeSync(fd);
  }
  const lines = buf.toString("utf8").split("\n");
  return st.size > len ? lines.slice(1) : lines;
}

/** Các dòng cuối của nhật ký (main.1.log rồi main.log — cũ trước, mới sau). */
export function readLogTail(logsDir: string, maxLines: number): string[] {
  const [current, previous] = logFileNames(logsDir, 2);
  return [...readTail(previous), ...readTail(current)].slice(-maxLines);
}

/** Minidump (*.dmp) trong thư mục crashDumps của Electron (Crashpad lưu ở thư mục con). */
export function listCrashDumps(dir: string): { mtimeMs: number }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".dmp"))
    .flatMap((name) => {
      // Dump có thể bị xoá giữa readdir và stat — bỏ riêng tệp đó, không làm mất cả danh sách.
      const st = statSync(join(dir, name), { throwIfNoEntry: false });
      return st ? [{ mtimeMs: st.mtimeMs }] : [];
    });
}

/** Thư mục minidump chỉ chủ tài khoản đọc được — dump chứa bộ nhớ tiến trình (có thể có nội dung tài liệu). */
export function restrictDumpDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") chmodSync(dir, 0o700);
}
