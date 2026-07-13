import { describe, it, expect } from "vitest";
import { checkOllama } from "../../src/main/services/ai/ollama-health";

describe("checkOllama", () => {
  it("đang chạy + model đã pull → running/modelPulled true", async () => {
    const h = await checkOllama({
      ping: async () => true,
      listModels: async () => [{ name: "qwen2.5:7b" }, { name: "llama3.1:8b" }],
      selectedChatModel: () => "qwen2.5:7b",
    });
    expect(h.running).toBe(true);
    expect(h.models).toEqual(["qwen2.5:7b", "llama3.1:8b"]);
    expect(h.modelPulled).toBe(true);
  });

  it("đang chạy nhưng model đang chọn CHƯA pull → modelPulled false", async () => {
    const h = await checkOllama({
      ping: async () => true,
      listModels: async () => [{ name: "llama3.1:8b" }],
      selectedChatModel: () => "qwen2.5:7b",
    });
    expect(h.running).toBe(true);
    expect(h.modelPulled).toBe(false);
  });

  it("Ollama chưa chạy → running false, không liệt kê model", async () => {
    let listed = false;
    const h = await checkOllama({
      ping: async () => false,
      listModels: async () => {
        listed = true;
        return [{ name: "x" }];
      },
      selectedChatModel: () => "x",
    });
    expect(h.running).toBe(false);
    expect(h.models).toEqual([]);
    expect(h.modelPulled).toBe(false);
    expect(listed).toBe(false); // không gọi listModels khi không chạy
  });

  it("không có model đang chọn → modelPulled false", async () => {
    const h = await checkOllama({
      ping: async () => true,
      listModels: async () => [{ name: "a" }],
      selectedChatModel: () => undefined,
    });
    expect(h.modelPulled).toBe(false);
  });
});
