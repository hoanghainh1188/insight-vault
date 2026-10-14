import { describe, it, expect } from "vitest";
import {
  selectLlmSample,
  summarizeRefusals,
  parseLlmSampleMode,
  type RefusalRun,
} from "../eval/lib/llm-sample";
import type { EvalQuestion } from "../eval/lib/dataset";

// 205 (#187): mẫu LLM mở rộng cho câu KHÔNG đáp án (vi + en, dev + hold-out) + tổng hợp từng câu qua nhiều lần chạy.

const q = (id: string, over: Partial<EvalQuestion> = {}): EvalQuestion =>
  ({
    id,
    lang: "vi",
    type: "answerable",
    split: "dev",
    text: id,
    ...over,
  }) as EvalQuestion;

describe("parseLlmSampleMode", () => {
  it("chỉ nhận 'unanswerable'; còn lại là mẫu mặc định", () => {
    expect(parseLlmSampleMode("unanswerable")).toBe("unanswerable");
    expect(parseLlmSampleMode(undefined)).toBe("default");
    expect(parseLlmSampleMode("xyz")).toBe("default");
  });
});

describe("selectLlmSample", () => {
  const all = [
    q("a-vi-dev"),
    q("a-vi-ho", { split: "holdout" }),
    q("a-en", { lang: "en" }),
    q("u-vi-dev", { type: "unanswerable" }),
    q("u-vi-ho", { type: "unanswerable", split: "holdout" }),
    q("u-en", { type: "unanswerable", lang: "en" }),
  ];
  it("mặc định: vi hold-out + mọi câu en (giữ hành vi 123)", () => {
    expect(selectLlmSample(all, "default").map((x) => x.id)).toEqual([
      "a-vi-ho",
      "a-en",
      "u-vi-ho",
      "u-en",
    ]);
  });
  it("unanswerable: mọi câu không đáp án vi + en, cả dev và hold-out", () => {
    expect(selectLlmSample(all, "unanswerable").map((x) => x.id)).toEqual([
      "u-vi-dev",
      "u-vi-ho",
      "u-en",
    ]);
  });
});

describe("summarizeRefusals", () => {
  const run = (over: Partial<RefusalRun>): RefusalRun => ({
    questionId: "u1",
    notFound: true,
    citationCount: 0,
    answer: "Không tìm thấy trong nguồn.",
    ...over,
  });
  it("gom theo câu: số lần từ chối đúng, danh sách câu trả lời lọt (để đọc tay)", () => {
    const s = summarizeRefusals([
      run({}),
      run({ notFound: false, citationCount: 1, answer: "Có [1]" }),
      run({}),
      run({ questionId: "u2", notFound: false, answer: "Bịa" }),
    ]);
    expect(s).toEqual([
      {
        questionId: "u1",
        runs: 3,
        refused: 2,
        leaked: [{ citationCount: 1, answer: "Có [1]" }],
      },
      {
        questionId: "u2",
        runs: 1,
        refused: 0,
        leaked: [{ citationCount: 0, answer: "Bịa" }],
      },
    ]);
  });
  it("rỗng ⇒ rỗng", () => {
    expect(summarizeRefusals([])).toEqual([]);
  });
});
