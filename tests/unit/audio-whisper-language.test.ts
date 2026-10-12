import { describe, it, expect } from "vitest";
import {
  LANG_DETECT_WINDOW_SEC,
  asrLanguageOptions,
  detectionWindow,
  pickLanguage,
  probVietnamese,
  requireTokenId,
} from "../../src/main/services/ingestion/audio/whisper-language";

// 194 — phần THUẦN của phát hiện ngôn ngữ một bước decoder {vi, en} (spike S2 #186).

const VOCAB = 6;
const IDS = { vi: 2, en: 4 };

/** logits [1, steps, VOCAB] — mọi ô = 0 trừ các ô đặt ở bước CUỐI. */
function logits(steps: number, last: Record<number, number>): Float32Array {
  const data = new Float32Array(steps * VOCAB);
  for (const [id, v] of Object.entries(last))
    data[(steps - 1) * VOCAB + Number(id)] = v;
  return data;
}

describe("probVietnamese (194)", () => {
  it("logit <|vi|> lớn hơn ⇒ P(vi) > 0,5", () => {
    const p = probVietnamese(logits(1, { 2: 5, 4: 1 }), [1, 1, VOCAB], IDS);
    expect(p).toBeCloseTo(1 / (1 + Math.exp(-4)), 6);
  });

  it("logit <|en|> lớn hơn ⇒ P(vi) < 0,5", () => {
    const p = probVietnamese(logits(1, { 2: -3, 4: 2 }), [1, 1, VOCAB], IDS);
    expect(p).toBeCloseTo(1 / (1 + Math.exp(5)), 6);
  });

  it("bằng nhau ⇒ 0,5", () => {
    expect(probVietnamese(logits(1, { 2: 7, 4: 7 }), [1, 1, VOCAB], IDS)).toBe(
      0.5,
    );
  });

  it("chỉ đọc vị trí CUỐI khi có nhiều bước", () => {
    const data = logits(3, { 2: 0, 4: 9 });
    data[0 * VOCAB + 2] = 100; // bước đầu nghiêng vi — phải bị bỏ qua
    expect(probVietnamese(data, [1, 3, VOCAB], IDS)).toBeLessThan(0.01);
  });

  it("chênh lệch rất lớn không tràn số (ổn định số học)", () => {
    expect(
      probVietnamese(logits(1, { 2: 1e4, 4: -1e4 }), [1, 1, VOCAB], IDS),
    ).toBe(1);
    expect(
      probVietnamese(logits(1, { 2: -1e4, 4: 1e4 }), [1, 1, VOCAB], IDS),
    ).toBe(0);
  });

  it("dims sai hình dạng ⇒ lỗi rõ ràng", () => {
    expect(() => probVietnamese(new Float32Array(6), [6], IDS)).toThrow(
      /logits/,
    );
  });

  it("id token ngoài vocab ⇒ lỗi", () => {
    expect(() =>
      probVietnamese(logits(1, {}), [1, 1, VOCAB], { vi: 2, en: VOCAB }),
    ).toThrow(/vocab/);
  });

  it("logit không hữu hạn (NaN) ⇒ lỗi, không đoán bừa", () => {
    expect(() =>
      probVietnamese(logits(1, { 2: Number.NaN, 4: 1 }), [1, 1, VOCAB], IDS),
    ).toThrow(/finite/);
  });
});

describe("pickLanguage (194)", () => {
  it("P(vi) ≥ 0,5 ⇒ vi, ngược lại en", () => {
    expect(pickLanguage(0.5)).toBe("vi");
    expect(pickLanguage(0.97)).toBe("vi");
    expect(pickLanguage(0.49)).toBe("en");
    expect(pickLanguage(0)).toBe("en");
  });
});

describe("requireTokenId (194)", () => {
  it("số nguyên không âm ⇒ trả nguyên", () => {
    expect(requireTokenId(50259, "<|en|>")).toBe(50259);
    expect(requireTokenId(0, "<|x|>")).toBe(0);
  });

  it.each([undefined, null, -1, 1.5, "50259", Number.NaN])(
    "%s ⇒ lỗi nêu tên token",
    (v) => {
      expect(() => requireTokenId(v, "<|vi|>")).toThrow(/<\|vi\|>/);
    },
  );
});

describe("detectionWindow (194)", () => {
  it("cắt đúng 30 s đầu ở 16 kHz", () => {
    const pcm = new Float32Array(16000 * 45).map((_, i) => i);
    const w = detectionWindow(pcm);
    expect(w.length).toBe(16000 * LANG_DETECT_WINDOW_SEC);
    expect(w[0]).toBe(0);
    expect(w[w.length - 1]).toBe(16000 * 30 - 1);
  });

  it("audio ngắn hơn cửa sổ ⇒ giữ nguyên độ dài", () => {
    const pcm = new Float32Array(16000 * 4);
    expect(detectionWindow(pcm).length).toBe(16000 * 4);
  });
});

describe("asrLanguageOptions (194)", () => {
  it("map mã ngôn ngữ ⇒ tên Whisper + task transcribe", () => {
    expect(asrLanguageOptions("vi")).toEqual({
      language: "vietnamese",
      task: "transcribe",
    });
    expect(asrLanguageOptions("en")).toEqual({
      language: "english",
      task: "transcribe",
    });
  });
});
