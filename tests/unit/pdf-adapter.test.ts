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

// 147 (c): toDisplayItem — toạ độ / hướng chữ trong hệ HIỂN THỊ (ma trận viewport của pdf.js tiêm vào).
import { toDisplayItem } from "../../src/main/services/ingestion/parsers/pdf";

describe("toDisplayItem (147)", () => {
  const W = 600;
  const H = 800;
  // Ma trận viewport pdf.js (scale 1) cho trang [0 0 W H]: user (gốc dưới-trái) ⇒ hiển thị (gốc trên-trái, y xuống).
  const VP = {
    0: [1, 0, 0, -1, 0, H],
    90: [0, 1, 1, 0, 0, 0],
    180: [-1, 0, 0, 1, W, 0],
    270: [0, -1, -1, 0, H, W],
  } as const;

  it("trang thẳng ⇒ như toLayoutItem", () => {
    const item = it_([10, 0, 0, 10, 50, 700]);
    expect(toDisplayItem(item, [...VP[0]])).toMatchObject({
      x: 50,
      y: 100,
      rotated: false,
    });
  });

  it("chữ vẽ xoay 90° trên trang /Rotate 90 ⇒ hiển thị thẳng (không rotated)", () => {
    // chữ hướng +y người dùng tại (ux=100, uy=50) ⇒ hiển thị (50, 100) hướng +x
    const li = toDisplayItem(it_([0, 10, -10, 0, 100, 50]), [...VP[90]]);
    expect(li.rotated).toBe(false);
    expect(li.x).toBeCloseTo(50);
    expect(li.y).toBeCloseTo(100);
  });

  it("chữ thẳng trên trang /Rotate 90 ⇒ hiển thị dọc (rotated)", () => {
    expect(
      toDisplayItem(it_([10, 0, 0, 10, 100, 50]), [...VP[90]]).rotated,
    ).toBe(true);
  });

  it("chữ lộn ngược khi hiển thị (180°) ⇒ rotated (clarify #13)", () => {
    expect(
      toDisplayItem(it_([10, 0, 0, 10, 100, 50]), [...VP[180]]).rotated,
    ).toBe(true);
    expect(
      toDisplayItem(it_([-10, 0, 0, -10, 100, 50]), [...VP[180]]).rotated,
    ).toBe(false);
  });

  it("chiều cao lấy theo item, thiếu ⇒ theo ma trận", () => {
    const li = toDisplayItem({ ...it_([0, 12, -12, 0, 100, 50]), height: 0 }, [
      ...VP[90],
    ]);
    expect(li.h).toBeCloseTo(12);
  });
});
