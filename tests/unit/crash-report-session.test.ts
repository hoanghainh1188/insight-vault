import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  createSessionMarker,
  type MarkerFs,
} from "../../src/main/services/crash-report/session-marker";

// 093 — phát hiện phiên trước kết thúc bất thường: tệp đánh dấu tạo lúc khởi động, xoá khi thoát sạch.

function memFs(existing = false): MarkerFs & { has: () => boolean } {
  let present = existing;
  return {
    has: () => present,
    exists: () => present,
    write: () => void (present = true),
    remove: () => void (present = false),
  };
}

describe("createSessionMarker", () => {
  it("lần đầu (không có đánh dấu) ⇒ không bất thường; begin tạo đánh dấu, end xoá", () => {
    const fs = memFs(false);
    const m = createSessionMarker({ dir: "/logs", fs });
    expect(m.begin()).toBe(false);
    expect(fs.has()).toBe(true);
    m.end();
    expect(fs.has()).toBe(false);
  });

  it("đánh dấu còn sót từ phiên trước ⇒ bất thường", () => {
    const m = createSessionMarker({ dir: "/logs", fs: memFs(true) });
    expect(m.begin()).toBe(true);
  });

  it("lỗi fs ⇒ không ném, coi như không bất thường", () => {
    const fs: MarkerFs = {
      exists: () => {
        throw new Error("EACCES");
      },
      write: () => {
        throw new Error("EACCES");
      },
      remove: () => {
        throw new Error("EACCES");
      },
    };
    const m = createSessionMarker({ dir: "/logs", fs });
    expect(m.begin()).toBe(false);
    expect(() => m.end()).not.toThrow();
  });

  it("đường dẫn tệp đánh dấu nằm trong thư mục nhật ký", () => {
    const paths: string[] = [];
    const fs: MarkerFs = {
      exists: (p) => (paths.push(p), false),
      write: (p) => void paths.push(p),
      remove: (p) => void paths.push(p),
    };
    createSessionMarker({ dir: "/logs", fs }).begin();
    expect(paths.every((p) => p === join("/logs", ".session-open"))).toBe(true);
  });
});
