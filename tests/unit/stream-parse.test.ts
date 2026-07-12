import { describe, it, expect } from "vitest";
import {
  parseOllamaLine,
  sseData,
  sseDeltaOpenAI,
  sseDeltaAnthropic,
  sseDeltaGemini,
} from "../../src/main/services/ai-runtime/online/stream-parse";

describe("parseOllamaLine (039)", () => {
  it("dòng có content → delta; done/không content/rác → null", () => {
    expect(parseOllamaLine('{"message":{"content":"xin "},"done":false}')).toBe(
      "xin ",
    );
    expect(parseOllamaLine('{"done":true}')).toBeNull();
    expect(parseOllamaLine('{"message":{"content":""}}')).toBeNull();
    expect(parseOllamaLine("không phải json")).toBeNull();
    expect(parseOllamaLine("")).toBeNull();
  });
});

describe("sseData (039)", () => {
  it("bóc payload sau data:; dòng khác → null", () => {
    expect(sseData('data: {"a":1}')).toBe('{"a":1}');
    expect(sseData("data: [DONE]")).toBe("[DONE]");
    expect(sseData("event: message_start")).toBeNull();
    expect(sseData("")).toBeNull();
    expect(sseData(": comment")).toBeNull();
  });
});

describe("sseDeltaOpenAI (039)", () => {
  it("delta.content; [DONE]/rỗng/rác → null", () => {
    expect(sseDeltaOpenAI('{"choices":[{"delta":{"content":"Hi"}}]}')).toBe(
      "Hi",
    );
    expect(sseDeltaOpenAI("[DONE]")).toBeNull();
    expect(sseDeltaOpenAI('{"choices":[{"delta":{}}]}')).toBeNull();
    expect(sseDeltaOpenAI("")).toBeNull();
  });
});

describe("sseDeltaAnthropic (039)", () => {
  it("chỉ content_block_delta có text; event khác → null", () => {
    expect(
      sseDeltaAnthropic(
        '{"type":"content_block_delta","delta":{"type":"text_delta","text":"abc"}}',
      ),
    ).toBe("abc");
    expect(sseDeltaAnthropic('{"type":"message_start"}')).toBeNull();
    expect(sseDeltaAnthropic('{"type":"ping"}')).toBeNull();
  });
});

describe("sseDeltaGemini (039)", () => {
  it("nối parts.text; candidates rỗng → null", () => {
    expect(
      sseDeltaGemini(
        '{"candidates":[{"content":{"parts":[{"text":"a"},{"text":"b"}]}}]}',
      ),
    ).toBe("ab");
    expect(sseDeltaGemini('{"candidates":[]}')).toBeNull();
    expect(sseDeltaGemini("{}")).toBeNull();
  });
});
