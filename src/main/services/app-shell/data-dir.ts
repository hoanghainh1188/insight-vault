import { mkdir } from "node:fs/promises";
import type { DataDirInfo } from "@shared/ipc/types";

// Đảm bảo thư mục dữ liệu cục bộ tồn tại (FR-011/012). Main truyền baseDir = app.getPath('userData')
// (chốt F1: docs/04-decisions/2026-07-11-data-dir-path.md). Nhận mkdir để inject được khi test.

type MkdirFn = (path: string, opts: { recursive: true }) => Promise<unknown>;

/**
 * Đảm bảo `dir` tồn tại. Trả DataDirInfo:
 * - ready:true nếu tạo/đã tồn tại
 * - ready:false nếu lỗi (main sẽ hiện dialog thân thiện, không để renderer tự xử FS)
 */
export async function ensureDataDir(
  dir: string,
  mkdirFn: MkdirFn = mkdir,
): Promise<DataDirInfo> {
  try {
    await mkdirFn(dir, { recursive: true });
    return { path: dir, ready: true };
  } catch {
    return { path: dir, ready: false };
  }
}
