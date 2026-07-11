import { describe, it, expect } from "vitest";
import {
  getSelectedModels,
  setSelectedModels,
  type StoreLike,
} from "../../src/main/services/ai-runtime/model-selection";

function fakeStore(
  initial: Record<string, unknown> = {},
): StoreLike & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    get: (k) => data[k],
    set: (k, v) => {
      data[k] = v;
    },
  };
}

describe("model-selection", () => {
  it("thiếu → {chatModel:null, embeddingModel:null}", () => {
    expect(getSelectedModels(fakeStore())).toEqual({
      chatModel: null,
      embeddingModel: null,
    });
  });

  it("đọc đúng lựa chọn đã lưu", () => {
    const s = fakeStore({
      "ai.modelSelection": {
        chatModel: "qwen2.5:7b",
        embeddingModel: "nomic-embed-text",
      },
    });
    expect(getSelectedModels(s)).toEqual({
      chatModel: "qwen2.5:7b",
      embeddingModel: "nomic-embed-text",
    });
  });

  it("giá trị hỏng (không phải object / sai kiểu) → null", () => {
    expect(
      getSelectedModels(fakeStore({ "ai.modelSelection": "bad" })),
    ).toEqual({
      chatModel: null,
      embeddingModel: null,
    });
    expect(
      getSelectedModels(fakeStore({ "ai.modelSelection": { chatModel: 123 } })),
    ).toEqual({ chatModel: null, embeddingModel: null });
  });

  it("set lưu + get lại đúng (idempotent)", () => {
    const s = fakeStore();
    const sel = {
      chatModel: "llama3.1:8b",
      embeddingModel: "nomic-embed-text",
    };
    expect(setSelectedModels(s, sel)).toEqual(sel);
    expect(getSelectedModels(s)).toEqual(sel);
  });

  it("input xấu (quá dài / ký tự lạ) → null (validate boundary, chống DoS store)", () => {
    const s = fakeStore();
    const bad = setSelectedModels(s, {
      chatModel: "A".repeat(50_000),
      embeddingModel: "x; rm -rf /",
    });
    expect(bad).toEqual({ chatModel: null, embeddingModel: null });
    // đọc lại store đã bị chuẩn hoá về null, không lưu chuỗi khổng lồ
    expect(getSelectedModels(s)).toEqual({
      chatModel: null,
      embeddingModel: null,
    });
  });

  it("tên model Ollama hợp lệ (name:tag, path) được giữ", () => {
    const s = fakeStore();
    const sel = { chatModel: "qwen2.5:7b", embeddingModel: "nomic-embed-text" };
    expect(setSelectedModels(s, sel)).toEqual(sel);
  });

  it("store.set ném → không throw, vẫn trả lựa chọn", () => {
    const bad: StoreLike = {
      get: () => undefined,
      set: () => {
        throw new Error("ENOSPC");
      },
    };
    const sel = { chatModel: "m", embeddingModel: "e" };
    expect(() => setSelectedModels(bad, sel)).not.toThrow();
    expect(setSelectedModels(bad, sel)).toEqual(sel);
  });
});
