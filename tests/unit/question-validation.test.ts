import { describe, it, expect } from "vitest";
import {
  validateQuestion,
  validateMode,
  validateHistory,
  MAX_HISTORY_ITEMS,
} from "../../src/main/services/rag/question-validation";

describe("validateMode", () => {
  it("chấp nhận grounded/open; ném giá trị lạ", () => {
    expect(validateMode("grounded")).toBe("grounded");
    expect(validateMode("open")).toBe("open");
    expect(() => validateMode("xxx")).toThrow(/Chế độ/);
    expect(() => validateMode(null)).toThrow();
  });
});

describe("validateHistory", () => {
  it("null → []; mảng hợp lệ giữ nguyên", () => {
    expect(validateHistory(null)).toEqual([]);
    expect(
      validateHistory([
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
      ]),
    ).toHaveLength(2);
  });
  it("không phải mảng / quá dài / lượt sai → ném", () => {
    expect(() => validateHistory("x")).toThrow();
    expect(() =>
      validateHistory(
        Array.from({ length: MAX_HISTORY_ITEMS + 1 }, () => ({
          role: "user",
          content: "a",
        })),
      ),
    ).toThrow(/quá dài/);
    expect(() => validateHistory([{ role: "system", content: "a" }])).toThrow();
    expect(() => validateHistory([{ role: "user", content: 123 }])).toThrow();
    expect(() =>
      validateHistory([{ role: "user", content: "x".repeat(2001) }]),
    ).toThrow();
  });
});

describe("validateQuestion", () => {
  it("trim + chấp nhận câu hợp lệ", () => {
    expect(validateQuestion("  Điều khoản A là gì?  ")).toBe(
      "Điều khoản A là gì?",
    );
  });
  it("rỗng / chỉ khoảng trắng → ném", () => {
    expect(() => validateQuestion("")).toThrow(/để trống/);
    expect(() => validateQuestion("   ")).toThrow(/để trống/);
  });
  it("> 2000 ký tự → ném", () => {
    expect(() => validateQuestion("a".repeat(2001))).toThrow(/quá dài/);
    expect(validateQuestion("a".repeat(2000))).toHaveLength(2000);
  });
  it("không phải chuỗi → ném", () => {
    expect(() => validateQuestion(null)).toThrow();
    expect(() => validateQuestion(42)).toThrow();
  });
});
