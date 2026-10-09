import { describe, expect, it } from "vitest";
import { buildLines } from "../../src/main/services/ingestion/pdf-layout/lines";
import { buildLexicon } from "../../src/main/services/ingestion/pdf-layout/hyphen";
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
    // 147 (a, clarify #18): tiếng Việt GIỮ gạch, nối liền — thay hành vi 112 "hợpđồng" (nối dính).
    expect(run(lines(50, 100, ["hợp-", "đồng"]))).toBe("hợp-đồng");
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

describe("joinParagraphs — gạch nối có bằng chứng (147 a)", () => {
  const runLex = (items: LayoutItem[], doc: string[]) =>
    joinParagraphs(buildLines(items).lines, buildLexicon(doc));

  it("tài liệu có 'long-term' ở chỗ khác ⇒ long-/term giữ gạch", () => {
    expect(
      runLex(lines(50, 100, ["a long-", "term plan"]), ["a long-term view"]),
    ).toBe("a long-term plan");
  });

  it("tài liệu có 'information' ⇒ infor-/mation nối liền", () => {
    expect(
      runLex(lines(50, 100, ["the infor-", "mation flow"]), ["Information"]),
    ).toBe("the information flow");
  });

  it("số trước gạch ⇒ giữ gạch, nối liền (112: thêm dấu cách)", () => {
    expect(run(lines(50, 100, ["the 2020-", "2021 season"]))).toBe(
      "the 2020-2021 season",
    );
  });

  it("gạch treo ⇒ giữ gạch + dấu cách", () => {
    expect(run(lines(50, 100, ["both pre-", "and post-war"]))).toBe(
      "both pre- and post-war",
    );
  });

  it("U+2010 cuối dòng được coi là gạch nối", () => {
    expect(run(lines(50, 100, ["a hyphen\u2010", "ated word"]))).toBe(
      "a hyphenated word",
    );
  });
});

describe("joinParagraphs — giới hạn đã biết (112 review, 147)", () => {
  it("từ ghép KHÔNG có bằng chứng trong tài liệu (long-/term) vẫn bị nối liền — hành vi cũ, ghi trong ADR", () => {
    expect(run(lines(50, 100, ["a long-", "term plan"]))).toBe(
      "a longterm plan",
    );
  });
});
