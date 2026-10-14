import { describe, it, expect } from "vitest";
import { spanAtTime } from "@shared/meeting/span-at-time";

// 186 PR C2 (R18) — câu đang phát theo thời gian player: span cuối cùng đã BẮT ĐẦU (≤ t). Tìm nhị phân. THUẦN.

const spans = [
  { tStart: 0, tEnd: 4 },
  { tStart: 4, tEnd: 9 },
  { tStart: 12, tEnd: 15 }, // khoảng lặng 9–12
  { tStart: 15, tEnd: 20 },
];

describe("spanAtTime", () => {
  it("trong một span ⇒ span đó (biên trái thuộc span)", () => {
    expect(spanAtTime(spans, 0)).toBe(0);
    expect(spanAtTime(spans, 3.9)).toBe(0);
    expect(spanAtTime(spans, 4)).toBe(1);
    expect(spanAtTime(spans, 13)).toBe(2);
  });

  it("giữa hai span (khoảng lặng) ⇒ giữ span trước", () => {
    expect(spanAtTime(spans, 10)).toBe(1);
  });

  it("trước span đầu ⇒ -1; sau span cuối ⇒ span cuối", () => {
    expect(spanAtTime([{ tStart: 2 }], 1)).toBe(-1);
    expect(spanAtTime(spans, 999)).toBe(3);
  });

  it("danh sách rỗng hoặc t không hữu hạn ⇒ -1", () => {
    expect(spanAtTime([], 5)).toBe(-1);
    expect(spanAtTime(spans, Number.NaN)).toBe(-1);
  });

  it("nhiều span (tìm nhị phân) khớp tìm tuyến tính", () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({
      tStart: i * 3,
      tEnd: i * 3 + 2,
    }));
    for (const t of [0, 1.5, 2.5, 1500, 2997, 5000]) {
      const linear = many.reduce((acc, s, i) => (s.tStart <= t ? i : acc), -1);
      expect(spanAtTime(many, t)).toBe(linear);
    }
  });
});
