import { describe, it, expect, vi } from "vitest";
import { rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureDataDir } from "../../src/main/services/app-shell/data-dir";

describe("data-dir", () => {
  it("tạo thư mục thật → ready:true và thư mục tồn tại", async () => {
    const dir = join(tmpdir(), `iv-test-${process.pid}-${Date.now()}`);
    try {
      const res = await ensureDataDir(dir);
      expect(res.ready).toBe(true);
      expect(res.path).toBe(dir);
      expect((await stat(dir)).isDirectory()).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("mkdir lỗi → ready:false, không ném", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("EACCES"));
    const res = await ensureDataDir("/khong-tao-duoc", failing);
    expect(res.ready).toBe(false);
    expect(failing).toHaveBeenCalledOnce();
  });
});
