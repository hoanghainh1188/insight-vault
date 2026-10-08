import { describe, it, expect } from "vitest";
import type { StudioKind } from "../../src/shared/ipc/types";
import {
  languageReminder,
  systemPromptFor,
} from "../../src/main/services/studio/prompt";

// 123 (FR-018, FR-019): lời nhắc Studio English, ngôn ngữ đầu ra = ngôn ngữ giao diện lúc tạo.

const KINDS: StudioKind[] = ["summary", "keyPoints", "faq", "outline"];

describe("studio prompt", () => {
  it("phủ 4 kind; mỗi prompt yêu cầu chèn [n] + không bịa + ngôn ngữ đầu ra", () => {
    for (const kind of KINDS) {
      const vi = systemPromptFor(kind, "vi");
      expect(vi).toContain("[n]");
      expect(vi).toMatch(/NEVER make anything up/);
      expect(vi).toContain("Write in Vietnamese");
      expect(systemPromptFor(kind, "en")).toContain("Write in English");
    }
  });

  it("ép tuân thủ chip [n] (REQUIRED) + bao quát ALL nguồn (#65)", () => {
    for (const kind of KINDS) {
      const p = systemPromptFor(kind, "en");
      expect(p).toContain("REQUIRED");
      expect(p).toContain("ALL");
    }
  });

  it("prompt khác nhau theo loại; FAQ nhãn theo ngôn ngữ đầu ra", () => {
    const set = new Set(KINDS.map((k) => systemPromptFor(k, "en")));
    expect(set.size).toBe(4);
    expect(systemPromptFor("summary", "en")).toContain("SUMMARY");
    expect(systemPromptFor("keyPoints", "en")).toContain("KEY POINTS");
    expect(systemPromptFor("outline", "en")).toContain("OUTLINE");
    expect(systemPromptFor("faq", "en")).toContain("'Q: …'");
    expect(systemPromptFor("faq", "vi")).toContain("'Hỏi: …'");
  });

  it("kind không hợp lệ → ném lỗi", () => {
    expect(() => systemPromptFor("xxx" as StudioKind, "en")).toThrow();
  });
});

describe("123 quickstart: nhắc lại ngôn ngữ đầu ra ở CUỐI (nguồn khác ngôn ngữ — model nhỏ hay bám ngôn ngữ nguồn)", () => {
  it("dòng cuối system prompt + lời nhắc kèm tin người dùng nêu rõ ngôn ngữ, kể cả khi nguồn khác ngôn ngữ", () => {
    for (const kind of KINDS) {
      const last = systemPromptFor(kind, "en").split("\n").at(-1)!;
      expect(last).toMatch(/entire answer in English.*another language/);
    }
    expect(languageReminder("en")).toMatch(/English/);
    expect(languageReminder("vi")).toMatch(/Vietnamese/);
  });
});
