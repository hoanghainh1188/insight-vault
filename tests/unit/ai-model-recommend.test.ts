import { describe, it, expect } from "vitest";
import { recommendChatModel } from "../../src/main/services/ai/model-recommend";

const GB = 1024 * 1024 * 1024;

describe("recommendChatModel", () => {
  it("< 8GB → small (~3B)", () => {
    const r = recommendChatModel(6 * GB);
    expect(r.tier).toBe("small");
    expect(r.examples.length).toBeGreaterThan(0);
    expect(r.totalMemGb).toBeCloseTo(6, 1);
  });

  it("8–16GB → medium (7–8B)", () => {
    expect(recommendChatModel(8 * GB).tier).toBe("medium");
    expect(recommendChatModel(16 * GB).tier).toBe("medium");
  });

  it("> 16GB → large", () => {
    const r = recommendChatModel(32 * GB);
    expect(r.tier).toBe("large");
    expect(r.totalMemGb).toBeCloseTo(32, 1);
  });

  it("biên < 8GB thuộc small (7.9GB)", () => {
    expect(recommendChatModel(7.9 * GB).tier).toBe("small");
  });
});
