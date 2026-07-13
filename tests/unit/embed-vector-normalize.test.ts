import { describe, it, expect } from "vitest";
import { l2normalize } from "../../src/main/services/embedding/vector-normalize";

const norm = (v: number[]): number =>
  Math.sqrt(v.reduce((s, x) => s + x * x, 0));

describe("l2normalize", () => {
  it("đưa ‖v‖₂ về 1", () => {
    const out = l2normalize([3, 4]);
    expect(norm(out)).toBeCloseTo(1, 10);
    expect(out[0]).toBeCloseTo(0.6, 10);
    expect(out[1]).toBeCloseTo(0.8, 10);
  });

  it("vector 0 giữ nguyên (không chia 0)", () => {
    expect(l2normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("vector rỗng giữ nguyên", () => {
    expect(l2normalize([])).toEqual([]);
  });

  it("không mutate input", () => {
    const input = [3, 4];
    l2normalize(input);
    expect(input).toEqual([3, 4]);
  });
});
