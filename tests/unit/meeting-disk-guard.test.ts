import { describe, it, expect } from "vitest";
import {
  minutesRemaining,
  diskLevel,
  canStart,
} from "../../src/main/services/meeting-capture/disk-guard";

// 186 — cảnh báo đĩa theo phút ghi còn lại (A7, FR-040). Hàm thuần.

const MB = 1024 * 1024;
const PER_MIN = 1_920_000; // WAV 16 kHz mono PCM16

describe("minutesRemaining", () => {
  it("trừ dự phòng 2× dữ liệu đã ghi + 500 MB rồi chia tốc độ ghi", () => {
    const free = 500 * MB + 2 * 100 * MB + 60 * PER_MIN;
    expect(
      minutesRemaining({
        freeBytes: free,
        recordedBytes: 100 * MB,
        bytesPerMin: PER_MIN,
      }),
    ).toBe(60);
  });

  it("làm tròn xuống", () => {
    const free = 500 * MB + 10.9 * PER_MIN;
    expect(
      minutesRemaining({
        freeBytes: free,
        recordedBytes: 0,
        bytesPerMin: PER_MIN,
      }),
    ).toBe(10);
  });

  it("không đủ dự phòng ⇒ 0 (không âm)", () => {
    expect(
      minutesRemaining({
        freeBytes: 100 * MB,
        recordedBytes: 0,
        bytesPerMin: PER_MIN,
      }),
    ).toBe(0);
  });

  it("đầu vào không hợp lệ ⇒ 0", () => {
    expect(
      minutesRemaining({
        freeBytes: Number.NaN,
        recordedBytes: 0,
        bytesPerMin: PER_MIN,
      }),
    ).toBe(0);
    expect(
      minutesRemaining({ freeBytes: 1e12, recordedBytes: 0, bytesPerMin: 0 }),
    ).toBe(0);
  });
});

describe("diskLevel", () => {
  it.each([
    [120, "ok"],
    [30, "ok"],
    [29, "warn"],
    [5, "warn"],
    [4, "urgent"],
    [1, "urgent"],
    [0, "stop"],
  ] as const)("%d phút ⇒ %s", (m, level) => {
    expect(diskLevel(m)).toBe(level);
  });
});

describe("canStart", () => {
  it("cần ≥ 10 phút", () => {
    expect(canStart(10)).toBe(true);
    expect(canStart(9)).toBe(false);
  });
});
