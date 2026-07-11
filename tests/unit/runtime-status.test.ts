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

  it("kết nối nhưng chưa chọn đủ model → not ready", async () => {
    const s = await computeRuntimeStatus(
      client({ reachable: true, models: ["a", "b"] }),
      sel("a", null),
    );
    expect(s.reachable).toBe(true);
    expect(s.ollamaReady).toBe(false);
    expect(s.reason).toMatch(/chưa chọn/i);
  });

  it("model đã chọn không có trên máy → not ready, nêu model thiếu", async () => {
    const s = await computeRuntimeStatus(
      client({ reachable: true, models: ["a"] }),
      sel("a", "missing"),
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
