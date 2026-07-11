import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "../../src/renderer/features/notebooks/relative-time";

const NOW = 1_700_000_000_000;
const rel = (agoMs: number) => formatRelativeTime(NOW - agoMs, NOW);

describe("formatRelativeTime", () => {
  it("dưới 1 phút → vừa xong", () => {
    expect(rel(0)).toBe("vừa xong");
    expect(rel(30_000)).toBe("vừa xong");
  });
  it("phút / giờ", () => {
    expect(rel(5 * 60_000)).toBe("5 phút trước");
    expect(rel(2 * 3_600_000)).toBe("2 giờ trước");
  });
  it("hôm qua / ngày trước", () => {
    expect(rel(30 * 3_600_000)).toBe("hôm qua");
    expect(rel(3 * 86_400_000)).toBe("3 ngày trước");
  });
  it("tuần trước", () => {
    expect(rel(9 * 86_400_000)).toBe("tuần trước");
  });
  it("cũ hơn ~2 tuần → DD/MM/YYYY", () => {
    const out = formatRelativeTime(NOW - 40 * 86_400_000, NOW);
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
  it("thời điểm tương lai (diff âm) → vừa xong", () => {
    expect(formatRelativeTime(NOW + 10_000, NOW)).toBe("vừa xong");
  });
});
