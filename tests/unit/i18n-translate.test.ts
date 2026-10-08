import { describe, it, expect } from "vitest";
import {
  createTranslatorFrom,
  type Catalog,
} from "../../src/shared/i18n/translate";

// 123 (contracts/i18n-core.md, FR-025): tra khoá lồng, nội suy {name} là văn bản thuần, fallback, plural theo Intl.

const catalogs: Record<"vi" | "en", Catalog> = {
  vi: {
    greet: "Xin chào {name}",
    only: { vi: "Chỉ tiếng Việt" },
    nested: { deep: { key: "Sâu {n}" } },
    files: { one: "{count} tệp", other: "{count} tệp" },
    filesIn: { one: "{count} tệp trong {nb}", other: "{count} tệp trong {nb}" },
  },
  en: {
    greet: "Hello {name}",
    only: {},
    nested: { deep: { key: "Deep {n}" } },
    files: { one: "{count} file", other: "{count} files" },
    filesIn: { one: "{count} file in {nb}", other: "{count} files in {nb}" },
  },
};

describe("createTranslatorFrom", () => {
  const vi = createTranslatorFrom(catalogs, "vi");
  const en = createTranslatorFrom(catalogs, "en");

  it("tra khoá lồng + nội suy số và chuỗi", () => {
    expect(en.t("greet", { name: "Hải" })).toBe("Hello Hải");
    expect(vi.t("greet", { name: "Hải" })).toBe("Xin chào Hải");
    expect(en.t("nested.deep.key", { n: 3 })).toBe("Deep 3");
  });

  it("placeholder thiếu tham số giữ nguyên {name}", () => {
    expect(en.t("greet")).toBe("Hello {name}");
  });

  it("tham số chứa HTML được trả nguyên văn (không diễn giải)", () => {
    expect(en.t("greet", { name: "<b>x</b>" })).toBe("Hello <b>x</b>");
  });

  it("khoá thiếu ở ngôn ngữ đích ⇒ vi ⇒ chính khoá", () => {
    expect(en.t("only.vi")).toBe("Chỉ tiếng Việt");
    expect(en.t("no.such.key")).toBe("no.such.key");
  });

  it("khoá trỏ vào nhánh (không phải lá) ⇒ chính khoá", () => {
    expect(en.t("nested")).toBe("nested");
  });

  it("plural theo Intl.PluralRules; {count} tự có", () => {
    expect(en.plural("files", 1)).toBe("1 file");
    expect(en.plural("files", 2)).toBe("2 files");
    expect(en.plural("files", 0)).toBe("0 files");
    expect(vi.plural("files", 1)).toBe("1 tệp");
    expect(vi.plural("files", 5)).toBe("5 tệp");
    expect(en.plural("filesIn", 3, { nb: "A" })).toBe("3 files in A");
  });

  it("plural trên khoá chuỗi thường ⇒ dùng chuỗi đó", () => {
    expect(en.plural("greet", 2, { name: "X" })).toBe("Hello X");
  });

  it("lang được giữ", () => {
    expect(en.lang).toBe("en");
  });
});
