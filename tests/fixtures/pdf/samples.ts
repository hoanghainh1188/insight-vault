import type { FixturePage, FixtureText } from "./make-pdf";

// 112: các PDF mẫu tự sinh (research R13) + văn bản kỳ vọng sau khi dựng bố cục. Cỡ chữ 10, bước dòng 12 trong đoạn,
// khoảng cách đoạn 26 (> 1,5 × 10). Trang 600×800 điểm. Bề rộng ký tự cố định 0,5 em ⇒ chữ 10pt rộng 5pt/ký tự.

export interface Sample {
  pages: FixturePage[];
  /** văn bản kỳ vọng theo trang (sau layoutPage) */
  expected: string[];
}

const W = 600;
const H = 800;
const SIZE = 10;
const STEP = 12;
const PARA = 26;

/** Đặt các dòng của một đoạn bắt đầu tại (x, y). Trả dòng + y kế tiếp (sau khoảng cách đoạn). */
function paragraph(
  x: number,
  y: number,
  lines: string[],
): { texts: FixtureText[]; next: number } {
  const texts = lines.map((text, i) => ({
    x,
    y: y + i * STEP,
    size: SIZE,
    text,
  }));
  return { texts, next: y + (lines.length - 1) * STEP + PARA };
}

function page(
  texts: FixtureText[],
  extra: Partial<FixturePage> = {},
): FixturePage {
  return { width: W, height: H, texts, ...extra };
}

export function oneColumn(): Sample {
  const a = paragraph(50, 80, [
    "The first paragraph starts here",
    "and continues on a second line.",
  ]);
  const b = paragraph(50, a.next, ["Second paragraph is short."]);
  return {
    pages: [page([...a.texts, ...b.texts])],
    expected: [
      "The first paragraph starts here and continues on a second line.\n\nSecond paragraph is short.",
    ],
  };
}

const LEFT = [
  [
    "Left column first paragraph line one",
    "left column first paragraph line two",
  ],
  ["Left column second paragraph begins", "and ends on this line of the left."],
];
const RIGHT = [
  [
    "Right column first paragraph line one",
    "right column first paragraph line two",
  ],
  [
    "Right column second paragraph begins",
    "and ends on this line of the right.",
  ],
];

export function twoColumns(): Sample {
  const title = {
    x: 50,
    y: 50,
    size: SIZE,
    text: "A Two Column Article Title That Spans The Whole Page Width Here",
  };
  const texts: FixtureText[] = [title];
  let yl = 90;
  for (const p of LEFT) {
    const r = paragraph(50, yl, p);
    texts.push(...r.texts);
    yl = r.next;
  }
  let yr = 90;
  for (const p of RIGHT) {
    const r = paragraph(320, yr, p);
    texts.push(...r.texts);
    yr = r.next;
  }
  texts.push({ x: 280, y: 780, size: SIZE, text: "Page 1" });
  const join = (ps: string[][]) => ps.map((p) => p.join(" ")).join("\n\n");
  return {
    pages: [page(texts)],
    expected: [[title.text, join(LEFT), join(RIGHT), "Page 1"].join("\n\n")],
  };
}

const TABLE_ROWS = [
  ["Item", "Qty", "Price"],
  ["Apple", "3", "1.20"],
  ["Banana", "12", "0.50"],
  ["Cherry", "", "9.99"],
];
const TABLE_MD = [
  "| Item | Qty | Price |",
  "|---|---|---|",
  "| Apple | 3 | 1.20 |",
  "| Banana | 12 | 0.50 |",
  "| Cherry | | 9.99 |",
].join("\n");

function tableTexts(rows: string[][], y0: number): FixtureText[] {
  const xs = [50, 200, 350];
  return rows.flatMap((r, i) =>
    r.flatMap((cell, j) =>
      cell === "" ? [] : [{ x: xs[j], y: y0 + i * 14, size: SIZE, text: cell }],
    ),
  );
}

export function borderlessTable(): Sample {
  const intro = paragraph(50, 60, ["Prices are listed below."]);
  return {
    pages: [page([...intro.texts, ...tableTexts(TABLE_ROWS, intro.next)])],
    expected: [`Prices are listed below.\n\n${TABLE_MD}`],
  };
}

