import { describe, it, expect, vi } from "vitest";
import {
  createOllamaClient,
  inferKind,
  resolveBaseUrl,
  DEFAULT_OLLAMA_URL,
} from "../../src/main/services/ai-runtime/ollama-client";

// fetch giả trả về Response-like tối thiểu.
function fakeFetch(
  handler: (url: string, init?: RequestInit) => unknown,
  ok = true,
  status = 200,
) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = handler(url, init);
    return { ok, status, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("ollama-client", () => {
  it("inferKind: tên chứa 'embed' → embedding, còn lại → chat", () => {
    expect(inferKind("nomic-embed-text")).toBe("embedding");
    expect(inferKind("qwen2.5:7b")).toBe("chat");
  });

  it("listModels parse /api/tags → Model[]", async () => {
    const c = createOllamaClient({
      fetchFn: fakeFetch(() => ({
        models: [
          { name: "qwen2.5:7b", size: 4700000000 },
          { name: "nomic-embed-text", size: 274000000 },
        ],
      })),
    });
    const models = await c.listModels();
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({ name: "qwen2.5:7b", kind: "chat" });
    expect(models[1].kind).toBe("embedding");
  });

  it("listModels khi fetch ném → [] (không throw)", async () => {
    const c = createOllamaClient({
      fetchFn: vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    expect(await c.listModels()).toEqual([]);
  });

  it("ping true khi ok; false khi ném", async () => {
    const ok = createOllamaClient({ fetchFn: fakeFetch(() => ({})) });
    expect(await ok.ping()).toBe(true);
    const down = createOllamaClient({
      fetchFn: vi.fn(async () => {
        throw new Error("down");
      }) as unknown as typeof fetch,
    });
    expect(await down.ping()).toBe(false);
  });

  it("chat parse message.content", async () => {
    const c = createOllamaClient({
      fetchFn: fakeFetch(() => ({ message: { content: "xin chào" } })),
    });
    expect(
      await c.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).toEqual({
      content: "xin chào",
    });
  });

  it("embed parse embedding vector", async () => {
    const c = createOllamaClient({
      fetchFn: fakeFetch(() => ({ embedding: [0.1, 0.2, 0.3] })),
    });
    expect(await c.embed({ text: "abc" })).toEqual({ vector: [0.1, 0.2, 0.3] });
  });

  it("chat/embed ném khi res.ok=false (Ollama trả lỗi)", async () => {
    const c = createOllamaClient({
      fetchFn: fakeFetch(() => ({}), false, 500),
    });
    await expect(
      c.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/chat/i);
    await expect(c.embed({ text: "abc" })).rejects.toThrow(/embed/i);
  });

  it("chat/embed ném khi fetch reject (abort/timeout / mất kết nối)", async () => {
    const c = createOllamaClient({
      fetchFn: vi.fn(async () => {
        throw new Error("AbortError");
      }) as unknown as typeof fetch,
    });
    await expect(c.chat({ messages: [] })).rejects.toThrow();
    await expect(c.embed({ text: "x" })).rejects.toThrow();
  });
});

describe("resolveBaseUrl (Constitution I: chỉ localhost)", () => {
  it("localhost / 127.0.0.1 (mọi port) được chấp nhận", () => {
    expect(resolveBaseUrl("http://localhost:11434").url).toBe(
      "http://localhost:11434",
    );
    expect(resolveBaseUrl("http://127.0.0.1:1").url).toBe("http://127.0.0.1:1");
    expect(resolveBaseUrl("http://127.0.0.1:11434").warning).toBeNull();
  });

  it("host ngoài localhost → fallback default + warning", () => {
    const r = resolveBaseUrl("http://evil.example.com:11434");
    expect(r.url).toBe(DEFAULT_OLLAMA_URL);
    expect(r.warning).toMatch(/localhost/i);
  });

  it("URL không hợp lệ → fallback default", () => {
    expect(resolveBaseUrl("not a url").url).toBe(DEFAULT_OLLAMA_URL);
  });

  it("không set env → default, không warning", () => {
    expect(resolveBaseUrl(undefined)).toEqual({
      url: DEFAULT_OLLAMA_URL,
      warning: null,
    });
  });

  it("explicit baseUrl ưu tiên hơn env", () => {
    expect(resolveBaseUrl("http://localhost:1", "http://127.0.0.1:2").url).toBe(
      "http://127.0.0.1:2",
    );
  });
});
