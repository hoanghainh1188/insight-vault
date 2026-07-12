import { join } from "node:path";
import type { StorageInfo } from "@shared/ipc/types";

// Tính thông tin lưu trữ cục bộ (037, Constitution I/III: chỉ đọc metadata kích thước, KHÔNG đọc nội dung
// file, KHÔNG egress). fs tiêm vào để unit-test không cần đĩa thật. dirSize/computeStorageInfo THUẦN.
// Wiring fs thật ở storage-fs.ts (loại khỏi coverage).

export interface DirEntryLike {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

export interface FsOps {
  readdir(p: string): Promise<DirEntryLike[]>;
  stat(p: string): Promise<{ size: number }>;
  statfs(p: string): Promise<{ bsize: number; bavail: number }>;
}

/** Tổng kích thước file (byte) trong cây thư mục. Lỗi đọc 1 nhánh → bỏ qua (không ném). */
export async function dirSize(
  root: string,
  fs: Pick<FsOps, "readdir" | "stat">,
): Promise<number> {
  let entries: DirEntryLike[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return 0;
  }
  let total = 0;
  for (const e of entries) {
    const p = join(root, e.name);
    if (e.isDirectory()) {
      total += await dirSize(p, fs);
    } else if (e.isFile()) {
      try {
        total += (await fs.stat(p)).size;
      } catch {
        // file biến mất giữa chừng / không đọc được → bỏ qua.
      }
    }
  }
  return total;
}

/** {path, usedBytes (size thư mục), freeBytes (trống của ổ)}. statfs lỗi → freeBytes=0. */
export async function computeStorageInfo(
  path: string,
  fs: FsOps,
): Promise<StorageInfo> {
  const usedBytes = await dirSize(path, fs);
  let freeBytes = 0;
  try {
    const s = await fs.statfs(path);
    freeBytes = s.bavail * s.bsize;
  } catch {
    freeBytes = 0;
  }
  return { path, usedBytes, freeBytes };
}
