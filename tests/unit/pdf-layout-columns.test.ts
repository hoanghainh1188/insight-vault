import { describe, expect, it } from "vitest";
import { buildLines } from "../../src/main/services/ingestion/pdf-layout/lines";
import { orderRegions } from "../../src/main/services/ingestion/pdf-layout/columns";
import type { LayoutItem } from "../../src/main/services/ingestion/pdf-layout/types";
import { grid, item, lines } from "./helpers/layout-items";

// 112 (FR-003, research R3): thứ tự đọc nhiều cột (XY-cut), không nhận ra cột ⇒ trên→xuống.

const PAGE = { width: 600, height: 800 };
const order = (items: LayoutItem[]) =>
  orderRegions(buildLines(items).lines, PAGE).map((r) =>
    r.map((l) => l.segments.map((s) => s.text).join(" | ")),
  );
const flat = (items: LayoutItem[]) => order(items).flat();

const L = (n: number) => `Left column line number ${n} with enough words`;
const R = (n: number) => `Right column line number ${n} with enough word`;

describe("orderRegions", () => {
  it("một cột ⇒ một vùng, theo y", () => {
    expect(order(lines(50, 100, ["one", "two", "three"]))).toEqual([
      ["one", "two", "three"],
    ]);
  });

  it("hai cột ⇒ hết cột trái rồi cột phải; tiêu đề trải trang ở trên, chân trang ở dưới", () => {
    const items = [
      item(
        "A Two Column Article Title That Spans The Whole Page Width Here",
        50,
        50,
      ),
      ...lines(50, 90, [L(1), L(2), L(3), L(4)]),
      ...lines(320, 90, [R(1), R(2), R(3), R(4)]),
      item("Page 1", 280, 780),
    ];
    expect(flat(items)).toEqual([
      "A Two Column Article Title That Spans The Whole Page Width Here",
      L(1),
      L(2),
      L(3),
      L(4),
      R(1),
      R(2),
      R(3),
      R(4),
      "Page 1",
    ]);
  });

  it("ba cột ⇒ trái → giữa → phải", () => {
    const c = (k: string, n: number) => `${k} column text row ${n} filling it`;
    const items = [
      ...lines(40, 100, [c("A", 1), c("A", 2), c("A", 3)]),
      ...lines(225, 100, [c("B", 1), c("B", 2), c("B", 3)]),
      ...lines(410, 100, [c("C", 1), c("C", 2), c("C", 3)]),
    ];
    expect(flat(items)).toEqual([
      c("A", 1),
      c("A", 2),
      c("A", 3),
      c("B", 1),
      c("B", 2),
      c("B", 3),
      c("C", 1),
      c("C", 2),
      c("C", 3),
    ]);
  });

  it("khe hẹp (< 2% bề rộng trang) ⇒ không tách cột", () => {
    const left = "x".repeat(48); // 50..290
    const items = [
      ...lines(50, 100, [left, left, left]),
      ...lines(301, 100, [
        "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
        "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
        "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
      ]),
    ];
    const r = order(items);
    expect(r).toHaveLength(1);
    expect(r[0][0]).toContain("|");
  });

  it("nhiều dòng cắt ngang khe trong thân trang (> 10%) ⇒ không tách cột", () => {
    const wide =
      "Full width paragraph line that crosses the gutter for sure ok";
    const items = [
      ...lines(50, 100, [L(1), L(2)]),
      ...lines(320, 100, [R(1), R(2)]),
      item(wide, 50, 130),
      ...lines(50, 150, [L(3), L(4)]),
      ...lines(320, 150, [R(3), R(4)]),
    ];
    const f = flat(items);
    // không tách cột ⇒ đọc theo hàng (trái | phải trên cùng một dòng)
    expect(f[0]).toBe(`${L(1)} | ${R(1)}`);
  });

  it("cột ngắn kiểu bảng (segment hẹp) ⇒ không tách cột", () => {
    const items = grid(
      [
        ["Item", "Qty", "Price"],
        ["Apple", "3", "1.20"],
        ["Banana", "12", "0.50"],
      ],
      [50, 200, 350],
      100,
    );
    expect(order(items)).toEqual([
      ["Item | Qty | Price", "Apple | 3 | 1.20", "Banana | 12 | 0.50"],
    ]);
  });

  it("không có dòng ⇒ []", () => {
    expect(orderRegions([], PAGE)).toEqual([]);
  });
});
