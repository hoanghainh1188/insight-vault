import { join } from "node:path";

// 093 — phát hiện phiên trước kết thúc bất thường (crash/bị buộc dừng): tạo tệp đánh dấu lúc khởi động, xoá khi
// thoát sạch. Còn sót lúc khởi động ⇒ lần trước không thoát sạch. Lỗi fs không được làm hỏng khởi động.

export interface MarkerFs {
  exists(path: string): boolean;
  write(path: string): void;
  remove(path: string): void;
}

export interface SessionMarker {
  /** Trả true nếu phiên trước kết thúc bất thường; đồng thời đánh dấu phiên này đang mở. */
  begin(): boolean;
  /** Gọi khi thoát sạch. */
  end(): void;
}

export const MARKER_FILE = ".session-open";

export function createSessionMarker({
  dir,
  fs,
}: {
  dir: string;
  fs: MarkerFs;
}): SessionMarker {
  const path = join(dir, MARKER_FILE);
  return {
    begin() {
      let abnormal = false;
      try {
        abnormal = fs.exists(path);
      } catch {
        abnormal = false;
      }
      try {
        fs.write(path);
      } catch {
        /* không ghi được ⇒ lần sau không phát hiện được; không chặn khởi động */
      }
      return abnormal;
    },
    end() {
      try {
        fs.remove(path);
      } catch {
        /* thoát tiếp — lần sau có thể báo nhầm "bất thường" 1 lần, chấp nhận được */
      }
    },
  };
}
