import { describe, expect, it } from "vitest";
import { toLayoutItem } from "../../src/main/services/ingestion/parsers/pdf";

// 112 (review): adapter TextItem → LayoutItem — chỉ coi là chữ XOAY khi thành phần xoay đáng kể; chữ nghiêng (shear,
// chỉ c ≠ 0) và xoay rất nhỏ giữ là chữ thường (không bị đẩy xuống cuối trang).

const it_ = (transform: number[]) => ({
  str: "x",
  transform,
  width: 5,
  height: 10,
});

describe("toLayoutItem", () => {
  it("toạ độ gốc trên-trái theo đỉnh trang", () => {
    const li = toLayoutItem(it_([10, 0, 0, 10, 50, 700]), 800);
    expect(li).toMatchObject({ x: 50, y: 100, w: 5, h: 10, rotated: false });
  });

  it("xoay 90° ⇒ rotated", () => {
    expect(toLayoutItem(it_([0, 10, -10, 0, 50, 700]), 800).rotated).toBe(true);
  });

  it("chữ nghiêng (shear: chỉ c ≠ 0) ⇒ không phải xoay", () => {
    expect(toLayoutItem(it_([10, 0, 3, 10, 50, 700]), 800).rotated).toBe(false);
  });

  it("xoay rất nhỏ (≈ 5°) ⇒ coi như chữ thường", () => {
    const a = (5 * Math.PI) / 180;
    expect(
      toLayoutItem(
        it_([
          10 * Math.cos(a),
          10 * Math.sin(a),
          -10 * Math.sin(a),
          10 * Math.cos(a),
          50,
          700,
        ]),
        800,
      ).rotated,
    ).toBe(false);
  });

  it("height = 0 ⇒ lấy cỡ chữ từ ma trận", () => {
    expect(
      toLayoutItem({ ...it_([12, 0, 0, 12, 50, 700]), height: 0 }, 800).h,
    ).toBe(12);
  });
});
