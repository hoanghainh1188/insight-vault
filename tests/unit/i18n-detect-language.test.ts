import { describe, it, expect } from "vitest";
import { detectQuestionLanguage } from "../../src/shared/i18n/detect-language";

// 123 (FR-017, research R10): chỉ trả vi/en khi chắc chắn; còn lại undefined để model tự theo ngôn ngữ câu hỏi.

describe("detectQuestionLanguage", () => {
  it("câu tiếng Việt có dấu ⇒ vi", () => {
    expect(detectQuestionLanguage("Vịnh Hạ Long nằm ở tỉnh nào?")).toBe("vi");
    expect(
      detectQuestionLanguage("Luật quốc tịch năm 2008 quy định gì về đ"),
    ).toBe("vi");
    expect(detectQuestionLanguage("Phở có nguồn gốc từ đâu [1]?")).toBe("vi");
  });

  it("câu English ≥ 3 từ ⇒ en", () => {
    expect(detectQuestionLanguage("Where is Ha Long Bay located?")).toBe("en");
    expect(
      detectQuestionLanguage(
        "What does the 2008 nationality law say about dual citizenship?",
      ),
    ).toBe("en");
    expect(
      detectQuestionLanguage("Summarize the main points of the document"),
    ).toBe("en");
  });

  it("tên riêng Việt trong câu English vẫn ⇒ en (mật độ dấu thấp)", () => {
    expect(
      detectQuestionLanguage(
        "What is the history of Hồ Hoàn Kiếm and why is it important for the people of the city?",
      ),
    ).toBe("en");
  });

  it("tiếng Việt không dấu ⇒ undefined", () => {
    expect(
      detectQuestionLanguage("vinh ha long nam o tinh nao"),
    ).toBeUndefined();
  });

  it("quá ngắn / chỉ số, mã, tên riêng ⇒ undefined", () => {
    for (const q of [
      "Q3 2024?",
      "Hà Nội",
      "OK",
      "",
      "   ",
      "[1] [2]",
      "https://example.com/a?b=1 42",
    ]) {
      expect(detectQuestionLanguage(q), q).toBeUndefined();
    }
  });

  it("bỏ qua [n], URL và chữ số khi đếm", () => {
    expect(
      detectQuestionLanguage(
        "See https://vi.wikipedia.org/wiki/Phở and explain it [3]",
      ),
    ).toBe("en");
  });

  it("ngôn ngữ khác ⇒ undefined", () => {
    expect(
      detectQuestionLanguage("Wo liegt die Halong-Bucht genau?"),
    ).toBeUndefined();
  });
});

describe("123 review: tiếng Việt không dấu không bị nhận nhầm English", () => {
  it("câu Việt không dấu có từ trùng English ⇒ undefined", () => {
    for (const q of [
      "cho toi biet do dai cua to chuc",
      "the nao la quyen cong dan",
      "ban co the tom tat tai lieu nay khong",
    ]) {
      expect(detectQuestionLanguage(q), q).toBeUndefined();
    }
  });
  it("câu English vẫn nhận đúng", () => {
    expect(detectQuestionLanguage("What is the history of the lake?")).toBe(
      "en",
    );
  });
});
