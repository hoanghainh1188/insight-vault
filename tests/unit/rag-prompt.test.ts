import { describe, it, expect } from "vitest";
import {
  groundedSystemPrompt,
  openSystemPrompt,
  systemPromptFor,
} from "../../src/main/services/rag/prompt";

describe("system prompts", () => {
  it("grounded: buộc chỉ dùng context + không tìm thấy + cấm bịa; chèn context", () => {
    const p = groundedSystemPrompt("[1] noi dung");
    expect(p).toContain("CHỈ dựa trên");
    expect(p).toContain("Không tìm thấy trong nguồn.");
    expect(p).toMatch(/KHÔNG bịa/i);
    expect(p).toContain("[1] noi dung");
  });

  it("open: cho phép kiến thức chung nhưng gắn nhãn 'không dựa trên nguồn'", () => {
    const p = openSystemPrompt("[1] noi dung");
    expect(p).toContain("(không dựa trên nguồn)");
    expect(p).toContain("[1] noi dung");
  });

  it("systemPromptFor chọn đúng theo mode", () => {
    expect(systemPromptFor("grounded", "x")).toBe(groundedSystemPrompt("x"));
    expect(systemPromptFor("open", "x")).toBe(openSystemPrompt("x"));
  });
});
