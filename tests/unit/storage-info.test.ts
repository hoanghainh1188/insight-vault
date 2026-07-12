import { describe, it, expect } from "vitest";
import {
  dirSize,
  computeStorageInfo,
  type FsOps,
  type DirEntryLike,
} from "../../src/main/services/app-shell/storage-info";

// Cây thư mục giả: root có file a(100) + thư mục sub chứa b(200) + c(50).
function entry(name: string, dir: boolean): DirEntryLike {
  return { name, isDirectory: () => dir, isFile: () => !dir };
}
function fakeFs(overrides: Partial<FsOps> = {}): FsOps {
  const tree: Record<string, DirEntryLike[]> = {
    "/data": [entry("a.bin", false), entry("sub", true)],
    "/data/sub": [entry("b.bin", false), entry("c.bin", false)],
  };
  const sizes: Record<string, number> = {
    "/data/a.bin": 100,
    "/data/sub/b.bin": 200,
    "/data/sub/c.bin": 50,
  };
  return {
    readdir: async (p) => tree[p] ?? [],
    stat: async (p) => ({ size: sizes[p] ?? 0 }),
    statfs: async () => ({ bsize: 4096, bavail: 1000 }),
    ...overrides,
  };
}

describe("dirSize (037)", () => {
  it("cộng đệ quy toàn bộ file", async () => {
    expect(await dirSize("/data", fakeFs())).toBe(350);
  });
  it("readdir lỗi → 0 (không ném)", async () => {
    const fs = fakeFs({
      readdir: async () => {
        throw new Error("EACCES");
      },
    });
    expect(await dirSize("/data", fs)).toBe(0);
  });
});

describe("computeStorageInfo (037)", () => {
  it("trả path + used (size) + free (bavail*bsize)", async () => {
    const info = await computeStorageInfo("/data", fakeFs());
    expect(info.path).toBe("/data");
    expect(info.usedBytes).toBe(350);
    expect(info.freeBytes).toBe(4096 * 1000);
  });
  it("statfs lỗi → freeBytes=0, vẫn có usedBytes", async () => {
    const fs = fakeFs({
      statfs: async () => {
        throw new Error("nope");
      },
    });
    const info = await computeStorageInfo("/data", fs);
    expect(info.usedBytes).toBe(350);
    expect(info.freeBytes).toBe(0);
  });
});