export function borderedTable(): Sample {
  const intro = paragraph(50, 60, ["Prices are listed below."]);
  const y0 = intro.next;
  const lines = [0, 1, 2, 3, 4].map((i) => ({
    x1: 45,
    y1: y0 - 11 + i * 14,
    x2: 450,
    y2: y0 - 11 + i * 14,
  }));
  for (const x of [45, 195, 345, 450])
    lines.push({ x1: x, y1: y0 - 11, x2: x, y2: y0 - 11 + 56 });
  return {
    pages: [page([...intro.texts, ...tableTexts(TABLE_ROWS, y0)], { lines })],
    expected: [`Prices are listed below.\n\n${TABLE_MD}`],
  };
}

export function tableAcrossPages(): Sample {
  const intro = paragraph(50, 60, ["Inventory continues on the next page."]);
  const head = TABLE_ROWS.slice(0, 3);
  const tail = [
    TABLE_ROWS[0],
    ["Durian", "1", "5.00"],
    ["Elderberry", "40", "0.10"],
  ];
  const md = (rows: string[][]) =>
    [
      `| ${rows[0].join(" | ")} |`,
      "|---|---|---|",
      ...rows.slice(1).map((r) => `| ${r.join(" | ")} |`),
    ].join("\n");
  return {
    pages: [
      page([...intro.texts, ...tableTexts(head, intro.next)]),
      page(tableTexts(tail, 60)),
    ],
    expected: [
      `Inventory continues on the next page.\n\n${md(head)}`,
      md(tail),
    ],
  };
}

export function tocNotTable(): Sample {
  const rows = [
    ["Chapter 1 Introduction ..........", "3"],
    ["Chapter 2 Methods ...............", "9"],
    ["Chapter 3 Results ...............", "17"],
    ["Chapter 4 Discussion ............", "25"],
  ];
  const texts = rows.flatMap((r, i) => [
    { x: 50, y: 60 + i * 14, size: SIZE, text: r[0] },
    { x: 500, y: 60 + i * 14, size: SIZE, text: r[1] },
  ]);
  return {
    pages: [page(texts)],
    // bước dòng 14 < 1,5 × 10 ⇒ một đoạn; không phải bảng (dấu chấm dẫn) ⇒ văn bản dòng thường
    expected: [rows.map((r) => r.join(" ")).join(" ")],
  };
}

export function bulletList(): Sample {
  const items = [
    "• First item in the list",
    "• Second item in the list",
    "• Third item in the list",
  ];
  const texts = items.map((t, i) => ({
    x: 50,
    y: 60 + i * 26,
    size: SIZE,
    text: t,
  }));
  return { pages: [page(texts)], expected: [items.join("\n\n")] };
}

export const VI_NFD = "Hà Nội là thủ đô.";

export function vietnamese(): Sample {
  const a = paragraph(50, 60, [
    "Điều 1. Hợp đồng lao động là sự thỏa thuận",
    "giữa người lao động và người sử dụng lao động.",
  ]);
  const b = paragraph(50, a.next, [VI_NFD]);
  return {
    pages: [page([...a.texts, ...b.texts])],
    expected: [
      `Điều 1. Hợp đồng lao động là sự thỏa thuận giữa người lao động và người sử dụng lao động.\n\n${VI_NFD}`,
    ],
  };
}

export function hyphenated(): Sample {
  const a = paragraph(50, 60, [
    "This sentence has a hyphen-",
    "ated word and a Capital-",
    "Case compound.",
  ]);
  return {
    pages: [page(a.texts)],
    expected: [
      "This sentence has a hyphenated word and a Capital-Case compound.",
    ],
  };
}

export function rotatedPage(): Sample {
  const a = paragraph(50, 60, ["Body text on a page with a side note."]);
  return {
    pages: [
      page([
        ...a.texts,
        { x: 560, y: 600, size: SIZE, text: "SIDE NOTE", angle: 90 },
      ]),
    ],
    expected: ["Body text on a page with a side note.\n\nSIDE NOTE"],
  };
}

export function manyItems(n: number): Sample {
  const texts: FixtureText[] = Array.from({ length: n }, (_, i) => ({
    x: 20 + (i % 100) * 5.5,
    y: 20 + Math.floor(i / 100) * 11,
    size: 5,
    text: String.fromCharCode(97 + (i % 26)),
  }));
  return {
    pages: [page(texts)],
    expected: [texts.map((t) => t.text).join(" ")],
  };
}
