import { describe, expect, it } from "vitest";
import { parsePdf } from "../../src/main/services/ingestion/parsers/pdf";
import { makePdf } from "../fixtures/pdf/make-pdf";
import {
  borderedTable,
  borderlessTable,
  bulletList,
  tableAcrossPages,
  tocNotTable,
  hyphenated,
  manyItems,
  oneColumn,
  rotatedPage,
  twoColumns,
  vietnamese,
  type Sample,
} from "../fixtures/pdf/samples";

// 112 (FR-001..FR-003, FR-007, SC-001): parsePdf thật (pdf.js) trên PDF tự sinh ⇒ văn bản có bố cục.

const texts = async (s: Sample) =>
  (await parsePdf(makePdf(s.pages))).pages.map((p) => p.text);

describe("parsePdf — bố cục văn bản", () => {
  it.each([
    ["1 cột", oneColumn],
    ["2 cột + tiêu đề + số trang", twoColumns],
    ["tiếng Việt (NFC + NFD)", vietnamese],
    ["gạch nối", hyphenated],
    ["chữ xoay", rotatedPage],
  ] as const)("%s", async (_name, make) => {
    const s = make();
    expect(await texts(s)).toEqual(s.expected);
  });

  it("trang dày đặc mẩu chữ ⇒ không mất ký tự nào (dự phòng > MAX item kiểm ở pdf-layout-page)", async () => {
    const s = manyItems(6000);
    const [t] = await texts(s);
    const chars = (x: string) => [...x.replace(/\s/g, "")].sort().join("");
    expect(chars(t)).toBe(chars(s.expected[0]));
  });

  it("giữ hợp đồng ParseResult: pageCount + pages[{page,text}]", async () => {
    const s = twoColumns();
    const r = await parsePdf(makePdf([...s.pages, ...oneColumn().pages]));
    expect(r.pageCount).toBe(2);
    expect(r.pages.map((p) => p.page)).toEqual([1, 2]);
  });

  it("onProgress gọi sau mỗi trang, tăng dần, kết thúc = 1", async () => {
    const pages = [
      ...oneColumn().pages,
      ...oneColumn().pages,
      ...oneColumn().pages,
    ];
    const seen: number[] = [];
    await parsePdf(makePdf(pages), (f) => seen.push(f));
    expect(seen).toHaveLength(3);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(1);
  });
});

describe("parsePdf — bảng (US2)", () => {
  it.each([
    ["bảng không viền", borderlessTable],
    ["bảng có viền (đường kẻ bị bỏ qua)", borderedTable],
    ["bảng trải 2 trang ⇒ mỗi trang một bảng", tableAcrossPages],
    ["mục lục dấu chấm dẫn ⇒ không phải bảng", tocNotTable],
    ["danh sách đầu dòng ⇒ không phải bảng", bulletList],
  ] as const)("%s", async (_n, make) => {
    const s = make();
    expect(await texts(s)).toEqual(s.expected);
  });

  it("trả blocks theo trang, trỏ đúng vùng bảng; trang không có bảng ⇒ không có blocks", async () => {
    const s = tableAcrossPages();
    const r = await parsePdf(makePdf([...s.pages, ...oneColumn().pages]));
    for (const p of r.pages.slice(0, 2)) {
      expect(p.blocks).toHaveLength(1);
      const b = p.blocks![0];
      expect(
        p.text.slice(b.start, b.end).startsWith("| Item | Qty | Price |"),
      ).toBe(true);
      expect(p.text.slice(b.end)).toBe("");
    }
    expect(r.pages[2].blocks).toBeUndefined();
    expect(
      (await parsePdf(makePdf(tocNotTable().pages))).pages[0].blocks,
    ).toBeUndefined();
  });
});

describe("parsePdf — ngân sách thời gian dựng bố cục (112 security hardening)", () => {
  it("hết ngân sách ⇒ các trang còn lại dùng cách nối cũ (không treo main process)", async () => {
    const s = twoColumns();
    const pages = [...s.pages, ...s.pages, ...s.pages];
    const r = await parsePdf(makePdf(pages), undefined, { layoutBudgetMs: 0 });
    // ngân sách 0 ⇒ không trang nào dựng bố cục: văn bản không có ngắt đoạn của layout
    for (const p of r.pages) {
      expect(p.text).not.toContain("\n\n");
      expect(p.blocks).toBeUndefined();
    }
    const normal = await parsePdf(makePdf(pages));
    expect(normal.pages[0].text).toContain("\n\n");
  });
});

