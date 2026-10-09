import {
  rotateForDisplay,
  type FixturePage,
  type FixtureText,
} from "./make-pdf";

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

// 147 (c): cùng nội dung với mẫu gốc nhưng trang có /Rotate (vẽ xoay ngược để HIỂN THỊ thẳng) ⇒ văn bản trích phải giống hệt.
export function rotatedSample(base: Sample, r: 90 | 180 | 270): Sample {
  return {
    pages: base.pages.map((p) => rotateForDisplay(p, r)),
    expected: base.expected,
  };
}

// 147 (c): MediaBox lệch gốc (CropBox / MediaBox không bắt đầu ở 0,0) ⇒ văn bản như mẫu gốc.
export function offsetOrigin(base: Sample): Sample {
  return {
    pages: base.pages.map((p) => ({ ...p, origin: { x: 100, y: 50 } })),
    expected: base.expected,
  };
}

// 147 (b, research R5): bảng số căn phải / căn dấu thập phân (mẫu dương) và các khối "trông như bảng" không phải bảng (mẫu âm).
// Bề rộng ký tự cố định 5pt ⇒ căn phải tại R: x = R − 5·độ dài; căn thập phân tại P: x = P − 5·độ dài phần trước dấu thập phân.

const CHAR = SIZE * 0.5;
const at = (x: number, y: number, text: string): FixtureText => ({
  x,
  y,
  size: SIZE,
  text,
});
const rightAt = (r: number, y: number, text: string): FixtureText =>
  at(r - CHAR * text.length, y, text);
const centerAt = (c: number, y: number, text: string): FixtureText =>
  at(c - (CHAR * text.length) / 2, y, text);
const intPart = (s: string): string => s.split(".")[0];
const decimalAt = (p: number, y: number, text: string): FixtureText =>
  at(p - CHAR * intPart(text).length, y, text);

const mdRow = (r: readonly string[]) =>
  `|${r.map((c) => (c === "" ? " " : ` ${c} `)).join("|")}|`;
const md = (rows: readonly string[][]) =>
  [
    mdRow(rows[0]),
    `|${rows[0].map(() => "---").join("|")}|`,
    ...rows.slice(1).map(mdRow),
  ].join("\n");

const FIN_RIGHTS = [280, 370, 450, 540];
const FIN_ROWS = [
  ["Revenue", "1,234.5", "1.100,0", "12.2%", "100.0%"],
  ["Cost of sales", "(456.7)", "(400.0)", "14.2%", "(37.0%)"],
  ["Gross profit", "777.8", "700.0", "11.1%", "63.0%"],
  ["Operating expenses", "(120.3)", "(98.6)", "22.0%", "(9.7%)"],
  ["Total", "657.5", "601.4", "9.3%", "53.3%"],
];

/** Báo cáo tài chính: 4 cột số căn phải, tiêu đề 2 dòng (giữa / phải), số âm trong ngoặc, `1.234,5` và `1,234.5`, hàng tổng. */
export function financialTable(): Sample {
  const intro = paragraph(50, 60, ["Income statement in thousands."]);
  const y0 = intro.next;
  const head1 = [
    at(50, y0, "Item"),
    centerAt(FIN_RIGHTS[0] - 17.5, y0, "Fiscal"),
    centerAt(FIN_RIGHTS[1] - 17.5, y0, "Fiscal"),
    rightAt(FIN_RIGHTS[2], y0, "Change"),
    rightAt(FIN_RIGHTS[3], y0, "Share"),
  ];
  const head2 = ["2025", "2024", "(%)", "(%)"].map((t, j) =>
    rightAt(FIN_RIGHTS[j], y0 + 11, t),
  );
  const body = FIN_ROWS.flatMap((r, i) => {
    const y = y0 + 25 + i * 14;
    return [
      at(50, y, r[0]),
      ...r.slice(1).map((c, j) => rightAt(FIN_RIGHTS[j], y, c)),
    ];
  });
  const outro = paragraph(50, y0 + 25 + 4 * 14 + 30, [
    "Figures are unaudited.",
  ]);
  return {
    pages: [
      page([...intro.texts, ...head1, ...head2, ...body, ...outro.texts]),
    ],
    expected: [
      [
        "Income statement in thousands.",
        md([
          ["Item", "Fiscal 2025", "Fiscal 2024", "Change (%)", "Share (%)"],
          ...FIN_ROWS,
        ]),
        "Figures are unaudited.",
      ].join("\n\n"),
    ],
  };
}

const DEC_POINTS = [300, 450];
const DEC_ROWS = [
  ["A", "12.5", "0.25"],
  ["B", "3.25", "1.5"],
  ["C", "100.125", "12"],
  ["D", "7", "3.125"],
];

