import { describe, it, expect } from "vitest";
import {
  CHARS_PER_TOKEN,
  MIN_BUDGET_CHARS,
  OLLAMA_MAX_NUM_CTX,
  ONLINE_MAX_CHARS,
  budgetForTokens,
  numCtxFor,
  parseOllamaContextLength,
  studioContextFor,
} from "../../src/main/services/studio/context-window";
import { STUDIO_CONTEXT_BUDGET } from "../../src/main/services/studio/constants";

// 105 — ngân sách Studio theo cửa sổ ngữ cảnh THẬT của model (ADR studio-large-clarify).

describe("numCtxFor", () => {
  it("lấy cửa sổ của model, có trần RAM; không biết ⇒ null", () => {
    expect(numCtxFor(8192)).toBe(8192);
    expect(numCtxFor(131072)).toBe(OLLAMA_MAX_NUM_CTX);
    expect(numCtxFor(null)).toBeNull();
    expect(numCtxFor(0)).toBeNull();
  });
});

describe("budgetForTokens", () => {
  it("không biết cửa sổ ⇒ ngân sách cũ (16.000)", () => {
    expect(budgetForTokens(null)).toBe(STUDIO_CONTEXT_BUDGET);
  });

  it("trừ dự phòng câu trả lời + system prompt rồi nhân hệ số ký tự/token", () => {
    const b = budgetForTokens(32768);
    expect(b).toBeGreaterThan(STUDIO_CONTEXT_BUDGET);
    expect(b).toBeLessThan(32768 * CHARS_PER_TOKEN);
  });

  it("cửa sổ nhỏ ⇒ ngân sách nhỏ (không vượt cửa sổ), nhưng không dưới mức sàn", () => {
    expect(budgetForTokens(4096)).toBeLessThan(STUDIO_CONTEXT_BUDGET);
    expect(budgetForTokens(1024)).toBe(MIN_BUDGET_CHARS);
  });

  it("có trần ký tự (online: chi phí/độ trễ trên key người dùng)", () => {
    expect(budgetForTokens(1_000_000, ONLINE_MAX_CHARS)).toBe(ONLINE_MAX_CHARS);
  });
});

describe("parseOllamaContextLength", () => {
  it("đọc '<arch>.context_length' trong model_info của /api/show", () => {
    expect(
      parseOllamaContextLength({
        model_info: {
          "general.architecture": "qwen2",
          "qwen2.context_length": 32768,
        },
      }),
    ).toBe(32768);
  });
  it("thiếu / sai hình ⇒ null", () => {
    expect(parseOllamaContextLength({})).toBeNull();
    expect(parseOllamaContextLength(null)).toBeNull();
    expect(
      parseOllamaContextLength({ model_info: { "x.context_length": "abc" } }),
    ).toBeNull();
  });
});

describe("studioContextFor", () => {
  it("Ollama: num_ctx theo model (có trần) + ngân sách theo num_ctx đó", () => {
    expect(studioContextFor("ollama", 131072)).toEqual({
      numCtx: OLLAMA_MAX_NUM_CTX,
      budget: budgetForTokens(OLLAMA_MAX_NUM_CTX),
    });
  });
  it("online: không ép num_ctx, ngân sách có trần ký tự", () => {
    expect(studioContextFor("anthropic", 200_000)).toEqual({
      numCtx: null,
      budget: ONLINE_MAX_CHARS,
    });
  });
  it("không biết cửa sổ ⇒ 16.000, không ép num_ctx", () => {
    expect(studioContextFor("ollama", null)).toEqual({
      numCtx: null,
      budget: STUDIO_CONTEXT_BUDGET,
    });
  });
});
