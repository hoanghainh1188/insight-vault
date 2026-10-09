import { describe, expect, it } from "vitest";
import {
  decimalAnchor,
  looksNumeric,
} from "../../src/main/services/ingestion/pdf-layout/numeric";

// 147 (b, research R5): ô "trông như số" để nhận bảng số căn phải — nhận cả kiểu Việt (`1.234,5`) lẫn Anh (`1,234.5`), số âm trong
// ngoặc, %, tiền tệ phổ biến; KHÔNG đoán locale. Điểm neo thập phân để căn cột khi mép phải không thẳng hàng.

describe("looksNumeric", () => {
  it.each([
    "0",
    "12",
    "1234567",
    "1,234",
    "1,234.5",
    "1.234,5",
    "1 234 567",
    "0.25",
    "(456.7)",
    "-12",
    "−3.5",
    "+7",
    "12.2%",
    "(9.7%)",
    "$1,200",
    "€ 30",
    "1.500.000 đ",
    "1.500.000 ₫",
    "250 VND",
    "12 USD",
    "2025",
  ])("số: %s", (s) => {
    expect(looksNumeric(s)).toBe(true);
  });

  it.each([
    "",
    "Revenue",
    "Total",
    "01/02/1990",
    "2025-01-01",
    "12:30",
    "A-123",
    "INV-0042",
    "Page 3",
    "p. 12",
    "- 3 -",
    "0912 345 678",
    "1,23,4",
    "12.2.%",
    "(12",
    "3 apples",
    "(%)",
    "—",
  ])("không phải số: %s", (s) => {
    expect(looksNumeric(s)).toBe(false);
  });
});

describe("decimalAnchor", () => {
  const seg = (text: string, x = 100) => ({ text, x, w: text.length * 5 });

  it("neo = mép trái dấu thập phân (= mép phải phần nguyên)", () => {
    expect(decimalAnchor(seg("12.5"))).toBe(110);
    expect(decimalAnchor(seg("100.125"))).toBe(115);
    expect(decimalAnchor(seg("1.234,5"))).toBe(125);
    expect(decimalAnchor(seg("1,234.5"))).toBe(125);
  });

  it("số nguyên (kể cả phân cách nghìn lặp lại) ⇒ neo sau chữ số cuối", () => {
    expect(decimalAnchor(seg("7"))).toBe(105);
    expect(decimalAnchor(seg("1.234.567"))).toBe(145);
    expect(decimalAnchor(seg("1,234,567"))).toBe(145);
  });

  it("một dấu phân cách duy nhất + 3 chữ số (mơ hồ, không đoán locale) ⇒ coi là dấu thập phân", () => {
    expect(decimalAnchor(seg("1,234"))).toBe(105);
    expect(decimalAnchor(seg("1.234"))).toBe(105);
  });

  it("ngoặc / % / đơn vị phía sau không làm lệch neo", () => {
    expect(decimalAnchor(seg("(456.7)"))).toBe(120);
    expect(decimalAnchor(seg("(9)"))).toBe(110);
    expect(decimalAnchor(seg("12.2%"))).toBe(110);
  });

  it("các số căn thập phân thẳng hàng ⇒ cùng neo", () => {
    const P = 300;
    const at = (t: string) => seg(t, P - t.split(".")[0].length * 5);
    const anchors = ["12.5", "3.25", "100.125", "7"].map((t) =>
      decimalAnchor(at(t)),
    );
    expect(new Set(anchors)).toEqual(new Set([P]));
  });
});
