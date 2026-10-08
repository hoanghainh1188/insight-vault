import { describe, it, expect } from "vitest";
import {
  parseAiTarget,
  pickProvider,
  rethrowForIpc,
} from "../../src/main/services/ai-runtime/ai-target";
import { OnlineProviderError } from "../../src/main/services/ai-runtime/online/online-error";
import { parseIpcError } from "../../src/shared/online-error-tag";

// 098 — chọn đích AI theo lượt: mặc định provider đang bật; "local" = Ollama cho MỌI lệnh LLM của lượt đó.

describe("parseAiTarget", () => {
  it("thiếu / 'active' ⇒ active; 'local' ⇒ local", () => {
    expect(parseAiTarget({})).toBe("active");
    expect(parseAiTarget({ target: "active" })).toBe("active");
    expect(parseAiTarget({ target: "local" })).toBe("local");
    expect(parseAiTarget(null)).toBe("active");
  });

  it("giá trị lạ ⇒ ném (đầu vào renderer không tin cậy)", () => {
    expect(() => parseAiTarget({ target: "openai" })).toThrow();
    expect(() => parseAiTarget({ target: 1 })).toThrow();
  });
});

describe("rethrowForIpc", () => {
  it("OnlineProviderError ⇒ Error có thẻ loại lỗi (renderer tách được)", () => {
    let thrown: unknown;
    try {
      rethrowForIpc(
        new OnlineProviderError("Gemini: hết thời gian chờ.", "timeout"),
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(
      parseIpcError(
        `Error invoking remote method 'rag:askStream': Error: ${(thrown as Error).message}`,
      ),
    ).toEqual({
      message: "Gemini: hết thời gian chờ.",
      onlineKind: "timeout",
      provider: "Gemini",
    });
  });

  it("lỗi khác ⇒ ném lại nguyên vẹn", () => {
    const e = new RangeError("x");
    expect(() => rethrowForIpc(e)).toThrow(e);
  });
});

describe("pickProvider", () => {
  const ollama = { id: "ollama" };
  const online = { id: "anthropic" };
  const registry = {
    getActive: () => online,
    get: (id: string) => {
      if (id !== "ollama") throw new Error("x");
      return ollama;
    },
  };

  it("local ⇒ LUÔN Ollama dù provider online đang bật (không lệnh nào ra ngoài)", () => {
    expect(pickProvider(registry, "local")).toBe(ollama);
  });
  it("active ⇒ provider đang bật (đọc lúc gọi)", () => {
    expect(pickProvider(registry, "active")).toBe(online);
  });
});
