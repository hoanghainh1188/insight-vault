import { describe, it, expect } from "vitest";
import { summarizeLlmRuns, type LlmRun } from "../eval/lib/llm-metrics";

// 123 (SC-006, research R9): số đo phần LLM theo nhóm ngôn ngữ câu hỏi — [n] hợp lệ, từ chối đúng,
// trả nhầm "không tìm thấy", ngôn ngữ câu trả lời khớp câu hỏi (bỏ [n] trước khi nhận diện).

const run = (over: Partial<LlmRun>): LlmRun => ({
  lang: "en",
  type: "answerable",
  notFound: false,
  citationCount: 1,
  answer: "The bay has many islands [1].",
  ...over,
});

describe("summarizeLlmRuns", () => {
  it("nhóm theo ngôn ngữ; tỉ lệ trên đúng mẫu số", () => {
    const s = summarizeLlmRuns([
      run({}),
      run({ answer: "Vịnh có rất nhiều hòn đảo đá vôi đẹp [1]." }), // sai ngôn ngữ
      run({ notFound: true, citationCount: 0, answer: "" }), // trả nhầm không tìm thấy
      run({
        type: "unanswerable",
        notFound: true,
        citationCount: 0,
        answer: "",
      }),
      run({
        type: "unanswerable",
        notFound: false,
        answer: "It costs 10 USD [2].",
      }), // bịa
      run({ lang: "vi", answer: "Phở xuất hiện vào đầu thế kỷ hai mươi [1]." }),
    ]);
    expect(s.en.answerable).toBe(3);
    expect(s.en.citedRate).toBeCloseTo(2 / 3);
    expect(s.en.falseNotFoundRate).toBeCloseTo(1 / 3);
    expect(s.en.languageMatchRate).toBeCloseTo(1 / 2);
    expect(s.en.languageDetected).toBe(2);
    expect(s.en.unanswerable).toBe(2);
    expect(s.en.correctRefusalRate).toBeCloseTo(1 / 2);
    expect(s.vi.answerable).toBe(1);
    expect(s.vi.languageMatchRate).toBe(1);
    expect(s.vi.unanswerable).toBe(0);
    expect(s.vi.correctRefusalRate).toBeNull();
  });

  it("câu trả lời không nhận diện được ngôn ngữ ⇒ không tính vào mẫu số", () => {
    const s = summarizeLlmRuns([run({ answer: "42 [1]" })]);
    expect(s.en.languageDetected).toBe(0);
    expect(s.en.languageMatchRate).toBeNull();
  });

  it("rỗng ⇒ null cho mọi tỉ lệ", () => {
    const s = summarizeLlmRuns([]);
    expect(s.vi.citedRate).toBeNull();
    expect(s.en.correctRefusalRate).toBeNull();
  });
});
