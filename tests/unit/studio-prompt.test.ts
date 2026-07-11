import { describe, it, expect } from "vitest";
import type { StudioKind } from "../../src/shared/ipc/types";
import { systemPromptFor } from "../../src/main/services/studio/prompt";

const KINDS: StudioKind[] = ["summary", "keyPoints", "faq", "outline"];

describe("studio prompt", () => {
  it("phủ 4 kind; mỗi prompt yêu cầu chèn [n] + không bịa + tiếng Việt", () => {
    for (const kind of KINDS) {
      const p = systemPromptFor(kind);
      expect(p.length).toBeGreaterThan(0);
      expect(p).toContain("[n]");
      expect(p.toLowerCase()).toContain("không bịa");
      expect(p).toContain("tiếng Việt");
    }
  });

  it("prompt khác nhau theo loại (nhiệm vụ riêng)", () => {
    const set = new Set(KINDS.map((k) => systemPromptFor(k)));
    expect(set.size).toBe(4);
    expect(systemPromptFor("summary")).toContain("TÓM TẮT");
    expect(systemPromptFor("keyPoints")).toContain("Ý CHÍNH");
    expect(systemPromptFor("faq")).toContain("HỎI");
    expect(systemPromptFor("outline")).toContain("DÀN Ý");
  });

  it("kind không hợp lệ → ném lỗi", () => {
    expect(() => systemPromptFor("xxx" as StudioKind)).toThrow();
  });
});
