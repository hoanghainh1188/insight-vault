import type { QuestionOutcome } from "./metrics";

// 187 PR 2 (FR-005): so từng câu của một cấu hình với mốc (v5 hiện hành) theo đường app. Hàm THUẦN — test ở
// tests/unit/eval-rerank-sweep.test.ts.

export interface QuestionDiff {
  questionId: string;
  lang: QuestionOutcome["lang"];
  split: QuestionOutcome["split"];
  type: QuestionOutcome["type"];
  detail: string;
}

export interface OutcomeDiff {
  /** tốt hơn mốc: từ chối đúng mới / hết bị từ chối nhầm / hạng đoạn đúng lên */
  rescued: QuestionDiff[];
  /** tệ hơn mốc: lọt mới / từ chối nhầm mới / hạng đoạn đúng xuống */
  regressed: QuestionDiff[];
  unchanged: number;
}

/** Hạng để so: bị từ chối hoặc không trúng ⇒ vô cực. */
const rankOf = (o: QuestionOutcome): number =>
  o.rejected || o.hitRank === null ? Infinity : o.hitRank;

const fmt = (o: QuestionOutcome): string =>
  o.rejected
    ? "từ chối"
    : o.hitRank === null
      ? "lọt, không trúng"
      : `hạng ${o.hitRank}`;

/** Chiều của thay đổi: -1 tốt hơn, 1 tệ hơn, 0 như cũ. Chỉ xét câu có ở cả hai phía. */
function direction(b: QuestionOutcome, c: QuestionOutcome): -1 | 0 | 1 {
  if (b.type === "unanswerable") {
    if (b.rejected === c.rejected) return 0;
    return c.rejected ? -1 : 1;
  }
  if (c.rejected && !b.rejected) return 1;
  if (b.rejected && !c.rejected) return -1;
  const rb = rankOf(b);
  const rc = rankOf(c);
  return rc === rb ? 0 : rc > rb ? 1 : -1;
}

export function compareOutcomes(
  baseline: readonly QuestionOutcome[],
  candidate: readonly QuestionOutcome[],
): OutcomeDiff {
  const base = new Map(baseline.map((o) => [o.questionId, o]));
  const out: OutcomeDiff = { rescued: [], regressed: [], unchanged: 0 };
  for (const c of candidate) {
    const b = base.get(c.questionId);
    if (!b) continue;
    const d = direction(b, c);
    if (d === 0) {
      out.unchanged += 1;
      continue;
    }
    const diff: QuestionDiff = {
      questionId: c.questionId,
      lang: c.lang,
      split: c.split,
      type: c.type,
      detail: `${fmt(b)} → ${fmt(c)}`,
    };
    (d < 0 ? out.rescued : out.regressed).push(diff);
  }
  return out;
}
