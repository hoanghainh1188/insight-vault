import { describe, it, expect, vi } from "vitest";
import { OllamaProvider } from "../../src/main/services/ai-runtime/ollama-provider";
import type { OllamaClient } from "../../src/main/services/ai-runtime/ollama-client";
import type { ModelSelection } from "../../src/shared/ipc/types";

function makeClient(over: Partial<OllamaClient> = {}): OllamaClient {
  return {
    ping: async () => true,
    listModels: async () => [],
    chat: vi.fn(async () => ({ content: "trả lời" })),
    embed: vi.fn(async () => ({ vector: [1, 2, 3] })),
    contextLength: vi.fn(async () => 32768),
    ...over,
  } as OllamaClient;
}

const sel = (over: Partial<ModelSelection> = {}): ModelSelection => ({
  chatModel: "qwen2.5:7b",
  embeddingModel: "nomic-embed-text",
  ...over,
});

describe("OllamaProvider", () => {
  it("chat dùng chatModel đã chọn khi req không nêu model", async () => {
    const client = makeClient();
    const p = new OllamaProvider(client, () => sel());
    const res = await p.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(res.content).toBe("trả lời");
    // 039: chat nhận thêm opts (undefined khi không stream).
    expect(client.chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "qwen2.5:7b" }),
      undefined,
    );
  });

  it("embed dùng embeddingModel đã chọn", async () => {
    const client = makeClient();
    const p = new OllamaProvider(client, () => sel());
    const res = await p.embed({ text: "abc" });
    expect(res.vector).toEqual([1, 2, 3]);
    expect(client.embed).toHaveBeenCalledWith(
      expect.objectContaining({ model: "nomic-embed-text" }),
    );
  });

  it("chat ném khi chưa chọn chat model", async () => {
    const p = new OllamaProvider(makeClient(), () => sel({ chatModel: null }));
    await expect(
      p.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/chat model/i);
  });

  it("test() báo chưa sẵn sàng khi model đã chọn không tồn tại", async () => {
    const client = makeClient({ listModels: async () => [] });
    const p = new OllamaProvider(client, () => sel());
    const status = await p.test();
    expect(status.ollamaReady).toBe(false);
  });

  it("id là 'ollama'", () => {
    expect(new OllamaProvider(makeClient(), () => sel()).id).toBe("ollama");
  });

  it("105: contextTokens đọc cửa sổ model đang chọn, nhớ theo tên model", async () => {
    const client = makeClient();
    let selection = sel();
    const p = new OllamaProvider(client, () => selection);
    expect(await p.contextTokens()).toBe(32768);
    expect(await p.contextTokens()).toBe(32768);
    expect(client.contextLength).toHaveBeenCalledTimes(1);
    selection = sel({ chatModel: "llama3.1:8b" });
    await p.contextTokens();
    expect(client.contextLength).toHaveBeenCalledTimes(2);
    selection = sel({ chatModel: null as unknown as string });
    expect(await p.contextTokens()).toBeNull();
  });

  it("105: không đọc được cửa sổ (Ollama chưa chạy) ⇒ KHÔNG nhớ null, lần sau đọc lại", async () => {
    const contextLength = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(8192);
    const p = new OllamaProvider(makeClient({ contextLength }), () => sel());
    expect(await p.contextTokens()).toBeNull();
    expect(await p.contextTokens()).toBe(8192);
  });
});
