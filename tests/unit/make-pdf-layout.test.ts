import { describe, it, expect } from "vitest";
import { CHAR_WIDTH, layoutParagraph } from "../fixtures/pdf/make-pdf";

// 177 (T007, research R4): helper dàn dòng cho PDF fixture của bộ đánh giá — CHỈ THÊM vào make-pdf.ts, không đổi makePdf.
// Bề rộng ký tự cố định CHAR_WIDTH/1000 em ⇒ một dòng cỡ `size` chứa tối đa floor(width / (size·CHAR_WIDTH/1000)) grapheme.

const lineWidth = (text: string, size: number): number =>
  [...text].length * size * (CHAR_WIDTH / 1000);

const TEXT =
  "Hợp đồng thuê kho có hiệu lực từ ngày ký và được gia hạn mỗi năm một lần nếu hai bên không có ý kiến khác về điều khoản.";

describe("layoutParagraph", () => {
  it("ngắt theo từ, không dòng nào vượt width; giữ nguyên thứ tự từ", () => {
    const out = layoutParagraph(TEXT, {
      x: 50,
      y: 80,
      width: 200,
      size: 10,
      leading: 12,
    });
    expect(out.length).toBeGreaterThan(1);
    for (const t of out) expect(lineWidth(t.text, 10)).toBeLessThanOrEqual(200);
    expect(out.map((t) => t.text).join(" ")).toBe(TEXT);
  });

  it("toạ độ: x cố định, y tăng đúng leading, size giữ nguyên", () => {
    const out = layoutParagraph(TEXT, {
      x: 40,
      y: 100,
      width: 180,
      size: 10,
      leading: 12,
    });
    out.forEach((t, i) => {
      expect(t.x).toBe(40);
      expect(t.y).toBe(100 + i * 12);
      expect(t.size).toBe(10);
    });
  });

  it("tất định: cùng đầu vào ⇒ cùng kết quả", () => {
    const opts = { x: 50, y: 80, width: 220, size: 10, leading: 12 };
    expect(layoutParagraph(TEXT, opts)).toEqual(layoutParagraph(TEXT, opts));
  });

  it("hyphenateAt: từ có gạch nối được tách ở gạch, dòng kết thúc bằng phần trước + '-', dòng sau bắt đầu bằng phần còn lại", () => {
    const text = "Bản hợp-đồng này có hiệu lực ngay khi hai bên cùng ký.";
    const out = layoutParagraph(text, {
      x: 50,
      y: 60,
      width: 500,
      size: 10,
      leading: 12,
      hyphenateAt: ["hợp-đồng"],
    });
    const i = out.findIndex((t) => t.text.endsWith("hợp-"));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(out[i].text).toBe("Bản hợp-");
    expect(out[i + 1].text.startsWith("đồng ")).toBe(true);
    // Nối lại (bỏ ngắt dòng) ⇒ đúng văn bản gốc.
    expect(
      out
        .map((t) => t.text)
        .join(" ")
        .replace("hợp- đồng", "hợp-đồng"),
    ).toBe(text);
  });

  it("từ dài hơn cả dòng vẫn được đặt (một mình một dòng), không lặp vô hạn", () => {
    const out = layoutParagraph("ngắn rấtrấtrấtrấtrấtdài ngắn", {
      x: 0,
      y: 0,
      width: 50,
      size: 10,
      leading: 12,
    });
    expect(out.map((t) => t.text)).toEqual([
      "ngắn",
      "rấtrấtrấtrấtrấtdài",
      "ngắn",
    ]);
  });

  it("không mutate options / mảng hyphenateAt", () => {
    const hyphenateAt = Object.freeze(["hợp-đồng"]) as unknown as string[];
    const opts = Object.freeze({
      x: 1,
      y: 2,
      width: 300,
      size: 10,
      leading: 12,
      hyphenateAt,
    });
    expect(() => layoutParagraph("hợp-đồng mới", opts)).not.toThrow();
    expect(hyphenateAt).toEqual(["hợp-đồng"]);
  });

  it("chuỗi rỗng / chỉ khoảng trắng ⇒ không dòng nào", () => {
    const o = { x: 0, y: 0, width: 100, size: 10, leading: 12 };
    expect(layoutParagraph("", o)).toEqual([]);
    expect(layoutParagraph("   ", o)).toEqual([]);
  });
});
