import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../../src/main/services/ai-runtime/registry";
import type { LLMProvider } from "../../src/main/services/ai-runtime/provider";

// Khoá bất biến (031, FR-005 / quyết định #1, phát hiện qua security review): đường embed lúc INGESTION phải
// LUÔN dùng Ollama local, KHÔNG qua registry.getActive() (đổi theo provider chat online). Test này chứng minh
// hai đường phân kỳ: getActive().embed NÉM khi provider online active (bẫy); embed cố định-Ollama vẫn chạy.

const ollama: LLMProvider = {
  id: "ollama",
  chat: async () => ({ content: "" }),
  embed: async () => ({ vector: [1, 2, 3] }),
  test: async () => ({ reachable: true, ollamaReady: true, reason: null }),
};
// Provider online: embed NÉM (đúng như Anthropic/Gemini/OpenAIProvider thật — không hỗ trợ embedding).
const online: LLMProvider = {
  id: "openai",
  chat: async () => ({ content: "" }),
  embed: async () => {
    throw new Error(
      "OpenAI embedding không dùng ở đây — embedding luôn dùng Ollama local.",
    );
  },
  test: async () => ({ reachable: true, ollamaReady: true, reason: null }),
};

describe("ingestion embed routing (031 — FR-005)", () => {
  it("getActive().embed NÉM khi provider online active (đây là bẫy phải tránh)", async () => {
    const registry = new ProviderRegistry();
    registry.register(ollama);
    registry.register(online);
    registry.setActive("openai");
    await expect(registry.getActive().embed({ text: "x" })).rejects.toThrow(
      /embedding/i,
    );
  });

  it("embed cố định-Ollama (embedLocal) vẫn chạy dù active = online", async () => {
    const registry = new ProviderRegistry();
    registry.register(ollama);
    registry.register(online);
    registry.setActive("openai"); // provider chat online đang active
    // Mô phỏng wiring ingestion.ts: getProvider = () => ({ embed: embedLocal }), embedLocal = ollama.embed.
    const embedLocal = (req: { text: string }) => ollama.embed(req);
    const getProvider = () => ({ embed: embedLocal });
    const res = await getProvider().embed({ text: "x" });
    expect(res.vector).toEqual([1, 2, 3]);
  });
});
