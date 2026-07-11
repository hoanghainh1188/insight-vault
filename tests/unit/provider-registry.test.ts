import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../../src/main/services/ai-runtime/registry";
import type { LLMProvider } from "../../src/main/services/ai-runtime/provider";

function fakeProvider(id: string, answer: string): LLMProvider {
  return {
    id,
    chat: async () => ({ content: answer }),
    embed: async () => ({ vector: [] }),
    test: async () => ({ reachable: true, ollamaReady: true, reason: null }),
  };
}

describe("ProviderRegistry", () => {
  it("provider đầu tiên tự thành active", () => {
    const r = new ProviderRegistry();
    r.register(fakeProvider("ollama", "local"));
    expect(r.getActive().id).toBe("ollama");
  });

  it("getActive ném khi chưa đăng ký", () => {
    expect(() => new ProviderRegistry().getActive()).toThrow();
  });

  it("setActive chuyển provider — nơi gọi AI dùng cùng interface (SC-006)", async () => {
    const r = new ProviderRegistry();
    r.register(fakeProvider("ollama", "local"));
    r.register(fakeProvider("mock-online", "online"));
    // Nơi gọi AI KHÔNG đổi: luôn r.getActive().chat(...)
    expect((await r.getActive().chat({ messages: [] })).content).toBe("local");
    r.setActive("mock-online");
    expect((await r.getActive().chat({ messages: [] })).content).toBe("online");
  });

  it("setActive ném khi provider chưa đăng ký", () => {
    const r = new ProviderRegistry();
    r.register(fakeProvider("ollama", "x"));
    expect(() => r.setActive("khong-co")).toThrow();
  });
});