/** Bảng căn theo dấu thập phân (mép phải KHÔNG thẳng hàng). */
export function decimalTable(): Sample {
  const y0 = 80;
  const head = [
    at(50, y0, "Sample"),
    at(DEC_POINTS[0] - 20, y0, "Mass (g)"),
    at(DEC_POINTS[1] - 20, y0, "Ratio"),
  ];
  const body = DEC_ROWS.flatMap((r, i) => {
    const y = y0 + 14 + i * 14;
    return [
      at(50, y, r[0]),
      ...r.slice(1).map((c, j) => decimalAt(DEC_POINTS[j], y, c)),
    ];
  });
  return {
    pages: [page([...head, ...body])],
    expected: [md([["Sample", "Mass (g)", "Ratio"], ...DEC_ROWS])],
  };
}

/** Mục lục KHÔNG có chấm dẫn: tên mục + số trang căn phải (số nguyên tăng dần) ⇒ không phải bảng. */
export function tocNoLeader(): Sample {
  const rows = [
    ["Introduction", "5"],
    ["Background", "18"],
    ["Methods", "42"],
    ["Results", "107"],
    ["Discussion", "236"],
  ];
  const texts = rows.flatMap((r, i) => [
    at(50, 60 + i * 14, r[0]),
    rightAt(550, 60 + i * 14, r[1]),
  ]);
  return {
    pages: [page(texts)],
    expected: [rows.map((r) => r.join(" ")).join(" ")],
  };
}

/** Danh sách nhãn–giá trị (giá trị ngay sau nhãn, không theo cột) ⇒ không phải bảng. */
export function keyValueList(): Sample {
  const rows = [
    ["Name:", "Nguyen Van An"],
    ["Date of birth:", "01/02/1990"],
    ["ID number:", "012345678901"],
    ["Phone:", "0912 345 678"],
    ["Salary:", "15,000,000"],
  ];
  const texts = rows.flatMap((r, i) => [
    at(50, 60 + i * 14, r[0]),
    at(50 + CHAR * r[0].length + 15, 60 + i * 14, r[1]),
  ]);
  return {
    pages: [page(texts)],
    expected: [rows.map((r) => r.join(" ")).join(" ")],
  };
}

/** Đoạn căn đều hai bên: khoảng giãn rộng (> 1 em) tách dòng thành 2 cụm ở vị trí khác nhau mỗi dòng ⇒ không phải bảng. */
export function justifiedParagraph(): Sample {
  const rows = [
    ["The company reported", "total revenue of 1,234.5 thousand in the year,"],
    ["an increase of 12.2% compared with the previous", "year, mainly due"],
    ["to higher sales volumes in the", "domestic market and stable prices"],
    ["across all of its principal product lines during", "the half."],
  ];
  const texts = rows.flatMap((r, i) => [
    at(50, 60 + i * 12, r[0]),
    at(50 + CHAR * r[0].length + 12, 60 + i * 12, r[1]),
  ]);
  return {
    pages: [page(texts)],
    expected: [rows.map((r) => r.join(" ")).join(" ")],
  };
}

/** Khối chữ ký hai bên, căn giữa từng bên ⇒ không phải bảng. */
export function signatureBlock(): Sample {
  const rows = [
    ["PARTY A", "PARTY B"],
    ["(Signature and full name)", "(Signature and full name)"],
    ["Nguyen Van An", "Tran Thi Binh"],
    ["Date: 01/03/2025", "Date: 02/03/2025"],
  ];
  const texts = rows.flatMap((r, i) => [
    centerAt(150, 60 + i * 14, r[0]),
    centerAt(450, 60 + i * 14, r[1]),
  ]);
  return {
    pages: [page(texts)],
    expected: [rows.map((r) => r.join(" ")).join(" ")],
  };
}

// 147 (a, research R6): từ ghép có gạch ở ngắt dòng. "long-term" có bằng chứng giữa dòng cùng trang; "well-known" chỉ có bằng chứng ở
// TRANG SAU (cần tiền quét cả tài liệu); "infor-"/"mation" là ngắt từ thật; tiếng Việt giữ gạch, nối liền.
export function hyphenCompounds(): Sample {
  const a = paragraph(50, 60, [
    "We prefer a long-term view. Our long-",
    "term plan relies on infor-",
    "mation and on a well-",
    "known method.",
  ]);
  const b = paragraph(50, a.next, ["Bản hợp-", "đồng này có hiệu lực."]);
  const c = paragraph(50, 60, ["The well-known method is simple."]);
  return {
    pages: [page([...a.texts, ...b.texts]), page(c.texts)],
    expected: [
      "We prefer a long-term view. Our long-term plan relies on information and on a well-known method.\n\nBản hợp-đồng này có hiệu lực.",
      "The well-known method is simple.",
    ],
  };
}
