import { describe, it, expect } from "vitest";
import {
  diagnoseRerank,
  passageIds,
  RERANK_WATCH_IDS,
  type RerankCandidate,
} from "../eval/lib/rerank-diagnose";
import type { QuestionOutcome } from "../eval/lib/metrics";

// 187 (T003, research R3, data-model RerankDiagnosis): phân loại vì sao bộ chấm từ chối nhầm / để lọt từng câu — hàm THUẦN.

const MIN = 0.6;

const cand = (
  chunkId: string,
  score: number,
  hit = false,
  quoteInWindow: boolean | null = hit ? true : null,
): RerankCandidate => ({
  chunkId,
  source: `src-${chunkId}`,
  score,
  hit,
  quoteInWindow,
});

const out = (
  over: Partial<QuestionOutcome> & Pick<QuestionOutcome, "questionId">,
): QuestionOutcome => ({
  lang: "vi",
  type: "answerable",
  split: "dev",
  rejected: false,
  hitRank: 1,
  ...over,
});

describe("diagnoseRerank", () => {
  it("câu có đáp án bị từ chối, đoạn đúng bị cắt khỏi cửa sổ ⇒ cutOff", () => {
    const [d] = diagnoseRerank(
      [
        out({
          questionId: "q-1",
          rejected: true,
          hitRank: null,
          rerankCandidates: [cand("a", 0.3), cand("b", 0.2, true, false)],
        }),
      ],
      MIN,
    );
    expect(d).toEqual({
      questionId: "q-1",
      type: "answerable",
      split: "dev",
      bestScore: 0.3,
      answerScore: 0.2,
      answerRrfRank: 2,
      quoteInWindow: false,
      cause: "cutOff",
    });
  });

  it("đáp án trong cửa sổ nhưng điểm < minScore ⇒ lowScoreInWindow", () => {
    const [d] = diagnoseRerank(
      [
        out({
          questionId: "q-2",
          split: "holdout",
          rejected: true,
          hitRank: null,
          rerankCandidates: [cand("a", 0.4, true, true)],
        }),
      ],
      MIN,
    );
    expect(d.cause).toBe("lowScoreInWindow");
    expect(d.answerRrfRank).toBe(1);
    expect(d.split).toBe("holdout");
  });

  it("không có đoạn đúng trong ứng viên ⇒ notRetrieved", () => {
    const [d] = diagnoseRerank(
      [
        out({
          questionId: "q-3",
          rejected: true,
          hitRank: null,
          rerankCandidates: [cand("a", 0.1), cand("b", 0.05)],
        }),
      ],
      MIN,
    );
    expect(d).toMatchObject({
      cause: "notRetrieved",
      bestScore: 0.1,
      answerScore: null,
      answerRrfRank: null,
      quoteInWindow: null,
    });
  });

  it("câu có đáp án tụt khỏi top 6 (không bị từ chối) cũng được chẩn đoán", () => {
    const [d] = diagnoseRerank(
      [
        out({
          questionId: "q-4",
          hitRank: 8,
          rerankCandidates: [cand("a", 0.9), cand("b", 0.5, true, true)],
        }),
      ],
      MIN,
    );
    expect(d.cause).toBe("lowScoreInWindow");
  });

  it("đoạn đúng tốt nhất (điểm cao nhất) quyết định cửa sổ; hạng RRF lấy đoạn đúng đầu tiên", () => {
    const [d] = diagnoseRerank(
      [
        out({
          questionId: "q-5",
          rejected: true,
          hitRank: null,
          rerankCandidates: [
            cand("a", 0.1),
            cand("b", 0.2, true, false),
            cand("c", 0.5, true, true),
          ],
        }),
      ],
      MIN,
    );
    expect(d).toMatchObject({
      answerScore: 0.5,
      answerRrfRank: 2,
      quoteInWindow: true,
      cause: "lowScoreInWindow",
    });
  });

  it("lỡ dù đoạn đúng trong cửa sổ và điểm ≥ minScore (rơi khỏi top 6 / bị bước khác loại) ⇒ rankedOut", () => {
    const [d] = diagnoseRerank(
      [
        out({
          questionId: "q-10",
          hitRank: 9,
          rerankCandidates: [cand("a", 0.95), cand("b", 0.7, true, true)],
        }),
      ],
      MIN,
    );
    expect(d).toMatchObject({
      cause: "rankedOut",
      answerScore: 0.7,
      answerRrfRank: 2,
    });
  });

  it("câu không đáp án không bị từ chối ⇒ nearTopicHighScore kèm bestScore", () => {
    const [d] = diagnoseRerank(
      [
        out({
          questionId: "q-6",
          type: "unanswerable",
          hitRank: null,
          rerankCandidates: [cand("a", 0.7), cand("b", 0.95)],
        }),
      ],
      MIN,
    );
    expect(d).toEqual({
      questionId: "q-6",
      type: "unanswerable",
      split: "dev",
      bestScore: 0.95,
      answerScore: null,
      answerRrfRank: null,
      quoteInWindow: null,
      cause: "nearTopicHighScore",
    });
  });

  it("câu ổn ngoài danh sách quan tâm ⇒ không xuất; câu trong danh sách quan tâm ⇒ luôn xuất (kể cả ok)", () => {
    const ok = [cand("a", 0.9, true, true)];
    const res = diagnoseRerank(
      [
        out({ questionId: "q-100", rerankCandidates: ok }),
        out({ questionId: "q-162", rerankCandidates: ok }),
        out({
          questionId: "q-176",
          type: "unanswerable",
          rejected: true,
          hitRank: null,
          rerankCandidates: [cand("a", 0.2)],
        }),
      ],
      MIN,
    );
    expect(res.map((d) => [d.questionId, d.cause])).toEqual([
      ["q-162", "ok"],
      ["q-176", "ok"],
    ]);
    expect(RERANK_WATCH_IDS).toEqual(
      expect.arrayContaining(["q-176", "q-179", "q-162", "q-170", "q-171"]),
    );
  });

  it("thiếu rerankCandidates ⇒ bỏ qua câu (kể cả câu quan tâm)", () => {
    expect(
      diagnoseRerank(
        [out({ questionId: "q-162", rejected: true, hitRank: null })],
        MIN,
      ),
    ).toEqual([]);
  });

  it("ứng viên rỗng ⇒ bestScore null", () => {
    const [d] = diagnoseRerank(
      [
        out({
          questionId: "q-7",
          type: "unanswerable",
          hitRank: null,
          rerankCandidates: [],
        }),
      ],
      MIN,
    );
    expect(d.bestScore).toBeNull();
  });

  it("danh sách quan tâm truyền vào thay mặc định", () => {
    const res = diagnoseRerank(
      [out({ questionId: "q-9", rerankCandidates: [cand("a", 0.9, true)] })],
      MIN,
      ["q-9"],
    );
    expect(res.map((d) => d.questionId)).toEqual(["q-9"]);
  });

  it("không mutate đầu vào", () => {
    const input = [
      out({
        questionId: "q-8",
        rejected: true,
        hitRank: null,
        rerankCandidates: [cand("b", 0.2, true, false), cand("a", 0.3)],
      }),
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    diagnoseRerank(input, MIN);
    expect(input).toEqual(snapshot);
  });
});

// 187 (review): id token của ĐOẠN trong cặp đã mã hoá `<s> câu hỏi </s></s> đoạn </s>` (xlm-roberta) — cơ sở của cờ quoteInWindow.
describe("passageIds", () => {
  const SEP = 2;
  it("lấy phần sau cụm dấu tách đầu tiên, bỏ dấu tách cuối", () => {
    expect(passageIds([0, 11, 12, SEP, SEP, 21, 22, 23, SEP], SEP)).toEqual([
      21, 22, 23,
    ]);
  });
  it("đoạn bị cắt vẫn kết thúc bằng dấu tách ⇒ phần còn lại", () => {
    expect(passageIds([0, 11, SEP, SEP, 21, SEP], SEP)).toEqual([21]);
  });
  it("không có dấu tách ⇒ rỗng; đoạn rỗng ⇒ rỗng", () => {
    expect(passageIds([0, 11, 12], SEP)).toEqual([]);
    expect(passageIds([0, 11, SEP, SEP], SEP)).toEqual([]);
  });
  it("không mutate", () => {
    const ids = [0, 11, SEP, SEP, 21, SEP];
    passageIds(ids, SEP);
    expect(ids).toEqual([0, 11, SEP, SEP, 21, SEP]);
  });
});
