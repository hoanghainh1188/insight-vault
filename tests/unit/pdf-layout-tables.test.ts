import { describe, expect, it } from "vitest";
import { buildLines } from "../../src/main/services/ingestion/pdf-layout/lines";
import {
  detectTables,
  renderTable,
} from "../../src/main/services/ingestion/pdf-layout/tables";
import type { LayoutItem } from "../../src/main/services/ingestion/pdf-layout/types";
import { cleanText } from "../../src/main/services/ingestion/cleaning";
import { grid, item, lines } from "./helpers/layout-items";

// 112 (FR-004, FR-005, research R5–R6): nhận diện bảng theo căn cột (≥ 2 cột × 3 hàng), không chắc ⇒ văn bản thường;
// xuất bảng Markdown ở dạng cố định của cleanText.

const PAGE = { width: 600, height: 800 };
const XS = [50, 200, 350];
const kinds = (items: LayoutItem[]) =>
  detectTables(buildLines(items).lines, PAGE).map((s) =>
    s.kind === "table" ? { table: s.rows } : { text: s.lines.length },
  );

const ROWS = [
  ["Item", "Qty", "Price"],
  ["Apple", "3", "1.20"],
  ["Banana", "12", "0.50"],
];

describe("detectTables", () => {
  it("≥ 3 hàng × ≥ 2 ô thẳng hàng ⇒ bảng (ô thiếu ⇒ rỗng)", () => {
    expect(kinds(grid([...ROWS, ["Cherry", "", "9.99"]], XS, 100))).toEqual([
      { table: [...ROWS, ["Cherry", "", "9.99"]] },
    ]);
  });

  it("chỉ 2 hàng ⇒ không phải bảng", () => {
    expect(kinds(grid(ROWS.slice(0, 2), XS, 100))).toEqual([{ text: 2 }]);
  });

  it("mép trái lệch > 0,5·h ⇒ không phải bảng", () => {
    const items = [
      ...grid([ROWS[0]], XS, 100),
      ...grid([ROWS[1]], [50, 220, 350], 114),
      ...grid([ROWS[2]], [50, 180, 380], 128),
    ];
    expect(kinds(items).some((k) => "table" in k)).toBe(false);
  });

  it("mục lục có dấu chấm dẫn ⇒ không phải bảng", () => {
    const toc = [
      ["Chapter 1 ..........", "3"],
      ["Chapter 2 ..........", "9"],
      ["Chapter 3 ..........", "17"],
    ];
    expect(kinds(grid(toc, [50, 500], 100))).toEqual([{ text: 3 }]);
  });

  it("danh sách đầu dòng (dấu • tách riêng) ⇒ không phải bảng", () => {
    const list = [
      ["•", "First"],
      ["•", "Second"],
      ["•", "Third"],
    ];
    expect(kinds(grid(list, [50, 70], 100))).toEqual([{ text: 3 }]);
  });

  it("cột văn bản dài (segment rộng) ⇒ không phải bảng", () => {
    const L = "Left column text that is long enough to be prose";
    const R = "Right column text that is long enough to be prose";
    const items = [
      ...lines(50, 100, [L, L, L], 14),
      ...lines(320, 100, [R, R, R], 14),
    ];
    expect(kinds(items).some((k) => "table" in k)).toBe(false);
  });

  it("ô nhiều dòng (dòng tiếp sát hơn, ít ô hơn) ⇒ nối vào ô phía trên bằng dấu cách", () => {
    const items = [
      ...grid([ROWS[0], ROWS[1]], XS, 100),
      item("Banana", 50, 128),
      item("long", 200, 128),
      item("description", 200, 139),
      item("0.50", 350, 128),
      ...grid([["Kiwi", "1", "2.00"]], XS, 153),
    ];
    expect(kinds(items)).toEqual([
      {
        table: [
          ROWS[0],
          ROWS[1],
          ["Banana", "long description", "0.50"],
          ["Kiwi", "1", "2.00"],
        ],
      },
    ]);
  });

  it("văn bản trước/sau bảng giữ là đoạn văn, đúng thứ tự", () => {
    const items = [
      ...lines(50, 60, ["Intro paragraph."]),
      ...grid(ROWS, XS, 90),
      ...lines(50, 160, ["Closing paragraph."]),
    ];
    expect(kinds(items)).toEqual([{ text: 1 }, { table: ROWS }, { text: 1 }]);
  });
});

describe("renderTable", () => {
  it("hàng đầu + hàng phân cách; ô cách | đúng 1 dấu cách; ô rỗng `| |`", () => {
    expect(renderTable([...ROWS, ["Cherry", "", "9.99"]])).toBe(
      [
        "| Item | Qty | Price |",
        "|---|---|---|",
        "| Apple | 3 | 1.20 |",
        "| Banana | 12 | 0.50 |",
        "| Cherry | | 9.99 |",
      ].join("\n"),
    );
  });

  it("thoát `|` trong ô; gộp khoảng trắng/xuống dòng trong ô", () => {
    expect(
      renderTable([
        ["a|b", "x"],
        ["c  d", "e\nf"],
      ]),
    ).toBe(["| a\\|b | x |", "|---|---|", "| c d | e f |"].join("\n"));
  });

  it("dạng cố định của cleanText", () => {
    const t = renderTable([...ROWS, ["", "", ""], ["x", "", ""]]);
    expect(cleanText(t)).toBe(t);
  });
});
