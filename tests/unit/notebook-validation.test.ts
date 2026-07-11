import { describe, it, expect } from "vitest";
import {
  validateName,
  validateColor,
  validateId,
  NAME_MAX_LEN,
} from "../../src/main/services/notebooks/validation";
import { PALETTE } from "../../src/main/services/notebooks/palette";

describe("notebook validation", () => {
  it("trim tên + chấp nhận 1–100 ký tự, cho unicode/emoji", () => {
    expect(validateName("  Vụ M&A  ")).toBe("Vụ M&A");
    expect(validateName("Ghi chú 📓")).toBe("Ghi chú 📓");
    expect(validateName("a".repeat(NAME_MAX_LEN))).toHaveLength(NAME_MAX_LEN);
  });

  it("tên rỗng / chỉ khoảng trắng → ném", () => {
    expect(() => validateName("")).toThrow(/để trống/);
    expect(() => validateName("   ")).toThrow(/để trống/);
    expect(() => validateName(null)).toThrow();
  });

  it("tên > 100 ký tự → ném", () => {
    expect(() => validateName("a".repeat(101))).toThrow(/tối đa/);
  });

  it("màu thuộc palette được chấp nhận; ngoài palette → ném", () => {
    expect(validateColor(PALETTE[0])).toBe(PALETTE[0]);
    expect(() => validateColor("#000000")).toThrow(/không hợp lệ/);
    expect(() => validateColor("red")).toThrow();
    expect(() => validateColor(123)).toThrow();
  });

  it("validateId: chuỗi non-empty OK; object/số/rỗng → ném lỗi nghiệp vụ", () => {
    expect(validateId("id-1")).toBe("id-1");
    expect(() => validateId("")).toThrow(/id không hợp lệ/);
    expect(() => validateId({ malicious: true })).toThrow();
    expect(() => validateId(42)).toThrow();
    expect(() => validateId(null)).toThrow();
  });
});
