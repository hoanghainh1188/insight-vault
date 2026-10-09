import { describe, expect, it } from "vitest";
import { buildLines } from "../../src/main/services/ingestion/pdf-layout/lines";
import {
  detectRightAlignedTable,
  detectTables,
  renderTable,
} from "../../src/main/services/ingestion/pdf-layout/tables";
import type { LayoutItem } from "../../src/main/services/ingestion/pdf-layout/types";
import { cleanText } from "../../src/main/services/ingestion/cleaning";
import { CW, grid, item, lines } from "./helpers/layout-items";

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

  it("147 (a): phần tiếp của ô dùng cùng quyết định gạch nối (ngắt thật ⇒ liền; tiếng Việt ⇒ giữ gạch)", () => {
    const items = [
      ...grid([ROWS[0], ROWS[1]], XS, 100),
      item("Banana", 50, 128),
      item("infor-", 200, 128),
      item("mation", 200, 139),
      item("0.50", 350, 128),
      item("Kiwi", 50, 153),
      item("hợp-", 200, 153),
      item("đồng", 200, 164),
      item("2.00", 350, 153),
    ];
    expect(kinds(items)).toEqual([
      {
        table: [
          ROWS[0],
          ROWS[1],
          ["Banana", "information", "0.50"],
          ["Kiwi", "hợp-đồng", "2.00"],
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

// 147 (b, research R5, clarify #1–#5): đường phụ cho bảng cột số căn phải / căn thập phân — chỉ chạy khi đường căn trái không nhận
// (hoặc nhận được ít dòng hơn); ngưỡng chống nhận nhầm; bảng căn trái hiện có giữ nguyên kết quả.

const right = (text: string, r: number, y: number) =>
  item(text, r - text.length * 10 * CW, y);
const decimal = (text: string, p: number, y: number) =>
  item(text, p - text.split(".")[0].length * 10 * CW, y);
/** hàng: nhãn tại x=50 + các ô số căn phải tại `rights` */
const rightRows = (rows: string[][], rights: number[], y0: number, step = 14) =>
  rows.flatMap((r, i) => [
    ...(r[0] === "" ? [] : [item(r[0], 50, y0 + i * step)]),
    ...r
      .slice(1)
      .flatMap((c, j) =>
        c === "" ? [] : [right(c, rights[j], y0 + i * step)],
      ),
  ]);

const FIN = [
  ["Revenue", "1,234.5", "1.100,0"],
  ["Cost of sales", "(456.7)", "(40.0)"],
  ["Gross profit", "777.8", "1,060.0"],
  ["Total", "1,555.6", "2,120.0"],
];
const RIGHTS = [300, 450];

describe("detectTables — bảng số căn phải (147 b)", () => {
  it("nhãn căn trái + 2 cột số căn phải (độ dài khác nhau) ⇒ bảng đúng ô", () => {
    const items = [
      item("Item", 50, 100),
      right("2025", RIGHTS[0], 100),
      right("2024", RIGHTS[1], 100),
      ...rightRows(FIN, RIGHTS, 114),
    ];
    expect(kinds(items)).toEqual([
      { table: [["Item", "2025", "2024"], ...FIN] },
    ]);
  });

  it("tiêu đề 2 dòng (dòng sau sát hơn, ít ô hơn) ⇒ gộp vào hàng tiêu đề; tiêu đề căn giữa gán theo chồng lấn", () => {
    const items = [
      item("Item", 50, 100),
      item("Fiscal", RIGHTS[0] - 32, 100),
      item("Fiscal", RIGHTS[1] - 32, 100),
      right("2025", RIGHTS[0], 111),
      right("2024", RIGHTS[1], 111),
      ...rightRows(FIN, RIGHTS, 125),
    ];
    expect(kinds(items)).toEqual([
      { table: [["Item", "Fiscal 2025", "Fiscal 2024"], ...FIN] },
    ]);
  });

  it("cột căn dấu thập phân (mép phải lệch) ⇒ bảng", () => {
    const rows = [
      ["A", "12.5", "0.25"],
      ["B", "3.25", "1.5"],
      ["C", "100.125", "12"],
      ["D", "7", "3.125"],
    ];
    const items = [
      item("Sample", 50, 86),
      item("Mass (g)", 280, 86),
      item("Ratio", 430, 86),
      ...rows.flatMap((r, i) => [
        item(r[0], 50, 100 + i * 14),
        decimal(r[1], 300, 100 + i * 14),
        decimal(r[2], 450, 100 + i * 14),
      ]),
    ];
    expect(kinds(items)).toEqual([
      { table: [["Sample", "Mass (g)", "Ratio"], ...rows] },
    ]);
  });

  it("1 cột số với ≥ 4 hàng (không tăng đơn điệu) ⇒ bảng; chỉ 3 hàng ⇒ không", () => {
    const rows = [
      ["North", "1,200"],
      ["South", "950"],
      ["East", "1,480"],
      ["West", "730"],
    ];
    expect(kinds(rightRows(rows, [400], 100))).toEqual([{ table: rows }]);
    expect(
      kinds(rightRows(rows.slice(0, 3), [400], 100)).some((k) => "table" in k),
    ).toBe(false);
  });

  it("mục lục không chấm dẫn (số trang nguyên tăng dần, căn phải) ⇒ không phải bảng — kể cả khi vài số trang thẳng mép trái", () => {
    const toc = [
      ["Introduction", "5"],
      ["Background", "18"],
      ["Methods", "42"],
      ["Results", "107"],
      ["Discussion", "236"],
    ];
    expect(kinds(rightRows(toc, [550], 100))).toEqual([{ text: 5 }]);
  });

  it("bảng 2 cột căn trái có cột số nguyên tăng dần (không phải mục lục) ⇒ vẫn là bảng như 112", () => {
    const counts = [
      ["Q1", "100"],
      ["Q2", "120"],
      ["Q3", "150"],
    ];
    expect(kinds(grid(counts, [50, 300], 100))).toEqual([{ table: counts }]);
    const pages = [
      ["Alpha", "5"],
      ["Beta", "18"],
      ["Gamma", "42"],
    ];
    expect(kinds(grid(pages, [50, 300], 100))).toEqual([{ table: pages }]);
  });

  it("mục lục có chấm dẫn vẫn bị loại ở đường phụ", () => {
    const toc = [
      ["Chapter 1 ..........", "5"],
      ["Chapter 2 ..........", "18"],
      ["Chapter 3 ..........", "42"],
      ["Chapter 4 ..........", "17"],
    ];
    expect(kinds(rightRows(toc, [550], 100)).some((k) => "table" in k)).toBe(
      false,
    );
  });

  it("chú thích ngay dưới bảng (không có số) ⇒ văn bản, không thành hàng bảng", () => {
    const items = [
      ...rightRows(FIN, RIGHTS, 100),
      item("Source: internal data", 50, 156),
    ];
    expect(kinds(items)).toEqual([{ table: FIN }, { text: 1 }]);
  });

  it("đường căn trái chỉ nhận 3 hàng đầu (số cùng độ dài) ⇒ đường phụ nhận cả bảng", () => {
    const rows = [
      ["Revenue", "1,234.5", "1,100.0"],
      ["Cost", "(456.7)", "(400.0)"],
      ["Profit", "1,777.8", "1,500.0"],
      ["Tax", "(77.8)", "(70.0)"],
      ["Net", "700.0", "630.0"],
    ];
    expect(kinds(rightRows(rows, RIGHTS, 100))).toEqual([{ table: rows }]);
  });

  it("bảng căn trái mà đường phụ cũng nhận được cùng số dòng ⇒ giữ kết quả đường căn trái", () => {
    const rows = [
      ["Item", "Qty", "Price"],
      ["Apple", "3", "1.20"],
      ["Banana", "12", "0.50"],
    ];
    expect(kinds(grid(rows, XS, 100))).toEqual([{ table: rows }]);
  });

  it("văn bản trước / sau bảng số giữ là đoạn văn, đúng thứ tự", () => {
    const items = [
      ...lines(50, 60, ["Intro paragraph."]),
      ...rightRows(FIN, RIGHTS, 90),
      ...lines(50, 180, ["Closing paragraph."]),
    ];
    expect(kinds(items)).toEqual([{ text: 1 }, { table: FIN }, { text: 1 }]);
  });
});

describe("detectRightAlignedTable", () => {
  const ls = (items: LayoutItem[]) => buildLines(items).lines;

  it("trả số dòng đã dùng + hàng; < 3 hàng dữ liệu ⇒ null", () => {
    const got = detectRightAlignedTable(ls(rightRows(FIN, RIGHTS, 100)), PAGE);
    expect(got).toEqual({ rows: FIN, lineCount: 4 });
    expect(
      detectRightAlignedTable(
        ls(rightRows(FIN.slice(0, 2), RIGHTS, 100)),
        PAGE,
      ),
    ).toBeNull();
  });

  it("ô chữ không chồng lấn cột số nào và không nằm bên trái ⇒ bảng dừng trước dòng đó", () => {
    const items = [
      ...rightRows(FIN, RIGHTS, 100),
      item("Note", 50, 156),
      item("see", 320, 156),
      right("1.0", RIGHTS[1], 156),
    ];
    expect(detectRightAlignedTable(ls(items), PAGE)?.lineCount).toBe(4);
  });
});