// 147 (c, research R3): trang có /Rotate — áp xoay trang (viewport pdf.js) trước khi dựng bố cục ⇒ cùng nội dung hiển thị thì
// văn bản trích GIỐNG HỆT trang thẳng; MediaBox lệch gốc cũng vậy; PDF không xoay không đổi.
import { rotatedSample, offsetOrigin } from "../fixtures/pdf/samples";

describe("parsePdf — trang xoay /Rotate (147)", () => {
  for (const r of [90, 180, 270] as const) {
    it(`/Rotate ${r}: hai cột + bảng ⇒ văn bản như trang thẳng`, async () => {
      for (const base of [twoColumns(), borderlessTable()]) {
        expect(await texts(rotatedSample(base, r))).toEqual(base.expected);
      }
    });
  }

  it("ghi chú bên lề (chữ xoay thật so với trang) trên trang /Rotate 90 vẫn xử lý riêng như trước", async () => {
    const base = rotatedPage();
    expect(await texts(rotatedSample(base, 90))).toEqual(base.expected);
  });

  it("MediaBox lệch gốc ⇒ văn bản như mẫu gốc (bảng vẫn nhận ra)", async () => {
    const base = borderlessTable();
    expect(await texts(offsetOrigin(base))).toEqual(base.expected);
  });

  it("PDF không xoay không đổi", async () => {
    const base = twoColumns();
    expect(await texts(base)).toEqual(base.expected);
  });
});

// 147 (b, SC-003): bảng số căn phải / căn thập phân ⇒ bảng đúng ô; mẫu âm ⇒ 0 bảng nhầm (bảng căn trái kiểm ở các test trên).
import {
  decimalTable,
  financialTable,
  justifiedParagraph,
  keyValueList,
  signatureBlock,
  tocNoLeader,
} from "../fixtures/pdf/samples";

describe("parsePdf — bảng số căn phải (147 b)", () => {
  it.each([
    [
      "báo cáo tài chính (4 cột số, tiêu đề 2 dòng, ngoặc âm, hàng tổng)",
      financialTable,
    ],
    ["căn dấu thập phân", decimalTable],
  ] as const)("mẫu dương: %s", async (_n, make) => {
    const s = make();
    expect(await texts(s)).toEqual(s.expected);
  });

  it.each([
    ["mục lục không chấm dẫn", tocNoLeader],
    ["danh sách nhãn–giá trị", keyValueList],
    ["đoạn căn đều hai bên", justifiedParagraph],
    ["khối chữ ký hai bên", signatureBlock],
  ] as const)("mẫu âm: %s ⇒ không có bảng", async (_n, make) => {
    const s = make();
    const r = await parsePdf(makePdf(s.pages));
    expect(r.pages.map((p) => p.text)).toEqual(s.expected);
    expect(r.pages[0].blocks).toBeUndefined();
  });

  it("bảng số trả block trỏ đúng vùng bảng", async () => {
    const r = await parsePdf(makePdf(financialTable().pages));
    const p = r.pages[0];
    expect(p.blocks).toHaveLength(1);
    const t = p.text.slice(p.blocks![0].start, p.blocks![0].end);
    expect(t.startsWith("| Item | Fiscal 2025 |")).toBe(true);
    expect(t.endsWith("| Total | 657.5 | 601.4 | 9.3% | 53.3% |")).toBe(true);
  });
});

// 147 (a, US4): gạch nối cuối dòng — bằng chứng cùng trang và TRANG SAU (tiền quét cả tài liệu); ngắt thật nối liền; tiếng Việt giữ gạch.
import { hyphenCompounds } from "../fixtures/pdf/samples";

describe("parsePdf — gạch nối (147 a)", () => {
  it("long-term / well-known (bằng chứng ở trang sau) giữ gạch; infor-mation nối liền; hợp-đồng giữ gạch", async () => {
    const s = hyphenCompounds();
    expect(await texts(s)).toEqual(s.expected);
  });

  it("vượt giới hạn giữ item ⇒ bằng chứng trượt: chỉ thấy trang đã gặp + chính trang (well-known ở trang sau không dùng được)", async () => {
    const s = hyphenCompounds();
    const r = await parsePdf(makePdf(s.pages), undefined, {
      hyphenRetainMaxItems: 0,
    });
    expect(r.pages[0].text).toBe(
      s.expected[0].replace("well-known method", "wellknown method"),
    );
    expect(r.pages[1].text).toBe(s.expected[1]);
  });

  it("mẫu gạch nối 112 không đổi", async () => {
    const s = hyphenated();
    expect(await texts(s)).toEqual(s.expected);
  });
});
