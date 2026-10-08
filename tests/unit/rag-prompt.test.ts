import { describe, it, expect } from "vitest";
import {
  groundedSystemPrompt,
  languageDirective,
  openSystemPrompt,
  systemPromptFor,
} from "../../src/main/services/rag/prompt";

// 123 (FR-019, FR-020; research R8): lời nhắc English duy nhất + chỉ dẫn ngôn ngữ đầu ra theo câu hỏi.
// "Không tìm thấy" KHÔNG còn bắt câu nguyên văn (app quyết theo cấu trúc: không [n] hợp lệ ⇒ notFound).

describe("languageDirective", () => {
  it("luôn dặn trả lời theo ngôn ngữ câu hỏi cuối; chỉ định rõ khi biết chắc", () => {
    const base = "same language as the user's last question";
    expect(languageDirective(undefined)).toContain(base);
    expect(languageDirective("vi")).toContain(base);
    expect(languageDirective("vi")).toContain("Vietnamese");
    expect(languageDirective("en")).toContain("English");
    expect(languageDirective(undefined)).not.toMatch(/Vietnamese|English\./);
  });
});

describe("system prompts", () => {
  it("grounded: chỉ dùng đoạn nguồn, chèn [n], không bịa, nói ngắn khi không có; chèn context", () => {
    const p = groundedSystemPrompt("[1] noi dung");
    expect(p).toContain("ONLY");
    expect(p).toContain("[n]");
    expect(p).toMatch(/do not make anything up/i);
    expect(p).toMatch(/do not contain/i);
    expect(p).toContain("[1] noi dung");
    // Đo 123: câu hỏi tiếng Việt ⇒ câu cố định (giữ từ chối đúng); English/không rõ ⇒ chỉ dẫn mềm (tránh từ chối nhầm).
    expect(groundedSystemPrompt("x", "vi")).toContain(
      '"Không tìm thấy trong nguồn."',
    );
    expect(groundedSystemPrompt("x", "en")).toMatch(
      /say briefly that the sources do not contain it/,
    );
    expect(groundedSystemPrompt("x", "en")).not.toContain("Không tìm thấy");
    expect(p).not.toContain("Không tìm thấy");
  });

  it("open: cho phép kiến thức chung nhưng gắn nhãn ngoài nguồn theo ngôn ngữ câu trả lời (Constitution II)", () => {
    const p = openSystemPrompt("[1] noi dung", "vi");
    expect(p).toContain("(not based on sources)");
    expect(p).toContain("(không dựa trên nguồn)");
    expect(p).toMatch(/do NOT put \[n\]/);
    expect(p).toContain("[1] noi dung");
    expect(p).toContain("Vietnamese");
  });

  it("lời nhắc không còn chỉ dẫn tiếng Việt (ngoài ví dụ nhãn ngoài nguồn)", () => {
    const VI =
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    expect(groundedSystemPrompt("x", "en")).not.toMatch(VI);
    expect(groundedSystemPrompt("x", "vi")).toContain(
      '"Không tìm thấy trong nguồn."',
    );
    expect(
      openSystemPrompt("x", "en").replace("(không dựa trên nguồn)", ""),
    ).not.toMatch(VI);
  });

  it("systemPromptFor chọn theo mode và truyền ngôn ngữ", () => {
    expect(systemPromptFor("grounded", "x", "en")).toBe(
      groundedSystemPrompt("x", "en"),
    );
    expect(systemPromptFor("open", "x")).toBe(openSystemPrompt("x"));
  });
});
