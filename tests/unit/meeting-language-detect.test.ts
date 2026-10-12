import { describe, it, expect } from "vitest";
import {
  pickLanguage,
  resolveFinalLanguage,
} from "../../src/main/services/meeting-capture/language-detect";

// 186 — phát hiện ngôn ngữ một bước decoder (ADR spike S2): chọn giữa <|vi|>/<|en|> theo logits, softmax trên 2 token.
// Bản chốt KHÔNG BAO GIỜ để Whisper tự chọn (transformers.js mặc định tiếng Anh ⇒ transcript tiếng Việt thành rác).

describe("pickLanguage", () => {
  it("logit vi lớn hơn ⇒ vi, độ tin cậy = softmax", () => {
    const r = pickLanguage(5, 3);
    expect(r?.language).toBe("vi");
    expect(r?.confidence).toBeCloseTo(1 / (1 + Math.exp(-2)), 6);
  });

  it("logit en lớn hơn ⇒ en", () => {
    expect(pickLanguage(-1, 4)).toMatchObject({ language: "en" });
  });

  it("bằng nhau ⇒ vi, độ tin cậy 0,5 (ngôn ngữ nguồn của app)", () => {
    expect(pickLanguage(2, 2)).toEqual({ language: "vi", confidence: 0.5 });
  });

  it("chênh lệch rất lớn không tràn số", () => {
    expect(pickLanguage(1e4, -1e4)).toEqual({ language: "vi", confidence: 1 });
    expect(pickLanguage(-1e4, 1e4)).toEqual({ language: "en", confidence: 1 });
  });

  it.each([
    [Number.NaN, 1],
    [1, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, 0],
  ])("logit không hữu hạn (%s, %s) ⇒ null", (a, b) => {
    expect(pickLanguage(a, b)).toBeNull();
  });
});

describe("resolveFinalLanguage", () => {
  it("chế độ khoá vi/en ⇒ dùng đúng chế độ, bỏ qua kết quả phát hiện", () => {
    expect(resolveFinalLanguage("vi", "en")).toBe("vi");
    expect(resolveFinalLanguage("en", null)).toBe("en");
  });

  it("auto/multi ⇒ ngôn ngữ đã phát hiện, chưa có thì null", () => {
    expect(resolveFinalLanguage("auto", "en")).toBe("en");
    expect(resolveFinalLanguage("multi", "vi")).toBe("vi");
    expect(resolveFinalLanguage("auto", null)).toBeNull();
  });
});
