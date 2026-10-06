import { describe, it, expect, vi, afterEach } from "vitest";
import { homedir } from "node:os";
import { logError, logEvent, redact, setLogSink } from "../../src/main/logging";

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

  it("che mật khẩu sao lưu (085)", () => {
    const out = redact({ password: "mat-khau-123", code: "busy" }) as Record<
      string,
      unknown
    >;
    expect(out.password).toBe("[REDACTED]");
    expect(out.code).toBe("busy");
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

  it("che khoá không phân biệt hoa thường + khoá dễ chứa đường dẫn/tên tệp (088)", () => {
    const out = redact({
      Token: "t",
      API_KEY: "k",
      authorization: "Bearer x",
      path: "/Users/a/doc.pdf",
      filename: "hop-dong.pdf",
      title: "Hồ sơ",
      url: "https://x",
      message: "ENOENT /Users/a",
      reason: "crashed",
    }) as Record<string, unknown>;
    for (const k of [
      "Token",
      "authorization",
      "path",
      "filename",
      "title",
      "url",
      "message",
    ])
      expect(out[k]).toBe("[REDACTED]");
    expect(out.reason).toBe("crashed");
  });

  it("meta vòng tham chiếu không làm tràn stack", () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = loop;
    expect(() => redact(loop)).not.toThrow();
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

describe("ghi nhật ký ra file (088)", () => {
  afterEach(() => {
    setLogSink(null);
    vi.restoreAllMocks();
  });

  it("logEvent ghi dòng JSON level info với meta ĐÃ che vào sink", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const lines: string[] = [];
    setLogSink({ write: (l) => void lines.push(l) });
    logEvent("rag.ask", { query: "câu hỏi mật", k: 8 });
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0]);
    expect(rec.level).toBe("info");
    expect(rec.event).toBe("rag.ask");
    expect(rec.meta).toEqual({ query: "[REDACTED]", k: 8 });
    expect(lines[0]).not.toContain("câu hỏi mật");
    expect(Number.isNaN(Date.parse(rec.ts))).toBe(false);
  });

  it("logError ghi level error và in qua console.error", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lines: string[] = [];
    setLogSink({ write: (l) => void lines.push(l) });
    logError("renderer.gone", { reason: "crashed" });
    expect(JSON.parse(lines[0]).level).toBe("error");
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("đường dẫn trong thư mục nhà (lộ tên tài khoản) được thay bằng ~ trước khi ghi", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const lines: string[] = [];
    setLogSink({ write: (l) => void lines.push(l) });
    const home = homedir();
    logEvent("x", { where: `${home}/Library/Logs`, list: [`${home}/a`] });
    expect(lines[0]).not.toContain(home);
    expect(JSON.parse(lines[0]).meta).toEqual({
      where: "~/Library/Logs",
      list: ["~/a"],
    });
  });

  it("sink ném lỗi ⇒ logEvent không ném lên tầng gọi", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setLogSink({
      write: () => {
        throw new Error("boom");
      },
    });
    expect(() => logEvent("x")).not.toThrow();
  });

  it("chưa gắn sink ⇒ chỉ console, không lỗi", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(() => logEvent("x")).not.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
  });
});
