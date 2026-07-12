import { describe, it, expect } from "vitest";
import {
  getOnlineConfig,
  setOnlineConfig,
  validOnlineModel,
} from "../../src/main/services/ai-runtime/online/online-config";
import type { StoreLike } from "../../src/main/services/ai-runtime/model-selection";

function fakeStore(
  initial?: unknown,
): StoreLike & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  if (initial !== undefined) data.set("ai.onlineConfig", initial);
  return {
    data,
    get: (k) => data.get(k),
    set: (k, v) => void data.set(k, v),
  };
}

describe("online-config (031)", () => {
  it("store rỗng → default (activeOnlineId=null, models null)", () => {
    const c = getOnlineConfig(fakeStore());
    expect(c.activeOnlineId).toBeNull();
    expect(c.models).toEqual({
      anthropic: null,
      gemini: null,
      openai: null,
    });
  });

  it("activeOnlineId lạ → null; hợp lệ → giữ", () => {
    expect(
      getOnlineConfig(fakeStore({ activeOnlineId: "hacker" })).activeOnlineId,
    ).toBeNull();
    expect(
      getOnlineConfig(fakeStore({ activeOnlineId: "openai" })).activeOnlineId,
    ).toBe("openai");
  });

  it("validate model: hợp lệ giữ, rác → null", () => {
    expect(validOnlineModel("claude-opus-4-5")).toBe("claude-opus-4-5");
    expect(validOnlineModel("gpt-4o")).toBe("gpt-4o");
    expect(validOnlineModel("a".repeat(500))).toBeNull();
    expect(validOnlineModel("bad name!")).toBeNull();
    expect(validOnlineModel(123)).toBeNull();
  });

  it("normalize models: chỉ giữ 3 provider hợp lệ", () => {
    const c = getOnlineConfig(
      fakeStore({
        activeOnlineId: "anthropic",
        models: { anthropic: "claude-opus-4-5", openai: "x!", evil: "y" },
      }),
    );
    expect(c.models.anthropic).toBe("claude-opus-4-5");
    expect(c.models.openai).toBeNull();
    expect((c.models as Record<string, unknown>)["evil"]).toBeUndefined();
  });

  it("setOnlineConfig ghi bản đã chuẩn hoá", () => {
    const store = fakeStore();
    setOnlineConfig(store, {
      activeOnlineId: "gemini",
      models: { anthropic: null, gemini: "gemini-2.5-pro", openai: null },
    });
    const back = getOnlineConfig(store);
    expect(back.activeOnlineId).toBe("gemini");
    expect(back.models.gemini).toBe("gemini-2.5-pro");
  });
});
