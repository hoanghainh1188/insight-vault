import {
  appendFileSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import type { LogFs } from "./log-file";

// 088 — adapter node:fs cho sink nhật ký (I/O thuần, logic xoay vòng nằm ở log-file.ts). Đồng bộ có chủ đích:
// log thưa, và dòng lỗi cuối cùng phải xuống đĩa trước khi tiến trình thoát vì lỗi khởi động.
export function createNodeLogFs(): LogFs {
  return {
    // Chỉ chủ tài khoản đọc được (0700/0600) — nhất quán thư mục sao lưu (085).
    mkdir: (dir) => void mkdirSync(dir, { recursive: true, mode: 0o700 }),
    size: (path) => statSync(path, { throwIfNoEntry: false })?.size ?? 0,
    append: (path, data) =>
      appendFileSync(path, data, { encoding: "utf8", mode: 0o600 }),
    rename: (from, to) => {
      if (statSync(from, { throwIfNoEntry: false })) renameSync(from, to);
    },
    remove: (path) => rmSync(path, { force: true }),
  };
}
