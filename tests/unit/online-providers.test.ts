import { describe, it, expect, vi } from "vitest";
import type { ChatMessage } from "../../src/shared/ipc/types";
import {
  AnthropicProvider,
  toAnthropicRequest,
  parseAnthropicResponse,
} from "../../src/main/services/ai-runtime/online/anthropic-provider";
import {
  GeminiProvider,
  toGeminiRequest,
  parseGeminiResponse,
} from "../../src/main/services/ai-runtime/online/gemini-provider";
import {
  OpenAIProvider,
  toOpenAIRequest,
  parseOpenAIResponse,
} from "../../src/main/services/ai-runtime/online/openai-provider";
import { OnlineProviderError } from "../../src/main/services/ai-runtime/online/online-error";

const MSGS: ChatMessage[] = [
  { role: "system", content: "Bạn là trợ lý." },
  { role: "user", content: "Xin chào" },
  { role: "assistant", content: "Chào bạn" },
  { role: "user", content: "Tóm tắt đi" },
];

// fetch giả trả JSON body với status tuỳ chọn.
function okFetch(body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  })) as unknown as typeof fetch;
}
function statusFetch(status: number): typeof fetch {
  return vi.fn(async () => ({
    ok: false,
    status,
    json: async () => ({}),
  })) as unknown as typeof fetch;
}
// fetch giả trả body là ReadableStream (cho đường stream 039 — streamLines đọc từng dòng).
function streamFetch(chunks: string[]): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder();
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    }),
  })) as unknown as typeof fetch;
}
const deps = (
  fetchFn: typeof fetch,
  key: string | null = "k",
  model = "m",
) => ({
  getKey: async () => key,
  getModel: () => model,
  fetchFn,
});

describe("AnthropicProvider (031)", () => {
  it("toAnthropicRequest tách system, map role, có max_tokens", () => {
    const b = toAnthropicRequest(MSGS, "claude-opus-4-5");
    expect(b.system).toContain("trợ lý");
    expect(b.messages).toEqual([
      { role: "user", content: "Xin chào" },
      { role: "assistant", content: "Chào bạn" },
      { role: "user", content: "Tóm tắt đi" },
    ]);
    expect(b.max_tokens).toBeGreaterThan(0);
  });

  it("parseAnthropicResponse nối block text; rác → ''", () => {
    expect(
      parseAnthropicResponse({
        content: [
          { type: "text", text: "A" },
          { type: "tool_use" },
          { type: "text", text: "B" },
        ],
      }),
    ).toBe("AB");
    expect(parseAnthropicResponse({})).toBe("");
  });

  it("chat 200 → content; 401 → OnlineProviderError auth", async () => {
    const p = new AnthropicProvider(
      deps(okFetch({ content: [{ type: "text", text: "Kết quả" }] })),
    );
    expect((await p.chat({ messages: MSGS })).content).toBe("Kết quả");
    const p401 = new AnthropicProvider(deps(statusFetch(401)));
    await expect(p401.chat({ messages: MSGS })).rejects.toBeInstanceOf(
      OnlineProviderError,
    );
  });

  it("thiếu key → ném; embed luôn ném (dùng Ollama)", async () => {
    const p = new AnthropicProvider(deps(okFetch({}), null));
    await expect(p.chat({ messages: MSGS })).rejects.toThrow(/khóa API/i);
    await expect(
      new AnthropicProvider(deps(okFetch({}))).embed(),
    ).rejects.toThrow(/embedding/i);
  });
});

describe("GeminiProvider (031)", () => {
  it("toGeminiRequest: system→systemInstruction, assistant→model", () => {
    const b = toGeminiRequest(MSGS);
    expect(b.systemInstruction?.parts[0].text).toContain("trợ lý");
    expect(b.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(b.contents[0].parts[0].text).toBe("Xin chào");
  });

  it("parseGeminiResponse lấy parts của candidate đầu", () => {
    expect(
      parseGeminiResponse({
        candidates: [{ content: { parts: [{ text: "X" }, { text: "Y" }] } }],
      }),
    ).toBe("XY");
    expect(parseGeminiResponse({ candidates: [] })).toBe("");
  });

  it("chat 200 → content; 429 → rate-limit", async () => {
    const p = new GeminiProvider(
      deps(okFetch({ candidates: [{ content: { parts: [{ text: "OK" }] } }] })),
    );
    expect((await p.chat({ messages: MSGS })).content).toBe("OK");
    await expect(
      new GeminiProvider(deps(statusFetch(429))).chat({ messages: MSGS }),
    ).rejects.toMatchObject({ kind: "rate-limit" });
  });

  it("chat stream (039): nối delta SSE Gemini qua onToken", async () => {
    const tokens: string[] = [];
    const p = new GeminiProvider(
      deps(
        streamFetch([
          'data: {"candidates":[{"content":{"parts":[{"text":"Chào "}]}}]}\n',
          'data: {"candidates":[{"content":{"parts":[{"text":"bạn"}]}}]}\n',
        ]),
      ),
    );
    const res = await p.chat(
      { messages: MSGS },
      { onToken: (d) => tokens.push(d) },
    );
    expect(tokens).toEqual(["Chào ", "bạn"]);
    expect(res.content).toBe("Chào bạn");
  });
});

describe("OpenAIProvider (031)", () => {
  it("toOpenAIRequest giữ nguyên messages", () => {
    const b = toOpenAIRequest(MSGS, "gpt-4o");
    expect(b.messages).toHaveLength(4);
    expect(b.messages[0]).toEqual({
      role: "system",
      content: "Bạn là trợ lý.",
    });
  });

  it("parseOpenAIResponse lấy choice đầu", () => {
    expect(
      parseOpenAIResponse({ choices: [{ message: { content: "Z" } }] }),
    ).toBe("Z");
    expect(parseOpenAIResponse({ choices: [] })).toBe("");
  });

  it("chat 200 → content; embed ném", async () => {
    const p = new OpenAIProvider(
      deps(okFetch({ choices: [{ message: { content: "Trả lời" } }] })),
    );
    expect((await p.chat({ messages: MSGS })).content).toBe("Trả lời");
    await expect(p.embed()).rejects.toThrow(/embedding/i);
  });

  it("test(): thiếu key → reachable=false + reason", async () => {
    const p = new OpenAIProvider(deps(okFetch({}), null));
    const s = await p.test();
    expect(s.reachable).toBe(false);
    expect(s.reason).toMatch(/khóa API/i);
  });

  it("chat stream (039): nối delta SSE qua onToken, trả nội dung đầy đủ", async () => {
    const tokens: string[] = [];
    const p = new OpenAIProvider(
      deps(
        streamFetch([
          'data: {"choices":[{"delta":{"content":"Xin "}}]}\n',
          'data: {"choices":[{"delta":{"content":"chào"}}]}\n',
          "data: [DONE]\n",
        ]),
      ),
    );
    const res = await p.chat(
      { messages: MSGS },
      { onToken: (d) => tokens.push(d) },
    );
    expect(tokens).toEqual(["Xin ", "chào"]);
    expect(res.content).toBe("Xin chào");
  });
});
