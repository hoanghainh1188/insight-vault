import type { QuestionOutcome } from "./metrics";

// 187 (research R1–R3, data-model RerankCandidate / RerankDiagnosis): chẩn đoán vì sao bộ chấm độ liên quan từ chối nhầm câu có
// đáp án hoặc để lọt câu không đáp án. Hàm THUẦN — unit test ở tests/unit/eval-rerank-diagnose.test.ts.

/** Một đoạn ứng viên trong lượt chấm (thứ tự RRF, đã cắt maxCandidates) — ghi cả khi câu bị từ chối. */
export interface RerankCandidate {
  chunkId: string;
  source: string;
  /** điểm bộ chấm (sigmoid 0..1) */
  score: number;
  /** đoạn chứa trích dẫn đáp án (câu có đáp án) */
  hit: boolean;
  /** trích dẫn còn nằm trong phần đoạn sau khi tokenizer cắt ở maxTokens; null nếu không phải đoạn đúng */
  quoteInWindow: boolean | null;
}

export type RerankCause =
  | "cutOff"
  | "lowScoreInWindow"
  | "rankedOut"
  | "nearTopicHighScore"
  | "notRetrieved"
  | "ok";

export interface RerankDiagnosis {
  questionId: string;
  type: QuestionOutcome["type"];
  split: QuestionOutcome["split"];
  bestScore: number | null;
  /** điểm cao nhất của đoạn đúng */
  answerScore: number | null;
  /** hạng RRF (1-based) của đoạn đúng đầu tiên */
  answerRrfRank: number | null;
  /** của đoạn đúng có điểm cao nhất */
  quoteInWindow: boolean | null;
  cause: RerankCause;
}

/** Câu luôn có mặt trong chẩn đoán (kể cả `ok`): câu lọt của #187 + bộ kiểm hồi quy đáp án-trong-bảng. */
export const RERANK_WATCH_IDS: readonly string[] = [
  "q-176",
  "q-179",
  "q-162",
  "q-170",
  "q-171",
];

const TOP_K = 6;

/**
 * Id token của ĐOẠN trong một cặp đã mã hoá `<s> câu hỏi </s></s> đoạn </s>` (xlm-roberta) — phần sau cụm dấu tách đầu tiên, bỏ dấu
 * tách cuối. Cơ sở của cờ `quoteInWindow` (`windowText` ở rerank.ts). Không mutate.
 */
export function passageIds(ids: readonly number[], sep: number): number[] {
  const first = ids.indexOf(sep);
  if (first < 0) return [];
  let start = first;
  while (start < ids.length && ids[start] === sep) start += 1;
  const end = ids.lastIndexOf(sep);
  return ids.slice(start, end > start ? end : ids.length);
}

function maxOf(xs: readonly number[]): number | null {
  return xs.length === 0 ? null : Math.max(...xs);
}

function diagnoseOne(
  o: QuestionOutcome,
  cands: readonly RerankCandidate[],
  minScore: number,
): RerankDiagnosis {
  const hits = cands.filter((c) => c.hit);
  const best = hits.reduce<RerankCandidate | null>(
    (b, c) => (b === null || c.score > b.score ? c : b),
    null,
  );
  const firstHit = cands.findIndex((c) => c.hit);
  const base = {
    questionId: o.questionId,
    type: o.type,
    split: o.split,
    bestScore: maxOf(cands.map((c) => c.score)),
    answerScore: best?.score ?? null,
    answerRrfRank: firstHit >= 0 ? firstHit + 1 : null,
    quoteInWindow: best?.quoteInWindow ?? null,
  };
  if (o.type === "unanswerable") {
    return { ...base, cause: o.rejected ? "ok" : "nearTopicHighScore" };
  }
  const missed = o.rejected || o.hitRank === null || o.hitRank > TOP_K;
  if (!missed) return { ...base, cause: "ok" };
  if (best === null) return { ...base, cause: "notRetrieved" };
  if (best.quoteInWindow === false) return { ...base, cause: "cutOff" };
  if (best.score < minScore) return { ...base, cause: "lowScoreInWindow" };
  // Đủ điểm, trong cửa sổ mà vẫn lỡ ⇒ rơi khỏi top 6 hoặc bị bước khác (delta / MMR) loại.
  return { ...base, cause: "rankedOut" };
}

/**
 * Chẩn đoán từng câu có `rerankCandidates` (thiếu ⇒ bỏ qua). Trả mọi câu có nguyên nhân ≠ ok + câu trong danh sách quan tâm,
 * theo thứ tự đầu vào. Không mutate.
 */
export function diagnoseRerank(
  outcomes: readonly QuestionOutcome[],
  minScore: number,
  watchIds: readonly string[] = RERANK_WATCH_IDS,
): RerankDiagnosis[] {
  const watch = new Set(watchIds);
  return outcomes.flatMap((o) => {
    if (!o.rerankCandidates) return [];
    const d = diagnoseOne(o, o.rerankCandidates, minScore);
    return d.cause !== "ok" || watch.has(o.questionId) ? [d] : [];
  });
}
