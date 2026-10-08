import { describe, it, expect } from "vitest";
import { formatBytes } from "../../src/renderer/shared/format-bytes";

// 037; 123: uỷ cho formatBytes dùng chung — vi dùng dấu phẩy thập phân, en dấu chấm.
describe("formatBytes (037)", () => {
  it("0 / âm / không hợp lệ → '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(Infinity)).toBe("0 B");
  });

  it("byte / KB / MB / GB (mặc định vi)", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("≥100 trong đơn vị → không thập phân", () => {
    expect(formatBytes(150 * 1024 * 1024)).toBe("150 MB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2,5 GB");
  });

  it("en → dấu chấm thập phân", () => {
    expect(formatBytes(1536, "en")).toBe("1.5 KB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024, "en")).toBe("2.5 GB");
  });
});
