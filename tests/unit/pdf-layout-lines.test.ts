import { describe, expect, it } from "vitest";
import { buildLines } from "../../src/main/services/ingestion/pdf-layout/lines";
import { item } from "./helpers/layout-items";

// 112 (FR-001, research R2): gom item cùng hàng thành dòng, tách segment theo khe lớn.

const texts = (r: ReturnType<typeof buildLines>) =>
  r.lines.map((l) => l.segments.map((s) => s.text));

describe("buildLines", () => {
  it("item cùng baseline ⇒ một dòng; khe > 0,15·h ⇒ đúng một dấu cách", () => {
    const r = buildLines([item("Hello", 50, 100), item("world", 78, 100)]);
    expect(texts(r)).toEqual([["Hello world"]]);
  });

  it("khe ≤ 0,15·h ⇒ nối liền; item đã có dấu cách ⇒ không chèn trùng", () => {
    expect(
      texts(buildLines([item("Hel", 50, 100), item("lo", 65, 100)])),
    ).toEqual([["Hello"]]);
    expect(
      texts(buildLines([item("Hello ", 50, 100), item("world", 84, 100)])),
    ).toEqual([["Hello world"]]);
  });

  it("khe > 1·h ⇒ segment riêng (ô/cột), giữ toạ độ", () => {
    const r = buildLines([item("Left", 50, 100), item("Right", 320, 100)]);
    expect(texts(r)).toEqual([["Left", "Right"]]);
    expect(r.lines[0].segments[1].x).toBe(320);
    expect(r.lines[0].segments[0].w).toBe(20);
  });

  it("sắp dòng theo y, trong dòng theo x (đầu vào xáo trộn)", () => {
    const r = buildLines([
      item("b2", 80, 112),
      item("a2", 80, 100),
      item("b1", 50, 112),
      item("a1", 50, 100),
    ]);
    expect(texts(r)).toEqual([
      ["a1", "a2"],
      ["b1", "b2"],
    ]);
  });

  it("chồng lấn dọc ≥ 50% ⇒ cùng dòng; < 50% ⇒ dòng khác; chỉ số trên nhỏ vẫn cùng dòng", () => {
    expect(
      buildLines([item("A", 50, 100), item("B", 80, 103)]).lines,
    ).toHaveLength(1);
    expect(
      buildLines([item("A", 50, 100), item("B", 80, 106)]).lines,
    ).toHaveLength(2);
    expect(
      buildLines([item("x", 50, 100), item("2", 56, 96, 6)]).lines,
    ).toHaveLength(1);
  });

  it("bỏ item rỗng/toàn khoảng trắng", () => {
    const r = buildLines([
      item("", 50, 100),
      item("   ", 60, 100),
      item("ok", 90, 100),
    ]);
    expect(texts(r)).toEqual([["ok"]]);
  });

  it("item xoay tách riêng, giữ thứ tự gốc", () => {
    const r = buildLines([
      item("body", 50, 100),
      item("SIDE", 560, 600, 10, true),
      item("NOTE", 560, 560, 10, true),
    ]);
    expect(texts(r)).toEqual([["body"]]);
    expect(r.rotated.map((i) => i.text)).toEqual(["SIDE", "NOTE"]);
  });

  it("dòng mang y (baseline) và h lớn nhất của dòng", () => {
    const r = buildLines([item("x", 50, 100), item("BIG", 60, 101, 12)]);
    expect(r.lines[0].h).toBe(12);
    expect(r.lines[0].y).toBe(101);
  });
});

describe("buildLines — item có chiều cao 0 (112 review)", () => {
  it("không chia cho 0 / NaN: vẫn gom được dòng", () => {
    const r = buildLines([item("a", 50, 100, 0), item("b", 80, 100, 10)]);
    expect(
      r.lines.flatMap((l) => l.segments.map((s) => s.text)).sort(),
    ).toEqual(["a", "b"]);
    for (const l of r.lines) expect(Number.isFinite(l.h)).toBe(true);
  });
});
