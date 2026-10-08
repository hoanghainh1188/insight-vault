import { detectQuestionLanguage } from "../../../src/shared/i18n/detect-language";

// 123 (SC-006, research R9): tổng hợp phần LLM của bộ đánh giá theo ngôn ngữ câu hỏi. Thuần (unit-test được).

export interface LlmRun {
  lang: "vi" | "en";
  type: "answerable" | "unanswerable";
  notFound: boolean;
  citationCount: number;
  answer: string;
}

export interface LlmGroupSummary {
  answerable: number;
  /** câu có đáp án được trả lời kèm ≥ 1 [n] hợp lệ */
  citedRate: number | null;
  /** câu có đáp án bị trả "không tìm thấy" */
  falseNotFoundRate: number | null;
  /** trong câu trả lời nhận diện được ngôn ngữ: tỉ lệ khớp ngôn ngữ câu hỏi */
  languageMatchRate: number | null;
  languageDetected: number;
  unanswerable: number;
  /** câu không có đáp án được từ chối đúng */
  correctRefusalRate: number | null;
}

export type LlmSummary = Record<"vi" | "en", LlmGroupSummary>;

const rate = (num: number, den: number): number | null =>
  den === 0 ? null : num / den;

function summarizeGroup(
  runs: readonly LlmRun[],
  lang: "vi" | "en",
): LlmGroupSummary {
  const ans = runs.filter((r) => r.lang === lang && r.type === "answerable");
  const unans = runs.filter(
    (r) => r.lang === lang && r.type === "unanswerable",
  );
  const answered = ans.filter((r) => !r.notFound);
  let detected = 0;
  let matched = 0;
  for (const r of answered) {
    const l = detectQuestionLanguage(r.answer.replace(/\[\d+\]/g, " "));
    if (l === undefined) continue;
    detected += 1;
    if (l === lang) matched += 1;
  }
  return {
    answerable: ans.length,
    citedRate: rate(
      answered.filter((r) => r.citationCount > 0).length,
      ans.length,
    ),
    falseNotFoundRate: rate(ans.filter((r) => r.notFound).length, ans.length),
    languageMatchRate: rate(matched, detected),
    languageDetected: detected,
    unanswerable: unans.length,
    correctRefusalRate: rate(
      unans.filter((r) => r.notFound).length,
      unans.length,
    ),
  };
}

export function summarizeLlmRuns(runs: readonly LlmRun[]): LlmSummary {
  return { vi: summarizeGroup(runs, "vi"), en: summarizeGroup(runs, "en") };
}
