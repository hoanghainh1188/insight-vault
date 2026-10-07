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
