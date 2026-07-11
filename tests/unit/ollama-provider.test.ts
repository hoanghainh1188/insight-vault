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
    ...over,
  };
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
    expect(client.chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "qwen2.5:7b" }),
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
});
