import { describe, it, expect } from "vitest";
import { redact } from "../../src/main/logging";

describe("logging policy (FR-014)", () => {
  it("che các trường nhạy cảm (nội dung người dùng)", () => {
    const out = redact({
      text: "bí mật",
      content: "tài liệu",
      ok: "giữ",
    }) as Record<string, unknown>;
    expect(out.text).toBe("[REDACTED]");
    expect(out.content).toBe("[REDACTED]");
    expect(out.ok).toBe("giữ");
  });

  it("che đệ quy trong object lồng nhau", () => {
    const out = redact({ meta: { query: "hỏi gì đó", page: 12 } }) as Record<
      string,
      Record<string, unknown>
    >;
    expect(out.meta.query).toBe("[REDACTED]");
    expect(out.meta.page).toBe(12);
  });

  it("che trong mảng", () => {
    const out = redact([{ apiKey: "sk-xxx" }, { safe: 1 }]) as Record<
      string,
      unknown
    >[];
    expect(out[0].apiKey).toBe("[REDACTED]");
    expect(out[1].safe).toBe(1);
  });

  it("giá trị nguyên thuỷ trả nguyên", () => {
    expect(redact("hello")).toBe("hello");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
  });

  it("payload chat/embed (ai-runtime): che content trong messages + text", () => {
    const chat = redact({
      model: "qwen2.5:7b",
      messages: [{ role: "user", content: "tài liệu mật" }],
    }) as { model: string; messages: { content: string }[] };
    expect(chat.model).toBe("qwen2.5:7b");
    expect(chat.messages[0].content).toBe("[REDACTED]");

    const embed = redact({
      model: "nomic-embed-text",
      text: "đoạn nhạy cảm",
    }) as Record<string, unknown>;
    expect(embed.model).toBe("nomic-embed-text");
    expect(embed.text).toBe("[REDACTED]");
  });
});
