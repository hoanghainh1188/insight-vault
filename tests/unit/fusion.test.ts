import { describe, it, expect } from "vitest";
import {
  reciprocalRankFusion,
  mmrSelect,
} from "../../src/main/services/rag/fusion";

describe("reciprocalRankFusion (055)", () => {
  it("id ở đầu CẢ HAI list → xếp cao nhất", () => {
    const out = reciprocalRankFusion([
      ["a", "b", "c"],
      ["a", "x", "y"],
    ]);
    expect(out[0]).toBe("a"); // xuất hiện đầu cả 2 → điểm cao nhất
    expect(out).toContain("b");
    expect(out).toContain("x");
  });
  it("dedup; list rỗng bỏ qua", () => {
    const out = reciprocalRankFusion([["a", "b"], [], ["b"]]);
    expect(out.filter((x) => x === "b")).toHaveLength(1);
  });
  it("rỗng → []", () => {
    expect(reciprocalRankFusion([])).toEqual([]);
  });
});

describe("mmrSelect (055)", () => {
  const q = [1, 0];
  it("loại gần-trùng: giữa 2 đoạn gần-trùng (a,b) chỉ chọn 1, rồi lấy đoạn đa dạng+liên quan (c)", () => {
    // q chéo; a,b gần-trùng (đều lệch trục x); c khác hướng NHƯNG vẫn liên quan q.
    const qDiag = [1, 1];
    const cands = [
      { id: "a", vector: [1, 0] },
      { id: "b", vector: [0.98, 0.02] }, // gần trùng a (rel hơi cao hơn)
      { id: "c", vector: [0, 1] }, // đa dạng so với a/b, vẫn liên quan q chéo
    ];
    const out = mmrSelect(cands, qDiag, 2, 0.7);
    expect(out).toHaveLength(2);
    expect(out).toContain("c"); // đoạn đa dạng được chọn
    expect(out).not.toContain("a"); // a bị loại vì gần-trùng b (đã chọn)
  });
  it("cand thiếu vector → giữ theo order, xếp sau cand có vector", () => {
    const cands = [
      { id: "a", vector: [1, 0] },
      { id: "b" }, // không vector
    ];
    const out = mmrSelect(cands, q, 5, 0.7);
    expect(out).toEqual(["a", "b"]);
  });
  it("queryVector rỗng → giữ thứ tự đầu vào, cắt n", () => {
    const cands = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(mmrSelect(cands, [], 2)).toEqual(["a", "b"]);
  });
  it("trả ≤ n", () => {
    const cands = [
      { id: "a", vector: [1, 0] },
      { id: "b", vector: [0, 1] },
      { id: "c", vector: [1, 1] },
    ];
    expect(mmrSelect(cands, q, 2).length).toBe(2);
  });
});
