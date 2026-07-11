import { describe, it, expect } from "vitest";
import { postprocessCitations } from "../../src/main/services/rag/citation";
import type { RetrievedChunk } from "../../src/main/services/rag/rag-types";

function chunk(n: number): RetrievedChunk {
  return {
    n,
    sourceTitle: `Nguồn ${n}`,
    score: 0.1 * n,
    chunk: {
      id: `c${n}`,
      sourceId: `s${n}`,
      ordinal: n,
      text: `text ${n}`,
      locator: { page: n, charStart: n, charEnd: n + 5 },
    },
  };
}

const mapOf = (...ns: number[]) =>
  new Map<number, RetrievedChunk>(ns.map((n) => [n, chunk(n)]));

describe("postprocessCitations — CRUX Constitution II / SC-002", () => {
  it("[n] hợp lệ → giữ chip + citation map đúng chunk/nguồn/locator", () => {
    const map = mapOf(1, 2, 3);
    const r = postprocessCitations("Câu trả lời [1] và thêm [2].", map);
    expect(r.answer).toContain("[1]");
    expect(r.answer).toContain("[2]");
    expect(r.citations).toHaveLength(2);
    expect(r.citations[0]).toEqual({
      n: 1,
      chunkId: "c1",
      sourceId: "s1",
      sourceTitle: "Nguồn 1",
      locator: { page: 1, charStart: 1, charEnd: 6 },
    });
  });

  it("[n] NGOÀI phạm vi (bịa) → GỠ khỏi answer + không vào citations", () => {
    const map = mapOf(1, 2, 3); // chỉ 3 chunk
    const r = postprocessCitations("Đúng [2] nhưng bịa [9] ở đây.", map);
    expect(r.answer).not.toContain("[9]");
    expect(r.answer).toContain("[2]");
    expect(r.citations.map((c) => c.n)).toEqual([2]);
  });

  it("dedup theo n; sắp theo n tăng dần", () => {
    const map = mapOf(1, 2, 3);
    const r = postprocessCitations("[3] rồi [1] rồi lại [1] và [3].", map);
    expect(r.citations.map((c) => c.n)).toEqual([1, 3]);
  });

  it("answer không có chip → citations rỗng", () => {
    const r = postprocessCitations("Không tìm thấy trong nguồn.", mapOf(1, 2));
    expect(r.citations).toEqual([]);
    expect(r.answer).toBe("Không tìm thấy trong nguồn.");
  });

  it("map rỗng → mọi chip bị gỡ, citations rỗng", () => {
    const r = postprocessCitations("Bịa [1] [2].", new Map());
    expect(r.citations).toEqual([]);
    expect(r.answer).not.toMatch(/\[\d+\]/);
  });
});
