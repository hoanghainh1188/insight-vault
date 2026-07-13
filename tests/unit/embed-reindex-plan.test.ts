import { describe, it, expect } from "vitest";
import { planReindexBatches } from "../../src/main/services/embedding/reindex-plan";

describe("planReindexBatches", () => {
  it("chia đều đúng lô", () => {
    expect(planReindexBatches(["a", "b", "c", "d"], 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("lô cuối ngắn hơn (phần dư)", () => {
    expect(planReindexBatches(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
  });

  it("mảng rỗng → []", () => {
    expect(planReindexBatches([], 32)).toEqual([]);
  });

  it("batchSize lớn hơn số phần tử → 1 lô", () => {
    expect(planReindexBatches(["a", "b"], 100)).toEqual([["a", "b"]]);
  });

  it("batchSize <= 0 → ném lỗi", () => {
    expect(() => planReindexBatches(["a"], 0)).toThrow();
  });
});
