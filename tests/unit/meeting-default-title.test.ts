import { describe, it, expect } from "vitest";
import { meetingTitleParts } from "../../src/renderer/features/meeting-capture/default-title";
import { formatDuration } from "../../src/shared/meeting/format-duration";

// 186 — tên mặc định "Cuộc họp 12/10, 14:30" (FR-002, D15) + định dạng thời lượng hh:mm:ss (FR-008). Hàm thuần.

describe("meetingTitleParts", () => {
  const d = new Date(2026, 9, 12, 14, 30, 5); // 12/10/2026 14:30 giờ máy

  it("vi-VN ⇒ ngày dd/MM, giờ HH:mm 24h", () => {
    expect(meetingTitleParts(d, "vi-VN")).toEqual({
      date: "12/10",
      time: "14:30",
    });
  });

  it("en-US ⇒ ngày MM/dd, giờ 24h", () => {
    expect(meetingTitleParts(d, "en-US")).toEqual({
      date: "10/12",
      time: "14:30",
    });
  });

  it("đệm 0 cho giờ/phút một chữ số", () => {
    expect(meetingTitleParts(new Date(2026, 0, 5, 9, 7), "vi-VN")).toEqual({
      date: "05/01",
      time: "09:07",
    });
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "00:00:00"],
    [7, "00:00:07"],
    [7.9, "00:00:07"],
    [6138, "01:42:18"],
    [36000, "10:00:00"],
    [360000, "100:00:00"],
  ])("%d giây ⇒ %s", (sec, out) => {
    expect(formatDuration(sec)).toBe(out);
  });

  it("âm / NaN ⇒ 00:00:00", () => {
    expect(formatDuration(-3)).toBe("00:00:00");
    expect(formatDuration(Number.NaN)).toBe("00:00:00");
  });
});
