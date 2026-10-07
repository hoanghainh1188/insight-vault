import { describe, expect, it } from "vitest";
import { buildLines } from "../../src/main/services/ingestion/pdf-layout/lines";
import { joinParagraphs } from "../../src/main/services/ingestion/pdf-layout/paragraphs";
import type { LayoutItem } from "../../src/main/services/ingestion/pdf-layout/types";
import { item, lines } from "./helpers/layout-items";

// 112 (FR-002, research R4): dòng cùng đoạn nối bằng dấu cách; khoảng dọc lớn ⇒ đoạn mới; nối từ bị ngắt gạch nối.

const run = (items: LayoutItem[]) => joinParagraphs(buildLines(items).lines);

describe("joinParagraphs", () => {
  it("dòng cùng đoạn (bước 12 < 1,5×10) nối bằng một dấu cách", () => {
    expect(run(lines(50, 100, ["first line", "second line"]))).toBe(
      "first line second line",
    );
  });

  it("khoảng baseline > 1,5·h ⇒ đoạn mới (\\n\\n)", () => {
    expect(
      run([...lines(50, 100, ["para one"]), ...lines(50, 126, ["para two"])]),
    ).toBe("para one\n\npara two");
    // đúng ngưỡng 15 ⇒ cùng đoạn; 15.1 ⇒ đoạn mới
    expect(run([item("a", 50, 100), item("b", 50, 115)])).toBe("a b");
    expect(run([item("a", 50, 100), item("b", 50, 115.1)])).toBe("a\n\nb");
  });

  it("gạch nối cuối dòng + chữ thường đầu dòng sau ⇒ nối liền, bỏ gạch", () => {
    expect(run(lines(50, 100, ["a hyphen-", "ated word"]))).toBe(
      "a hyphenated word",
    );
  });

  it("gạch nối + chữ HOA ⇒ giữ gạch, nối liền", () => {
    expect(run(lines(50, 100, ["a Capital-", "Case word"]))).toBe(
      "a Capital-Case word",
    );
  });

  it("soft hyphen U+00AD cuối dòng ⇒ bỏ, nối liền", () => {
    expect(run(lines(50, 100, ["trích­", "xuất văn bản"]))).toBe(
      "tríchxuất văn bản",
    );
  });

  it("gạch đứng riêng (dấu gạch ngang câu) không bị nối", () => {
    expect(run(lines(50, 100, ["giá trị -", "tiếp theo"]))).toBe(
      "giá trị - tiếp theo",
    );
  });

  it("tiếng Việt có dấu tổ hợp giữ nguyên ký tự; gạch nối + chữ thường có dấu", () => {
    const nfd = "Hà Nội";
    expect(run(lines(50, 100, [nfd, "đẹp"]))).toBe(`${nfd} đẹp`);
    expect(run(lines(50, 100, ["hợp-", "đồng"]))).toBe("hợpđồng");
  });

  it("dòng nhiều segment ⇒ nối segment bằng dấu cách", () => {
    expect(run([item("left", 50, 100), item("right", 300, 100)])).toBe(
      "left right",
    );
  });

  it("vùng rỗng ⇒ chuỗi rỗng", () => {
    expect(joinParagraphs([])).toBe("");
  });
});

describe("joinParagraphs — giới hạn đã biết (112 review)", () => {
  it("từ ghép có gạch nối đúng ở cuối dòng (long-/term) bị nối liền — đúng FR-002, ghi trong ADR", () => {
    expect(run(lines(50, 100, ["a long-", "term plan"]))).toBe(
      "a longterm plan",
    );
  });
});
