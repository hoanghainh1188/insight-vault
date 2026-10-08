import { describe, it, expect } from "vitest";
import {
  parseUiLanguage,
  resolveLanguage,
} from "../../src/shared/i18n/resolve-language";
import { LANGUAGES, SOURCE_LANGUAGE } from "../../src/shared/i18n/languages";

// 123 (FR-002, FR-005, contracts/i18n-core.md): giá trị lưu ⇒ preference hợp lệ; auto ⇒ theo locale OS.

describe("parseUiLanguage", () => {
  it("giữ auto/vi/en", () => {
    expect(parseUiLanguage("auto")).toBe("auto");
    expect(parseUiLanguage("vi")).toBe("vi");
    expect(parseUiLanguage("en")).toBe("en");
  });

  it("giá trị không hợp lệ ⇒ auto", () => {
    for (const raw of [null, undefined, "", "fr", "EN", 1, {}, ["vi"]]) {
      expect(parseUiLanguage(raw)).toBe("auto");
    }
  });
});

describe("resolveLanguage", () => {
  it("preference cố định thắng locale OS", () => {
    expect(resolveLanguage("vi", "en-US")).toBe("vi");
    expect(resolveLanguage("en", "vi-VN")).toBe("en");
  });

  it("auto + locale tiếng Việt (mọi biến thể) ⇒ vi", () => {
    for (const l of ["vi", "vi-VN", "VI_vn", "vi-Latn", "Vi"]) {
      expect(resolveLanguage("auto", l)).toBe("vi");
    }
  });

  it("auto + locale khác / rỗng / thiếu ⇒ en", () => {
    for (const l of ["en-US", "de-DE", "video", "", undefined]) {
      expect(resolveLanguage("auto", l)).toBe("en");
    }
  });
});

describe("LANGUAGES", () => {
  it("vi là ngôn ngữ nguồn; tên tự xưng + locale Intl", () => {
    expect(SOURCE_LANGUAGE).toBe("vi");
    expect(LANGUAGES.map((l) => l.code)).toEqual(["vi", "en"]);
    expect(LANGUAGES.find((l) => l.code === "vi")).toMatchObject({
      nativeName: "Tiếng Việt",
      intlLocale: "vi-VN",
    });
    expect(LANGUAGES.find((l) => l.code === "en")).toMatchObject({
      nativeName: "English",
      intlLocale: "en-US",
    });
  });
});
