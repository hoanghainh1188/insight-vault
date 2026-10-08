import { describe, it, expect } from "vitest";
import { computeRuntimeStatus } from "../../src/main/services/ai-runtime/runtime-status";
import type { OllamaClient } from "../../src/main/services/ai-runtime/ollama-client";
import type { Model, ModelSelection } from "../../src/shared/ipc/types";

function client(opts: { reachable: boolean; models?: string[] }): OllamaClient {
  return {
    ping: async () => opts.reachable,
    listModels: async () =>
      (opts.models ?? []).map((name): Model => ({
        name,
        sizeBytes: null,
        kind: "chat",
      })),
    chat: async () => ({ content: "" }),
    embed: async () => ({ vector: [] }),
    contextLength: async () => null,
  };
}

const sel = (c: string | null, e: string | null): ModelSelection => ({
  chatModel: c,
  embeddingModel: e,
});

describe("runtime-status", () => {
  it("Ollama không kết nối → not reachable, not ready", async () => {
    const s = await computeRuntimeStatus(
      client({ reachable: false }),
      sel("a", "b"),
    );
    expect(s.reachable).toBe(false);
    expect(s.ollamaReady).toBe(false);
    expect(s.reason).toMatch(/không kết nối/i);
  });

  it("kết nối nhưng chưa chọn mô hình trả lời → not ready", async () => {
    const s = await computeRuntimeStatus(
      client({ reachable: true, models: ["a", "b"] }),
      sel(null, null),
    );
    expect(s.reachable).toBe(true);
    expect(s.ollamaReady).toBe(false);
    expect(s.reason).toMatch(/chưa chọn mô hình trả lời/i);
    expect(s.reason).not.toMatch(/embedding/i);
  });

  it("#124: chỉ cần mô hình trả lời — embedding chạy trong app (059), không bắt chọn/cài model embedding Ollama", async () => {
    const s = await computeRuntimeStatus(
      client({ reachable: true, models: ["qwen2.5:7b"] }),
      sel("qwen2.5:7b", null),
    );
    expect(s.ollamaReady).toBe(true);
    expect(s.reason).toBeNull();
    // embeddingModel cũ (trước 059) đã gỡ khỏi Ollama ⇒ vẫn sẵn sàng.
    const old = await computeRuntimeStatus(
      client({ reachable: true, models: ["qwen2.5:7b"] }),
      sel("qwen2.5:7b", "nomic-embed-text"),
    );
    expect(old.ollamaReady).toBe(true);
  });

  it("mô hình trả lời đã chọn không có trên máy → not ready, nêu tên", async () => {
    const s = await computeRuntimeStatus(
      client({ reachable: true, models: ["a"] }),
      sel("missing", null),
    );
    expect(s.ollamaReady).toBe(false);
    expect(s.reason).toContain("missing");
  });

  it("kết nối + model đủ + tồn tại → ready", async () => {
    const s = await computeRuntimeStatus(
      client({ reachable: true, models: ["chat", "emb"] }),
      sel("chat", "emb"),
    );
    expect(s.ollamaReady).toBe(true);
    expect(s.reason).toBeNull();
  });
});
