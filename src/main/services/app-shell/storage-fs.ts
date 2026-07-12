import { readdir, stat, statfs } from "node:fs/promises";
import type { FsOps } from "./storage-info";

// Wiring fs thật cho storage-info (037) — adapter I/O, tách khỏi logic thuần để loại khỏi coverage
// (pattern như ai-runtime/ingestion). Chỉ đọc kích thước, KHÔNG đọc nội dung file.
export function createFsOps(): FsOps {
  return {
    readdir: (p) => readdir(p, { withFileTypes: true }),
    stat: (p) => stat(p),
    statfs: (p) => statfs(p),
  };
}
