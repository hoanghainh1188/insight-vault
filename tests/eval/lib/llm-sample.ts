import type { EvalQuestion } from "./dataset";

// 205 (#187): mẫu LLM mở rộng cho câu KHÔNG đáp án + tổng hợp từng câu qua nhiều lần chạy (tầng trả lời không tất định). Thuần.

export type LlmSampleMode = "default" | "unanswerable";

export function parseLlmSampleMode(raw: string | undefined): LlmSampleMode {
  return raw === "unanswerable" ? "unanswerable" : "default";
}

/** default = mẫu 123 (vi hold-out + mọi câu en); unanswerable = mọi câu không đáp án vi + en, dev lẫn hold-out. */
export function selectLlmSample(
  questions: readonly EvalQuestion[],
  mode: LlmSampleMode,
): EvalQuestion[] {
  return questions.filter((q) =>
    mode === "unanswerable"
      ? q.type === "unanswerable"
      : (q.lang === "vi" && q.split === "holdout") || q.lang === "en",
  );
}

export interface RefusalRun {
  questionId: string;
  notFound: boolean;
  citationCount: number;
  answer: string;
}

export interface RefusalSummary {
  questionId: string;
  runs: number;
  /** số lần tầng trả lời từ chối đúng ("không tìm thấy") */
  refused: number;
  /** các câu trả lời lọt (không từ chối) — đọc tay để biết có bịa không */
  leaked: { citationCount: number; answer: string }[];
}

export function summarizeRefusals(
  runs: readonly RefusalRun[],
): RefusalSummary[] {
  const byId = new Map<string, RefusalSummary>();
  for (const r of runs) {
    const s = byId.get(r.questionId) ?? {
      questionId: r.questionId,
      runs: 0,
      refused: 0,
      leaked: [],
    };
    s.runs += 1;
    if (r.notFound) s.refused += 1;
    else s.leaked.push({ citationCount: r.citationCount, answer: r.answer });
    byId.set(r.questionId, s);
  }
  return [...byId.values()];
}
