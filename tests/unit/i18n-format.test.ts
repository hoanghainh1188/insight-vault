import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  isoDate,
} from "../../src/shared/i18n/format";
import { createTranslator } from "../../src/shared/i18n/translate";

// 123 (FR-023, US5): định dạng theo ngôn ngữ; bucket thời gian tương đối giữ hành vi vi hiện có (relative-time 009).

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 8, 14, 5).getTime();

describe("formatDateTime", () => {
  it("vi-VN / en-US medium + short", () => {
    const at = new Date(2026, 9, 8, 14, 5).getTime();
    expect(formatDateTime(at, "vi")).toBe(
      new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(at),
    );
    expect(formatDateTime(at, "en")).toBe("Oct 8, 2026, 2:05 PM");
  });
});

describe("formatNumber / formatBytes", () => {
  it("dấu thập phân theo ngôn ngữ", () => {
    expect(formatNumber(1536.5, "vi")).toBe("1.536,5");
    expect(formatNumber(1536.5, "en")).toBe("1,536.5");
  });

  it("formatBytes", () => {
    expect(formatBytes(0, "en")).toBe("0 B");
    expect(formatBytes(-5, "vi")).toBe("0 B");
    expect(formatBytes(1023, "en")).toBe("1023 B");
    expect(formatBytes(1536, "en")).toBe("1.5 KB");
    expect(formatBytes(1536, "vi")).toBe("1,5 KB");
    expect(formatBytes(1024 * 1024 * 150, "en")).toBe("150 MB");
    expect(formatBytes(1024 ** 3, "vi")).toBe("1 GB");
  });
});

describe("isoDate", () => {
  it("yyyy-mm-dd theo giờ địa phương, không theo ngôn ngữ", () => {
    expect(isoDate(new Date(2026, 0, 5, 23, 59).getTime())).toBe("2026-01-05");
  });
});

describe("formatRelativeTime", () => {
  const vi = createTranslator("vi");
  const en = createTranslator("en");

  it("vi giữ đúng các bucket cũ", () => {
    expect(formatRelativeTime(NOW + 5000, NOW, vi)).toBe("vừa xong");
    expect(formatRelativeTime(NOW - 30_000, NOW, vi)).toBe("vừa xong");
    expect(formatRelativeTime(NOW - 3 * MIN, NOW, vi)).toBe("3 phút trước");
    expect(formatRelativeTime(NOW - 2 * HOUR, NOW, vi)).toBe("2 giờ trước");
    expect(formatRelativeTime(NOW - 30 * HOUR, NOW, vi)).toBe("hôm qua");
    expect(formatRelativeTime(NOW - 3 * DAY, NOW, vi)).toBe("3 ngày trước");
    expect(formatRelativeTime(NOW - 10 * DAY, NOW, vi)).toBe("tuần trước");
    expect(formatRelativeTime(new Date(2026, 1, 3).getTime(), NOW, vi)).toBe(
      "03/02/2026",
    );
  });

  it("en", () => {
    expect(formatRelativeTime(NOW - 30_000, NOW, en)).toBe("just now");
    expect(formatRelativeTime(NOW - 1 * MIN, NOW, en)).toBe("1 minute ago");
    expect(formatRelativeTime(NOW - 3 * MIN, NOW, en)).toBe("3 minutes ago");
    expect(formatRelativeTime(NOW - 1 * HOUR, NOW, en)).toBe("1 hour ago");
    expect(formatRelativeTime(NOW - 30 * HOUR, NOW, en)).toBe("yesterday");
    expect(formatRelativeTime(NOW - 3 * DAY, NOW, en)).toBe("3 days ago");
    expect(formatRelativeTime(NOW - 10 * DAY, NOW, en)).toBe("last week");
    expect(formatRelativeTime(new Date(2026, 1, 3).getTime(), NOW, en)).toBe(
      "2/3/2026",
    );
  });
});
