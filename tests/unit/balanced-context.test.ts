import { describe, it, expect } from "vitest";
import type { ScoredChunk } from "../../src/main/services/rag/rag-types";
import { buildBalancedContext } from "../../src/main/services/studio/balanced-context";

// Helper: 1 chunk của nguồn `sourceTitle`, độ dài `len` ký tự, ordinal cho thứ tự đọc.
function sc(
  id: string,
  sourceTitle: string,
  len: number,
  ordinal = 0,
): ScoredChunk {
  return {
    chunk: {
      id,
      sourceId: sourceTitle,
      ordinal,
      text: "x".repeat(len),
      locator: { page: null, charStart: 0, charEnd: len },
    },
    sourceTitle,
    score: 0,
  };
}

describe("buildBalancedContext (021-studio coverage #65)", () => {
  it("interleave round-robin: lấy chunk ĐẦU của mọi nguồn trước khi sang chunk kế", () => {
    const groups = [
      [sc("A0", "A", 50, 0), sc("A1", "A", 50, 1)],
      [sc("B0", "B", 50, 0), sc("B1", "B", 50, 1)],
      [sc("C0", "C", 50, 0), sc("C1", "C", 50, 1)],
    ];
    const { map } = buildBalancedContext(groups, 100_000);
    // Vòng 0: A0,B0,C0 → rồi vòng 1: A1,B1,C1 (KHÁC sequential A0,A1,B0,B1,…).
    expect([...map.values()].map((r) => r.chunk.id)).toEqual([
      "A0",
      "B0",
      "C0",
      "A1",
      "B1",
      "C1",
    ]);
    expect(map.get(1)?.n).toBe(1);
    expect(map.get(6)?.n).toBe(6);
  });

  it("khi ngân sách hẹp, MỌI nguồn vẫn giữ được chunk đầu (không nguồn nào bị bỏ trắng)", () => {
    // Mỗi chunk ~3000 ký tự. Vòng 0 (3 chunk ~9000+overhead) lọt budget 10000; vòng 1 tràn.
    const groups = [
      [sc("A0", "A", 3000, 0), sc("A1", "A", 3000, 1)],
      [sc("B0", "B", 3000, 0), sc("B1", "B", 3000, 1)],
      [sc("C0", "C", 3000, 0), sc("C1", "C", 3000, 1)],
    ];
    const { map } = buildBalancedContext(groups, 10_000);
    expect(map.size).toBe(3);
    const titles = new Set([...map.values()].map((r) => r.sourceTitle));
    expect(titles).toEqual(new Set(["A", "B", "C"]));
    // Không chunk vòng 1 nào lọt (chứng minh cắt phần dư sau khi đã trải đều).
    const ids = new Set([...map.values()].map((r) => r.chunk.id));
    expect(ids).toEqual(new Set(["A0", "B0", "C0"]));
  });

  it("luôn giữ ít nhất 1 chunk dù chunk đầu vượt ngân sách", () => {
    const groups = [[sc("big", "A", 20_000, 0)]];
    const { map } = buildBalancedContext(groups, 8000);
    expect(map.size).toBe(1);
    expect(map.get(1)?.chunk.id).toBe("big");
  });

  it("nguồn ĐẦU có chunk quá khổ vẫn KHÔNG bịt các nguồn sau (regression #65)", () => {
    // Bug gốc: chunk đầu nguồn A vượt budget → chiếm hết → B,C bị bỏ trắng.
    // Vòng 0 phải nhận chunk đầu của MỌI nguồn vô điều kiện.
    const groups = [
      [sc("A0", "A", 20_000, 0), sc("A1", "A", 100, 1)],
      [sc("B0", "B", 100, 0), sc("B1", "B", 100, 1)],
      [sc("C0", "C", 100, 0)],
    ];
    const { map } = buildBalancedContext(groups, 8000);
    const titles = new Set([...map.values()].map((r) => r.sourceTitle));
    expect(titles).toEqual(new Set(["A", "B", "C"]));
    // Chunk đầu của cả 3 nguồn đều có mặt; các chunk vòng ≥1 bị loại vì đã tràn budget.
    const ids = new Set([...map.values()].map((r) => r.chunk.id));
    expect(ids).toEqual(new Set(["A0", "B0", "C0"]));
  });

  it("nhóm độ dài KHÔNG đều — interleave dừng đúng cho nhóm cạn, tiếp cho nhóm còn dài", () => {
    const groups = [
      [sc("A0", "A", 30, 0)], // 1 chunk
      [sc("B0", "B", 30, 0), sc("B1", "B", 30, 1), sc("B2", "B", 30, 2)], // 3 chunk
    ];
    const { map } = buildBalancedContext(groups, 100_000);
    // Vòng 0: A0,B0 → vòng 1: (A cạn) B1 → vòng 2: (A cạn) B2.
    expect([...map.values()].map((r) => r.chunk.id)).toEqual([
      "A0",
      "B0",
      "B1",
      "B2",
    ]);
  });

  it("đánh số [n] liên tục 1..k và map giữ nguyên locator/id (kiểm chứng được)", () => {
    const groups = [[sc("A0", "A", 50, 0)], [sc("B0", "B", 50, 0)]];
    const { map, contextText } = buildBalancedContext(groups, 100_000);
    expect([...map.keys()]).toEqual([1, 2]);
    expect(map.get(1)?.chunk.locator).toEqual({
      page: null,
      charStart: 0,
      charEnd: 50,
    });
    expect(contextText).toContain("[1] (Nguồn: A");
    expect(contextText).toContain("[2] (Nguồn: B");
  });

  it("một nguồn duy nhất → giữ đúng thứ tự chunk của nguồn đó", () => {
    const groups = [
      [sc("A0", "A", 30, 0), sc("A1", "A", 30, 1), sc("A2", "A", 30, 2)],
    ];
    const { map } = buildBalancedContext(groups, 100_000);
    expect([...map.values()].map((r) => r.chunk.id)).toEqual([
      "A0",
      "A1",
      "A2",
    ]);
  });

  it("groups rỗng → context rỗng, map rỗng", () => {
    const { map, contextText } = buildBalancedContext([], 8000);
    expect(map.size).toBe(0);
    expect(contextText).toBe("");
  });
});
